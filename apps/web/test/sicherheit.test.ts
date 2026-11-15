import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pruefeAbrechnung } from "@biaticheck/pruefkern";
import { describe, expect, it } from "vitest";
import { G001 } from "../../../packages/pruefkern/test/golden/G-001";
import { erstelleFallAnsicht } from "@/server/ansicht";
import type { faelle } from "@/server/db/schema";
import { EnvSchema } from "@/server/env";
import { erstelleRatenbegrenzung } from "@/server/ratenbegrenzung";
import { lokalerSpeicher } from "@/server/speicher";
import { MAX_DATEIGROESSE, pruefeUpload } from "@/server/upload";
import { ermittleStatus } from "@/server/verarbeitung";
import { erzeugeZugang, pruefeZugang } from "@/server/zugang";

const SCHLUESSEL = Buffer.alloc(32, 7).toString("base64");
const PDF = new TextEncoder().encode("%PDF-1.7\nInhalt mit IBAN DE00 1234");

describe("Zugangstoken", () => {
  it("akzeptiert nur das passende Token", () => {
    const { token, hash } = erzeugeZugang();
    expect(token.length).toBeGreaterThanOrEqual(43);
    expect(hash).not.toContain(token);
    expect(pruefeZugang(token, hash)).toBe(true);
    expect(pruefeZugang(token.slice(0, -1) + "x", hash)).toBe(false);
    expect(pruefeZugang("", hash)).toBe(false);
    expect(pruefeZugang(null, hash)).toBe(false);
    expect(pruefeZugang("a".repeat(5000), hash)).toBe(false);
  });
});

describe("Dateispeicher", () => {
  const id = "11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222";

  it("verschlüsselt: auf der Platte steht kein Klartext, Laden liefert das Original", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "bck-"));
    const s = lokalerSpeicher(dir, SCHLUESSEL);
    await s.speichere(id, PDF);
    const roh = await readFile(path.join(dir, id));
    expect(roh.includes(Buffer.from("IBAN"))).toBe(false);
    expect(await s.lade(id)).toEqual(PDF);
  });

  it("erkennt manipulierte Dateien", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "bck-"));
    const s = lokalerSpeicher(dir, SCHLUESSEL);
    await s.speichere(id, PDF);
    const roh = await readFile(path.join(dir, id));
    roh[roh.length - 1] = roh[roh.length - 1]! ^ 0xff;
    await writeFile(path.join(dir, id), roh);
    await expect(s.lade(id)).rejects.toThrow();
  });

  it("verweigert unverschlüsselte Dateien, wenn Verschlüsselung aktiv ist", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "bck-"));
    await lokalerSpeicher(dir).speichere(id, PDF);
    await expect(lokalerSpeicher(dir, SCHLUESSEL).lade(id)).rejects.toThrow(/Unverschlüsselte Datei/);
  });

  it.each(["../../etc/passwd", "abc", `${"1".repeat(36)}/../x`, "/absolut"])("verhindert Pfadausbruch: %s", async (schluessel) => {
    const s = lokalerSpeicher(await mkdtemp(path.join(tmpdir(), "bck-")));
    await expect(s.speichere(schluessel, PDF)).rejects.toThrow(/Ungültiger Speicherschlüssel/);
  });
});

describe("Ratenbegrenzung", () => {
  it("lässt n Anfragen je Fenster zu", () => {
    let zeit = 0;
    const r = erstelleRatenbegrenzung(2, 1000, () => zeit);
    expect([r.erlaube("a"), r.erlaube("a"), r.erlaube("a"), r.erlaube("b")]).toEqual([true, true, false, true]);
    zeit = 1001;
    expect(r.erlaube("a")).toBe(true);
  });
});

