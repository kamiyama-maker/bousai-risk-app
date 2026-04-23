// 国土地理院ジオコーディングAPI
// https://msearch.gsi.go.jp/address-search/AddressSearch?q={address}

import type { GeocodeResult } from "./types";

export async function geocode(address: string): Promise<GeocodeResult | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;

  const url =
    "https://msearch.gsi.go.jp/address-search/AddressSearch?q=" +
    encodeURIComponent(trimmed);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "BCP-JAPAN-Bousai-Risk-App/1.0",
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      throw new Error(`GSI geocoding HTTP ${res.status}`);
    }

    const data = (await res.json()) as Array<{
      geometry?: { coordinates?: [number, number] };
      properties?: { title?: string };
    }>;

    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    // 最初の候補を採用（GSIは完全一致から順に返す）
    const top = data[0];
    const coords = top.geometry?.coordinates;
    if (!coords || coords.length < 2) return null;

    const normalized = top.properties?.title ?? trimmed;

    // 精度判定: 正規化後の住所の構造から推定
    let precision: "prefecture" | "municipality" | "district" | "address" =
      "address";
    if (/^[^\s]+?[都道府県]$/.test(normalized)) {
      precision = "prefecture"; // 例: "千葉県"
    } else if (/[市区町村]$/.test(normalized)) {
      precision = "municipality"; // 例: "大阪府大阪市北区"
    } else if (!/[0-9０-９一二三四五六七八九十]+[-ー―番地号丁目]/.test(normalized)) {
      precision = "district"; // 例: "京都府京都市下京区烏丸"
    } else {
      precision = "address"; // 番地まで
    }
    const lowPrecision = precision === "prefecture" || precision === "municipality";

    return {
      normalizedAddress: normalized,
      lon: coords[0],
      lat: coords[1],
      source: "国土地理院 Address Search API",
      precision,
      lowPrecision,
    };
  } catch (err) {
    console.error("geocode error:", err);
    return null;
  }
}
