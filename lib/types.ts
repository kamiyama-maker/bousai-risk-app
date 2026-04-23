// 事業継続力強化計画サポート 型定義

export interface GeocodeResult {
  normalizedAddress: string;
  lat: number;
  lon: number;
  source: string;
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
  error?: string;
}

export interface FireRiskResult {
  /** 建物密集度の目安 */
  density: "high" | "medium" | "low" | "unknown";
  comment: string;
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
  errors: string[];
}
