import type { z } from "zod";
import { Rohdaten, Rohposition } from "./rohdaten";

/**
 * Bereinigt die Antwort des Modells, bevor sie gegen das Format geprüft wird.
 *
 * Ohne erzwungenes Ausgabeformat (Testseite) lässt das Modell gelegentlich Felder weg, schreibt Zahlen als Text
 * („1.214,88“) oder erfindet einen Listenwert. Eine einzelne unsaubere Zusatzangabe – etwa ein Beleg ohne Betrag –
 * darf nicht dazu führen, dass die ganze Abrechnung als unlesbar gilt und kein Ergebnis erscheint.
 *
 * Regeln:
 * - Fehlendes Feld: null bzw. leere Liste, wenn das Format das erlaubt.
 * - Zahl als Text: wird umgerechnet (deutsche und englische Schreibweise).
 * - Ungültiger Listenwert: neutraler Ersatzwert (z. B. Kostenart „unbekannt“) oder null.
 * - Unbrauchbarer Eintrag einer Zusatzliste (Zähler, Belege, Bestandteile, Erläuterungen): wird verworfen und gemeldet.
 * Kernangaben werden nie erfunden: Fehlt der Betrag einer Kostenposition, wird die Position verworfen und gemeldet –
 * die Summenkontrolle zeigt dann die Lücke.
 */

type Form = Record<string, z.ZodType>;
type Objekt = Record<string, unknown>;

const ERSATZ: Record<string, unknown> = { kategorie: "unbekannt", schluesselTyp: "sonstig", quelle: "betriebskostenabrechnung", art: "sonstig" };

/** „1.214,88“, „1214.88“, „1.214,88 €“ → 1214.88 */
export function zahlAusText(text: string): number | undefined {
  const t = text.replace(/[€\s]|EUR|Euro|m²|m³|kWh/gi, "");
  if (!/^-?[\d.,]+$/.test(t)) return undefined;
  const deutsch = /,\d{1,3}$/.test(t) || (/\.\d{3}(\.|$)/.test(t) && !/\.\d{1,2}$/.test(t));
  const n = Number(deutsch ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function istObjekt(v: unknown): v is Objekt {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Bringt ein Objekt feldweise in Form. Liefert undefined, wenn ein Pflichtfeld nicht zu retten ist. */
function repariere(form: Form, eingabe: unknown, ersatz: Record<string, unknown> = ERSATZ): Objekt | undefined {
  if (!istObjekt(eingabe)) return undefined;
  const aus: Objekt = {};
  for (const [feld, schema] of Object.entries(form)) {
    let wert = eingabe[feld];
    if (wert === undefined) wert = schema.safeParse(null).success ? null : schema.safeParse([]).success ? [] : undefined;
    if (!schema.safeParse(wert).success) {
      const zahl = typeof wert === "string" ? zahlAusText(wert) : undefined;
      if (zahl !== undefined && schema.safeParse(zahl).success) wert = zahl;
      else if (typeof wert === "string" && schema.safeParse(wert.trim().toLowerCase()).success) wert = wert.trim().toLowerCase();
      else if (feld in ersatz && schema.safeParse(ersatz[feld]).success) wert = ersatz[feld];
      else if (schema.safeParse(null).success) wert = null;
      else if (schema.safeParse([]).success) wert = [];
      else return undefined;
    }
    aus[feld] = wert;
  }
  return aus;
}

/** Bereinigt eine Liste: brauchbare Einträge bleiben, unbrauchbare werden gemeldet. */
function liste(wert: unknown, form: Form, name: string, verworfen: string[], ersatz?: Record<string, unknown>): Objekt[] {
  if (!Array.isArray(wert)) return [];
  const aus: Objekt[] = [];
  for (const [i, eintrag] of wert.entries()) {
    const ok = repariere(form, eintrag, ersatz);
    if (ok) aus.push(ok);
    else verworfen.push(`${name} Nr. ${i + 1} unvollständig – nicht übernommen`);
  }
  return aus;
}

const formVon = (schema: z.ZodType): Form => (schema as unknown as { shape: Form }).shape;
const elementVon = (schema: z.ZodType): Form => formVon((schema as unknown as { element: z.ZodType }).element);
const innenVon = (schema: z.ZodType): Form => formVon((schema as unknown as { unwrap: () => z.ZodType }).unwrap());

/** Bereinigte Rohdaten und die Liste dessen, was dabei verworfen wurde. */
export function bereinigeRohdaten(eingabe: unknown): { roh: unknown; verworfen: string[] } {
  if (!istObjekt(eingabe)) return { roh: eingabe, verworfen: [] };
  const verworfen: string[] = [];
  const form = formVon(Rohdaten);
  const r: Objekt = { ...eingabe };

  // Listen zuerst: Einträge einzeln retten oder verwerfen
  const positionsform = formVon(Rohposition);
  r.kostenpositionen = (Array.isArray(r.kostenpositionen) ? r.kostenpositionen : []).flatMap((p: unknown, i: number) => {
    if (!istObjekt(p)) return [];
    const q: Objekt = { ...p };
    q.bestandteile = liste(q.bestandteile, elementVon(positionsform.bestandteile!), `Aufschlüsselung zu „${String(q.bezeichnung ?? i + 1)}“`, verworfen);
    q.hinweise = Array.isArray(q.hinweise) ? q.hinweise.filter((t) => typeof t === "string" && t.trim()) : typeof q.hinweise === "string" && q.hinweise.trim() ? [q.hinweise] : [];
    const ok = repariere(positionsform, q);
    if (!ok) verworfen.push(`Kostenposition „${String(q.bezeichnung ?? i + 1)}“ unvollständig – nicht übernommen`);
    return ok ? [ok] : [];
  });
  r.zaehler = liste(r.zaehler, elementVon(form.zaehler!), "Zählerstand", verworfen);
  // Belege: Art "rechnung" als Ersatz (nicht "sonstig")
  r.belege = liste(r.belege, elementVon(form.belege!), "Beleg", verworfen, { ...ERSATZ, art: "rechnung", fremdesObjekt: false });
  r.erlaeuterungen = (Array.isArray(r.erlaeuterungen) ? r.erlaeuterungen : []).flatMap((e: unknown) => {
    const ok = repariere(elementVon(form.erlaeuterungen!), typeof e === "string" ? { text: e } : e);
    return ok && typeof ok.text === "string" && ok.text.trim() ? [ok] : [];
  });
  r.unsicherheiten = Array.isArray(r.unsicherheiten) ? r.unsicherheiten.filter((t) => typeof t === "string") : [];

  // Heizkosten: ohne Betrag der Wohnung nicht verwendbar
  if (r.heizkosten !== null && r.heizkosten !== undefined) {
    const h = repariere(innenVon(form.heizkosten!), r.heizkosten);
    if (!h) verworfen.push("Heizkosten ohne Betrag der Wohnung – nicht übernommen");
    r.heizkosten = h ?? null;
  }
  if (typeof r.istNebenkostenabrechnung !== "boolean") r.istNebenkostenabrechnung = (r.kostenpositionen as unknown[]).length > 0;

  return { roh: repariere(form, r) ?? r, verworfen };
}
