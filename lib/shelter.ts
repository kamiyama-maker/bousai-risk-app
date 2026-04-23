// 最寄り避難所の取得
//
// 方針：
// 1) OpenStreetMap Overpass API で「災害避難用」として明示的にタグ付けされたもののみ抽出
//    - emergency=assembly_point / evacuation_centre / evacuation_site
//    - amenity=shelter AND shelter_type に災害避難を示す値がある
//    - 学校・公民館などで shelter=yes が付くノード・ウェイ
//    - 駅の無料休憩所・バス停のシェルター等（shelter_type=public_transport 等）は除外
// 2) 取得できた結果は名称・距離・タグでフィルタ。amenity=shelter 単独は除外
// 3) 国土地理院「指定緊急避難場所」地図へのディープリンクも返し、ユーザーが公式で確認できるように
//
// ※ 最終的には国土数値情報「指定緊急避難場所」データ(P20)を使った自前エンドポイントに
//   置き換えるのが理想だが、MVPとしてはOSM+地理院タイルリンクで運用。

import type { Shelter, ShelterResult } from "./types";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const SEARCH_RADIUS_M = 3000; // 3km まで広げる（地方部でも取れるように）

type OverpassElement = {
  id: number;
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type OverpassResponse = {
  elements?: OverpassElement[];
};

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// 駅・バス停等のシェルター種別（災害避難所ではない）を除外するためのリスト
const EXCLUDE_SHELTER_TYPES = new Set([
  "public_transport",
  "picnic_shelter",
  "weather_shelter",
  "rain_shelter",
  "sun_shelter",
  "lean_to",
  "field_shelter",
  "gazebo",
  "basic_hut",
  "wildlife_hide",
  "smoking_area",
  "changing_rooms",
]);

// 明らかに避難所ではない name を弾くブラックリスト
const EXCLUDE_NAME_PATTERNS = [
  /無料休憩所/,
  /休憩所/,
  /待合所/,
  /喫煙所/,
  /バス停/,
  /パーゴラ/,
];

function isDisasterShelter(tags: Record<string, string>): boolean {
  // 強いシグナル（ほぼ確実に災害避難所）
  if (
    tags.emergency === "assembly_point" ||
    tags.emergency === "evacuation_centre" ||
    tags.emergency === "evacuation_site" ||
    tags["disaster:type"] != null ||
    tags["hinanjo"] === "yes" ||
    tags["evacuation_site"] === "yes"
  ) {
    return true;
  }

  // amenity=shelter は shelter_type の内容で判別
  if (tags.amenity === "shelter") {
    const st = tags.shelter_type;
    if (!st) return false; // shelter_type が無いと判断できない → 除外
    if (EXCLUDE_SHELTER_TYPES.has(st)) return false;
    // shelter_type=emergency や shelter_type=community_shelter は避難所扱い
    if (st === "emergency" || st === "community_shelter") return true;
    return false;
  }

  // 学校・公民館等で shelter=yes
  if (tags.shelter === "yes" && (tags.amenity || tags.building)) {
    return true;
  }

  // 名称に「避難場所」「避難所」等が含まれる
  const name = tags["name:ja"] ?? tags.name;
  if (name && /(避難場所|避難所|防災公園)/.test(name)) {
    return true;
  }

  return false;
}

function looksLikeNoise(tags: Record<string, string>): boolean {
  const name = tags["name:ja"] ?? tags.name ?? "";
  return EXCLUDE_NAME_PATTERNS.some((p) => p.test(name));
}

async function overpassFetch(query: string): Promise<OverpassResponse | null> {
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "BCP-JAPAN-Bousai-Risk-App/1.0",
        },
        body: "data=" + encodeURIComponent(query),
        next: { revalidate: 3600 },
      });
      if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
      return (await res.json()) as OverpassResponse;
    } catch (err) {
      console.warn(`Overpass endpoint failed (${endpoint}):`, err);
      // 次のエンドポイントへフォールバック
    }
  }
  return null;
}

