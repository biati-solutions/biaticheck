import { describe, expect, it } from "vitest";
import { BELEG_PRUEFLISTE, erstelleStufe1, erstelleStufe2, euro, pruefeAbrechnung, RECHTSSTAND, REGELWERK_VERSION, wendeAntwortAn, type AbrechnungEingabe, type Regelergebnis } from "../src/index";
import { korrekteAbrechnung } from "./faelle";

/** Regelwerk 0.15: Zahlungshinweis, Zahlungsfrist, zusätzliche Schreiben und die Randfälle der neuen Regeln. */

const HEUTE = "2026-05-20";
const pruefe = (a: AbrechnungEingabe) => pruefeAbrechnung(a, { heute: HEUTE }).ergebnisse;
const nur = (e: Regelergebnis[], id: string) => e.filter((x) => x.regelId === id);
const stufen = (a: AbrechnungEingabe, heute = HEUTE) => {
  const bericht = pruefeAbrechnung(a, { heute });
  const s1 = erstelleStufe1(bericht, a, { heute });
  return { bericht, s1, s2: erstelleStufe2(bericht, a, s1) };
};
/** Korrekte Abrechnung (Zugang 14.05.2026, Nachzahlung 132 €) mit einer zusätzlichen Position, Summe und Saldo nachgeführt. */
const mitPosition = (bezeichnung: string, kategorie: AbrechnungEingabe["kostenpositionen"][number]["kategorie"], anteilMieter = 60): AbrechnungEingabe => {
  const a = korrekteAbrechnung();
  a.kostenpositionen.push({ id: "neu", bezeichnung, kategorie, gesamtkosten: anteilMieter * (960 / 72), umlageschluessel: { typ: "wohnflaeche", anteilEinheit: 72, anteilGesamt: 960 }, anteilMieter });
  a.ausgewiesen = { summeKostenMieter: 3132 + anteilMieter, saldo: 132 + anteilMieter };
  return a;
};
const mitFehler = () => mitPosition("Verwaltungskosten", "verwaltung", 40);

describe("Regelwerk 0.15", () => {
  it("Version und Rechtsstand stehen im Prüfbericht", () => {
    const bericht = pruefeAbrechnung(korrekteAbrechnung(), { heute: HEUTE });
    expect(REGELWERK_VERSION).toBe("0.15.0");
    expect(bericht.rechtsstand).toBe(RECHTSSTAND);
    expect(RECHTSSTAND).toMatch(/^\d{4}-\d{2}$/);
  });

  it("Kundentexte nennen keine Zahl der Prüfregeln", () => {
    for (const a of [korrekteAbrechnung(), mitFehler()]) {
      const { s1, s2 } = stufen(a);
      expect([...s2.zusammenfassung, ...Object.values(s1.erklaerungen)].join(" ")).not.toMatch(/Prüfregeln|Regeln/);
    }
  });
});

describe("Zahlungsfrist und Zahlungshinweis", () => {
  it("Stufe 1 nennt die Zahlungsfrist: 30 Tage nach Zugang", () => {
    expect(stufen(korrekteAbrechnung()).s1.zahlungsfrist).toEqual({ art: "nachzahlung", bis: "2026-06-13", tageVerbleibend: 24 });
    const ohneZugang = korrekteAbrechnung();
    delete ohneZugang.meta.zugangAm;
    expect(stufen(ohneZugang).s1.zahlungsfrist).toBeUndefined();
  });

  it("belegter Fehler: unter Vorbehalt zahlen statt kürzen, mit Zahlungsfrist und Vorbehalt im Schreiben", () => {
    const { s2 } = stufen(mitFehler());
    const titel = s2.fahrplan.schritte.map((x) => x.titel);
    expect(titel).toContain("Nachzahlung unter Vorbehalt zahlen");
    expect(titel.join(" ")).not.toMatch(/nicht bezahlen|Höchstens/);
    const zahlen = s2.fahrplan.schritte.find((x) => x.titel === "Nachzahlung unter Vorbehalt zahlen")!;
    expect(zahlen.bis).toBe("2026-06-13");
    expect(zahlen.text).toContain(euro(40));
    expect(s2.anschreiben.text).toContain("nur unter dem Vorbehalt der Rückforderung");
  });

  it("schon gezahlt: zurückfordern, Schreiben nennt die geleistete Zahlung, Eingangsfrage entfällt", () => {
    expect(stufen(mitFehler()).s2.rueckfragen.map((r) => r.feld)).toContain("meta.nachzahlungGezahlt");
    const { s2 } = stufen(wendeAntwortAn(mitFehler(), "meta.nachzahlungGezahlt", true, HEUTE));
    expect(s2.fahrplan.schritte.map((x) => x.titel)).toContain("Zu viel Gezahltes zurückfordern");
    expect(s2.anschreiben.text).toContain("Die Nachzahlung habe ich bereits geleistet.");
    expect(s2.rueckfragen.map((r) => r.feld)).not.toContain("meta.nachzahlungGezahlt");
  });

  it("ohne Befund keine Eingangsfrage und keine zusätzlichen Schreiben", () => {
    const { s2 } = stufen(korrekteAbrechnung());
    expect(s2.rueckfragen).toEqual([]);
    expect(s2.nachfassschreiben).toBeUndefined();
    expect(s2.belegeinsicht).toBeUndefined();
  });
});

