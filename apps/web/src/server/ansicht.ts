import { erstelleStufe1, erstelleStufe2, istBeanstandet, type Auffaelligkeit, type Fakt, type Referenzwerte, type Stufe1, type Stufe2, type Unterlagenanforderung } from "@biaticheck/pruefkern";
import type { faelle, Fallstatus } from "./db/schema";

/**
 * Alles, was der Kunde über seinen Fall sieht. Wird an den Browser geschickt –
 * deshalb ausschließlich hier zusammengestellt, nie aus dem Datenbankobjekt direkt.
 *
 * Preismodell: Die Zusammenfassung (Betrag, Fehlerpotenzial, Ergebnis, Frist, Kostenvergleich) ist kostenlos.
 * Die gefundenen Punkte, die nächsten Schritte und das Schreiben erscheinen erst nach Zahlung von PREIS.
 * Gibt es nichts zu zeigen (kein Fehler, kein Prüfbedarf, kein Hinweis), wird nichts berechnet.
 * Gesperrte Inhalte werden gar nicht erst an den Browser geschickt.
 */
export const PREIS = 7.99;

export interface FehlerKurz {
  /** Belegter Fehler, begründeter Prüfbedarf, Hinweis oder Vergleich. */
  einordnung: Auffaelligkeit["einordnung"];
  titel: string;
  satz: string;
  /** Kurze Erklärung mit Zahlen – erscheint beim Antippen des Betrags. */
  erklaerung: string;
  betrag?: number;
  /** Bei Prüfbedarf: Frage an den Kunden, die den Punkt klärt. */
  rueckfrage?: { feld: string; frage: string; typ: Stufe1["rueckfragen"][number]["typ"] };
  /** Nachvollziehbare Zahlen und Fundstelle. */
  fakten: Fakt[];
  fundstelle?: string;
  grundlage?: string;
}

/**
 * Erklärung beim Antippen eines Befundbetrags. Kostenlos: der Rechenweg aus den sichtbaren Zahlen
 * (hervorgehobene Zeilen). Die ausführliche Erklärung gehört zum Erledigen-Paket.
 */
const rechenweg = (p: Auffaelligkeit): string => {
  const zeilen = p.fakten.filter((f) => f.betont).map((f) => `${f.label}: ${f.wert}`);
  return zeilen.length ? `So kommt der Betrag zustande: ${zeilen.join("; ")}.` : p.kurz.satz;
};

const kurz = (p: Auffaelligkeit, ausfuehrlich: boolean): FehlerKurz => ({
  einordnung: p.einordnung,
  titel: p.kurz.titel,
  satz: p.kurz.satz,
  erklaerung: ausfuehrlich ? p.befund : rechenweg(p),
  ...(p.betrag !== undefined ? { betrag: p.betrag } : {}),
  ...(p.rueckfrage ? { rueckfrage: p.rueckfrage } : {}),
  fakten: p.fakten,
  ...(p.fundstelle ? { fundstelle: p.fundstelle } : {}),
  ...(p.grundlage ? { grundlage: p.grundlage.replace(/\s*\(Schwellenwert[^)]*\)/, "") } : {}),
});

export interface FallAnsicht {
  id: string;
  status: Fallstatus;
  erstelltAm: string;
  /** Ergebnis stammt aus der Musterabrechnung (Demo-Modus ohne KI-Auslesen). */
  demo: boolean;
  freischaltung: "test" | "aus";
  bezahlt: boolean;
  /** Preis des Erledigen-Pakets; nicht gesetzt, wenn es für diesen Fall kostenlos ist. */
  preis?: number;
  stufe1?: Stufe1;
  /** Gefundene Fehler und Auffälligkeiten in Kurzfassung (kostenlos). */
  fehler?: FehlerKurz[];
  /** Mögliche Fehler, die erst mit weiteren Unterlagen sicher sind (kostenlos, ohne Betrag im Potenzial). */
  pruefbedarf?: FehlerKurz[];
  /** Hinweise und Vergleichswerte ohne Fehlerverdacht – zählen nie als Fehler. */
  hinweise?: FehlerKurz[];
  unterlagen?: Unterlagenanforderung[];
  stufe2?: Stufe2;
}

export function erstelleFallAnsicht(
  fall: typeof faelle.$inferSelect,
  optionen: { zahlungModus: "test" | "aus"; regional?: Referenzwerte; heute?: string },
): FallAnsicht {
  const sichtbar = fall.status === "fertig" && fall.bericht && fall.daten;
  const stufe1 = sichtbar ? erstelleStufe1(fall.bericht!, fall.daten!, { heute: optionen.heute, regional: optionen.regional }) : undefined;
  const bezahlt = Boolean(fall.bezahltAm);
  const stufe2 = stufe1 ? erstelleStufe2(fall.bericht!, fall.daten!, stufe1) : undefined;
  // Bezahlschranke: sobald es Punkte zu zeigen gibt und noch nicht bezahlt ist
  const hatPunkte = Boolean(stufe2?.auffaelligkeiten.some((p) => p.status !== "nicht_pruefbar"));
  const gesperrt = hatPunkte && !bezahlt;
  const liste = (filter: (p: Auffaelligkeit) => boolean) => (gesperrt ? undefined : stufe2?.auffaelligkeiten.filter(filter).map((p) => kurz(p, true)));
  return {
    id: fall.id,
    status: fall.status,
    erstelltAm: fall.erstelltAm.toISOString(),
    demo: fall.auslesung?.modell === "demo",
    freischaltung: optionen.zahlungModus,
    bezahlt,
    preis: gesperrt ? PREIS : undefined,
    // Die Erklärung zum Gesamtbetrag nennt die einzelnen Punkte – vor der Zahlung nur allgemein
    stufe1: stufe1 && gesperrt ? { ...stufe1, erklaerungen: { ...stufe1.erklaerungen, betrag: "Das ist die Summe der Beträge aus den gefundenen Punkten. Die einzelnen Punkte sehen Sie nach dem Freischalten." } } : stufe1,
    fehler: liste((p) => istBeanstandet(p.status)),
    pruefbedarf: liste((p) => p.status === "pruefbedarf"),
    hinweise: liste((p) => p.status === "hinweis"),
    unterlagen: gesperrt ? undefined : stufe2?.unterlagen,
    stufe2: gesperrt ? undefined : stufe2,
  };
}

export const LAEUFT: readonly Fallstatus[] = ["hochgeladen", "wird_ausgelesen"];
