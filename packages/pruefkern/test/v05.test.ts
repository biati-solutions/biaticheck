import { describe, expect, it } from "vitest";
import { ALLE_REGELN, BELEG_PRUEFLISTE, erstelleStufe1, erstelleStufe2, euro, pruefeAbrechnung, REGELWERK_VERSION, wendeAntwortAn, type AbrechnungEingabe, type Regelergebnis } from "../src/index";
import { korrekteAbrechnung } from "./faelle";
import { G001 } from "./golden/G-001";

/** Regelwerk 0.5: neue Regeln aus der Wettbewerbs- und Quellenanalyse sowie der geänderte Zahlungshinweis. */

const HEUTE = "2026-05-20";
const pruefe = (a: AbrechnungEingabe, heute = HEUTE) => pruefeAbrechnung(a, { heute }).ergebnisse;
const nur = (e: Regelergebnis[], id: string) => e.filter((x) => x.regelId === id);
const nichtOk = (e: Regelergebnis[], id: string) => nur(e, id).filter((x) => x.status !== "ok");
const stufen = (a: AbrechnungEingabe, heute = HEUTE) => {
  const bericht = pruefeAbrechnung(a, { heute });
  const s1 = erstelleStufe1(bericht, a, { heute });
  return { bericht, s1, s2: erstelleStufe2(bericht, a, s1) };
};
const wf = { typ: "wohnflaeche" as const, anteilEinheit: 72, anteilGesamt: 960 };
const mitPosition = (bezeichnung: string, kategorie: AbrechnungEingabe["kostenpositionen"][number]["kategorie"], anteilMieter = 60): AbrechnungEingabe => {
  const a = korrekteAbrechnung();
  a.kostenpositionen.push({ id: "neu", bezeichnung, kategorie, gesamtkosten: anteilMieter * (960 / 72), umlageschluessel: wf, anteilMieter });
  a.ausgewiesen = { summeKostenMieter: 3132 + anteilMieter, saldo: 132 + anteilMieter };
  return a;
};

describe("Regelwerk 0.5", () => {
  it("Version und Umfang: 38 Regeln mit eindeutigen IDs", () => {
    expect(REGELWERK_VERSION).toBe("0.5.0");
    expect(ALLE_REGELN.length).toBe(38);
    expect(new Set(ALLE_REGELN.map((r) => r.id)).size).toBe(38);
  });

  it("die korrekte Abrechnung bleibt ohne Befund", () => {
    expect(pruefe(korrekteAbrechnung()).filter((e) => e.status !== "ok")).toEqual([]);
  });
});

describe("Stufe 2 bricht bei Rechenfehlern zugunsten des Mieters nicht ab", () => {
  it("zu niedrig addierte Summe hat einen Text", () => {
    const a = korrekteAbrechnung();
    a.ausgewiesen = { summeKostenMieter: 3100, saldo: 100 };
    const { s2 } = stufen(a);
    expect(s2.auffaelligkeiten.find((p) => p.regelId === "R-02")!.loesung).toContain("Sie müssen nichts unternehmen");
  });
});

describe("I-15 CO₂-Angaben fehlen", () => {
  const basis = (brennstoff?: "gas" | "fernwaerme" | "holz") => {
    const a = korrekteAbrechnung();
    a.heizkosten = { ...a.heizkosten!, co2Ausgewiesen: false, brennstoff };
    return a;
  };

  it("Gas ohne CO₂-Angaben: Fehler, 3 % der Heizkosten", () => {
    expect(nur(pruefe(basis("gas")), "I-15")).toMatchObject([{ status: "abweichung", betragZugunstenMieter: 29.4 }]);
  });

  it("Energieträger unbekannt oder Fernwärme: nur Auffälligkeit", () => {
    expect(nur(pruefe(basis()), "I-15")).toMatchObject([{ status: "auffaelligkeit" }]);
    expect(nur(pruefe(basis("fernwaerme")), "I-15")).toMatchObject([{ status: "auffaelligkeit" }]);
  });

  it("kein Befund bei Holz, bei Zeiträumen vor 2023, wenn CO₂ ausgewiesen ist oder die Angabe fehlt", () => {
    expect(nur(pruefe(basis("holz")), "I-15")).toEqual([]);
    const alt = basis("gas");
    alt.meta.abrechnungszeitraum = { von: "2022-01-01", bis: "2022-12-31" };
    expect(nur(pruefe(alt), "I-15")).toEqual([]);
    expect(nur(pruefe(korrekteAbrechnung()), "I-15")).toEqual([]);
    const mitCo2 = basis("gas");
    mitCo2.heizkosten!.co2 = { emissionKg: 28_800, flaecheM2: 960, kostenGesamt: 1000, vermieteranteil: 400 };
    expect(nur(pruefe(mitCo2), "I-15")).toEqual([]);
  });
});