export async function getNearbyShelters(
  lat: number,
  lon: number
): Promise<ShelterResult> {
  // 災害避難所として明示的にタグ付けされたもののみクエリ
  const query = `
    [out:json][timeout:25];
    (
      node(around:${SEARCH_RADIUS_M},${lat},${lon})[emergency=assembly_point];
      node(around:${SEARCH_RADIUS_M},${lat},${lon})[emergency=evacuation_centre];
      node(around:${SEARCH_RADIUS_M},${lat},${lon})[emergency=evacuation_site];
      node(around:${SEARCH_RADIUS_M},${lat},${lon})["disaster:type"];
      node(around:${SEARCH_RADIUS_M},${lat},${lon})[amenity=shelter][shelter_type=emergency];
      node(around:${SEARCH_RADIUS_M},${lat},${lon})[amenity=shelter][shelter_type=community_shelter];
      node(around:${SEARCH_RADIUS_M},${lat},${lon})[shelter=yes][amenity~"^(school|community_centre|public_building|townhall)$"];
      node(around:${SEARCH_RADIUS_M},${lat},${lon})["hinanjo"];
      way(around:${SEARCH_RADIUS_M},${lat},${lon})[emergency=assembly_point];
      way(around:${SEARCH_RADIUS_M},${lat},${lon})[emergency=evacuation_centre];
      way(around:${SEARCH_RADIUS_M},${lat},${lon})[emergency=evacuation_site];
      way(around:${SEARCH_RADIUS_M},${lat},${lon})["disaster:type"];
      way(around:${SEARCH_RADIUS_M},${lat},${lon})[shelter=yes][amenity~"^(school|community_centre|public_building|townhall)$"];
    );
    out center tags 50;
  `;

  const data = await overpassFetch(query);
  const portalUrl = `https://maps.gsi.go.jp/#15/${lat}/${lon}/&base=pale&ls=std%7Chnbs&disp=11&d=m`;

  if (!data) {
    return {
      shelters: [],
      source: "OpenStreetMap Overpass API",
      portalUrl,
      error: "Overpass API unreachable",
    };
  }

  const elements = data.elements ?? [];

  const shelters: Shelter[] = elements
    .map((el) => {
      const eLat = el.lat ?? el.center?.lat;
      const eLon = el.lon ?? el.center?.lon;
      const tags = el.tags ?? {};
      if (eLat == null || eLon == null) return null;
      if (!isDisasterShelter(tags)) return null;
      if (looksLikeNoise(tags)) return null;

      const name =
        tags["name:ja"] ||
        tags.name ||
        tags["official_name"] ||
        tags["operator"] ||
        "（名称未登録の指定避難場所）";

      const distanceKm =
        Math.round(haversineKm(lat, lon, eLat, eLon) * 100) / 100;

      const tagList: string[] = [];
      if (tags.emergency) tagList.push(`emergency=${tags.emergency}`);
      if (tags["disaster:type"]) tagList.push(`災害:${tags["disaster:type"]}`);
      if (tags.amenity === "shelter" && tags.shelter_type)
        tagList.push(`shelter=${tags.shelter_type}`);
      if (tags.amenity && tags.amenity !== "shelter")
        tagList.push(tags.amenity);
      if (tags.building && tagList.length === 0) tagList.push(tags.building);

      return {
        name,
        distanceKm,
        lat: eLat,
        lon: eLon,
        tags: tagList,
        osmUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
      } satisfies Shelter;
    })
    .filter((s): s is Shelter => s !== null)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 5);

  return {
    shelters,
    source: "OpenStreetMap Overpass API（emergency/disaster タグ限定）＋ 国土地理院地図",
    portalUrl,
  };
}

// 呼び出し側用：portalUrl を返すユーティリティ（HazardMap側と独立で使える）
export function gsiShelterPortalUrl(lat: number, lon: number): string {
  return `https://maps.gsi.go.jp/#15/${lat}/${lon}/&base=pale&ls=std%7Chnbs&disp=11&d=m`;
}
