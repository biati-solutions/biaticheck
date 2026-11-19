/**
 * Baut die statische Vorschau für GitHub Pages: die Startseite und ein Beispielergebnis mit der Musterabrechnung.
 *
 * GitHub Pages liefert nur fertige Dateien aus – Upload, Datenbank und Auslesen laufen dort nicht. Die Vorschau
 * ist deshalb ein Abbild der echten Seiten: Die App läuft kurz im Demo-Modus, ein Browser ruft beide Seiten auf,
 * und das fertige HTML wird ohne Programmcode gespeichert.
 *
 * Voraussetzung: gebaute App (`pnpm build`) läuft im Demo-Modus, z. B.
 *   NODE_ENV=test DEMO_AUSLESEN=true FREIGABE_ERFORDERLICH=false ZAHLUNG_MODUS=test pnpm start -p 3300
 * Aufruf:
 *   VORSCHAU_URL=http://localhost:3300 pnpm vorschau [Zielordner]
 */
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "@playwright/test";

const basis = process.env.VORSCHAU_URL ?? "http://localhost:3300";
const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ziel = path.resolve(process.argv[2] ?? path.join(web, "vorschau"));
const PDF = Buffer.from("%PDF-1.7\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF");

const HINWEIS_START = "Vorschau mit Beispieldaten. Eigene Abrechnungen lassen sich hier noch nicht hochladen.";
const HINWEIS_BEISPIEL = "Beispielergebnis mit einer anonymisierten Musterabrechnung.";

/** Entfernt Programmcode und alles, was ohne Server nicht funktioniert, und setzt den Vorschau-Hinweis. */
async function bereinige(page: Page, hinweis: string, verweis: { text: string; href: string }) {
  await page.evaluate(
    ({ hinweis, verweis }) => {
      document.querySelectorAll('script, link[rel="preload"][as="script"], link[rel="modulepreload"], next-route-announcer, nextjs-portal').forEach((e) => e.remove());
      // Schalter und Hinweise, die nur in der echten App Sinn ergeben
      document.querySelector('button[aria-label="Hell- oder Dunkelmodus umschalten"]')?.remove();
      document.querySelector('[role="note"]')?.remove();
      for (const p of document.querySelectorAll("p")) if (p.textContent?.startsWith("Bitte speichern Sie diesen Link")) p.remove();
      // Eingaben sind in der Vorschau nur zum Ansehen
      document.querySelectorAll("main form button, main form input, main button").forEach((e) => e.setAttribute("disabled", ""));
      document.querySelectorAll("form").forEach((f) => f.setAttribute("onsubmit", "return false"));
      // Verweise: Startseite und Anker bleiben, Rechtstexte gibt es in der Vorschau nicht
      for (const a of document.querySelectorAll("a[href]")) {
        const href = a.getAttribute("href")!;
        if (href === "/") a.setAttribute("href", "./");
        else if (href.startsWith("/#")) a.setAttribute("href", `./${href.slice(1)}`);
        else if (href === "/impressum" || href === "/datenschutz") a.removeAttribute("href");
      }
      const balken = document.createElement("div");
      balken.setAttribute("role", "note");
      balken.style.cssText = "background:#0e3b2e;color:#e8f0ec;font:500 14px/1.4 Inter,system-ui,sans-serif;padding:10px 16px;text-align:center";
      balken.append(`${hinweis} `);
      const a = document.createElement("a");
      a.href = verweis.href;
      a.textContent = verweis.text;
      a.style.cssText = "color:#7fe0bd;text-decoration:underline;white-space:nowrap";
      balken.append(a);
      document.body.prepend(balken);
    },
    { hinweis, verweis },
  );
  // Absolute Pfade der App auf Pfade neben der Datei umstellen (Pages liegt in einem Unterordner)
  return "<!DOCTYPE html>" + (await page.evaluate(() => document.documentElement.outerHTML)).replaceAll('"/_next/', '"_next/').replaceAll('"/biati-logo.svg', '"biati-logo.svg');
}

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

// Startseite: der Knopf führt in der Vorschau zum Beispielergebnis
await page.goto(basis, { waitUntil: "networkidle" });
await page.evaluate(() => {
  const knopf = [...document.querySelectorAll("form button")].find((b) => b.textContent?.includes("Kostenlos prüfen"));
  const a = document.createElement("a");
  a.href = "beispiel.html";
  a.className = knopf?.className ?? "";
  a.style.textAlign = "center";
  a.textContent = "Beispielergebnis ansehen";
  knopf?.replaceWith(a);
});
const start = await bereinige(page, HINWEIS_START, { text: "Beispielergebnis ansehen", href: "beispiel.html" });

// Beispielergebnis: Musterabrechnung, Eingangsdatum gesetzt, Schreiben geöffnet
await page.goto(basis, { waitUntil: "networkidle" });
await page.locator("#datei").setInputFiles({ name: "abrechnung.pdf", mimeType: "application/pdf", buffer: PDF });
await page.getByRole("checkbox").check();
await page.getByRole("button", { name: "Kostenlos prüfen" }).click();
await page.getByText("Ihre Nachzahlung").waitFor({ timeout: 60_000 });
const zugang = page.locator("#frage-meta\\.zugangAm");
await zugang.fill("2025-11-28");
await zugang.locator("xpath=ancestor::form").getByRole("button", { name: "Senden" }).click();
await page.getByText("Einspruch möglich").locator("..").getByText(/bis \d/).waitFor();
const erledigen = page.getByRole("button", { name: /erledigen$/ });
if (await erledigen.count()) await erledigen.click();
await page.getByRole("button", { name: "Schreiben öffnen" }).click();
await page.locator("#anschreiben").waitFor();
// Textfelder: der sichtbare Inhalt muss im gespeicherten HTML stehen
await page.evaluate(() => {
  document.querySelectorAll("textarea").forEach((t) => (t.textContent = t.value));
  document.querySelectorAll("input").forEach((i) => i.setAttribute("value", i.value));
});
const beispiel = await bereinige(page, HINWEIS_BEISPIEL, { text: "Zur Startseite", href: "./" });
await browser.close();

await rm(ziel, { recursive: true, force: true });
await mkdir(path.join(ziel, "_next"), { recursive: true });
await cp(path.join(web, ".next", "static"), path.join(ziel, "_next", "static"), { recursive: true });
await cp(path.join(web, "public", "biati-logo.svg"), path.join(ziel, "biati-logo.svg"));
// Schriften werden im CSS mit absolutem Pfad geladen – auf den Ordner neben dem CSS umstellen. Programmcode wird nicht ausgeliefert.
const statisch = path.join(ziel, "_next", "static");
for (const datei of await readdir(statisch, { recursive: true })) {
  const voll = path.join(statisch, datei);
  if (datei.endsWith(".css")) await writeFile(voll, (await readFile(voll, "utf8")).replaceAll("/_next/static/media/", "../media/"));
  else if (/\.(js|map|json)$/.test(datei)) await rm(voll, { force: true });
}
await writeFile(path.join(ziel, "index.html"), start);
await writeFile(path.join(ziel, "beispiel.html"), beispiel);
// Ohne diese Datei blendet GitHub Pages Ordner aus, die mit einem Unterstrich beginnen
await writeFile(path.join(ziel, ".nojekyll"), "");
console.log(`Vorschau gebaut: ${ziel} (index.html ${start.length} Zeichen, beispiel.html ${beispiel.length} Zeichen)`);
