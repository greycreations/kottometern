import { rules } from "../config/grill-rules";
import { evaluate } from "./rules";
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}
export function coordinates(lat: unknown, lon: unknown) {
  if (
    typeof lat !== "number" ||
    typeof lon !== "number" ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180
  )
    throw new ApiError("Ogiltig plats.", 400);
  return [Number(lat.toFixed(3)), Number(lon.toFixed(3))];
}
export function normalize(data: unknown, now = Date.now()) {
  if (!data || typeof data !== "object") throw new Error("Saknat svar");
  const d = data as {
    timezone: string;
    hourly_units: Record<string, string>;
    hourly: Record<string, unknown[]>;
  };
  new Intl.DateTimeFormat("sv-SE", { timeZone: d.timezone }).format();
  if (typeof d.timezone !== "string" || !d.timezone)
    throw new Error("Saknad tidszon");
  const expected = {
    time: "unixtime",
    temperature_2m: "°C",
    precipitation: "mm",
    wind_speed_10m: "m/s",
  };
  for (const [k, v] of Object.entries(expected))
    if (d.hourly_units?.[k] !== v) throw new Error("Fel enhet");
  const h = d.hourly,
    times = h?.time;
  if (!Array.isArray(times) || !times.length) throw new Error("Saknade tider");
  for (const k of Object.keys(expected))
    if (!Array.isArray(h[k]) || h[k].length !== times.length)
      throw new Error("Olika serielängder");
  if (
    times.some(
      (t, i) =>
        typeof t !== "number" ||
        !Number.isFinite(t) ||
        (i > 0 && (t as number) <= (times[i - 1] as number)),
    )
  )
    throw new Error("Felaktig tidsserie");
  const i = times.findLastIndex((t) => (t as number) * 1000 <= now);
  if (i < 0 || now - (times[i] as number) * 1000 >= 90 * 60 * 1000)
    throw new Error("För gammal vädertimme");
  const weather = {
    temperature: h.temperature_2m[i],
    precipitation: h.precipitation[i],
    wind: h.wind_speed_10m[i],
  };
  if (
    Object.values(weather).some(
      (v) => typeof v !== "number" || !Number.isFinite(v),
    )
  )
    throw new Error("Saknade värden");
  const w = weather as {
    temperature: number;
    precipitation: number;
    wind: number;
  };
  return {
    ...w,
    ...evaluate(w),
    rules,
    timezone: d.timezone,
    weatherTime: (times[i] as number) * 1000,
    fetchedAt: now,
    stale: false,
  };
}
type Result = ReturnType<typeof normalize>;
export class WeatherService {
  cache = new Map<string, Result>();
  pending = new Map<string, Promise<Result>>();
  constructor(
    private fetcher: typeof fetch = fetch,
    private now = () => Date.now(),
  ) {}
  async get(lat: number, lon: number): Promise<Result> {
    const [a, b] = coordinates(lat, lon),
      key = `${a},${b}`,
      old = this.cache.get(key),
      now = this.now();
    if (old && now - old.fetchedAt < 600000) return old;
    if (this.pending.has(key)) return this.pending.get(key)!;
    const task = (async () => {
      try {
        const url = new URL(
          process.env.OPEN_METEO_FORECAST_URL ||
            "https://api.open-meteo.com/v1/forecast",
        );
        url.search = new URLSearchParams({
          latitude: String(a),
          longitude: String(b),
          hourly: "temperature_2m,precipitation,wind_speed_10m",
          temperature_unit: "celsius",
          wind_speed_unit: "ms",
          precipitation_unit: "mm",
          timeformat: "unixtime",
          timezone: "auto",
          past_days: "1",
          forecast_days: "1",
        }).toString();
        if (process.env.OPEN_METEO_API_KEY)
          url.searchParams.set("apikey", process.env.OPEN_METEO_API_KEY);
        const response = await this.fetcher(url, {
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) throw new Error("Leverantör HTTP " + response.status);
        const result = normalize(await response.json(), this.now());
        this.cache.delete(key);
        this.cache.set(key, result);
        if (this.cache.size > 200)
          this.cache.delete(this.cache.keys().next().value!);
        return result;
      } catch (error) {
        console.error(
          "Väderhämtning misslyckades:",
          error instanceof Error ? error.name : "Okänt fel",
        );
        const t = this.now();
        if (
          old &&
          t - old.fetchedAt <= 3600000 &&
          t - old.weatherTime <= 3600000
        )
          return { ...old, stale: true };
        throw new ApiError("Vädret kunde inte hämtas just nu");
      } finally {
        this.pending.delete(key);
      }
    })();
    this.pending.set(key, task);
    return task;
  }
}
export const weatherService = new WeatherService();
export async function locations(q: string) {
  const url = new URL(
    process.env.OPEN_METEO_GEOCODING_URL ||
      "https://geocoding-api.open-meteo.com/v1/search",
  );
  url.search = new URLSearchParams({
    name: q,
    count: "5",
    language: "sv",
    format: "json",
  }).toString();
  if (process.env.OPEN_METEO_API_KEY)
    url.searchParams.set("apikey", process.env.OPEN_METEO_API_KEY);
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error("HTTP");
    const d = await res.json();
    if (d.results === undefined) return [];
    if (!Array.isArray(d.results)) throw new Error("Format");
    return d.results
      .slice(0, 5)
      .map(
        (p: {
          name: string;
          admin1?: string;
          country?: string;
          latitude: number;
          longitude: number;
        }) => {
          coordinates(p.latitude, p.longitude);
          if (typeof p.name !== "string") throw new Error("Namn");
          return {
            name: p.name,
            region: typeof p.admin1 === "string" ? p.admin1 : "",
            country: typeof p.country === "string" ? p.country : "",
            lat: p.latitude,
            lon: p.longitude,
          };
        },
      );
  } catch {
    throw new ApiError("Ortsökningen kunde inte genomföras. Försök igen.");
  }
}
