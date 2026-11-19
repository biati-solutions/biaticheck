# BiatiCheck online stellen

Es gibt zwei Wege, und sie leisten Verschiedenes:

| | GitHub Pages | Eigener Server |
|---|---|---|
| Was läuft dort | die Testseite (`apps/testseite`); ohne Claude-Anmeldung nur „Beispiel ansehen“ | die vollständige App (`apps/web`) |
| Abrechnungen hochladen | nein | ja |
| Datenbank, Prüfbereich, Auslesen | nein | ja |
| Kosten | keine | Server ab etwa 5–10 € im Monat |
| Wofür | zeigen und im Team testen | echter Betrieb, erst als Testumgebung, dann öffentlich |

GitHub Pages liefert nur fertige Dateien aus. Deshalb kann dort keine App laufen, die Dateien entgegennimmt und speichert.

## 1. GitHub Pages

Auf GitHub Pages liegt die **Testseite** aus `apps/testseite`, nicht die Next.js-App. Das ist auf `main` bereits eingerichtet
(`.github/workflows/pages.yml`, Branch `biati-main-test`, gespeicherte Versionen in Ordnern wie `BiatiCheck_v1/`) und in
`CLAUDE.md` beschrieben. Aus `apps/web` wird bewusst keine zweite Vorschau gebaut.

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
git clone https://github.com/biati-solutions/biaticheck.git && cd biaticheck

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

Am 19.11.2026 lokal mit Docker durchgespielt (auf dem Stand vor dem Umzug auf `main`; danach nur der Build der Web-App erneut geprüft): Build beider Images, Start aller Dienste, Migration, Aufruf über HTTPS, Upload einer Datei (verschlüsselt im Volume abgelegt, Fall bei den Experten), Experten-Konto anlegen, Anmeldung im Prüfbereich, Aufräumen, Neustart der App ohne Datenverlust. Nicht geprüft: das Zertifikat für eine echte Domain (lokal nur ein selbst ausgestelltes) und das automatische Auslesen mit API-Schlüssel.

## Vor dem öffentlichen Start

Unabhängig von der Technik sind diese Punkte offen:

- Impressum und Datenschutzerklärung ausfüllen und rechtlich prüfen lassen
- Auftragsverarbeitung mit dem KI-Dienstleister (AVV, Verarbeitung in der EU) klären
- Rechtliche Einschätzung zum Rechtsdienstleistungsgesetz (Zahlungshinweis, Schreiben)
- Bezahlung anbinden (Stripe); bis dahin bleibt `ZAHLUNG_MODUS=aus`
- Regeln vom Expertenteam bestätigen lassen (alle stehen auf „Entwurf“)

Empfehlung: zuerst als Testumgebung unter `test.biati.de` mit `FREIGABE_ERFORDERLICH=true` starten.
