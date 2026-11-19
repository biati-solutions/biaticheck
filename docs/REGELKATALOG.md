# Regelkatalog v0.6 (Entwurf)

Alle Regeln haben den Stand **Entwurf** und müssen vom Expertenteam bestätigt werden.
Code: `packages/pruefkern/src/regeln/` · Tests: `packages/pruefkern/test/`

| ID | Regel | Grundlage | Ergebnis bei Verstoß | Wenn Daten fehlen |
|---|---|---|---|---|
| F-01 | Abrechnungszeitraum ≤ 12 Monate; seit 0.6: Abrechnung nicht vor Ende des Zeitraums datiert | § 556 Abs. 3 S. 1 BGB | Abweichung; zu früh erstellt: Auffälligkeit | nicht prüfbar |
| F-02 | Abrechnung innerhalb von 12 Monaten nach Ende des Zeitraums zugegangen | § 556 Abs. 3 S. 2, 3 BGB | verspätet, Zeitraum noch nicht bestätigt: **Prüfbedarf** (Nachzahlung zählt nicht); Zeitraum durch lückenlos anschließende Vorjahresabrechnung bestätigt: Abweichung, Nachzahlung entfällt | Eingangsdatum; Vorjahresabrechnung |
| F-03 | Einwendungsfrist des Mieters | § 556 Abs. 3 S. 5–6 BGB | Auffälligkeit (abgelaufen) | Rückfrage Zugangsdatum |
| F-04 | Gesamtkosten und Umlageschlüssel je Position; seit 0.6 auch die Werte des Schlüssels (Gesamtmenge, eigener Anteil) und kein nicht erklärter Schlüssel | § 259 BGB; BGH VIII ZR 93/15 | Auffälligkeit | – |
| F-05 | Keine Abrechnung bei Pauschale | Mietvertrag | Abweichung | – |
| F-06 | Verständliche Bezeichnung: keine unerklärten Abkürzungen, keine Sammelbegriffe („Sonstige Kosten“, „Hausstrom“) | § 259 BGB; AG Hamburg 49 C 607/24, 48 C 320/20 | Auffälligkeit ohne Betrag (nur Amtsgerichte) | – |
| R-01 | Anteil je Position nachrechnen (inkl. Zeitanteil bei Ein-/Auszug); seit 0.6 auch nach Verbrauch verteilte Positionen (ohne Zeitanteil) | § 556a BGB | Abweichung mit Betrag | nicht prüfbar; nicht nachrechenbare Positionen werden gezählt |
| R-02 | Gesamtsumme der Positionen | Rechnerisch | Abweichung | – |
| R-03 | Saldo = Kosten − Vorauszahlungen | Rechnerisch | Abweichung | Rückfrage Vorauszahlungen |
| R-04 | Einheitliche Wohn-, Gesamt- und Heizflächen | § 556a BGB | Auffälligkeit | – |
| R-05 | Angerechnete Vorauszahlungen passen zu den tatsächlichen Zahlungen | § 556 Abs. 2 BGB | ohne Beleg: **Prüfbedarf** (Betrag zählt nicht zum Potenzial); mit belegtem Verlauf: Fehler mit Betrag | Vorjahresabrechnung oder Kontoauszüge |
| R-06 | Ein- oder Auszug im Abrechnungsjahr berücksichtigt (Mietbeginn/-ende laut Mietvertrag) | § 556a Abs. 1 BGB | Auffälligkeit mit „bis zu“-Betrag: zeitabhängige Kosten × Tage außerhalb der Mietzeit | Mietvertrag |
| R-07 | Wohnfläche der Abrechnung passt zum Mietvertrag (Toleranz 3 %) | § 556a BGB; BGH VIII ZR 220/17 (tatsächliche Fläche maßgeblich) | Auffälligkeit mit „bis zu“-Betrag auf nach Fläche verteilte Kosten | Mietvertrag |
| R-08 | Gesamtfläche und Wohnfläche wie im Vorjahr (Toleranz 1 %); kleinere Gesamtfläche = möglicher Leerstand | § 556a BGB; BGH VIII ZR 159/05 | Auffälligkeit mit „bis zu“-Betrag auf nach Fläche verteilte Kosten | Vorjahresabrechnung (Flächen werden beim Nachreichen ausgelesen) |
| R-09 | Verteilerschlüssel wie im Mietvertrag; ohne Vereinbarung gilt Wohnfläche (Verbrauch, direkte Zuordnung und Heizung ausgenommen) | § 556a Abs. 1 BGB | Auffälligkeit ohne Betrag | Mietvertrag (`mietvertrag.umlageschluessel`) |
| R-10 | Verbrauchskosten bei Ein- oder Auszug: Zwischenablesung erfolgt | § 9b HeizkostenV; § 556a BGB | ohne Ablesung: Auffälligkeit | Rückfrage: Zähler abgelesen? |
| I-01 | Keine nicht umlagefähigen Kosten (Verwaltung, Instandhaltung, Rücklage, Bank) | § 1 Abs. 2 BetrKV | Abweichung mit Betrag | – |
| I-02 | Sonstige Betriebskosten im Mietvertrag vereinbart | § 2 Nr. 17 BetrKV | Abweichung mit Betrag | Rückfrage Mietvertrag |
| I-03 | Jede Position einer Kostenart zuordenbar | § 2 BetrKV | Auffälligkeit | – |
| I-04 | Heizkosten: Verbrauchsanteil 50–70 %, Verbrauch erfasst (sonst 15 % Kürzung). Neu in 0.5: Warmwasser ohne Zähler (Schätzung, Formel, Verdunster) → 15 % der Warmwasserkosten, nicht zusätzlich zur Kürzung der gesamten Heizkosten | §§ 7, 8, 12 HeizkostenV | Abweichung / Auffälligkeit (Warmwasseranteil unbekannt: Auffälligkeit ohne Betrag) | Rückfrage Heizkostenabrechnung |
| I-05 | Kabel-/SAT-Kosten nur bis 30.06.2024. Neu in 0.5: Betriebsstrom der Anlage und Glasfaserbereitstellungsentgelt bleiben zulässig | § 2 Nr. 15 BetrKV, § 230 Abs. 4 TKG | Abweichung / Auffälligkeit (zeitanteilig) | – |
| I-06 | Aufzugskosten bei EG-Wohnung | BGH VIII ZR 103/06; Mietvertrag | Abweichung bei vertraglicher Ausnahme | Rückfrage Mietvertrag |
| I-07 | Wartung ohne Reparaturanteil (Vollwartung, Handwerkerleistung) | § 1 Abs. 2 BetrKV | Auffälligkeit | – |
| I-08 | CO₂-Kosten nach Stufenmodell aufgeteilt | CO2KostAufG | Abweichung | – |
| I-09 | Wasser nach Verbrauch, wenn ein Wasserzähler vorhanden ist | § 556a Abs. 1 S. 2 BGB | ohne Angabe: Prüfbedarf (ohne Betrag); mit Zähler: Auffälligkeit | Rückfrage: eigener Wasserzähler? |
| I-10 | Rauchwarnmelder: nur Wartung, keine Miete | BGH VIII ZR 379/20 | „Miete“: Abweichung mit Betrag; gemischt oder unklar: Auffälligkeit ohne Betrag | Rechnung mit getrennter Miete/Wartung |
| I-11 | Hauswart ohne Reparatur-, Verwaltungs- oder Bereitschaftsanteil | § 2 Nr. 14, § 1 Abs. 2 BetrKV; AG Leonberg 4 C 446/14 | Hinweis im Namen: Auffälligkeit mit „bis zu 20 %“ (neu in 0.5); > 130 % des DMB-Werts (0,37 €/m²/Monat): Auffälligkeit ohne Betrag | Hauswartvertrag, Leistungsverzeichnis |
| I-12 | Vorwegabzug bei Gewerbe im Haus | § 556a BGB; BGH VIII ZR 78/05 | Gewerbe ja, kein Vorwegabzug: Auffälligkeit ohne Betrag | Rückfrage: Gewerbe im Haus? |
| I-13 | Leerstand trägt der Vermieter (gleiche Wohnungsanzahl bei nach Einheiten verteilten Kosten) | § 556a BGB; BGH VIII ZR 159/05 | Auffälligkeit mit „bis zu“-Betrag | – |
| I-14 | Grundsteuer ab 2025: Änderung ≥ 20 % gegenüber Vorjahr belegt | § 2 Nr. 1 BetrKV; GrStG | Auffälligkeit, Grundsteuerbescheid anfordern | Vorjahresabrechnung |
| I-15 | CO₂-Kosten und Einstufung des Gebäudes in der Heizkostenabrechnung ausgewiesen (Zeiträume ab 01.01.2023) | § 7 Abs. 3, 4 CO2KostAufG | Gas/Heizöl: Abweichung, 3 % der Heizkosten; Fernwärme oder Energieträger unbekannt: Auffälligkeit „bis zu“; Strom/Holz: kein Befund | – |
| I-16 | Nur gebäudebezogene Versicherungen (keine Rechtsschutz-, Mietausfall-, Hausratversicherung) | § 2 Nr. 13, § 1 Abs. 2 BetrKV | Abweichung mit Betrag | – |
| I-17 | Keine einmaligen Kosten und Anschaffungen | § 556 Abs. 1 BGB; § 1 Abs. 1 BetrKV | eindeutig (Anschaffung, Erstbepflanzung, Leuchtmittel, Kauf/Miete Feuerlöscher): Abweichung; möglich (Verstopfung, Sonderreinigung, Entrümpelung, Graffiti): Auffälligkeit „bis zu“ | Rechnung |
| I-18 | Hauswart: keine Sammelposition mit Garten/Reinigung; keine Doppelabrechnung, wenn der Hauswart über dem DMB-Wert liegt und Garten/Reinigung zusätzlich abgerechnet werden | § 2 Nr. 9, 10, 14 BetrKV; AG Hamburg 49 C 535/23 | Auffälligkeit ohne Betrag | Leistungsverzeichnis |
| I-19 | Kostenart im Mietvertrag auf den Mieter umgelegt (Verweis auf die BetrKV = alle; sonst nur die aufgezählten). Ohne Heizkosten, sonstige (I-02) und nicht umlagefähige Kosten (I-01) | § 556 Abs. 1 BGB; BGH VIII ZR 137/15 | Abweichung mit Betrag | Mietvertrag (`mietvertrag.umgelegteKostenarten`) |
| P-01 | Vorjahresvergleich (> 10 % und > 25 €; neue Kostenarten) | Wirtschaftlichkeitsgebot | Auffälligkeit | Rückfrage Vorjahresabrechnung |
| P-02 | Kalte Nebenkosten pro m² und Monat (Schwelle 2,50 € – **Entwurf**) | Betriebskostenspiegel | Auffälligkeit | Rückfrage Wohnfläche |
| P-03 | Warmwasserkosten pro m³ (Schwelle 20 € – **Entwurf**) | Wirtschaftlichkeitsgebot | Auffälligkeit | – |
| P-04 | Kennwert je Kostenart: mehr als doppelt so teuer wie der DMB-Wert und mehr als 50 € über dem Durchschnitt (**Entwurf**). Ohne Heizung, Hauswart (I-11), Sonstige (I-02) und Wasser (verbrauchsabhängig) | Wirtschaftlichkeitsgebot; Betriebskostenspiegel | Auffälligkeit ohne Betrag; im Schreiben nur Bitte um Belege, kein Einwand | Wohnfläche |

