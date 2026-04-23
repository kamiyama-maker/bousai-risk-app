// 重ねるハザードマップ（国土地理院 災害ポータル）
// https://disaportal.gsi.go.jp/
// タイル画像を取得し、当該座標のピクセル色から浸水深・土砂災害区域を判定する。

import { PNG } from "pngjs";
import type { HazardMapResult } from "./types";

const TILE_ZOOM = 16;

// 各災害種別のタイル URL
const TILE_URLS = {
  flood:
    "https://disaportal.gsi.go.jp/data/raster/01_flood_l2_shinsuishin_data",
  highTide:
    "https://disaportal.gsi.go.jp/data/raster/03_hightide_l2_shinsuishin_data",
  tsunami:
    "https://disaportal.gsi.go.jp/data/raster/04_tsunami_newlegend_data",
  landslide: "https://disaportal.gsi.go.jp/data/raster/05_dosekiryukeikaikuiki",
} as const;

type RGBA = { r: number; g: number; b: number; a: number };

// 緯度経度 → タイル座標（WebMercator）
function latLonToTile(lat: number, lon: number, z: number) {
  const n = Math.pow(2, z);
  const xTile = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const yTile = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );

  // タイル内のピクセル位置（256×256）
  const xFloat = ((lon + 180) / 360) * n;
  const yFloat =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;

  const pixelX = Math.min(255, Math.floor((xFloat - xTile) * 256));
  const pixelY = Math.min(255, Math.floor((yFloat - yTile) * 256));

  return { x: xTile, y: yTile, px: pixelX, py: pixelY };
}

async function fetchTilePixel(
  baseUrl: string,
  lat: number,
  lon: number
): Promise<RGBA | null> {
  const { x, y, px, py } = latLonToTile(lat, lon, TILE_ZOOM);
  const url = `${baseUrl}/${TILE_ZOOM}/${x}/${y}.png`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "BCP-JAPAN-Bousai-Risk-App/1.0" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      // 404 はその地点にデータがない = リスクなし扱い
      if (res.status === 404) {
        return { r: 0, g: 0, b: 0, a: 0 };
      }
      throw new Error(`HazardMap tile HTTP ${res.status}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const png = PNG.sync.read(buf);
    const idx = (png.width * py + px) << 2;
    return {
      r: png.data[idx],
      g: png.data[idx + 1],
      b: png.data[idx + 2],
      a: png.data[idx + 3],
    };
  } catch (err) {
    console.error(`HazardMap fetch failed (${baseUrl}):`, err);
    return null;
  }
}

// 洪水・高潮・津波の色コード → 浸水深
// 参考: https://disaportal.gsi.go.jp/ の凡例
function interpretFloodDepth(rgba: RGBA | null): {
  depth: string;
  hasRisk: boolean;
} {
  if (!rgba || rgba.a < 16) {
    return { depth: "想定なし", hasRisk: false };
  }
  const { r, g, b } = rgba;

  // おおまかなカラーマッチング（許容幅あり）
  const near = (tr: number, tg: number, tb: number, tol = 30) =>
    Math.abs(r - tr) <= tol &&
    Math.abs(g - tg) <= tol &&
    Math.abs(b - tb) <= tol;

  if (near(0xdc, 0x7a, 0xdc)) return { depth: "20m以上", hasRisk: true };
  if (near(0xf2, 0x85, 0xc9)) return { depth: "10〜20m", hasRisk: true };
  if (near(0xff, 0x91, 0x91)) return { depth: "5〜10m", hasRisk: true };
  if (near(0xff, 0xb7, 0xb7)) return { depth: "3〜5m", hasRisk: true };
  if (near(0xff, 0xd8, 0xc0)) return { depth: "0.5〜3m", hasRisk: true };
  if (near(0xf7, 0xf5, 0xa9)) return { depth: "0.5m未満", hasRisk: true };

  // 未知の色でも α が立っていればリスクあり扱い
  return { depth: "浸水想定あり（深さ要確認）", hasRisk: true };
}

function interpretLandslide(rgba: RGBA | null): {
  category: string;
  hasRisk: boolean;
} {
  if (!rgba || rgba.a < 16) {
    return { category: "区域外", hasRisk: false };
  }
  const { r, g, b } = rgba;
  const near = (tr: number, tg: number, tb: number, tol = 40) =>
    Math.abs(r - tr) <= tol &&
    Math.abs(g - tg) <= tol &&
    Math.abs(b - tb) <= tol;

  // 土砂災害警戒区域: 黄系、特別警戒区域: 赤系
  if (near(0xff, 0x2a, 0x00) || near(0xcc, 0x00, 0x33))
    return { category: "土砂災害特別警戒区域（レッドゾーン）", hasRisk: true };
  if (near(0xff, 0xff, 0x00) || near(0xff, 0xd7, 0x00))
    return { category: "土砂災害警戒区域（イエローゾーン）", hasRisk: true };
  return { category: "警戒区域の可能性あり（要確認）", hasRisk: true };
}

export async function getHazardMap(
  lat: number,
  lon: number
): Promise<HazardMapResult | null> {
  const [flood, highTide, tsunami, landslide] = await Promise.all([
    fetchTilePixel(TILE_URLS.flood, lat, lon),
    fetchTilePixel(TILE_URLS.highTide, lat, lon),
    fetchTilePixel(TILE_URLS.tsunami, lat, lon),
    fetchTilePixel(TILE_URLS.landslide, lat, lon),
  ]);

  return {
    flood: interpretFloodDepth(flood),
    highTide: interpretFloodDepth(highTide),
    tsunami: interpretFloodDepth(tsunami),
    landslide: interpretLandslide(landslide),
    portalUrl: `https://disaportal.gsi.go.jp/hazardmapportal/hazardmap/maps/index.html?ll=${lat},${lon}&z=16&base=pale&vs=c1j0l0u0t0h0z0&disp=11111`,
  };
}