describe("I-04 Warmwasser nicht nach Verbrauch", () => {
  it("mit bekanntem Warmwasseranteil: Fehler, 15 % davon", () => {
    const a = korrekteAbrechnung();
    a.heizkosten = { ...a.heizkosten!, warmwasser: { verbrauchErfasst: false, anteilMieter: 300 } };
    expect(nichtOk(pruefe(a), "I-04")).toMatchObject([{ status: "abweichung", titel: "Warmwasser nicht nach Verbrauch abgerechnet", betragZugunstenMieter: 45 }]);
  });

  it("ohne Warmwasseranteil: Auffälligkeit ohne Betrag", () => {
    const a = korrekteAbrechnung();
    a.heizkosten = { ...a.heizkosten!, warmwasser: { verbrauchErfasst: false } };
    const [b] = nichtOk(pruefe(a), "I-04");
    expect(b).toMatchObject({ status: "auffaelligkeit" });
    expect(b!.betragZugunstenMieter).toBeUndefined();
  });

  it("keine doppelte Kürzung, wenn schon die ganze Heizung nicht erfasst ist", () => {
    const a = korrekteAbrechnung();
    a.heizkosten = { ...a.heizkosten!, verbrauchErfasst: false, warmwasser: { verbrauchErfasst: false, anteilMieter: 300 } };
    expect(nichtOk(pruefe(a), "I-04").map((b) => b.titel)).toEqual(["Heizkosten nicht nach Verbrauch abgerechnet"]);
  });
});

describe("I-16 Versicherungen, I-17 einmalige Kosten", () => {
  it("Rechtsschutz- und Mietausfallversicherung: Fehler mit vollem Betrag", () => {
    expect(nur(pruefe(mitPosition("Rechtsschutzversicherung", "versicherung", 40)), "I-16")).toMatchObject([{ status: "abweichung", betragZugunstenMieter: 40, positionId: "neu" }]);
    expect(nur(pruefe(mitPosition("Mietausfall-Versicherung", "versicherung", 25)), "I-16")).toMatchObject([{ status: "abweichung", betragZugunstenMieter: 25 }]);
    expect(nur(pruefe(korrekteAbrechnung()), "I-16")).toEqual([]);
  });

  it("Anschaffung ist ein Fehler, ein einmaliger Anlass eine Auffälligkeit", () => {
    expect(nur(pruefe(mitPosition("Anschaffung Feuerlöscher", "sonstige")), "I-17")).toMatchObject([{ status: "abweichung", betragZugunstenMieter: 60 }]);
    expect(nur(pruefe(mitPosition("Erstbepflanzung Vorgarten", "gartenpflege")), "I-17")).toMatchObject([{ status: "abweichung" }]);
    expect(nur(pruefe(mitPosition("Rohrreinigung nach Verstopfung", "entwaesserung")), "I-17")).toMatchObject([{ status: "auffaelligkeit" }]);
  });

  it("laufende Leistungen und Rauchwarnmelder (I-10) bleiben unberührt", () => {
    expect(nur(pruefe(mitPosition("Dachrinnenreinigung", "sonstige")), "I-17")).toEqual([]);
    expect(nur(pruefe(mitPosition("Wartung Feuerlöscher", "sonstige")), "I-17")).toEqual([]);
    expect(nur(pruefe(mitPosition("Miete Rauchwarnmelder", "sonstige")), "I-17")).toEqual([]);
  });
});

