// J-SHIS Map API
// https://www.j-shis.bosai.go.jp/map/api/
// 確率論的地震動予測・表層地盤・液状化

import type { JshisResult } from "./types";

type PshmAttrs = {
  T30_I50_PS?: number | null;
  T30_I55_PS?: number | null;
  T30_I60_PS?: number | null;
};

type SstrctAttrs = {
  AVS30?: number | null;
  AMP?: number | null;
};

type MeshFeature = {
  properties?: Record<string, number | string | null>;
};

type MeshFeatureCollection = {
  features?: MeshFeature[];
};

const PSHM_BASE =
  "https://www.j-shis.bosai.go.jp/map/api/pshm/Y2020/AVR/TTL_MTTL/meshinfo.geojson";
const SSTRCT_BASE =
  "https://www.j-shis.bosai.go.jp/map/api/sstrct/V3/meshinfo.geojson";

async function fetchMesh(
  base: string,
  lat: number,
  lon: number,
  attr: string
): Promise<MeshFeature | null> {
  const url = `${base}?position=${lon},${lat}&epsg=4326&attr=${encodeURIComponent(
    attr
  )}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "BCP-JAPAN-Bousai-Risk-App/1.0" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) throw new Error(`J-SHIS HTTP ${res.status}`);
    const data = (await res.json()) as MeshFeatureCollection;
    const feat = data.features?.[0];
    return feat ?? null;
  } catch (err) {
    console.error(`J-SHIS mesh fetch failed (${attr}):`, err);
    return null;
  }
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const p = parseFloat(v);
    return Number.isFinite(p) ? p : null;
  }
  return null;
}

/**
 * AVS30と増幅率から液状化リスクをざっくり判定。
 * J-SHIS本体の液状化ハザードはメッシュ粒度が粗くAPIでも取りにくいため、
 * 増幅率と地盤タイプで代用的に推定する。
 */
function estimateLiquefaction(
  avs30: number | null,
  amp: number | null
): "high" | "medium" | "low" | "unknown" {
  if (amp != null) {
    if (amp >= 2.0) return "high";
    if (amp >= 1.5) return "medium";
    return "low";
  }
  if (avs30 != null) {
    if (avs30 < 200) return "high";
    if (avs30 < 300) return "medium";
    return "low";
  }
  return "unknown";
}

export async function getJshis(
  lat: number,
  lon: number
): Promise<JshisResult | null> {
  const [pshm, sstrct] = await Promise.all([
    fetchMesh(PSHM_BASE, lat, lon, "T30_I50_PS,T30_I55_PS,T30_I60_PS"),
    fetchMesh(SSTRCT_BASE, lat, lon, "AVS30,AMP"),
  ]);

  const p = (pshm?.properties ?? {}) as PshmAttrs;
  const s = (sstrct?.properties ?? {}) as SstrctAttrs;

  const toPct = (v: unknown): number | null => {
    const n = toNumber(v);
    if (n == null) return null;
    // J-SHISは確率を 0–1 で返す
    return Math.round(n * 100 * 10) / 10;
  };

  const avs30 = toNumber(s.AVS30 ?? null);
  const amp = toNumber(s.AMP ?? null);

  const meshCode =
    (pshm?.properties?.["MESH_CODE"] as string | undefined) ??
    (sstrct?.properties?.["MESH_CODE"] as string | undefined) ??
    null;

  return {
    prob55: toPct(p.T30_I50_PS),
    prob60: toPct(p.T30_I55_PS),
    prob65: toPct(p.T30_I60_PS),
    avs30,
    amplification: amp,
    liquefactionRisk: estimateLiquefaction(avs30, amp),
    meshCode,
  };
}
