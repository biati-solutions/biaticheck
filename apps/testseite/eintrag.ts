import { z } from "zod";
import { Rohdaten } from "../../packages/auslesen/src/rohdaten";
import { SYSTEM_PROMPT } from "../../packages/auslesen/src/prompt";
import { wandleUm } from "../../packages/auslesen/src/umwandlung";
import { pruefeKonsistenz } from "../../packages/auslesen/src/konsistenz";
import { bereinigeRohdaten } from "../../packages/auslesen/src/bereinigen";
import { KEINE_KONTROLLE, KONTROLL_PROMPT, KontrolleRoh, kontrollbefundeAus, protokollFuerKontrolle, werteKontrolleAus } from "../../packages/auslesen/src/kontrolle";
import { BELEG_PRUEFLISTE, KOSTENKATEGORIEN, type Kostenkategorie, erstelleZeilenprotokoll, schliesstAn, erstelleStufe1, erstelleStufe2, pruefeAbrechnung, wendeAntwortAn, AntwortFehler, personalisiereAnschreiben } from "../../packages/pruefkern/src/index";

export { personalisiereAnschreiben, schliesstAn, BELEG_PRUEFLISTE };
/** Schlüssel der Kostenarten – für die Auswertung des Mietvertrags (welche Kostenarten sind umgelegt?). */
export const KOSTENARTEN: Record<string, string> = KOSTENKATEGORIEN;
export const ANWEISUNG = SYSTEM_PROMPT;
export const SCHEMA = JSON.stringify(z.toJSONSchema(Rohdaten));
export const KONTROLL_ANWEISUNG = KONTROLL_PROMPT;
export const KONTROLL_SCHEMA = JSON.stringify(z.toJSONSchema(KontrolleRoh));

/** Zeilenprotokoll der unveränderten Auslesung (ohne Kundenantworten) – Grundlage der KI-Kontrolle. */
function protokollVon(rohJson: unknown, heute: string) {
  const roh = Rohdaten.safeParse(ergaenze(rohJson));
  if (!roh.success || !roh.data.istNebenkostenabrechnung) return undefined;
  const { abrechnung } = wandleUm(roh.data);
  return erstelleZeilenprotokoll(pruefeAbrechnung(abrechnung, { heute }), abrechnung);
}

/** Unterschritt 2: Text des Protokolls für die Kontrollanfrage. */
export function kontrollProtokoll(rohJson: unknown, heute: string): string | undefined {
  const protokoll = protokollVon(rohJson, heute);
  return protokoll ? protokollFuerKontrolle(protokoll) : undefined;
}

/** Unterschritt 2: Antwort der KI nach festen Regeln auswerten. */
export function werteKontrolle(antwort: unknown, rohJson: unknown, heute: string) {
  const protokoll = protokollVon(rohJson, heute);
  if (!protokoll) return KEINE_KONTROLLE("keine Abrechnung");
  const gueltig = KontrolleRoh.safeParse(antwort);
  if (!gueltig.success) return KEINE_KONTROLLE("keine gültige Antwort", protokoll.zeilen.length);
  const kontrolle = werteKontrolleAus(gueltig.data, protokoll);
  // befunde: Funde für die Liste „Das haben wir gefunden“ (Regel K-01)
  return { ...kontrolle, befunde: kontrollbefundeAus(kontrolle, protokoll) };
}

/** Fehlende Felder, Zahlen als Text und unbrauchbare Zusatzangaben bereinigen (siehe packages/auslesen/src/bereinigen.ts). */
const ergaenze = (roh: unknown): unknown => bereinigeRohdaten(roh).roh;

/** Rohausgabe des Modells → geprüftes Ergebnis (Stufe 1 und 2). */
type Verlauf = { ab: string; betriebskosten?: number; heizkosten?: number }[];

