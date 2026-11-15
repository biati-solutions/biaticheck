import { pruefeAbrechnung } from "@biaticheck/pruefkern";
import { describe, expect, it } from "vitest";
import { bereinigeRohdaten, Rohdaten, wandleUm, zahlAusText } from "../src/index";
import { G001_ROH } from "./G-001.roh";

const roh = () => structuredClone(G001_ROH) as unknown as Record<string, any>;
const lies = (r: unknown) => {
  const b = bereinigeRohdaten(r);
  return { ...b, geprueft: Rohdaten.safeParse(b.roh) };
};

describe("Bereinigung der Modellantwort – eine unsaubere Angabe verhindert nie das ganze Ergebnis", () => {
  it("saubere Antwort bleibt unverändert", () => {
    const { roh: r, verworfen } = bereinigeRohdaten(roh());
    expect(r).toEqual(G001_ROH);
    expect(verworfen).toEqual([]);
  });

  it("fehlende Felder werden mit null bzw. leerer Liste ergänzt (auch in Positionen, Heizkosten, Zählern, Belegen)", () => {
    const r = roh();
    for (const k of ["zaehler", "belege", "erlaeuterungen", "gezahlteVorauszahlungenGesamt", "geschoss", "unsicherheiten"]) delete r[k];
    for (const p of r.kostenpositionen) for (const k of ["unterart", "bestandteile", "hinweise", "belegnummer", "steuerlich35a", "gesamtkostenVorVorwegabzug"]) delete p[k];
    delete r.heizkosten.verbrauchMieter;
    delete r.heizkosten.co2Vermieteranteil;
    r.zaehler = [{ art: "kaltwasser", anfang: 100, ende: 140 }];
    r.belege = [{ positionBezeichnung: "Grundsteuer", bezeichnung: "Bescheid", betrag: 9729.3 }];
    const { geprueft, verworfen } = lies(r);
    expect(geprueft.success).toBe(true);
    expect(verworfen).toEqual([]);
  });

  it("Zahlen als Text werden umgerechnet", () => {
    expect(zahlAusText("1.214,88")).toBe(1214.88);
    expect(zahlAusText("1.214,88 €")).toBe(1214.88);
    expect(zahlAusText("84,28 m²")).toBe(84.28);
    expect(zahlAusText("3187.97")).toBe(3187.97);
    expect(zahlAusText("-93,05")).toBe(-93.05);
    expect(zahlAusText("ca. 80")).toBeUndefined();
    const r = roh();
    r.saldo = "1.214,88 €";
    r.kostenpositionen[0].anteilMieter = "257,21";
    r.wohnflaecheMieter = "84,28";
    const { geprueft } = lies(r);
    expect(geprueft.success && geprueft.data.saldo).toBe(1214.88);
    expect(geprueft.success && geprueft.data.kostenpositionen[0]!.anteilMieter).toBe(257.21);
  });

  it("ungültige Listenwerte erhalten einen neutralen Ersatz", () => {
    const r = roh();
    r.kostenpositionen[0].kategorie = "steuern";
    r.kostenpositionen[1].schluesselTyp = "Fläche";
    r.kostenpositionen[2].unterart = "regen";
    r.kostenpositionen[3].quelle = "Anlage 2";
    r.zaehler = [{ art: "Wärmemengenzähler", anfang: 1, ende: 2 }];
    r.belege = [{ positionBezeichnung: "Grundsteuer", bezeichnung: "Bescheid", art: "Bescheid", betrag: 100, fremdesObjekt: "nein" }];
    const { geprueft } = lies(r);
    if (!geprueft.success) throw new Error(JSON.stringify(geprueft.error.issues));
    expect(geprueft.data.kostenpositionen[0]!.kategorie).toBe("unbekannt");
    expect(geprueft.data.kostenpositionen[1]!.schluesselTyp).toBe("sonstig");
    expect(geprueft.data.kostenpositionen[2]!.unterart).toBeNull();
    expect(geprueft.data.zaehler[0]!.art).toBe("sonstig");
    expect(geprueft.data.belege[0]).toMatchObject({ art: "rechnung", fremdesObjekt: false });
  });

  it("unbrauchbare Zusatzangaben werden einzeln verworfen und gemeldet – das Ergebnis entsteht trotzdem", () => {
    const r = roh();
    r.zaehler = [{ art: "kaltwasser", anfang: "unleserlich", ende: 140 }, { art: "kaltwasser", anfang: 100, ende: 140 }];
    r.belege = [{ positionBezeichnung: "Grundsteuer", bezeichnung: "Bescheid" }, "Rechnung 4711", { positionBezeichnung: "Heizkosten", bezeichnung: "Gutschrift", betrag: "-600,00" }];
    r.kostenpositionen[0].bestandteile = [{ bezeichnung: "Teil A" }, { bezeichnung: "Teil B", betrag: "120,00" }];
    r.kostenpositionen[1].hinweise = "nur ein Satz";
    r.erlaeuterungen = ["Hauswart und Aufzug enthalten keine Reparaturkosten.", { seite: 3 }];
    const { geprueft, verworfen } = lies(r);
    if (!geprueft.success) throw new Error(JSON.stringify(geprueft.error.issues));
    expect(verworfen).toEqual(["Aufschlüsselung zu „Grundsteuer“ Nr. 1 unvollständig – nicht übernommen", "Zählerstand Nr. 1 unvollständig – nicht übernommen", "Beleg Nr. 1 unvollständig – nicht übernommen", "Beleg Nr. 2 unvollständig – nicht übernommen"]);
    expect(geprueft.data.zaehler).toHaveLength(1);
    expect(geprueft.data.kostenpositionen[0]!.bestandteile).toEqual([{ bezeichnung: "Teil B", betrag: 120 }]);
    expect(geprueft.data.kostenpositionen[1]!.hinweise).toEqual(["nur ein Satz"]);
    expect(geprueft.data.erlaeuterungen).toEqual([{ text: "Hauswart und Aufzug enthalten keine Reparaturkosten.", seite: null }]);
    // Gutschrift mit Minuszeichen wird als Gutschrift mit positivem Betrag übernommen, die Prüfung läuft durch
    const { abrechnung } = wandleUm(geprueft.data);
    expect(abrechnung.belege).toEqual([expect.objectContaining({ zuPosition: "heizkosten", art: "gutschrift", betrag: 600 })]);
    expect(() => pruefeAbrechnung(abrechnung, { heute: "2026-10-29" })).not.toThrow();
  });

  it("Kostenposition ohne Betrag wird verworfen und gemeldet, statt die Abrechnung unlesbar zu machen", () => {
    const r = roh();
    delete r.kostenpositionen[4].anteilMieter;
    const { geprueft, verworfen } = lies(r);
    expect(geprueft.success).toBe(true);
    expect(verworfen).toEqual(["Kostenposition „Haftpflicht-Versicherung“ unvollständig – nicht übernommen"]);
    expect(geprueft.success && geprueft.data.kostenpositionen).toHaveLength(G001_ROH.kostenpositionen.length - 1);
  });

  it("Heizkosten ohne Betrag der Wohnung werden weggelassen; völlig Unbrauchbares bleibt ein Formatfehler", () => {
    const r = roh();
    delete r.heizkosten.anteilMieter;
    const a = lies(r);
    expect(a.geprueft.success && a.geprueft.data.heizkosten).toBeNull();
    expect(a.verworfen).toEqual(["Heizkosten ohne Betrag der Wohnung – nicht übernommen"]);
    expect(lies("kaputt").geprueft.success).toBe(false);
    expect(lies(null).geprueft.success).toBe(false);
  });
});