describe("I-11 und I-18 Hauswart", () => {
  it("I-11: Hinweis in der Bezeichnung ergibt einen Abzug von bis zu 20 %", () => {
    const a = korrekteAbrechnung();
    a.kostenpositionen.find((p) => p.id === "p9")!.bezeichnung = "Hauswart inkl. Kleinreparaturen";
    expect(nichtOk(pruefe(a), "I-11")).toMatchObject([{ status: "auffaelligkeit", betragZugunstenMieter: 48 }]);
  });

  it("I-18: Sammelposition Hauswart und Garten", () => {
    const a = korrekteAbrechnung();
    a.kostenpositionen.find((p) => p.id === "p9")!.bezeichnung = "Hausmeister/Gartenpflege";
    expect(nur(pruefe(a), "I-18")[0]).toMatchObject({ status: "auffaelligkeit", titel: "Sammelposition: Hausmeister/Gartenpflege" });
  });

  it("I-18: mögliche Doppelabrechnung nur, wenn der Hauswart über dem Durchschnitt liegt", () => {
    expect(nur(pruefe(korrekteAbrechnung()), "I-18")).toEqual([]); // 0,28 € je m² und Monat
    const teuer = korrekteAbrechnung();
    const hw = teuer.kostenpositionen.find((p) => p.id === "p9")!;
    hw.anteilMieter = 360; // 0,42 € je m² und Monat
    hw.gesamtkosten = 4800;
    expect(nur(pruefe(teuer), "I-18")).toMatchObject([{ status: "auffaelligkeit", titel: "Hauswart und Garten oder Reinigung doppelt?" }]);
  });
});

describe("I-05 Kabel: Ausnahmen", () => {
  it("Glasfaserbereitstellungsentgelt bleibt umlagefähig, Kabelgebühr nicht", () => {
    expect(nur(pruefe(mitPosition("Glasfaserbereitstellungsentgelt", "antenne_kabel")), "I-05")).toMatchObject([{ status: "ok" }]);
    expect(nur(pruefe(mitPosition("Kabelanschluss", "antenne_kabel")), "I-05")).toMatchObject([{ status: "abweichung", betragZugunstenMieter: 60 }]);
  });
});

describe("F-06 Verständliche Bezeichnungen", () => {
  it("unbekannte Abkürzung und nichtssagender Sammelbegriff fallen auf", () => {
    expect(nur(pruefe(mitPosition("Wartung RWR Anlage", "sonstige")), "F-06")).toMatchObject([{ status: "auffaelligkeit", beleg: { kuerzel: ["RWR"] } }]);
    expect(nur(pruefe(mitPosition("Hausstrom", "beleuchtung")), "F-06")).toMatchObject([{ status: "auffaelligkeit", beleg: { nichtssagend: true } }]);
  });

  it("gängige Kürzel und klare Bezeichnungen nicht", () => {
    expect(nur(pruefe(mitPosition("Kabel TV", "antenne_kabel")), "F-06")).toEqual([]);
    expect(nur(pruefe(korrekteAbrechnung()), "F-06")).toEqual([]);
  });
});

describe("R-08 Flächen gegenüber dem Vorjahr", () => {
  it("kleinere Gesamtfläche: Auffälligkeit mit geschätztem Betrag", () => {
    const a = korrekteAbrechnung();
    a.vorjahr = { ...a.vorjahr!, flaechen: { wohnflaecheMieter: 72, gesamtflaeche: 1200 } };
    const [b] = nur(pruefe(a), "R-08");
    // nach Fläche verteilt: 288 + 180 + 120 + 48 + 336 + 240 = 1.212 €; 1 − 960/1200 = 20 %
    expect(b).toMatchObject({ status: "auffaelligkeit", titel: "Gesamtfläche kleiner als im Vorjahr", betragZugunstenMieter: 242.4 });
  });

  it("gleiche Flächen: in Ordnung; ohne Vorjahresflächen: keine Aussage", () => {
    const a = korrekteAbrechnung();
    a.vorjahr = { ...a.vorjahr!, flaechen: { wohnflaecheMieter: 72, gesamtflaeche: 960 } };
    expect(nur(pruefe(a), "R-08")).toMatchObject([{ status: "ok" }]);
    expect(nur(pruefe(korrekteAbrechnung()), "R-08")).toEqual([]);
  });

  it("nur Flächen aus dem Vorjahr: kein Vorjahresvergleich der Kosten (P-01)", () => {
    const a = korrekteAbrechnung();
    a.vorjahr = { flaechen: { gesamtflaeche: 960 } };
    expect(nur(pruefe(a), "P-01")).toMatchObject([{ status: "nicht_pruefbar" }]);
  });
});

