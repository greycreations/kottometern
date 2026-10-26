import { rules, validateRules, type Level } from "../config/grill-rules";
export type Weather = {
  temperature: number;
  precipitation: number;
  wind: number;
};
export function evaluate(w: Weather, r = rules) {
  validateRules(r);
  if (
    Object.values(w).some((v) => !Number.isFinite(v)) ||
    w.precipitation < 0 ||
    w.wind < 0
  )
    throw new Error("Ogiltiga vädervärden");
  const temperature: Level =
    w.temperature >= r.temperature[2]
      ? 4
      : w.temperature >= r.temperature[1]
        ? 3
        : w.temperature >= r.temperature[0]
          ? 2
          : 1;
  const precipitation: Level =
    w.precipitation === r.precipitation[0]
      ? 4
      : w.precipitation <= r.precipitation[1]
        ? 3
        : w.precipitation <= r.precipitation[2]
          ? 2
          : 1;
  const wind: Level =
    w.wind < r.wind[0]
      ? 4
      : w.wind < r.wind[1]
        ? 3
        : w.wind < r.wind[2]
          ? 2
          : 1;
  const levels = { temperature, precipitation, wind };
  const level = Math.min(temperature, precipitation, wind) as Level;
  const factor =
    level === 4
      ? null
      : precipitation === level
        ? "precipitation"
        : wind === level
          ? "wind"
          : "temperature";
  const texts = {
    temperature: [
      "Kylan drar ner grillvädret.",
      "Det svala vädret håller nivån på två av fyra.",
      "Lite svalt håller nivån på tre av fyra.",
    ],
    precipitation: [
      "Nederbörden drar ner grillvädret.",
      "Regnet håller nivån på två av fyra.",
      "Lätt duggregn håller nivån på tre av fyra.",
    ],
    wind: [
      "Kraftig vind drar ner grillvädret.",
      "Blåsten håller nivån på två av fyra.",
      "Lite blåsigt håller nivån på tre av fyra.",
    ],
  };
  return {
    level,
    levels,
    factor,
    reason: factor ? texts[factor][level - 1] : "Varmt, torrt och lugnt.",
  };
}