Hinweis F-03: Gerechnet wird vorsichtig „Zugang + 12 Monate“ (taggenau). Ob die Frist erst zum Monatsende abläuft, soll das Expertenteam entscheiden.

Hinweis I-10: Die Wartung von Rauchwarnmeldern ist nur umlagefähig, wenn sie im Mietvertrag vereinbart ist. Das prüft bereits I-02 (Position der Kategorie „sonstige“), deshalb gibt es dafür keine eigene Regel.

## Neu in v0.5

Quelle: Wettbewerbs- und Quellenanalyse vom 11.11.2026 (Mineko-AGB, NebenkostenPro, Verbraucherzentrale Energieberatung, VR.de, Finanztip-Anbietertest 2026).

- Neue Regeln: F-06, R-08, R-09, R-10, I-15, I-16, I-17, I-18, P-04. Erweitert: I-04 (Warmwasser), I-05 (Glasfaser), I-11 (20 %).
- Erledigte Kandidaten aus v0.4: Doppelabrechnung Hauswart (I-18), Kennwerte je Kostenart (P-04), Versicherungsarten (I-16), Zwischenablesung (R-10).
- Rechtsprechung der Amtsgerichte (F-06, I-18, 20 % bei I-11) führt nie zu einem sicheren Fehler, nur zu einer Auffälligkeit. Die Aktenzeichen stammen aus Finanztip und sind vom Expertenteam gegen die Urteile zu prüfen.
- Zahlungshinweis geändert, siehe unten.

