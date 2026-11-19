import { Hochladen } from "@/komponenten/Hochladen";
import { MINDESTERSPARNIS, PREIS } from "@/server/ansicht";

const euro = (n: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);

/** Was geprüft wird – in der Sprache der Mieter, ohne Paragraphen und ohne Zählerei. */
const PRUEFPUNKTE = [
  ["Fristen", "Kam die Abrechnung rechtzeitig? Wenn nicht, müssen Sie eine Nachzahlung oft gar nicht leisten."],
  ["Rechenwege", "Wir rechnen Ihren Anteil an jeder Position nach und prüfen Summe und Nachzahlung."],
  ["Verteilung", "Stimmen Wohnfläche und Verteilerschlüssel, und passen sie zum Vorjahr?"],
  ["Kosten, die Sie nicht zahlen müssen", "Verwaltung, Reparaturen, Anschaffungen oder Versicherungen des Vermieters gehören nicht in die Abrechnung."],
  ["Heizung und Warmwasser", "Wurde nach Verbrauch abgerechnet, und trägt der Vermieter seinen Teil der CO₂-Kosten?"],
  ["Vorauszahlungen", "Sind alle Ihre Zahlungen vollständig angerechnet?"],
] as const;

const SCHRITTE = [
  ["Abrechnung hochladen", "Als PDF oder Foto. Legen Sie die Heizkostenabrechnung dazu, wenn Sie eine bekommen haben."],
  ["Wir prüfen", "Wir lesen Ihre Abrechnung aus und rechnen jede Position nach. Unklare Fälle sieht sich einer unserer Fachleute an."],
  ["Ergebnis ansehen", "Sie sehen, welche Punkte auffallen und um wie viel Geld es geht. Auf Wunsch erhalten Sie ein fertiges Schreiben an Ihre Hausverwaltung."],
] as const;

const FRAGEN = [
  [
    "Was kostet die Prüfung?",
    `Die Prüfung und das Ergebnis sind kostenlos. Das fertige Schreiben an Ihre Hausverwaltung kostet ${euro(PREIS)} – aber nur, wenn wir mindestens ${euro(MINDESTERSPARNIS)} für Sie gefunden haben. Sonst ist auch das kostenlos.`,
  ],
  [
    "Welche Unterlagen brauche ich?",
    "Für den Anfang genügt die Abrechnung. Mit der Abrechnung des Vorjahres und Ihrem Mietvertrag können wir noch mehr Punkte prüfen. Danach fragen wir Sie nur, wenn es sich lohnt.",
  ],
  ["Wie lange dauert es?", "Meist etwa eine Minute. Schauen wir uns Ihre Abrechnung zusätzlich von Hand an, sehen Sie das Ergebnis unter Ihrem persönlichen Link, sobald es vorliegt."],
  [
    "Was passiert mit meinen Daten?",
    "Ihre Abrechnung wird verschlüsselt gespeichert und nach 90 Tagen gelöscht. Sie brauchen kein Konto. Namen und Kontodaten aus der Abrechnung übernehmen wir nicht.",
  ],
  ["Ist das eine Rechtsberatung?", "Nein. Wir prüfen Ihre Abrechnung rechnerisch und nach allgemeinen Regeln. Bei einem Streit mit dem Vermieter helfen ein Mieterverein oder eine Anwältin."],
] as const;

function Haken() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="mt-[3px] shrink-0 text-gruen" aria-hidden="true">
      <path d="M4 10.5l4 4 8-9" />
    </svg>
  );
}

