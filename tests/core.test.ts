import { describe, it, expect, vi } from "vitest";
import { evaluate } from "../src/lib/rules";
import { normalize, WeatherService, coordinates } from "../src/lib/provider";
import { rules, validateRules } from "../src/config/grill-rules";
const now = Date.UTC(2026, 9, 25, 2, 30);
function fixture() {
  return {
    timezone: "Europe/Stockholm",
    hourly_units: {
      time: "unixtime",
      temperature_2m: "°C",
      precipitation: "mm",
      wind_speed_10m: "m/s",
    },
    hourly: {
      time: [now / 1000 - 5400, now / 1000 - 1800, now / 1000 + 1800],
      temperature_2m: [8, 22, 30],
      precipitation: [1, 0.2, 0],
      wind_speed_10m: [12, 2, 0],
    },
  };
}
describe("Regler", () => {
  it.each([
    [22, 0, 2, 4, null],
    [22, 0.2, 2, 3, "precipitation"],
    [22, 0.3, 2, 3, "precipitation"],
    [22, 0.31, 2, 2, "precipitation"],
    [17, 0, 2, 3, "temperature"],
    [22, 0, 8, 2, "wind"],
    [22, 1.1, 2, 1, "precipitation"],
    [8, 0, 2, 1, "temperature"],
    [17, 0.2, 5, 3, "precipitation"],
  ] as const)(
    "exempel %s/%s/%s",
    (temperature, precipitation, wind, level, factor) => {
      expect(evaluate({ temperature, precipitation, wind })).toMatchObject({
        level,
        factor,
      });
    },
  );
  it("exakta gränser och grannar", () => {
    for (const t of [9.999, 10, 10.001, 14.999, 15, 15.001, 19.999, 20, 20.001])
      expect(
        evaluate({ temperature: t, precipitation: 0, wind: 0 }).level,
      ).toBe(t < 10 ? 1 : t < 15 ? 2 : t < 20 ? 3 : 4);
    for (const p of [0, 0.0001, 0.2999, 0.3, 0.3001, 0.9999, 1, 1.0001])
      expect(
        evaluate({ temperature: 25, precipitation: p, wind: 0 }).level,
      ).toBe(p === 0 ? 4 : p <= 0.3 ? 3 : p <= 1 ? 2 : 1);
    for (const w of [0, 3.999, 4, 4.001, 6.999, 7, 7.001, 9.999, 10, 10.001])
      expect(
        evaluate({ temperature: 25, precipitation: 0, wind: w }).level,
      ).toBe(w < 4 ? 4 : w < 7 ? 3 : w < 10 ? 2 : 1);
  });
  it("sämre väder höjer aldrig nivån", () => {
    for (let t = -5; t < 25; t++)
      for (let p = 0; p < 2; p += 0.1)
        for (let w = 0; w < 12; w++) {
          const a = evaluate({
            temperature: t,
            precipitation: p,
            wind: w,
          }).level;
          expect(
            evaluate({
              temperature: t - 1,
              precipitation: p + 0.1,
              wind: w + 1,
            }).level,
          ).toBeLessThanOrEqual(a);
        }
  });
  it("validering och fasta texter", () => {
    for (const v of [NaN, Infinity, -1])
      expect(() =>
        evaluate({ temperature: 22, precipitation: v, wind: 2 }),
      ).toThrow();
    expect(() =>
      evaluate({ temperature: 22, precipitation: 0, wind: -1 }),
    ).toThrow();
    expect(() =>
      validateRules({ ...rules, wind: [7, 4, 10] } as unknown as typeof rules),
    ).toThrow();
    expect(
      evaluate({ temperature: -20, precipitation: 0, wind: 0 }).reason.length,
    ).toBeLessThanOrEqual(90);
  });
});
describe("Adapter", () => {
  it("samma index, senaste timmen och DST utan tidsförskjutning", () => {
    const r = normalize(fixture(), now);
    expect(r).toMatchObject({
      temperature: 22,
      precipitation: 0.2,
      wind: 2,
      level: 3,
      weatherTime: now - 1800000,
    });
    expect(
      new Intl.DateTimeFormat("sv-SE", {
        timeZone: r.timezone,
        hour: "2-digit",
        minute: "2-digit",
      }).format(r.weatherTime),
    ).toBe("03:00");
  });
  it.each([
    "null",
    "unit",
    "length",
    "order",
    "timezone",
    "old",
    "negative",
    "nan",
  ])("avvisar %s", (kind) => {
    const f = fixture();
    if (kind === "null") f.hourly.temperature_2m[1] = null as unknown as number;
    if (kind === "unit") f.hourly_units.wind_speed_10m = "km/h";
    if (kind === "length") f.hourly.wind_speed_10m.pop();
    if (kind === "order") f.hourly.time.reverse();
    if (kind === "timezone") f.timezone = "invalid";
    if (kind === "old") f.hourly.time = f.hourly.time.map((t) => t - 86400);
    if (kind === "negative") f.hourly.precipitation[1] = -1;
    if (kind === "nan") f.hourly.wind_speed_10m[1] = NaN;
    expect(() => normalize(f, now)).toThrow();
  });
  it("koordinater valideras och avrundas", () => {
    expect(coordinates(57.12345, 12.45678)).toEqual([57.123, 12.457]);
    expect(() => coordinates(null, 12)).toThrow();
    expect(() => coordinates(91, 12)).toThrow();
  });
  it("cache, deduplicering, TTL, fallback och platsisolering", async () => {
    let time = now;
    const fetcher = vi.fn(async () => new Response(JSON.stringify(fixture())));
    const service = new WeatherService(fetcher as typeof fetch, () => time);
    const [a, b] = await Promise.all([
      service.get(57, 12),
      service.get(57, 12),
    ]);
    expect(a).toEqual(b);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await service.get(57, 12);
    expect(fetcher).toHaveBeenCalledTimes(1);
    time += 600001;
    fetcher.mockRejectedValue(new Error("timeout"));
    expect((await service.get(57, 12)).stale).toBe(true);
    await expect(service.get(58, 12)).rejects.toThrow();
    time += 3600000;
    await expect(service.get(57, 12)).rejects.toThrow();
  });
  it("429, saknade värden och timeout ger aldrig en nivå", async () => {
    for (const f of [
      async () => new Response("{}", { status: 429 }),
      async () => new Response("{}"),
      async () => {
        throw new DOMException("Timeout", "TimeoutError");
      },
    ])
      await expect(
        new WeatherService(f as typeof fetch, () => now).get(57, 12),
      ).rejects.toThrow();
  });
});
