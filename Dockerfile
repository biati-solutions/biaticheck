# BiatiCheck – Image für den eigenen Server (siehe docs/DEPLOYMENT.md).
# Zwei Ziele:
#   werkzeug  vollständiger Quellstand mit allen Abhängigkeiten: Datenbank-Migration, Experten-Konto, Aufräumen
#   app       schlankes Laufzeit-Image mit dem eigenständigen Next.js-Server (Standard)

FROM node:22-bookworm-slim AS basis
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

FROM basis AS werkzeug
# Erst nur die Paketlisten: Die Abhängigkeiten bleiben im Zwischenspeicher, solange sie sich nicht ändern.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY packages/pruefkern/package.json packages/pruefkern/
COPY packages/auslesen/package.json packages/auslesen/
RUN pnpm install --frozen-lockfile --filter "@biaticheck/web..."
COPY packages packages
COPY apps/web apps/web
# Der Build braucht keine echte Datenbank – die Verbindung wird erst zur Laufzeit geöffnet.
RUN BUILD_STANDALONE=1 DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm --filter @biaticheck/web build

FROM node:22-bookworm-slim AS app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 UPLOAD_DIR=/daten/uploads
WORKDIR /app
COPY --from=werkzeug --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=werkzeug --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=werkzeug --chown=node:node /app/apps/web/public ./apps/web/public
RUN mkdir -p /daten/uploads && chown -R node:node /daten
USER node
VOLUME /daten/uploads
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