export function werteAus(
  rohJson: unknown,
  heute: string,
  antworten: Record<string, unknown> = {},
  mietvertrag?: {
    pauschaleVereinbart?: boolean;
    vereinbarteSonstigeKosten?: string[];
    aufzugAusgenommen?: boolean;
    mietbeginn?: string;
    mietende?: string;
    wohnflaeche?: number;
    gewerbeImHaus?: boolean;
    umgelegteKostenarten?: "alle" | Kostenkategorie[];
    umlageschluessel?: "wohnflaeche" | "personen" | "einheiten" | "miteigentumsanteil" | "keine";
  },
  vorauszahlungen?: { verlauf: Verlauf; quelle: "vorjahresabrechnung" | "kontoauszug" | "kunde" },
  kontrollbefunde?: { beschreibung: string; textstelle: string; positionId?: string; seite?: number }[],
  /** Flächen aus der Vorjahresabrechnung, nur wenn deren Zeitraum lückenlos anschließt (Regel R-11). */
  vorjahrFlaechen?: { wohnflaecheMieter?: number; gesamtflaeche?: number },
) {
  const bereinigt = bereinigeRohdaten(rohJson);
  const roh = Rohdaten.safeParse(bereinigt.roh);
  if (!roh.success) return { fehler: "format", details: roh.error.issues.slice(0, 8).map((i) => `${i.path.join(".")}: ${i.message}`) };
  if (!roh.data.istNebenkostenabrechnung) return { fehler: "keine_abrechnung" };
  let abrechnung: ReturnType<typeof wandleUm>["abrechnung"];
  let hinweise: string[];
  try {
    ({ abrechnung, hinweise } = wandleUm(roh.data));
  } catch (e) {
    return { fehler: "format", details: [e instanceof Error ? e.message : String(e)] };
  }
  hinweise = [...bereinigt.verworfen, ...hinweise];
  const konsistenz = pruefeKonsistenz(abrechnung);
  if (kontrollbefunde?.length) abrechnung = { ...abrechnung, kontrollbefunde };
  if (mietvertrag) {
    const { gewerbeImHaus, ...vertrag } = mietvertrag;
    abrechnung = { ...abrechnung, mietvertrag: { ...abrechnung.mietvertrag, ...vertrag } };
    if (gewerbeImHaus) abrechnung = { ...abrechnung, ausstattung: { ...abrechnung.ausstattung, gewerbeImHaus } };
  }
  if (vorjahrFlaechen && Object.keys(vorjahrFlaechen).length)
    abrechnung = { ...abrechnung, vorjahr: { kostenpositionen: abrechnung.vorjahr?.kostenpositionen ?? [], flaechen: vorjahrFlaechen } };
  if (vorauszahlungen?.verlauf.length)
    abrechnung = { ...abrechnung, vorauszahlungenDetail: { ...abrechnung.vorauszahlungenDetail, verlauf: vorauszahlungen.verlauf, verlaufQuelle: vorauszahlungen.quelle } };
  for (const [feld, wert] of Object.entries(antworten)) {
    try { abrechnung = wendeAntwortAn(abrechnung, feld, wert, heute); }
    catch (e) { if (e instanceof AntwortFehler) return { fehler: "antwort", meldung: e.fuerKunden ? e.message : "Die Angabe ist ungültig.", feld }; throw e; }
  }
  const bericht = pruefeAbrechnung(abrechnung, { heute });
  const s1 = erstelleStufe1(bericht, abrechnung, { heute });
  const s2 = erstelleStufe2(bericht, abrechnung, s1);
  const protokoll = erstelleZeilenprotokoll(bericht, abrechnung);
  return { s1, s2, konsistenz, hinweise, verworfen: bereinigt.verworfen, protokoll, positionen: abrechnung.kostenpositionen.map((p) => ({ name: p.bezeichnung, betrag: p.anteilMieter })), heizkosten: abrechnung.heizkosten?.anteilMieter ?? null, plz: abrechnung.meta.plz ?? null, zeitraum: abrechnung.meta.abrechnungszeitraum ?? null };
}
