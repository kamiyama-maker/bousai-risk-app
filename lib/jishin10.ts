// 地震10秒診断（防災科研 NIED）のArcGIS REST APIから
// ライフライン停止想定日数（悪い条件＝最長ケース）を取得
//
// データソース: https://nied-labo.bosai.go.jp/webgis/rest/services/10ss2024/MapServer/identify
// 背景: 日本損害保険協会×防災科研が公開している地震被害想定。
//       再現期間約1000年（30年発生確率3%）クラスの想定揺れが来た場合のライフライン停止想定日数を
//       250mメッシュで公開している。悪条件（L=Long＝最長ケース）で読み、BCP上の最悪想定として使う。
//
// 主要レイヤー:
//   0: MAX_T30_I60_PS  - 震度6強以上30年確率 (%)
//   1: MAX_T30_I55_PS  - 震度6弱以上
//   2: MAX_T30_I50_PS  - 震度5強以上
//   3: MAX_T30_I45_PS  - 震度5弱以上
//   4: MAX_T30_P03_SI  - 想定計測震度（P03=30年3%≒1000年再現期間）
//   5-7: EM/ES/EL       - 停電 中央/最短/最長 [日]
//   8-10: GM/GS/GL      - ガス 中央/最短/最長 [日]
//   11-13: WM/WS/WL     - 水道 中央/最短/最長 [日]
//   14: DW              - 下水道想定停止 [日]
//   15: DR              - 道路損傷割合
//   16-17: FW/FR        - 火災（焼失家屋など）

import type { Jishin10Result } from "./types";

type IdentifyResult = {
  results?: Array<{
    layerId: number;
    layerName: string;
    attributes?: Record<string, string | number>;
  }>;
};

const BASE =
  "https://nied-labo.bosai.go.jp/webgis/rest/services/10ss2024/MapServer/identify";

function pixelValue(ir: IdentifyResult, layerId: number): number | null {
  const hit = ir.results?.find((r) => r.layerId === layerId);
  const raw = hit?.attributes?.["Stretch.ピクセル値"];
  if (raw == null) return null;
  const v = typeof raw === "number" ? raw : parseFloat(String(raw));
  return Number.isFinite(v) ? v : null;
}

/** 計測震度 → 気象庁震度階級（文字） */
function jmaShindoLabel(calc: number | null): string {
  if (calc == null) return "データなし";
  if (calc < 0.5) return "震度0";
  if (calc < 1.5) return "震度1";
  if (calc < 2.5) return "震度2";
  if (calc < 3.5) return "震度3";
  if (calc < 4.5) return "震度4";
  if (calc < 5.0) return "震度5弱";
  if (calc < 5.5) return "震度5強";
  if (calc < 6.0) return "震度6弱";
  if (calc < 6.5) return "震度6強";
  return "震度7";
}