describe("Upload-Prüfung", () => {
  const formular = (datei?: Blob, einwilligung = "ja") => {
    const f = new FormData();
    if (datei) f.set("datei", datei, "abrechnung.pdf");
    f.set("einwilligung", einwilligung);
    return f;
  };

  it("akzeptiert ein PDF mit Einwilligung", async () => {
    expect(await pruefeUpload(formular(new Blob([PDF])))).toMatchObject({ ok: true, mimeType: "application/pdf" });
  });
  it("verlangt Einwilligung", async () => {
    expect(await pruefeUpload(formular(new Blob([PDF]), "nein"))).toMatchObject({ ok: false, status: 400 });
  });
  it("verlangt eine Datei", async () => {
    expect(await pruefeUpload(formular())).toMatchObject({ ok: false, status: 400 });
  });
  it("lehnt getarnte Dateien ab (HTML mit .pdf-Endung)", async () => {
    expect(await pruefeUpload(formular(new Blob(["<html><script>alert(1)</script>"])))).toMatchObject({ ok: false, status: 415 });
  });
  it("lehnt zu große Dateien ab", async () => {
    expect(await pruefeUpload(formular(new Blob([new Uint8Array(MAX_DATEIGROESSE + 1)])))).toMatchObject({ ok: false, status: 413 });
  });
});

describe("Konfiguration", () => {
  const basis = { DATABASE_URL: "postgresql://x@localhost/db" };
  it("verlangt im Produktivbetrieb einen Dateischlüssel", () => {
    expect(EnvSchema.safeParse({ ...basis, NODE_ENV: "production" }).success).toBe(false);
    expect(EnvSchema.safeParse({ ...basis, NODE_ENV: "production", DATEI_SCHLUESSEL: SCHLUESSEL }).success).toBe(true);
  });
  it("lehnt zu kurze Schlüssel ab", () => {
    expect(EnvSchema.safeParse({ ...basis, DATEI_SCHLUESSEL: "kurz" }).success).toBe(false);
  });
  it("Freischaltung ohne Bezahlung: im Produktivbetrieb standardmäßig aus, nur mit ausdrücklicher Erlaubnis", () => {
    const prod = { ...basis, NODE_ENV: "production", DATEI_SCHLUESSEL: SCHLUESSEL };
    expect(EnvSchema.parse(prod).ZAHLUNG_MODUS).toBe("aus");
    expect(EnvSchema.parse(basis).ZAHLUNG_MODUS).toBe("test");
    expect(EnvSchema.safeParse({ ...prod, ZAHLUNG_MODUS: "test" }).success).toBe(false);
    expect(EnvSchema.parse({ ...prod, ZAHLUNG_MODUS: "test", ERLAUBE_TESTZAHLUNG: "true" }).ZAHLUNG_MODUS).toBe("test");
  });

  it("Demo-Auslesen ist im Produktivbetrieb verboten", () => {
    expect(EnvSchema.safeParse({ ...basis, NODE_ENV: "production", DATEI_SCHLUESSEL: SCHLUESSEL, DEMO_AUSLESEN: "true" }).success).toBe(false);
  });

  it("Freigabe durch Experten ist standardmäßig an", () => {
    expect(EnvSchema.parse(basis).FREIGABE_ERFORDERLICH).toBe(true);
  });
});

describe("Statusentscheidung", () => {
  it.each([
    [{ istNebenkostenabrechnung: false, konsistent: true, freigabeErforderlich: false }, "kein_nebenkostendokument"],
    [{ istNebenkostenabrechnung: true, konsistent: false, freigabeErforderlich: false }, "expertenpruefung"],
    [{ istNebenkostenabrechnung: true, konsistent: true, freigabeErforderlich: true }, "expertenpruefung"],
    [{ istNebenkostenabrechnung: true, konsistent: true, freigabeErforderlich: false }, "fertig"],
  ] as const)("%j → %s", (eingabe, status) => {
    expect(ermittleStatus(eingabe)).toBe(status);
  });
});

