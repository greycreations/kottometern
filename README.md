# Köttometern

En responsiv svensk väderapp som väger temperatur, nederbörd och vind på skalan stekpanna–grill. Välj en ort bland sökträffarna eller begär positionering. Ingen position efterfrågas automatiskt. Endast den senaste platsen sparas i webbläsaren.

## Starta med Docker

Node 24 LTS används i flerfasbygget. En container, ingen databas. Standardfilen bygger direkt från `https://github.com/greycreations/kottometern.git#main`. Du behöver bara Compose-filen och en fungerande Docker-motor med internetåtkomst; ingen lokal klon eller Git-installation krävs.

Hämta och starta i en tom mapp (PowerShell):

```powershell
Invoke-WebRequest https://raw.githubusercontent.com/greycreations/kottometern/main/docker-compose.yml -OutFile docker-compose.yml
docker compose up --build -d
```

Alla miljövariabler har standardvärden. För egna inställningar kan du hämta `.env.example` från repot och kopiera till `.env`. Från en klon av repot:

```sh
cp .env.example .env
docker compose up --build -d
```

PowerShell: `Copy-Item .env.example .env` följt av `docker compose up --build -d`.

För att hämta senaste koden från `main` och bygga om, kör `docker compose build --no-cache` och sedan `docker compose up -d`. För en fixerad version kan `#main` i byggkontexten ersättas med en tagg eller fullständig commit-SHA.

För att bygga **lokal källkod**, inklusive egna opushade ändringar, använd båda filerna:

```sh
docker compose -f docker-compose.yml -f docker-compose.local.yml up --build -d
```

Använd samma `-f`-argument vid exempelvis `down` för lokalbygget. Enbart standardfilen använder alltid koden i GitHub-repot.

Öppna http://localhost:3000. Se loggar med `docker compose logs -f app`. Stoppa med `docker compose down`. Ändra `PORT` i `.env` för annan värdport; containerporten förblir 3000. På mobil används datorns nätverksadress och vald port. Positionering kräver normalt HTTPS, medan localhost fungerar lokalt. Manuell ortsökning fungerar över HTTP.

## Utveckling och kontroller

```sh
npm ci
npm run dev
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

Tester mockar leverantören och använder fixerad tid. Playwright kör 320 px och desktop. Hälsokontroll: `GET /api/health`, utan externa anrop.

## Konfiguration och beteende

`src/config/grill-rules.ts` innehåller typade trösklar som både motor och gränssnitt använder. Ändringar kräver ombyggnad. Ogiltiga gränser stoppar serverstart. Lägsta delnivå avgör; lika nivå bryts med nederbörd, vind, temperatur. Råa tal används vid beräkning; bara visningen avrundas. Motiveringar är fasta svenska texter.

Servern använder Open-Meteos hourly temperature_2m, precipitation och wind_speed_10m med °C, mm och m/s. Nederbörden avser föregående timme. Senaste Unix-timme som inte ligger i framtiden väljs, alla värden från samma index; ny data måste vara yngre än 90 minuter. Tider formateras med svarets IANA-tidszon utan manuell UTC-förskjutning. Vädret är modellbaserat. Molnighet och dagsljus ingår inte.

Minnescache har tio minuters TTL och högst 200 koordinatpar, äldst först. Koordinater avrundas till tre decimaler även i leverantörsanropet. Samtidiga identiska väderanrop delas. Vid fel tillåts samma plats gamla cache endast när både vädertid och hämtning är högst 60 minuter gamla; ursprungliga tider bevaras. Cache försvinner vid omstart. Ingen fabricerad fallback eller automatisk retry. Leverantörstimeout är åtta sekunder. Sökningar cachas inte. Klienten uppdaterar medan sidan är synlig, och vid återgång om tio minuter passerat.

Interna API:er är `/api/locations?q=...` och `/api/weather?lat=...&lon=...`, med no-store och högst 30 anrop per minut per klient. Vid direkt Compose-drift delar klienter utan proxyhuvud en begränsning. Använd endast betrodd proxy om x-forwarded-for används; processen är inte avsedd som distribuerad publik API-gateway.

`.env` laddas av Compose och ska inte checkas in. `OPEN_METEO_FORECAST_URL` och `OPEN_METEO_GEOCODING_URL` styr serverns fasta leverantörsadresser. `OPEN_METEO_API_KEY` är valfri och skickas bara från servern. Med kundnyckel måste motsvarande kundendpoints anges. Trösklar finns inte i miljövariabler.

## Källor och användning

- [Forecast API och enheter](https://open-meteo.com/en/docs)
- [Geocoding API och GeoNames](https://open-meteo.com/en/docs/geocoding-api)
- [Open-Meteos villkor](https://open-meteo.com/en/terms)

Den fria tjänsten är avsedd för icke-kommersiellt bruk och har anropsgränser. Kommersiell drift kräver lämpligt avtal och kundendpoints. Data anges med Open-Meteo/CC BY 4.0 och GeoNames i appens sidfot. Köttometern bedömer väder, inte eldningsförbud.

## Verifieringsrapport

Se `VERIFICATION.md` för faktiskt utförda kontroller och miljöbegränsningar.