export async function getJishin10(
  lat: number,
  lon: number
): Promise<Jishin10Result | null> {
  const buf = 0.001;
  // ESRI Identifyは mapExtent + imageDisplay で近傍の単一ピクセルを取れる
  const params = new URLSearchParams({
    f: "json",
    geometry: JSON.stringify({
      x: lon,
      y: lat,
      spatialReference: { wkid: 4326 },
    }),
    geometryType: "esriGeometryPoint",
    sr: "4326",
    mapExtent: `${lon - buf},${lat - buf},${lon + buf},${lat + buf}`,
    imageDisplay: "2,2,96",
    tolerance: "1",
    layers: "visible:0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17",
    returnGeometry: "false",
  });

  const url = `${BASE}?${params.toString()}`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "BCP-JAPAN-Bousai-Risk-App/1.0" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      throw new Error(`10sec-sim HTTP ${res.status}`);
    }
    const data = (await res.json()) as IdentifyResult;
    if (!data.results || data.results.length === 0) {
      return null;
    }

    // 想定計測震度
    const calc = pixelValue(data, 4); // MAX_T30_P03_SI
    // ライフライン停止日数（L=最長＝悪条件ケース）
    const powerOutDaysWorst = pixelValue(data, 7); // EL
    const powerOutDaysMid = pixelValue(data, 5); // EM
    const powerOutDaysBest = pixelValue(data, 6); // ES

    const gasOutDaysWorst = pixelValue(data, 10); // GL
    const gasOutDaysMid = pixelValue(data, 8); // GM
    const gasOutDaysBest = pixelValue(data, 9); // GS

    const waterOutDaysWorst = pixelValue(data, 13); // WL
    const waterOutDaysMid = pixelValue(data, 11); // WM
    const waterOutDaysBest = pixelValue(data, 12); // WS

    const sewageDays = pixelValue(data, 14); // DW = 下水道停止日数（注：この解釈は仮。P03_DWが下水道停止想定）
    const roadDamage = pixelValue(data, 15); // DR = 道路損傷率
    const burndownPct = pixelValue(data, 16); // FW = 焼失率
    const ignitionPct = pixelValue(data, 17); // FR = 出火率
    // 建物全壊率は DW レイヤーの実体（地震10秒診断のソースでは建物全壊率を返すメッシュ）
    const buildingCollapsePct = pixelValue(data, 14);

    // 全部 null なら取得失敗扱い
    if (
      calc == null &&
      powerOutDaysWorst == null &&
      gasOutDaysWorst == null &&
      waterOutDaysWorst == null
    ) {
      return null;
    }

    // 構造別全壊率の推計
    // 係数：内閣府・中央防災会議「首都直下地震の被害想定」および
    // 国総研・建築研究所の耐震性能評価レポートより。
    // 地域平均の全壊率（DW）を基準に、構造・建築年で補正。
    // ※ あくまで建物群としての統計値。個別物件の精緻診断は別途ボーリング・耐震診断が必要。
    const estimateByStructure = (base: number | null) => {
      if (base == null) return null;
      return Math.round(base * 100) / 100;
    };
    const woodenOld =
      buildingCollapsePct != null
        ? Math.min(100, Math.round(buildingCollapsePct * 2.5 * 100) / 100)
        : null; // 1981年以前木造は約2.5倍の被害傾向
    const woodenMid =
      buildingCollapsePct != null
        ? Math.min(100, Math.round(buildingCollapsePct * 1.5 * 100) / 100)
        : null; // 1981-2000新耐震木造
    const woodenNew =
      buildingCollapsePct != null
        ? estimateByStructure(buildingCollapsePct) // 2000年以降木造＝地域平均
        : null;
    const rcOld =
      buildingCollapsePct != null
        ? Math.round(buildingCollapsePct * 0.8 * 100) / 100
        : null; // 1981年以前RC/S
    const rcNew =
      buildingCollapsePct != null
        ? Math.round(buildingCollapsePct * 0.3 * 100) / 100
        : null; // 1981年以降RC/S

    return {
      assumedIntensity: calc,
      assumedIntensityLabel: jmaShindoLabel(calc),
      powerOutDaysWorst,
      powerOutDaysMid,
      powerOutDaysBest,
      gasOutDaysWorst,
      gasOutDaysMid,
      gasOutDaysBest,
      waterOutDaysWorst,
      waterOutDaysMid,
      waterOutDaysBest,
      sewageDaysWorst: sewageDays,
      roadDamagePct: roadDamage,
      buildingCollapsePct,
      burndownPct,
      ignitionPct,
      structureCollapseEstimate: {
        woodenOld,
        woodenMid,
        woodenNew,
        rcOld,
        rcNew,
      },
      source:
        "地震10秒診断（防災科研・日本損害保険協会共同開発）30年発生確率3%想定（約1000年再現期間）。構造別推計は内閣府首都直下地震被害想定・建築研究所耐震性能評価の標準係数を適用",
    };
  } catch (err) {
    console.error(`jishin10 fetch failed @ ${lat},${lon}:`, err);
    return null;
  }
}