## Nächste Regelkandidaten (aus Musterprüfungen ergänzen)

- Plausibilität der Vorauszahlungsanpassung nach § 560 Abs. 4 BGB (G-001)
- Öffentlich geförderter Wohnraum: Sonderregeln NMV 1970, Umlageausfallwagnis (G-001)
- Heizkostenabrechnung: Pflichtangaben seit der HeizkostenV-Novelle 2021 (Verbrauchsvergleich, monatliche Verbrauchsinformation bei fernablesbaren Geräten)
- Zählerabgleich: Zählernummer, Anfangs- und Endstand vom Kunden bestätigen lassen
- Mietvertrag automatisch auslesen (vereinbarte Kostenarten, Verteilerschlüssel, Wohnfläche)

## Ergebnisstufen und Prüfbedarf

| Stufe | Bedeutung | zählt zum Potenzial |
|---|---|---|
| Fehler (`abweichung`) | eindeutig | ja, sicher |
| Auffällig (`auffaelligkeit`) | wahrscheinlich, Belegeinsicht nötig | ja, „zu klären“ |
| Prüfbedarf (`pruefbedarf`) | möglicher Fehler, aber erst mit weiteren Unterlagen sicher | **nein** – der Kunde wird um die Unterlage gebeten (`unterlagen`), danach wird neu geprüft |
| Nicht prüfbar (`nicht_pruefbar`) | Angaben fehlen | nein |

