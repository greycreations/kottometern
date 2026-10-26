import { NextResponse } from "next/server";
import { ApiError } from "./provider";
const clients = new Map<string, { start: number; count: number }>();
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...(status === 429 ? { "Retry-After": "60" } : {}),
    },
  });
}
export async function handle(request: Request, fn: () => Promise<unknown>) {
  const now = Date.now(),
    key =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  for (const [k, v] of clients) if (now - v.start >= 60000) clients.delete(k);
  const slot = clients.get(key) || { start: now, count: 0 };
  slot.count++;
  clients.set(key, slot);
  if (clients.size > 10000) clients.delete(clients.keys().next().value!);
  if (slot.count > 30)
    return json(
      { error: "För många anrop. Vänta en minut och försök igen." },
      429,
    );
  try {
    return json(await fn());
  } catch (e) {
    return json(
      { error: e instanceof ApiError ? e.message : "Något gick fel." },
      e instanceof ApiError ? e.status : 500,
    );
  }
}
