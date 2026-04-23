// 事業継続力強化計画サポート 型定義

export interface GeocodeResult {
  normalizedAddress: string;
  lat: number;
  lon: number;
  source: string;
  /** ジオコーディング精度: prefecture(県のみ)/municipality(市区町村)/district(町名)/address(番地) */
  precision: "prefecture" | "municipality" | "district" | "address";
  /** 精度が低くて警告表示すべきかどうか */
  lowPrecision: boolean;
}

export interface ElevationResult {
  elevation: number | null; // m
  dataSource: string | null;
}

export interface JshisResult {
  /** 30年以内に震度5強以上の確率 (%) */
  prob55: number | null;
  /** 30年以内に震度6弱以上の確率 (%) */
  prob60: number | null;
  /** 30年以内に震度6強以上の確率 (%) */
  prob65: number | null;
  /** 表層地盤増幅率 Vs30 (m/s) */
  avs30: number | null;
  /** 増幅率（倍） */
  amplification: number | null;
  /** 液状化判定（ざっくり） */
  liquefactionRisk: "high" | "medium" | "low" | "unknown";
  meshCode: string | null;
}

export interface HazardMapResult {
  /** 洪水浸水想定（想定最大規模） */
  flood: { depth: string; hasRisk: boolean };
  /** 高潮浸水想定 */
  highTide: { depth: string; hasRisk: boolean };
  /** 津波浸水想定 */
  tsunami: { depth: string; hasRisk: boolean };
  /** 土砂災害警戒区域 */
  landslide: { category: string; hasRisk: boolean };
  /** ディープリンク */
  portalUrl: string;
}

export interface Shelter {
  name: string;
  distanceKm: number;
  lat: number;
  lon: number;
  tags: string[];
  osmUrl: string;
}

export interface ShelterResult {
  shelters: Shelter[];
  source: string;
  /** 国土地理院「指定緊急避難場所」マップへの直接リンク（目視確認用） */
  portalUrl?: string;
  error?: string;
}

export interface FireRiskResult {
  /** 建物密集度の目安 */
  density: "high" | "medium" | "low" | "unknown";
  comment: string;
}

export interface Jishin10Result {
  /** 想定計測震度（P03=30年3%≒1000年再現） */
  assumedIntensity: number | null;
  assumedIntensityLabel: string;
  /** 停電想定日数 */
  powerOutDaysWorst: number | null; // 最長（悪条件）
  powerOutDaysMid: number | null; // 中央
  powerOutDaysBest: number | null; // 最短
  /** ガス停止想定日数 */
  gasOutDaysWorst: number | null;
  gasOutDaysMid: number | null;
  gasOutDaysBest: number | null;
  /** 上水道停止想定日数 */
  waterOutDaysWorst: number | null;
  waterOutDaysMid: number | null;
  waterOutDaysBest: number | null;
  /** 下水道想定停止日数 */
  sewageDaysWorst: number | null;
  /** 道路損傷率 (%) */
  roadDamagePct: number | null;
  /** 建物全壊率 (%)：地域全体での平均 */
  buildingCollapsePct: number | null;
  /** 焼失率 (%)：火災による焼失建物の割合 */
  burndownPct: number | null;
  /** 出火率 (%)：建物あたりの出火発生確率 */
  ignitionPct: number | null;
  /** 構造別の全壊率推計（内閣府被害想定の標準係数で算出） */
  structureCollapseEstimate: {
    woodenOld: number | null; // 旧耐震（1981年以前）木造
    woodenMid: number | null; // 新耐震（1981-2000）木造
    woodenNew: number | null; // 2000年以降木造
    rcOld: number | null; // 旧耐震 RC/S造
    rcNew: number | null; // 新耐震 RC/S造
  };
  source: string;
}

export interface ResearchResult {
  address: string;
  queryAt: string; // ISO timestamp
  geocode: GeocodeResult | null;
  elevation: ElevationResult | null;
  jshis: JshisResult | null;
  hazard: HazardMapResult | null;
  shelters: ShelterResult | null;
  fire: FireRiskResult | null;
  /** 地震10秒診断由来のライフライン停止想定日数（悪条件＝最長） */
  jishin10: Jishin10Result | null;
  errors: string[];
}