Leitlinie: Ein Betrag erscheint erst dann als mögliche Ersparnis, wenn das Tool sich sicher genug ist. Sonst lieber eine Unterlage nachfordern als ein Schreiben mit einer falschen Forderung empfehlen.

## Zahlungshinweis und Fristen (seit v0.5)

Ein Einwand gegen die Abrechnung schiebt die Fälligkeit der Nachzahlung nicht auf (§ 286 Abs. 3 BGB). Verbraucherzentrale, Finanztip und VR.de empfehlen deshalb übereinstimmend die Zahlung unter Vorbehalt.

| Lage | Hinweis im Fahrplan |
|---|---|
| Nachforderung entfällt insgesamt (F-02 bestätigt, F-05) | „Nachzahlung nicht bezahlen“ |
| Frist möglicherweise versäumt (F-02 Prüfbedarf) | „Nachzahlung nur unter Vorbehalt zahlen“ (vorher: vorerst nicht bezahlen) |
| Sichere Fehler oder zu klärende Punkte | „Nachzahlung unter Vorbehalt zahlen“, Betrag mit dem Schreiben zurückfordern (vorher: höchstens Saldo − sicher zahlen bzw. ab 30 € noch nicht bezahlen) |
| Kunde hat schon gezahlt (`meta.nachzahlungGezahlt`) | „Zu viel Gezahltes zurückfordern“, das Schreiben nennt die geleistete Zahlung |

- Zahlungsfrist: Zugang + 30 Tage, in Stufe 1 neben der Einwendungsfrist (`zahlungsfrist`). Bei einem Guthaben gerät danach der Vermieter in Verzug.
- Die Kernaussage „… müssen Sie nicht bezahlen“ erscheint nur noch, wenn die Nachforderung insgesamt entfällt. Sonst: „… sind falsch abgerechnet“.
- Einwendungsfrist (F-03): taggenau ein Jahr nach Zugang, nicht zum Jahresende (LG Berlin 63 S 35/16, laut Finanztip). Die bisherige Rechnung bleibt.
- Vom Expertenteam bzw. Anwalt zu bestätigen (RDG).

## Zusätzliche Ausgaben in Stufe 2 (seit v0.5)

- `nachfassschreiben`: Erinnerung, wenn die Hausverwaltung nach 14 Tagen nicht antwortet.
- `belegeinsicht`: eigenes Schreiben nur für die Belege, dazu eine Prüfliste je Beleg (`fahrplan.belegPruefliste`).
- `positionen`: jede Kostenposition mit Bewertung (in Ordnung, Fehler, zu klären, noch offen) und anzuforderndem Beleg.
- Eingangsfrage „Haben Sie die Nachzahlung schon bezahlt?“ als Rückfrage in Stufe 2.

