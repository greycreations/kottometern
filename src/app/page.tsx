"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { rules, titles } from "../config/grill-rules";
import type { normalize } from "../lib/provider";
type Place = {
  name: string;
  region?: string;
  country?: string;
  lat: number;
  lon: number;
};
type Result = ReturnType<typeof normalize>;
function Icon({ kind = "grill" }: { kind?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      aria-hidden="true"
    >
      {kind === "pin" ? (
        <>
          <path d="M48 25c0 12-16 27-16 27S16 37 16 25a16 16 0 1 1 32 0Z" />
          <circle cx="32" cy="25" r="5" />
        </>
      ) : (
        <>
          <path d="M12 29h40a20 20 0 0 1-40 0ZM22 49l-5 10m25-10 5 10M20 54h24M23 20c-7-7 7-8 0-15m10 15c-7-7 7-8 0-15m10 15c-7-7 7-8 0-15" />
          <path d="M9 29h46" />
        </>
      )}
    </svg>
  );
}
export default function Home() {
  const [place, setPlace] = useState<Place | null>(null),
    [query, setQuery] = useState(""),
    [hits, setHits] = useState<Place[]>([]),
    [searched, setSearched] = useState(false),
    [searching, setSearching] = useState(false),
    [locating, setLocating] = useState(false),
    [result, setResult] = useState<Result | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [searchError, setSearchError] = useState("");
  const generation = useRef(0),
    searchId = useRef(0),
    last = useRef(0),
    selected = useRef<Place | null>(null),
    busy = useRef(false),
    heading = useRef<HTMLHeadingElement>(null);
  const load = useCallback(async (p: Place) => {
    const id = ++generation.current;
    busy.current = true;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/weather?lat=${p.lat}&lon=${p.lon}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (id === generation.current) {
        setResult(data);
        last.current = Date.now();
      }
    } catch (e) {
      if (id === generation.current) {
        setResult(null);
        setError(
          e instanceof Error ? e.message : "Vädret kunde inte hämtas just nu",
        );
      }
    } finally {
      if (id === generation.current) {
        busy.current = false;
        setLoading(false);
      }
    }
  }, []);
  const choose = useCallback(
    (p: Place) => {
      searchId.current++;
      setSearching(false);
      selected.current = p;
      setPlace(p);
      setResult(null);
      setHits([]);
      setSearched(false);
      setSearchError("");
      last.current = 0;
      try {
        localStorage.setItem("kottometern-place", JSON.stringify(p));
      } catch {}
      void load(p);
    },
    [load],
  );
  useEffect(() => {
    const restore = setTimeout(() => {
      try {
        const p = JSON.parse(
          localStorage.getItem("kottometern-place") || "null",
        );
        if (
          p &&
          typeof p.name === "string" &&
          typeof p.lat === "number" &&
          typeof p.lon === "number" &&
          Number.isFinite(p.lat) &&
          Number.isFinite(p.lon) &&
          Math.abs(p.lat) <= 90 &&
          Math.abs(p.lon) <= 180
        )
          choose(p);
      } catch {}
    }, 0);
    const refresh = () => {
      if (
        document.visibilityState === "visible" &&
        selected.current &&
        !busy.current &&
        Date.now() - last.current >= 600000
      )
        void load(selected.current);
    };
    const timer = setInterval(refresh, 60000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearTimeout(restore);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [choose, load]);
  async function search(e: React.FormEvent) {
    e.preventDefault();
    const id = ++searchId.current;
    setSearching(true);
    setHits([]);
    setSearched(false);
    setSearchError("");
    try {
      const r = await fetch(
        "/api/locations?q=" + encodeURIComponent(query.trim()),
        { cache: "no-store" },
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      if (id === searchId.current) {
        setHits(d);
        setSearched(true);
      }
    } catch (e) {
      if (id === searchId.current)
        setSearchError(
          e instanceof Error ? e.message : "Sökningen misslyckades.",
        );
    } finally {
      if (id === searchId.current) setSearching(false);
    }
  }
  function locate() {
    setSearchError("");
    if (!window.isSecureContext || !navigator.geolocation) {
      setSearchError(
        "Positionering kräver HTTPS eller localhost. Sök efter en ort i stället.",
      );
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        choose({
          name: "Din position",
          lat: p.coords.latitude,
          lon: p.coords.longitude,
        });
      },
      (e) => {
        setLocating(false);
        setSearchError(
          e.code === 1
            ? "Positionering nekades. Du kan söka efter en ort."
            : e.code === 3
              ? "Positioneringen tog för lång tid. Sök efter en ort."
              : "Din position kunde inte hämtas. Sök efter en ort.",
        );
      },
      { timeout: 10000, maximumAge: 0 },
    );
  }
  function time(t: number) {
    return new Intl.DateTimeFormat("sv-SE", {
      timeZone: result!.timezone,
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(t);
  }
  return (
    <main>
      <header>
        <Link className="brand" href="/" aria-label="Köttometern, startsida">
          <span className="brandmark">
            <Icon />
          </span>
          Köttometern
        </Link>
        <span className="eyebrow edition">
          ETT LAGOM VETENSKAPLIGT VÄDERINDEX
        </span>
      </header>
      <section className="intro">
        <p className="eyebrow">
          <span className="tiny-dot" /> VÄDRET HAR EN ÅSIKT.
        </p>
        <h1>
          Stekpanna inne.
          <br />
          Eller <em>grill ute?</em>
        </h1>
        <p>Vi läser vädret. Köttometern visar vilket håll det lutar åt.</p>
      </section>
      <div className="app-grid">
        <section className="place-card" aria-labelledby="place-title">
          <span className="eyebrow">01 / VÄLJ DIN PLATS</span>
          <h2 id="place-title">Var håller du hus?</h2>
          <p>En ort räcker. Resten tar vädret hand om.</p>
          <form onSubmit={search}>
            <label htmlFor="city">Sök ort</label>
            <div className="search-row">
              <input
                id="city"
                placeholder="Till exempel Göteborg"
                value={query}
                onChange={(e) => {
                  searchId.current++;
                  setSearching(false);
                  setQuery(e.target.value);
                  setHits([]);
                  setSearched(false);
                }}
                minLength={3}
                maxLength={100}
                required
                autoComplete="off"
              />
              <button type="submit" disabled={searching} aria-label="Sök ort">
                {searching ? "…" : "→"}
              </button>
            </div>
          </form>
          <div aria-live="polite">
            {searching && <p>Söker orter…</p>}
            {searched && !hits.length && (
              <p>Inga orter hittades. Prova ett annat namn.</p>
            )}
            {hits.length > 0 && (
              <ul className="hits">
                {hits.map((p, i) => (
                  <li key={i}>
                    <button onClick={() => choose(p)}>
                      <strong>{p.name}</strong>
                      <small>
                        {[p.region, p.country].filter(Boolean).join(", ")}
                      </small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {searchError && <p className="error">{searchError}</p>}
          </div>
          <div className="or">
            <span />
            eller
            <span />
          </div>
          <button className="location" onClick={locate} disabled={locating}>
            <Icon kind="pin" />
            {locating ? "Letar efter din position…" : "Använd min plats"}
          </button>
          <p className="privacy">
            Din senast valda plats sparas bara i den här webbläsaren.
          </p>
          <div className="place-foot">
            <span>INGET KONTO.</span>
            <span>BARA VÄDER.</span>
          </div>
        </section>
        <section
          className={"result-card level-" + (result?.level || 0)}
          aria-labelledby="result-title"
          aria-busy={loading}
        >
          <div className="result-top">
            <span className="eyebrow">02 / VÄDRETS UTSLAG</span>
            <span className="live-dot" />
            {place && (
              <button
                className="refresh"
                onClick={() => load(place)}
                disabled={loading}
              >
                ↻ Uppdatera
              </button>
            )}
          </div>
          <div aria-live="polite" aria-atomic="true">
            <p className="place-name">
              {place ? place.name : "Din plats väntar på dig"}
            </p>
            <div className="meter" aria-hidden="true">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className={result && n <= result.level ? "active" : ""}
                >
                  <span>{n.toString().padStart(2, "0")}</span>
                </div>
              ))}
            </div>
            <div className="meter-labels">
              <span>STEKPANNA</span>
              <span>GRILL</span>
            </div>
            <div className="verdict">
              <span className="verdict-icon">
                <Icon />
              </span>
              <p className="score">
                {loading ? (
                  "Läser vädret…"
                ) : result ? (
                  <>
                    <b>{result.level}</b> av 4
                  </>
                ) : (
                  "— av 4"
                )}
              </p>
              <h2 id="result-title" ref={heading}>
                {loading
                  ? "Ett ögonblick."
                  : result
                    ? titles[result.level - 1]
                    : error
                      ? "Vädret tar en paus."
                      : "Vad säger vädret?"}
              </h2>
              <p className="reason">
                {loading
                  ? "Vi hämtar den senaste vädertimmen."
                  : result
                    ? result.reason
                    : error || "Välj en plats för att få dagens utslag."}
              </p>
              {error && place && (
                <button className="retry" onClick={() => load(place)}>
                  Försök igen
                </button>
              )}
              {result?.stale && (
                <p className="stale">
                  Visar tidigare uppgifter – kunde inte uppdatera
                </p>
              )}
            </div>
          </div>
          {result && (
            <>
              <div className="weather-stats">
                <div>
                  <small>Temperatur</small>
                  <strong>
                    {result.temperature.toLocaleString("sv-SE", {
                      maximumFractionDigits: 1,
                    })}
                    <span> °C</span>
                  </strong>
                </div>
                <div>
                  <small>Nederbörd / timme</small>
                  <strong>
                    {result.precipitation.toLocaleString("sv-SE", {
                      maximumFractionDigits: 2,
                    })}
                    <span> mm</span>
                  </strong>
                </div>
                <div>
                  <small>Vind</small>
                  <strong>
                    {result.wind.toLocaleString("sv-SE", {
                      maximumFractionDigits: 1,
                    })}
                    <span> m/s</span>
                  </strong>
                </div>
              </div>
              <p className="timestamps">
                Gäller kl. {time(result.weatherTime)} · Hämtat kl.{" "}
                {time(result.fetchedAt)}
                <br />
                {result.timezone}
              </p>
            </>
          )}
        </section>
      </div>
      <details>
        <summary>
          Så räknar vi <span>+</span>
        </summary>
        <div className="rules-body">
          <p>
            Tre väderfaktorer. Fyra nivåer. Den lägsta delnivån avgör. Vid lika
            nivå avgör nederbörd, sedan vind, sedan temperatur.
          </p>
          <div className="table-wrap">
            <table>
              <caption>Aktiva trösklar</caption>
              <thead>
                <tr>
                  <th>Nivå</th>
                  <th>Temperatur °C</th>
                  <th>Nederbörd mm</th>
                  <th>Vind m/s</th>
                </tr>
              </thead>
              <tbody>
                {[4, 3, 2, 1].map((n) => (
                  <tr key={n}>
                    <th>{n}</th>
                    <td>
                      {n === 4
                        ? `≥ ${rules.temperature[2]}`
                        : n === 1
                          ? `< ${rules.temperature[0]}`
                          : `${rules.temperature[n - 2]} ≤ T < ${rules.temperature[n - 1]}`}
                    </td>
                    <td>
                      {n === 4
                        ? "= 0"
                        : n === 1
                          ? `> ${rules.precipitation[2]}`
                          : `${rules.precipitation[4 - n - 1]} < P ≤ ${rules.precipitation[4 - n]}`}
                    </td>
                    <td>
                      {n === 4
                        ? `0 ≤ W < ${rules.wind[0]}`
                        : n === 1
                          ? `≥ ${rules.wind[2]}`
                          : `${rules.wind[3 - n]} ≤ W < ${rules.wind[4 - n]}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Nivå 1: Stekpannan vinner. Nivå 2: Grilltvekan. Nivå 3: Grillväder
            med en reservation. Nivå 4: Grillen vinner.
          </p>
          <p>
            En modellbaserad uppskattning för senaste vädertimmen. Nederbörd är
            mängden under föregående timme. Molnighet och dagsljus ingår inte.
            Gränserna är våra egna startvärden.
          </p>
          <p>Köttometern bedömer väder, inte eldningsförbud.</p>
        </div>
      </details>
      <footer>
        <span>
          Köttometern{" "}
          <span className="footer-note">· Lite väder. Mycket känsla.</span>
        </span>
        <div>
          <a href="https://open-meteo.com/">Väderdata: Open-Meteo, CC BY 4.0</a>
          <a href="https://www.geonames.org/">Ortsdata: GeoNames</a>
        </div>
      </footer>
    </main>
  );
}
