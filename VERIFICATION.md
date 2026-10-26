# Verifiering · 26 oktober 2026

## Komplettering för GitHub

Standardfilen `docker-compose.yml` bygger nu från `greycreations/kottometern`, grenen `main`, med standardvärden för miljövariabler. `docker-compose.local.yml` kan läggas ovanpå för lokala byggen. Båda konfigurationerna validerades med `docker compose config --quiet`. Ingen applikationskod ändrades i denna komplettering.

Docker-motorn blev tillgänglig och följande kontroller genomfördes med Docker 29.7.2:

- `docker compose -p kottometern up --build -d`: godkänt. Byggkontext hämtades direkt från GitHub, commit `681a74d3aa166a365c3147ed4db3fba874c14707`.
- `docker compose -p kottometern up -d --wait --wait-timeout 60`: godkänt, containern rapporterar healthy.
- Containern kör som `uid=1001(app)`, utan root.
- Startsidan svarar HTTP 200 och `/api/health` ger `{"status":"ok"}` genom publicerad port 3000.

## Applikationskontroller

- `npm install`: genomförd, lockfil skapad och direkta beroenden versionslåsta. Installationen rapporterade inga kända sårbarheter.
- `npm run lint`: godkänd utan varningar.
- `npm run typecheck`: godkänd.
- `npm test`: 24 godkända deterministiska tester för regler, gränser, monotonicitet, validering, tidsval, sommartid, cache, deduplicering, TTL, fallback, platsisolering och leverantörsfel.
- `npm run test:e2e`: 8 godkända tester, Chromium vid 320 px och 1280 px. Ortsval, tangentbord, ingen horisontell scroll, sparad plats, blockerad localStorage, nekad positionering, tom sökning, hämtfel/återförsök och snabba platsbyten.
- Visuell kontroll av startsidan vid 390 px: genomförd.
- `npm run build`: godkänt produktionsbygge med Next.js 16.4.3 och standalone-output. Windows-sandboxens EPERM krävde att bygget kördes med utökad åtkomst.
- `docker compose config --quiet`: godkänd med kopierad `.env.example`.
- Riktiga lokala HTTP-anrop till `/api/health`, `/api/locations?q=Göteborg` och `/api/weather?lat=57.7&lon=12`: godkända. Väderanropet gav validerad hourly-data, svensk motivering och Europe/Stockholm. Leverantörens dokumentation för parametrar, enheter, tidssemantik och villkor lästes vid implementationen.

## Kvarvarande verifieringsluckor

Ingen fysisk mobil eller separat hjälpmedelsläsare har använts. Positioneringens lyckade hårdvaruflöde är inte verifierat. Browserförlopp och fel mockas i de automatiska testerna; riktiga leverantörsanrop är separata rökprov och ingår inte i deterministiska tester.
