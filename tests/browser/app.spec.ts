import { test, expect } from "@playwright/test";

test('sena platssvar ignoreras och localStorage får vara blockerat', async ({page}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new Error('Blocked'); };
    Storage.prototype.getItem = () => { throw new Error('Blocked'); };
  });
  await page.route('**/api/locations?*', route => route.fulfill({json:[place,{...place,name:'Malmö',lat:55.6}]}));
  let release!: () => void;
  const gate = new Promise<void>(resolve => {release=resolve;});
  await page.route('**/api/weather?*', async route => {
    if(route.request().url().includes('lat=57.7')) {await gate;await route.fulfill({json:{...weather,level:1,reason:'Kylan drar ner grillvädret.'}});}
    else await route.fulfill({json:weather});
  });
  await page.goto('/');
  await page.getByRole('textbox').fill('Göteborg');
  await page.getByRole('textbox').press('Enter');
  await page.getByRole('button',{name:'Göteborg Västra Götaland, Sverige'}).click();
  await page.getByRole('textbox').press('Enter');
  await page.getByRole('button',{name:'Malmö Västra Götaland, Sverige'}).click();
  await expect(page.getByRole('heading',{name:'Grillväder med en reservation'})).toBeVisible();
  release();
  await expect(page.getByText('Malmö',{exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Stekpannan vinner'})).toHaveCount(0);
});
const place = {
  name: "Göteborg",
  region: "Västra Götaland",
  country: "Sverige",
  lat: 57.7,
  lon: 12,
};
const weather = {
  temperature: 22,
  precipitation: 0.2,
  wind: 2,
  level: 3,
  reason: "Lätt duggregn håller nivån på tre av fyra.",
  timezone: "Europe/Stockholm",
  weatherTime: Date.now(),
  fetchedAt: Date.now(),
  stale: false,
};
test.beforeEach(async ({ page }) => {
  await page.route("**/api/locations?*", (r) => r.fulfill({ json: [place] }));
  await page.route("**/api/weather?*", (r) => r.fulfill({ json: weather }));
});
test("ortsökning, tangentbord, resultat och mobilbredd", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("— av 4")).toBeVisible();
  await page.getByLabel("Sök ort", { exact: true }).first().fill("Göteborg");
  await page.getByRole("textbox").press("Enter");
  await page
    .getByRole("button", { name: "Göteborg Västra Götaland, Sverige" })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Grillväder med en reservation" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Grillväder med en reservation" }),
  ).toBeVisible();
});
test("nekad position och tom sökning", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (_ok, fail) =>
      fail?.({ code: 1 } as GeolocationPositionError);
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Använd min plats" }).click();
  await expect(
    page.getByText("Positionering nekades.", { exact: false }),
  ).toBeVisible();
  await page.route("**/api/locations?*", (r) => r.fulfill({ json: [] }));
  await page.getByRole("textbox").fill("Ingenstans");
  await page.getByRole("textbox").press("Enter");
  await expect(
    page.getByText("Inga orter hittades.", { exact: false }),
  ).toBeVisible();
});
test("fel och försök igen", async ({ page }) => {
  await page.route("**/api/weather?*", (r) =>
    r.fulfill({
      status: 502,
      json: { error: "Vädret kunde inte hämtas just nu" },
    }),
  );
  await page.goto("/");
  await page.getByRole("textbox").fill("Göteborg");
  await page.getByRole("textbox").press("Enter");
  await page
    .getByRole("button", { name: "Göteborg Västra Götaland, Sverige" })
    .click();
  await expect(page.getByRole("button", { name: "Försök igen" })).toBeVisible();
  await expect(page.getByText("— av 4")).toBeVisible();
  await page.route("**/api/weather?*", (r) => r.fulfill({ json: weather }));
  await page.getByRole("button", { name: "Försök igen" }).click();
  await expect(
    page.getByRole("heading", { name: "Grillväder med en reservation" }),
  ).toBeVisible();
});