describe("Erinnerung und Belegeinsicht", () => {
  const { s2 } = stufen(mitFehler());

  it("Erinnerungsschreiben mit Platzhalter für das Datum des ersten Schreibens", () => {
    expect(s2.nachfassschreiben!.betreff).toMatch(/^Erinnerung: Betriebskostenabrechnung 2025/);
    expect(s2.nachfassschreiben!.text).toContain("[Datum Ihres ersten Schreibens]");
    expect(s2.nachfassschreiben!.text).toContain("Einwendungsfrist läuft bis zum 14.05.2027");
  });

  it("Belegeinsicht als eigenes Schreiben, Prüfliste für die Belege", () => {
    expect(s2.belegeinsicht!.text).toContain("1. Rechnungen zu „Verwaltungskosten“");
    expect(BELEG_PRUEFLISTE).toHaveLength(4);
  });
});

describe("Randfälle der neuen Regeln", () => {
  it("I-05: Glasfaserbereitstellungsentgelt bleibt umlagefähig, Kabelgebühr nicht", () => {
    expect(nur(pruefe(mitPosition("Glasfaserbereitstellungsentgelt", "antenne_kabel")), "I-05")).toMatchObject([{ status: "ok" }]);
    expect(nur(pruefe(mitPosition("Kabelanschluss", "antenne_kabel")), "I-05")).toMatchObject([{ status: "abweichung", betragZugunstenMieter: 60 }]);
  });

  it("I-04: keine doppelte Kürzung, wenn schon die ganze Heizung nicht erfasst ist", () => {
    const a = korrekteAbrechnung();
    a.heizkosten = { ...a.heizkosten!, verbrauchErfasst: false, warmwasser: { verbrauchErfasst: false, anteilMieter: 300 } };
    expect(nur(pruefe(a), "I-04").filter((e) => e.status !== "ok").map((e) => e.titel)).toEqual(["Heizkosten nicht nach Verbrauch abgerechnet"]);
  });

  it("I-19: kein Befund bei Holz, vor 2023, mit ausgewiesenen CO₂-Werten oder ohne Angabe", () => {
    const basis = (aendern: (a: AbrechnungEingabe) => void) => {
      const a = korrekteAbrechnung();
      a.heizkosten = { ...a.heizkosten!, co2Ausgewiesen: false, brennstoff: "gas" };
      aendern(a);
      return nur(pruefe(a), "I-19");
    };
    expect(basis(() => {})).toMatchObject([{ status: "abweichung", betragZugunstenMieter: 29.4 }]);
    expect(basis((a) => (a.heizkosten!.brennstoff = "holz"))).toEqual([]);
    expect(basis((a) => (a.meta.abrechnungszeitraum = { von: "2022-01-01", bis: "2022-12-31" }))).toEqual([]);
    expect(basis((a) => (a.heizkosten!.co2 = { emissionKg: 28_800, flaecheM2: 960, kostenGesamt: 1000, vermieteranteil: 400 }))).toEqual([]);
    expect(nur(pruefe(korrekteAbrechnung()), "I-19")).toEqual([]);
  });

  it("I-20: verneinte und laufende Leistungen bleiben unberührt", () => {
    expect(nur(pruefe(mitPosition("Dachrinnenreinigung", "sonstige")), "I-20")).toEqual([]);
    expect(nur(pruefe(mitPosition("Wartung Feuerlöscher", "sonstige")), "I-20")).toEqual([]);
    expect(nur(pruefe(mitPosition("Gartenpflege ohne Neuanpflanzung", "gartenpflege")), "I-20")).toEqual([]);
  });

  it("I-21: Verweis auf die Betriebskostenverordnung = alles vereinbart", () => {
    const a = korrekteAbrechnung();
    a.mietvertrag = { umgelegteKostenarten: "alle" };
    expect(nur(pruefe(a), "I-21")).toMatchObject([{ status: "ok" }]);
  });

  it("R-10: fragt nach der Zwischenablesung, wenn sie unbekannt ist", () => {
    const a = korrekteAbrechnung();
    a.meta.nutzungszeitraum = { von: "2025-04-01", bis: "2025-12-31" };
    expect(nur(pruefe(a), "R-10")).toMatchObject([{ status: "nicht_pruefbar", rueckfrage: { feld: "meta.zwischenablesung" } }]);
    expect(nur(pruefe(wendeAntwortAn(a, "meta.zwischenablesung", true, HEUTE)), "R-10")).toMatchObject([{ status: "ok" }]);
  });

  it("R-11: Änderungen zugunsten des Mieters fallen nicht auf; nur Flächen aus dem Vorjahr lassen P-01 offen", () => {
    const a = korrekteAbrechnung();
    a.vorjahr = { kostenpositionen: [], flaechen: { wohnflaecheMieter: 75, gesamtflaeche: 900 } };
    expect(nur(pruefe(a), "R-11")).toMatchObject([{ status: "ok" }]);
    expect(nur(pruefe(a), "P-01")).toMatchObject([{ status: "nicht_pruefbar" }]);
  });

  it("R-12: ohne Vereinbarung gilt die Wohnfläche; Verbrauch und Heizung sind ausgenommen", () => {
    const a = korrekteAbrechnung();
    a.mietvertrag = { umlageschluessel: "keine" };
    expect(nur(pruefe(a), "R-12")).toMatchObject([{ status: "auffaelligkeit", beleg: { positionen: ["p2", "p3", "p4"] } }]);
  });
});
