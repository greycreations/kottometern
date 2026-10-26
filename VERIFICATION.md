# Verifiering · 26 oktober 2026

## Komplettering för GitHub

Standardfilen `docker-compose.yml` bygger nu från `greycreations/kottometern`, grenen `main`, med standardvärden för miljövariabler. `docker-compose.local.yml` kan läggas ovanpå för lokala byggen. Båda konfigurationerna valideras med `docker compose config --quiet`. Ingen applikationskod ändrades i denna komplettering. Containerbygge och start är fortsatt inte verifierade när Docker-motorn saknas.

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

Docker-klient 29.7.2 finns, men Docker-motorn är inte tillgänglig (`dockerDesktopLinuxEngine` saknas). Containerbygge, Compose-start och hälsokontroll inuti containern är därför **inte verifierade**. Starta Docker Desktop/Linux-motorn och kör README-kommandona för att slutföra den kontrollen.

Ingen fysisk mobil eller separat hjälpmedelsläsare har använts. Positioneringens lyckade hårdvaruflöde är inte verifierat. Browserförlopp och fel mockas i de automatiska testerna; riktiga leverantörsanrop är separata rökprov och ingår inte i deterministiska tester.
