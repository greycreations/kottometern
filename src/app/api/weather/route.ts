import { handle } from "../../../lib/http";
import { ApiError, weatherService } from "../../../lib/provider";
export const dynamic = "force-dynamic";
export function GET(req: Request) {
  return handle(req, async () => {
    const p = new URL(req.url).searchParams;
    const lat = p.get("lat"),
      lon = p.get("lon");
    if (!lat?.trim() || !lon?.trim())
      throw new ApiError("Välj en giltig plats.", 400);
    return weatherService.get(Number(lat), Number(lon));
  });
}