describe("R-09 Verteilerschlüssel laut Mietvertrag", () => {
  it("nichts vereinbart: Wohnfläche gilt, Verteilung nach Einheiten fällt auf – Verbrauch und Heizung nicht", () => {
    const a = korrekteAbrechnung();
    a.mietvertrag = { umlageschluessel: "keine" };
    const [b] = nur(pruefe(a), "R-09");
    expect(b).toMatchObject({ status: "auffaelligkeit", beleg: { positionen: ["p2", "p3", "p4"] } });
  });

  it("ohne Angabe zum Mietvertrag keine Aussage", () => {
    expect(nur(pruefe(korrekteAbrechnung()), "R-09")).toEqual([]);
  });
});

describe("R-10 Zwischenablesung bei Ein- oder Auszug", () => {
  const umzug = (zwischenablesung?: boolean) => {
    const a = korrekteAbrechnung();
    a.meta.nutzungszeitraum = { von: "2025-04-01", bis: "2025-12-31" };
    if (zwischenablesung !== undefined) a.meta.zwischenablesung = zwischenablesung;
    return a;
  };

  it("fragt nach, wenn unbekannt; Auffälligkeit ohne Ablesung; in Ordnung mit Ablesung", () => {
    expect(nur(pruefe(umzug()), "R-10")).toMatchObject([{ status: "nicht_pruefbar", rueckfrage: { feld: "meta.zwischenablesung" } }]);
    expect(nur(pruefe(umzug(false)), "R-10")).toMatchObject([{ status: "auffaelligkeit" }]);
    expect(nur(pruefe(umzug(true)), "R-10")).toMatchObject([{ status: "ok" }]);
  });

  it("ohne Umzug kein Befund", () => {
    expect(nur(pruefe(korrekteAbrechnung()), "R-10")).toEqual([]);
  });
});

describe("P-04 Kennwert je Kostenart", () => {
  it("mehr als doppelt so teuer wie der Durchschnitt: Auffälligkeit ohne Betrag, im Schreiben nur als Bitte um Belege", () => {
    const a = korrekteAbrechnung();
    const garten = a.kostenpositionen.find((p) => p.id === "p6")!;
    garten.anteilMieter = 300; // 0,35 € je m² und Monat, Durchschnitt 0,15 €
    garten.gesamtkosten = 4000;
    a.ausgewiesen = { summeKostenMieter: 3312, saldo: 312 };
    const { bericht, s2 } = stufen(a);
    const [b] = nichtOk(bericht.ergebnisse, "P-04");
    expect(b).toMatchObject({ status: "auffaelligkeit", titel: "Überdurchschnittlich teuer: Gartenpflege" });
    expect(b!.betragZugunstenMieter).toBeUndefined();
    expect(s2.anschreiben.text).toContain("Gartenpflege: Die Kosten liegen mit 0,35 € je m² und Monat deutlich über dem Bundesdurchschnitt von 0,15 €.");
    expect(s2.anschreiben.text).not.toContain("Ich erhebe Einwände");
  });

  it("Wasser wird nicht verglichen (hängt vom Verbrauch ab)", () => {
    expect(nichtOk(pruefe(korrekteAbrechnung()), "P-04")).toEqual([]);
  });
});