describe("Kundenansicht", () => {
  // Verspätet zugestellt: Nachzahlung entfällt → es gibt Punkte zu zeigen, also greift die Bezahlschranke
  const daten = { ...G001, meta: { ...G001.meta, zugangAm: "2026-01-15", zeitraumBestaetigt: true } };
  const bericht = pruefeAbrechnung(daten, { heute: "2026-10-29" });
  const fall = (status: (typeof faelle.$inferSelect)["status"], bezahltAm: Date | null = null) =>
    ({ id: "x", status, bericht, daten, erstelltAm: new Date(), zugangHash: "geheim", auslesung: null, bezahltAm }) as unknown as typeof faelle.$inferSelect;
  const ansicht = (f: typeof faelle.$inferSelect) => erstelleFallAnsicht(f, { zahlungModus: "test", heute: "2026-11-06" });

  it("zeigt vor der Freigabe durch Experten kein Ergebnis", () => {
    const a = ansicht(fall("expertenpruefung"));
    expect(a.stufe1).toBeUndefined();
    expect(a.stufe2).toBeUndefined();
  });

  it("ohne Zahlung: nur die Zusammenfassung – keine gefundenen Punkte, keine Schritte, kein Schreiben im Browser", () => {
    const a = ansicht(fall("fertig"));
    expect(a.stufe1?.fehlerpotenzial.sicher).toBe(1214.88);
    expect(a.preis).toBe(7.99);
    expect(a.stufe2).toBeUndefined();
    expect(a.fehler).toBeUndefined();
    expect(a.pruefbedarf).toBeUndefined();
    expect(a.hinweise).toBeUndefined();
    expect(a.unterlagen).toBeUndefined();
    // Die Erklärung zum Gesamtbetrag nennt vor der Zahlung keine einzelnen Punkte
    expect(a.stufe1!.erklaerungen.betrag).toBe("Das ist die Summe der Beträge aus den gefundenen Punkten. Die einzelnen Punkte sehen Sie nach dem Freischalten.");
    const json = JSON.stringify(a);
    expect(json).not.toContain("Abrechnung kam zu spät");
    expect(json).not.toContain("Satellitenanlage");
    expect(json).not.toContain("geheim");
    expect(json).not.toContain("kostenpositionen");
    for (const e of bericht.ergebnisse) {
      if (e.status === "ok") continue;
      expect(json).not.toContain(e.titel);
      expect(json).not.toContain(e.erklaerung);
      if (e.naechsterSchritt) expect(json).not.toContain(e.naechsterSchritt);
    }
  });

  it("die Bezahlschranke gilt auch bei kleinen Beträgen; nach der Zahlung sind Punkte und Unterlagen sichtbar", () => {
    const b = pruefeAbrechnung(G001, { heute: "2026-10-29" });
    const g001 = (bezahltAm: Date | null) => erstelleFallAnsicht({ ...fall("fertig", bezahltAm), bericht: b, daten: G001 } as typeof faelle.$inferSelect, { zahlungModus: "test", heute: "2026-11-06" });
    const vorher = g001(null);
    expect(vorher.stufe1?.fehlerpotenzial).toMatchObject({ zuKlaeren: 13.57, pruefbedarf: { anzahl: 1, betrag: 1222.87 } });
    expect(vorher.preis).toBe(7.99);
    expect(vorher.stufe2).toBeUndefined();
    const nachher = g001(new Date());
    expect(nachher.preis).toBeUndefined();
    expect(nachher.stufe2).toBeDefined();
    expect(nachher.fehler).toHaveLength(1);
    expect(nachher.pruefbedarf).toHaveLength(1);
    expect(nachher.unterlagen?.[0]?.arten).toEqual(["vorjahresabrechnung"]);
    // Nach der Zahlung zeigt der Klick auf einen Betrag die ausführliche Erklärung
    expect(nachher.fehler![0]!.erklaerung).toContain("Kabel-/SAT-Kosten dürfen nur bis zum 30.06.2024 umgelegt werden.");
  });

  it("ohne Befund keine Bezahlschranke: Wer nichts zu sehen bekommt, zahlt nichts", () => {
    const a = erstelleFallAnsicht({ ...fall("fertig"), bericht: { ...bericht, ergebnisse: bericht.ergebnisse.filter((e) => e.status === "ok" || e.status === "nicht_pruefbar") } } as typeof faelle.$inferSelect, { zahlungModus: "test", heute: "2026-11-06" });
    expect(a.preis).toBeUndefined();
    expect(a.stufe2).toBeDefined();
    expect(a.fehler).toEqual([]);
  });

  it("nach der Freischaltung: Stufe 2 mit Lösungsvorschlägen und Anschreiben", () => {
    const a = ansicht(fall("fertig", new Date()));
    expect(a.bezahlt).toBe(true);
    expect(a.stufe2?.auffaelligkeiten.length).toBeGreaterThan(0);
    expect(a.stufe2?.anschreiben.betreff).toContain("Betriebskostenabrechnung 2024");
  });
});