## Auslesen (seit v0.5)

- Neue Felder: Energieträger, CO₂-Angaben vorhanden, Warmwasser mit Zähler erfasst, Warmwasseranteil der Wohnung; aus der Vorjahresabrechnung zusätzlich Wohn- und Gesamtfläche.
- Zweite Lesung: Stimmen die Zahlen der ersten Lesung untereinander nicht, wird das Dokument ein zweites Mal gelesen. Nur wenn auch diese unstimmig ist, geht der Fall an einen Experten.

## Abdeckung der sieben Prüfbereiche (seit v0.6)

| Prüfbereich | Regeln | Grenzen |
|---|---|---|
| Abrechnungszeitraum und Erstellung der Abrechnung | F-01, F-02, F-03, R-06, R-10 | Zugangsdatum kommt vom Kunden |
| Rechnerische Richtigkeit jeder Position | R-01 (alle Schlüssel mit Werten, auch Verbrauch), R-02, R-03, R-05, I-08 | Heizkosten-Einzelabrechnung (Grund- und Verbrauchskosten) wird nicht nachgerechnet; direkt zugeordnete Kosten sind nicht nachrechenbar |
| Korrekte Verteilerschlüssel | F-04, R-04, R-07, R-08, R-09, I-04, I-09, I-12, I-13 | R-09 braucht den Schlüssel aus dem Mietvertrag |
| Umlagefähigkeit der Kostenarten | I-01, I-03, I-05, I-07, I-10, I-11, I-16, I-17, I-18 | Reparaturanteile nur als Auffälligkeit, Klärung über Belege |
| Formelle Richtigkeit | F-01, F-04, F-06, R-02, R-03 | – |
| Vereinbarkeit mit dem Mietvertrag | F-05, I-02, I-06, I-19, R-06, R-07, R-09 | Der Mietvertrag wird noch nicht automatisch ausgelesen. Die Angaben kommen aus Rückfragen oder vom Experten; ohne sie bleiben diese Regeln stumm bzw. „nicht prüfbar“ |
| Aktuelle Rechtsprechung | jede Regel nennt ihre Grundlage (`grundlage`) und hat eine Version; der Prüfbericht nennt `rechtsstand` | Kein Automatismus: neue Urteile müssen vom Expertenteam eingepflegt werden, danach `RECHTSSTAND` in `pruefung.ts` hochsetzen |

### Berücksichtigte Rechtsprechung (Rechtsstand 2026-11)

| Entscheidung | Thema | Regel |
|---|---|---|
| BGH VIII ZR 93/15 (20.01.2016) | Mindestangaben einer Abrechnung | F-04 |
| BGH VIII ZR 137/15 (10.02.2016) | Verweis auf die Betriebskostenverordnung genügt als Vereinbarung | I-19 |
| BGH VIII ZR 220/17 (30.05.2018) | tatsächliche Wohnfläche maßgeblich | R-07 |
| BGH VIII ZR 159/05 (31.05.2006) | Leerstand trägt der Vermieter | I-13, R-08 |
| BGH VIII ZR 78/05 (08.03.2006) | Vorwegabzug für Gewerbe | I-12 |
| BGH VIII ZR 103/06 (20.09.2006) | Aufzugskosten im Erdgeschoss | I-06 |
| BGH VIII ZR 379/20 (11.05.2022) | Miete von Rauchwarnmeldern nicht umlagefähig | I-10 |
| AG Leonberg 4 C 446/14 | pauschaler Abzug beim Hauswart | I-11 |
| AG Hamburg 49 C 535/23, 49 C 607/24, 48 C 320/20 | Sammelpositionen, unverständliche Bezeichnungen | I-18, F-06 |
| LG Berlin 63 S 35/16 | Einwendungsfrist taggenau | F-03 |
| AG Berlin-Wedding 7 C 554/22 | Betriebskostenspiegel allein beweist keine Unwirtschaftlichkeit | P-02, P-04 |

Die Aktenzeichen der Amts- und Landgerichte sowie BGH VIII ZR 137/15 sind aus Sekundärquellen bzw. aus dem Gedächtnis übernommen und vom Expertenteam gegen die Urteile zu prüfen.