export default function Startseite() {
  return (
    <>
      <section className="border-b border-linie bg-grund-alt" aria-labelledby="titel">
        <div className="mx-auto grid w-full max-w-6xl items-start gap-10 px-4 py-10 md:grid-cols-[1fr_minmax(0,460px)] md:gap-14 md:py-16">
          <div className="min-w-0 md:pt-4">
            <p className="text-sm font-semibold text-gruen-tief">Nebenkostenprüfung von Biati Solutions</p>
            <h1 id="titel" className="mt-3 text-[clamp(32px,4.6vw,52px)] leading-[1.08] font-bold">
              Stimmt Ihre Nebenkosten{"­"}abrechnung?
            </h1>
            <p className="mt-4 max-w-[32em] text-lg text-gedaempft">
              Laden Sie Ihre Abrechnung hoch. Wir rechnen nach und zeigen Ihnen, ob Sie zu viel zahlen – und was Sie dann tun können.
            </p>
            <ul className="mt-7 grid gap-2.5 text-[15px]">
              {["Kostenlos und ohne Konto", "Ergebnis meist nach einer Minute", "Fertiges Schreiben an die Hausverwaltung, wenn etwas nicht stimmt"].map((punkt) => (
                <li key={punkt} className="flex gap-2.5">
                  <Haken />
                  {punkt}
                </li>
              ))}
            </ul>
          </div>
          <div id="pruefen" className="scroll-mt-24">
            <Hochladen />
          </div>
        </div>
      </section>

      <section id="ablauf" className="scroll-mt-20 py-16 md:py-20" aria-labelledby="ablauf-titel">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4">
          <h2 id="ablauf-titel" className="text-[clamp(26px,3.2vw,36px)] leading-tight font-bold">
            So läuft es ab
          </h2>
          <ol className="grid gap-8 md:grid-cols-3 md:gap-10">
            {SCHRITTE.map(([titel, text], i) => (
              <li key={titel} className="grid content-start gap-2 border-t-2 border-gruen pt-4">
                <span className="text-sm font-semibold text-gruen-tief">Schritt {i + 1}</span>
                <h3 className="text-lg font-bold">{titel}</h3>
                <p className="text-[15px] text-gedaempft">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="inhalt" className="scroll-mt-20 border-y border-linie bg-grund-alt py-16 md:py-20" aria-labelledby="inhalt-titel">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4">
          <div className="grid max-w-2xl gap-3">
            <h2 id="inhalt-titel" className="text-[clamp(26px,3.2vw,36px)] leading-tight font-bold">
              Das schauen wir uns an
            </h2>
            <p className="text-lg text-gedaempft">Die häufigsten Fehler in Nebenkostenabrechnungen – und die, die am meisten Geld kosten.</p>
          </div>
          <ul className="grid gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {PRUEFPUNKTE.map(([titel, text]) => (
              <li key={titel} className="flex gap-3">
                <Haken />
                <div className="grid content-start gap-1">
                  <h3 className="font-semibold">{titel}</h3>
                  <p className="text-[15px] text-gedaempft">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="py-16 md:py-20" aria-labelledby="team-titel">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 md:grid-cols-[1fr_1.2fr] md:gap-14">
          <div className="grid content-start gap-3">
            <h2 id="team-titel" className="text-[clamp(26px,3.2vw,36px)] leading-tight font-bold">
              Wer hinter BiatiCheck steht
            </h2>
            <p className="text-gedaempft">
              BiatiCheck ist ein Angebot des Energieteams von Biati Solutions. Die Prüfung folgt dem, worauf unsere Fachleute bei Abrechnungen achten. Ist etwas
              unklar, schaut sich ein Mensch Ihre Abrechnung an, bevor Sie das Ergebnis sehen.
            </p>
            <a href="#pruefen" className="mt-2 inline-flex justify-self-start rounded-lg bg-gruen px-5 py-3 font-semibold text-white hover:bg-gruen-tief">
              Abrechnung hochladen
            </a>
          </div>
          <div id="fragen" className="scroll-mt-24">
            <h2 className="mb-2 text-lg font-bold">Häufige Fragen</h2>
            {FRAGEN.map(([frage, antwort]) => (
              <details key={frage} className="group border-b border-linie py-3.5">
                <summary className="flex cursor-pointer list-none items-baseline justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                  {frage}
                  <span className="text-gedaempft transition-transform group-open:rotate-45" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p className="mt-2 text-[15px] text-gedaempft">{antwort}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
