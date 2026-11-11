import type Anthropic from "@anthropic-ai/sdk";
import type { AbrechnungEingabe } from "@biaticheck/pruefkern";
import { pruefeKonsistenz, type Konsistenz } from "./konsistenz";
import { AuslesenFehler, rufeModellAuf, type Dokument } from "./modell";
import { wandleUm } from "./umwandlung";

export { AuslesenFehler, MODELL, type Dokument, type Dokumenttyp } from "./modell";
export { erkenneDokumenttyp } from "./dateityp";
export { pruefeKonsistenz, type Konsistenz } from "./konsistenz";
export { Rohdaten } from "./rohdaten";
export { wandleUm } from "./umwandlung";
export { vergleiche, type Vergleich } from "./vergleich";
export { bereinigeVerlauf, leseVorauszahlungen, VorauszahlungenRoh, type Vorauszahlungsverlauf } from "./vorauszahlungen";

export interface Auslesung {
  /** Nicht gesetzt, wenn das Dokument keine Nebenkostenabrechnung ist. */
  abrechnung?: AbrechnungEingabe;
  istNebenkostenabrechnung: boolean;
  konsistenz: Konsistenz;
  hinweise: string[];
  modell: string;
  nutzung: { eingabeTokens: number; ausgabeTokens: number };
  /** Anzahl der Lesungen (2, wenn die erste unstimmig war). */
  lesungen: number;
}

export interface Ausleseoptionen {
  /**
   * Stimmen die Zahlen der ersten Lesung untereinander nicht, wird das Dokument ein zweites Mal unabhängig gelesen.
   * Ein Lesefehler lässt sich so oft beheben, ohne dass ein Experte eingreifen muss. Standard: an.
   */
  zweiteLesung?: boolean;
}

function werteAus(aufruf: Awaited<ReturnType<typeof rufeModellAuf>>): Pick<Auslesung, "abrechnung" | "konsistenz" | "hinweise"> {
  const { abrechnung, hinweise } = wandleUm(aufruf.rohdaten);
  return { abrechnung, konsistenz: pruefeKonsistenz(abrechnung), hinweise };
}

/** Liest Dokumente aus und kontrolliert das Ergebnis auf innere Stimmigkeit. */
export async function leseAus(client: Anthropic, dokumente: Dokument[], optionen: Ausleseoptionen = {}): Promise<Auslesung> {
  const aufruf = await rufeModellAuf(client, dokumente);
  if (!aufruf.rohdaten.istNebenkostenabrechnung) {
    return {
      istNebenkostenabrechnung: false,
      konsistenz: { konsistent: false, gruende: ["Dokument ist keine Nebenkostenabrechnung"] },
      hinweise: aufruf.rohdaten.unsicherheiten,
      modell: aufruf.modell,
      nutzung: aufruf.nutzung,
      lesungen: 1,
    };
  }
  const erste = werteAus(aufruf);
  const basis = { istNebenkostenabrechnung: true, modell: aufruf.modell };
  if (erste.konsistenz.konsistent || optionen.zweiteLesung === false) return { ...erste, ...basis, nutzung: aufruf.nutzung, lesungen: 1 };

  // Zweite, unabhängige Lesung. Scheitert sie oder ist auch sie unstimmig, bleibt es beim ersten Ergebnis – der Fall geht zum Experten.
  let zweiterAufruf;
  try {
    zweiterAufruf = await rufeModellAuf(client, dokumente);
  } catch (fehler) {
    if (!(fehler instanceof AuslesenFehler)) throw fehler;
    return { ...erste, ...basis, hinweise: [...erste.hinweise, `Zweite Lesung fehlgeschlagen (${fehler.code})`], nutzung: aufruf.nutzung, lesungen: 1 };
  }
  const nutzung = {
    eingabeTokens: aufruf.nutzung.eingabeTokens + zweiterAufruf.nutzung.eingabeTokens,
    ausgabeTokens: aufruf.nutzung.ausgabeTokens + zweiterAufruf.nutzung.ausgabeTokens,
  };
  if (zweiterAufruf.rohdaten.istNebenkostenabrechnung) {
    const zweite = werteAus(zweiterAufruf);
    if (zweite.konsistenz.konsistent) {
      return {
        ...zweite,
        ...basis,
        modell: zweiterAufruf.modell,
        hinweise: [...zweite.hinweise, `Erste Lesung war unstimmig und wurde verworfen: ${erste.konsistenz.gruende.join("; ")}`],
        nutzung,
        lesungen: 2,
      };
    }
  }
  return { ...erste, ...basis, hinweise: [...erste.hinweise, "Auch die zweite Lesung war unstimmig"], nutzung, lesungen: 2 };
}
