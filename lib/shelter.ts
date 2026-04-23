// 最寄り避難所
// OpenStreetMap Overpass API で指定緊急避難場所・避難所を検索する
// （日本は OSM 上で国土地理院避難場所データを反映している地域が多い）

import type { Shelter, ShelterResult } from "./types";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const SEARCH_RADIUS_M = 2000;

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

export async function getNearbyShelters(
  lat: number,
  lon: number
): Promise<ShelterResult> {
  // 日本のOSMタグで避難所として該当するもの
  // amenity=shelter, emergency=assembly_point, amenity=community_centre + shelter=yes
  const query = `
    [out:json][timeout:25];
    (
      node(around:${SEARCH_RADIUS_M},${lat},${lon})[amenity=shelter];
      node(around:${SEARCH_RADIUS_M},${lat},${lon})[emergency=assembly_point];
      node(around:${SEARCH_RADIUS_M},${lat},${lon})[emergency=evacuation_centre];
      node(around:${SEARCH_RADIUS_M},${lat},${lon})["disaster:type"];
      way(around:${SEARCH_RADIUS_M},${lat},${lon})[amenity=shelter];
      way(around:${SEARCH_RADIUS_M},${lat},${lon})[emergency=evacuation_centre];
    );
    out center tags;
  `;

  try {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "BCP-JAPAN-Bousai-Risk-App/1.0",
      },
      body: "data=" + encodeURIComponent(query),
      next: { revalidate: 3600 },
    });

    if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);

    const data = (await res.json()) as OverpassResponse;
    const elements = data.elements ?? [];

    const shelters: Shelter[] = elements
      .map((el) => {
        const eLat = el.lat ?? el.center?.lat;
        const eLon = el.lon ?? el.center?.lon;
        if (eLat == null || eLon == null) return null;

        const tags = el.tags ?? {};
        const name =
          tags["name:ja"] ||
          tags.name ||
          tags["official_name"] ||
          tags["operator"] ||
          "（名称未登録の避難所）";

        const distanceKm =
          Math.round(haversineKm(lat, lon, eLat, eLon) * 100) / 100;

        const tagList: string[] = [];
        if (tags.amenity) tagList.push(tags.amenity);
        if (tags.emergency) tagList.push(tags.emergency);
        if (tags["disaster:type"]) tagList.push(tags["disaster:type"]);
        if (tags.shelter_type) tagList.push(tags.shelter_type);

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
      source: "OpenStreetMap Overpass API",
    };
  } catch (err) {
    console.error("shelter error:", err);
    return {
      shelters: [],
      source: "OpenStreetMap Overpass API",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
