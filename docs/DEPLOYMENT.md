# BiatiCheck online stellen

Es gibt zwei Wege, und sie leisten Verschiedenes:

| | GitHub Pages | Eigener Server |
|---|---|---|
| Was läuft dort | Vorschau: Startseite und ein Beispielergebnis mit der Musterabrechnung | die vollständige App |
| Abrechnungen hochladen | nein | ja |
| Datenbank, Prüfbereich, Auslesen | nein | ja |
| Kosten | keine | Server ab etwa 5–10 € im Monat |
| Wofür | zeigen, wie BiatiCheck aussieht | echter Betrieb, erst als Testumgebung, dann öffentlich |

GitHub Pages liefert nur fertige Dateien aus. Deshalb kann dort keine App laufen, die Dateien entgegennimmt und speichert.

## 1. Vorschau auf GitHub Pages

Die Vorschau baut sich selbst: `.github/workflows/pages.yml` startet die App im Demo-Modus, ruft Startseite und Beispielergebnis im Browser auf und speichert das fertige HTML ohne Programmcode (`apps/web/skripte/vorschau.ts`).

Einmalig einrichten:

1. Im Repository auf GitHub: **Settings → Pages → Source: „GitHub Actions“**.
2. Den Stand nach `main` übernehmen. Der Ablauf läuft bei jedem Push auf `main` und lässt sich unter **Actions → Vorschau auf GitHub Pages → Run workflow** von Hand starten.
3. Die Adresse steht danach unter Settings → Pages, in der Regel `https://heydriver.github.io/biaticheck/`.

Zu beachten:

- Die Seite ist **öffentlich**, auch wenn das Repository privat ist. Sie enthält nur die anonymisierte Musterabrechnung.
- Bei einem privaten Repository braucht GitHub Pages einen bezahlten GitHub-Tarif.
- Impressum und Datenschutzerklärung sind in der Vorschau nicht verlinkt, weil sie noch Platzhalter sind.

Lokal bauen:

```bash
pnpm --filter @biaticheck/web build
NODE_ENV=test DEMO_AUSLESEN=true FREIGABE_ERFORDERLICH=false ZAHLUNG_MODUS=test \
  DATABASE_URL=postgresql://biaticheck:biaticheck@localhost:5432/biaticheck \
  DATEI_SCHLUESSEL=$(openssl rand -base64 32) pnpm --filter @biaticheck/web start -p 3300 &
VORSCHAU_URL=http://localhost:3300 pnpm --filter @biaticheck/web vorschau   # Ergebnis: apps/web/vorschau/
```

## 2. Die echte App auf einem eigenen Server

Drei Dienste in Docker: die App, PostgreSQL und Caddy. Caddy holt und erneuert das HTTPS-Zertifikat selbst.

### Voraussetzungen

- Ein Server in der EU mit Docker (zum Beispiel Hetzner Cloud, 2 vCPU, 4 GB RAM, Ubuntu 24.04)
- Eine Domain, deren DNS-Eintrag (A-Record) auf die IP des Servers zeigt, zum Beispiel `test.biati.de`
- Ports 80 und 443 offen

### Einrichten

```bash
# Docker installieren (einmalig)
curl -fsSL https://get.docker.com | sh

# Code holen
git clone https://github.com/Heydriver/biaticheck.git && cd biaticheck

# Konfiguration anlegen und ausfüllen
cp deploy/.env.example .env
nano .env

# Starten (der erste Build dauert einige Minuten)
docker compose up -d --build

# Experten-Konto für den Prüfbereich anlegen (Passwort wird verdeckt abgefragt)
docker compose run --rm werkzeug pnpm --filter @biaticheck/web experte:anlegen anna@biati.de "Anna Muster"
```

Danach ist die App unter `https://<DOMAIN>` erreichbar, der Prüfbereich unter `https://<DOMAIN>/intern`.

### Was in die `.env` gehört

| Wert | Bedeutung |
|---|---|
| `DOMAIN` | Adresse der App |
| `POSTGRES_PASSWORD` | Passwort der Datenbank: `openssl rand -hex 24` |
| `DATEI_SCHLUESSEL` | verschlüsselt die Abrechnungen: `openssl rand -base64 32`. **Sicher aufbewahren** – ohne ihn sind gespeicherte Abrechnungen nicht mehr lesbar. Die App startet ohne ihn nicht |
| `ANTHROPIC_API_KEY` | Schlüssel für das automatische Auslesen. Leer: jeder Fall geht an einen Experten |
| `FREIGABE_ERFORDERLICH` | `true`: Ergebnisse werden erst nach Freigabe durch einen Experten sichtbar. Für den Start empfohlen |

### Betrieb

```bash
# Neue Version einspielen (die Datenbank wird beim Start automatisch migriert)
git pull && docker compose up -d --build

# Protokolle ansehen
docker compose logs -f app

# Abgelaufene Fälle löschen (90 Tage) – täglich per Cron, z. B. um 3:15 Uhr
15 3 * * * cd /root/biaticheck && docker compose run --rm werkzeug pnpm --filter @biaticheck/web aufraeumen

# Datenbank sichern
docker compose exec -T db pg_dump -U biaticheck biaticheck | gzip > sicherung-$(date +%F).sql.gz
```

Zu sichern sind die Datenbank, das Volume `uploads` (die verschlüsselten Abrechnungen) und die Datei `.env`. Sicherungen gehören auf einen zweiten Speicherort, nicht nur auf denselben Server.

### Geprüft

Am 19.11.2026 lokal mit Docker durchgespielt: Build beider Images, Start aller Dienste, Migration, Aufruf über HTTPS, Upload einer Datei (verschlüsselt im Volume abgelegt, Fall bei den Experten), Experten-Konto anlegen, Anmeldung im Prüfbereich, Aufräumen, Neustart der App ohne Datenverlust. Nicht geprüft: das Zertifikat für eine echte Domain (lokal nur ein selbst ausgestelltes) und das automatische Auslesen mit API-Schlüssel.

## Vor dem öffentlichen Start

Unabhängig von der Technik sind diese Punkte offen:

- Impressum und Datenschutzerklärung ausfüllen und rechtlich prüfen lassen
- Auftragsverarbeitung mit dem KI-Dienstleister (AVV, Verarbeitung in der EU) klären
- Rechtliche Einschätzung zum Rechtsdienstleistungsgesetz (Zahlungshinweis, Schreiben)
- Bezahlung anbinden (Stripe); bis dahin bleibt `ZAHLUNG_MODUS=aus`
- Regeln vom Expertenteam bestätigen lassen (alle stehen auf „Entwurf“)

Empfehlung: zuerst als Testumgebung unter `test.biati.de` mit `FREIGABE_ERFORDERLICH=true` starten.
