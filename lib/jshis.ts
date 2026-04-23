// J-SHIS Map API（防災科学技術研究所 地震ハザードステーション）
// https://www.j-shis.bosai.go.jp/map/api/
// 重要仕様：
// - 1リクエストにつきattrは1つのみ（複数指定は "invalid" で弾かれる）
// - pshm(確率論的地震動)の attr: T30_I45_PS / T30_I50_PS / T30_I55_PS / T30_I60_PS
// - sstrct(表層地盤)の attr: ARV(増幅率) / AVS(平均S波速度) / JCODE / JNAME
// - 返却値は0〜1の確率または数値（文字列で返ってくる）

import type { JshisResult } from "./types";

type MeshFeature = {
  properties?: Record<string, string | number | null>;
};

type MeshFeatureCollection = {
  features?: MeshFeature[];
  status?: string;
};

const PSHM_BASE =
  "https://www.j-shis.bosai.go.jp/map/api/pshm/Y2020/AVR/TTL_MTTL/meshinfo.geojson";
const SSTRCT_BASE =
  "https://www.j-shis.bosai.go.jp/map/api/sstrct/V3/meshinfo.geojson";

async function fetchSingleAttr(
  base: string,
  lat: number,
  lon: number,
  attr: string
): Promise<{ value: number | null; meshcode: string | null }> {
  const url = `${base}?position=${lon},${lat}&epsg=4326&attr=${encodeURIComponent(
    attr
  )}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "BCP-JAPAN-Bousai-Risk-App/1.0" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      throw new Error(`J-SHIS HTTP ${res.status}`);
    }
    const data = (await res.json()) as MeshFeatureCollection;
    if (data.status !== "Success") {
      return { value: null, meshcode: null };
    }
    const feat = data.features?.[0];
    const props = (feat?.properties ?? {}) as Record<string, unknown>;
    const raw = props[attr];

    let value: number | null = null;
    if (typeof raw === "number") value = Number.isFinite(raw) ? raw : null;
    else if (typeof raw === "string") {
      const n = parseFloat(raw);
      value = Number.isFinite(n) ? n : null;
    }

    const meshcode =
      typeof props["meshcode"] === "string" ? (props["meshcode"] as string) : null;

    return { value, meshcode };
  } catch (err) {
    console.error(`J-SHIS fetch failed (${attr}) @ ${lat},${lon}:`, err);
    return { value: null, meshcode: null };
  }
}

/**
 * AVS（平均S波速度, m/s）と ARV（増幅率）からざっくり液状化可能性を推定。
 * J-SHIS自体の液状化ハザードはファイル単位でしか公開されていないため、
 * 表層地盤の速度構造から統計的な傾向値で代替する。
 * （本格判定は別途ボーリング調査等が必要）
 */
function estimateLiquefaction(
  avs: number | null,
  arv: number | null
): "high" | "medium" | "low" | "unknown" {
  // 増幅率が高い＝軟弱地盤＝液状化しやすい傾向
  if (arv != null) {
    if (arv >= 2.0) return "high";
    if (arv >= 1.5) return "medium";
    if (arv > 0) return "low";
  }
  if (avs != null) {
    // AVS が小さい＝軟弱
    if (avs < 200) return "high";
    if (avs < 300) return "medium";
    if (avs > 0) return "low";
  }
  return "unknown";
}

export async function getJshis(
  lat: number,
  lon: number
): Promise<JshisResult | null> {
  // J-SHIS の attr は1リクエスト1つ限定なので6本並列で取得
  const [i45, i50, i55, i60, arv, avs] = await Promise.all([
    fetchSingleAttr(PSHM_BASE, lat, lon, "T30_I45_PS"),
    fetchSingleAttr(PSHM_BASE, lat, lon, "T30_I50_PS"),
    fetchSingleAttr(PSHM_BASE, lat, lon, "T30_I55_PS"),
    fetchSingleAttr(PSHM_BASE, lat, lon, "T30_I60_PS"),
    fetchSingleAttr(SSTRCT_BASE, lat, lon, "ARV"),
    fetchSingleAttr(SSTRCT_BASE, lat, lon, "AVS"),
  ]);

  // どれか1つでも取得できれば結果を返す（全敗ならnull）
  const hasAny =
    i45.value != null ||
    i50.value != null ||
    i55.value != null ||
    i60.value != null ||
    arv.value != null ||
    avs.value != null;
  if (!hasAny) return null;

  const toPct = (v: number | null): number | null => {
    if (v == null) return null;
    return Math.round(v * 100 * 10) / 10;
  };

  const meshCode =
    i60.meshcode ?? i55.meshcode ?? i50.meshcode ?? i45.meshcode ?? arv.meshcode ?? avs.meshcode;

  // 気象庁震度階級と計測震度の対応：
  //   震度5弱: 4.5≤I<5.0 → I45以上で5弱以上
  //   震度5強: 5.0≤I<5.5 → I50以上で5強以上
  //   震度6弱: 5.5≤I<6.0 → I55以上で6弱以上
  //   震度6強: 6.0≤I<6.5 → I60以上で6強以上
  return {
    prob55: toPct(i50.value), // 震度5強以上（30年以内）= T30_I50_PS
    prob60: toPct(i55.value), // 震度6弱以上（30年以内）= T30_I55_PS
    prob65: toPct(i60.value), // 震度6強以上（30年以内）= T30_I60_PS
    avs30: avs.value, // AVS = 平均S波速度（m/s）
    amplification: arv.value, // ARV = 増幅率
    liquefactionRisk: estimateLiquefaction(avs.value, arv.value),
    meshCode,
  };
}
