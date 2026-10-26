import { handle } from "../../../lib/http";
import { ApiError, locations } from "../../../lib/provider";
export const dynamic = "force-dynamic";
export function GET(req: Request) {
  return handle(req, async () => {
    const q = new URL(req.url).searchParams.get("q")?.trim() || "";
    if (q.length < 3 || q.length > 100)
      throw new ApiError("Skriv mellan 3 och 100 tecken.", 400);
    return locations(q);
  });
}