describe("Zahlungsfrist und Zahlungshinweis", () => {
  const mitFehler = () => mitPosition("Rechtsschutzversicherung", "versicherung", 40);

  it("Stufe 1 nennt die Zahlungsfrist: 30 Tage nach Zugang", () => {
    const { s1 } = stufen(korrekteAbrechnung());
    expect(s1.zahlungsfrist).toEqual({ art: "nachzahlung", bis: "2026-06-13", tageVerbleibend: 24 });
    expect(stufen(G001).s1.zahlungsfrist).toBeUndefined(); // ohne Zugangsdatum
  });

  it("sicherer Fehler: unter Vorbehalt zahlen statt kürzen, mit Zahlungsfrist", () => {
    const { s2 } = stufen(mitFehler());
    const titel = s2.fahrplan.schritte.map((x) => x.titel);
    expect(titel).toContain("Nachzahlung unter Vorbehalt zahlen");
    expect(titel.join(" ")).not.toMatch(/nicht bezahlen|Höchstens/);
    const zahlen = s2.fahrplan.schritte.find((x) => x.titel === "Nachzahlung unter Vorbehalt zahlen")!;
    expect(zahlen.bis).toBe("2026-06-13");
    expect(zahlen.text).toContain(euro(40));
    expect(s2.anschreiben.text).toContain("nur unter dem Vorbehalt der Rückforderung");
  });

  it("schon gezahlt: zurückfordern, Schreiben nennt die geleistete Zahlung, keine Eingangsfrage mehr", () => {
    const offen = stufen(mitFehler()).s2;
    expect(offen.rueckfragen.map((r) => r.feld)).toContain("meta.nachzahlungGezahlt");
    const { s2 } = stufen(wendeAntwortAn(mitFehler(), "meta.nachzahlungGezahlt", true, HEUTE));
    expect(s2.fahrplan.schritte.map((x) => x.titel)).toContain("Zu viel Gezahltes zurückfordern");
    expect(s2.anschreiben.text).toContain("Die Nachzahlung habe ich bereits geleistet.");
    expect(s2.rueckfragen.map((r) => r.feld)).not.toContain("meta.nachzahlungGezahlt");
  });

  it("nicht zahlen nur, wenn die Nachforderung insgesamt entfällt", () => {
    const spaet = wendeAntwortAn(wendeAntwortAn(G001, "meta.zugangAm", "2026-01-15", "2026-11-06"), "meta.zeitraumBestaetigt", true, "2026-11-06");
    expect(stufen(spaet, "2026-11-06").s2.fahrplan.schritte.map((x) => x.titel)).toContain("Nachzahlung nicht bezahlen");
  });
});

describe("Zusätzliche Schreiben und Positionsübersicht", () => {
  const { s2 } = stufen(mitPosition("Rechtsschutzversicherung", "versicherung", 40));

  it("Erinnerungsschreiben, wenn es etwas zu beanstanden gibt", () => {
    expect(s2.nachfassschreiben!.betreff).toMatch(/^Erinnerung: Betriebskostenabrechnung 2025/);
    expect(s2.nachfassschreiben!.text).toContain("[Datum Ihres ersten Schreibens]");
    expect(stufen(korrekteAbrechnung()).s2.nachfassschreiben).toBeUndefined();
  });

  it("Belegeinsicht als eigenes Schreiben mit Prüfliste", () => {
    const a = korrekteAbrechnung();
    a.kostenpositionen.find((p) => p.id === "p9")!.bezeichnung = "Hauswart inkl. Kleinreparaturen";
    const mitBeleg = stufen(a).s2;
    expect(mitBeleg.belegeinsicht!.text).toContain("1. Hauswartvertrag und Leistungsverzeichnis zu „Hauswart inkl. Kleinreparaturen“");
    expect(mitBeleg.fahrplan.belegPruefliste).toEqual(BELEG_PRUEFLISTE);
    expect(stufen(korrekteAbrechnung()).s2.belegeinsicht).toBeUndefined();
  });

  it("Positionsübersicht: jede Position mit Bewertung", () => {
    expect(s2.positionen).toHaveLength(10);
    expect(s2.positionen.find((p) => p.id === "neu")).toMatchObject({ bewertung: "fehler", hinweis: "Versicherung nicht erlaubt: Rechtsschutzversicherung" });
    expect(s2.positionen.filter((p) => p.id !== "neu").every((p) => p.bewertung === "in_ordnung")).toBe(true);
  });
});
