export type Level = 1 | 2 | 3 | 4;
export const rules = {
  temperature: [10, 15, 20],
  precipitation: [0, 0.3, 1],
  wind: [4, 7, 10],
} as const;
export function validateRules(r: typeof rules) {
  for (const [key, values] of Object.entries(r)) {
    if (
      values.some((v) => !Number.isFinite(v)) ||
      !(values[0] < values[1] && values[1] < values[2]) ||
      (key !== "temperature" && values[0] < 0)
    )
      throw new Error("Ogiltig regelkonfiguration: " + key);
  }
  if (r.precipitation[0] !== 0)
    throw new Error("Nederbördens första gräns måste vara noll");
}
validateRules(rules);
export const titles = [
  "Stekpannan vinner",
  "Grilltvekan",
  "Grillväder med en reservation",
  "Grillen vinner",
];
