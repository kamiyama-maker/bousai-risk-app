// 国土地理院 標高API
// https://cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php?lon=&lat=&outtype=JSON

import type { ElevationResult } from "./types";

export async function getElevation(
  lat: number,
  lon: number
): Promise<ElevationResult | null> {
  const url = `https://cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php?lon=${lon}&lat=${lat}&outtype=JSON`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "BCP-JAPAN-Bousai-Risk-App/1.0" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) throw new Error(`GSI elevation HTTP ${res.status}`);

    const data = (await res.json()) as {
      elevation?: number | string;
      hsrc?: string;
    };

    const rawElev = data.elevation;
    let elevation: number | null = null;
    if (typeof rawElev === "number") {
      elevation = rawElev;
    } else if (typeof rawElev === "string") {
      const parsed = parseFloat(rawElev);
      elevation = Number.isFinite(parsed) ? parsed : null;
    }

    return {
      elevation,
      dataSource: data.hsrc ?? null,
    };
  } catch (err) {
    console.error("elevation error:", err);
    return null;
  }
}
