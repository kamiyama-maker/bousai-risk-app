// 重ねるハザードマップ（国土地理院 災害ポータル）
// https://disaportal.gsi.go.jp/
// タイル画像を取得し、当該座標のピクセル色から浸水深・土砂災害区域を判定する。

import { PNG } from "pngjs";
import type { HazardMapResult } from "./types";

const TILE_ZOOM = 16;
/** 沿岸部確認用の広域ズーム（津波・高潮で使用）。ピクセル≈32mで、3x3 = 約96m範囲 */
const COASTAL_ZOOM = 12;

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

/**
 * 中心ピクセル+周辺8ピクセルをサンプリングし、最大リスクを返す。
 * 黒潮町のようにα=0の隣接ピクセルがあっても、周辺3x3で津波想定が
 * 取れれば検出できるようにするバグフィックス。
 * 隣接タイル境界をまたぐ場合もハンドル。
 */
async function fetchTilePixelsMax(
  baseUrl: string,
  lat: number,
  lon: number,
  zoom: number = TILE_ZOOM
): Promise<RGBA | null> {
  const { x, y, px, py } = latLonToTile(lat, lon, zoom);

  // メインタイルとその周辺で、必要な隣接タイルを事前算出
  const needTiles = new Set<string>();
  needTiles.add(`${x},${y}`);
  if (px <= 1) needTiles.add(`${x - 1},${y}`);
  if (px >= 254) needTiles.add(`${x + 1},${y}`);
  if (py <= 1) needTiles.add(`${x},${y - 1}`);
  if (py >= 254) needTiles.add(`${x},${y + 1}`);
  // 角近接は省略（コストと効果のバランス）

  const tiles = new Map<string, ReturnType<typeof PNG.sync.read> | null>();
  await Promise.all(
    Array.from(needTiles).map(async (key) => {
      const [tx, ty] = key.split(",").map(Number);
      const url = `${baseUrl}/${zoom}/${tx}/${ty}.png`;
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "BCP-JAPAN-Bousai-Risk-App/1.0" },
          next: { revalidate: 86400 },
        });
        if (!res.ok) {
          tiles.set(key, null); // 404 = データなし
          return;
        }
        const buf = Buffer.from(await res.arrayBuffer());
        tiles.set(key, PNG.sync.read(buf));
      } catch (err) {
        console.error(`HazardMap fetch failed (${url}):`, err);
        tiles.set(key, null);
      }
    })
  );

  // 3x3サンプリング
  const candidates: RGBA[] = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      let tx = x;
      let ty = y;
      let sx = px + dx;
      let sy = py + dy;
      if (sx < 0) {
        tx--;
        sx += 256;
      } else if (sx >= 256) {
        tx++;
        sx -= 256;
      }
      if (sy < 0) {
        ty--;
        sy += 256;
      } else if (sy >= 256) {
        ty++;
        sy -= 256;
      }
      const png = tiles.get(`${tx},${ty}`);
      if (png) {
        const idx = (png.width * sy + sx) << 2;
        candidates.push({
          r: png.data[idx],
          g: png.data[idx + 1],
          b: png.data[idx + 2],
          a: png.data[idx + 3],
        });
      }
    }
  }

  if (candidates.length === 0) return null;

  // αが立っている（= 何らかのリスク色がある）ピクセルの中で、
  // 最もリスクが大きい色を返す。無ければ最初のピクセル。
  const withRisk = candidates.filter((c) => c.a >= 16);
  if (withRisk.length === 0) return candidates[0];

  // リスクの重み付け: 青/紫系(>20m浸水、特別警戒)が高いRGB合計相対位置
  const score = (c: RGBA) => {
    // 高リスク順のマーカー色に近いほど高得点
    const dist = (tr: number, tg: number, tb: number) =>
      Math.abs(c.r - tr) + Math.abs(c.g - tg) + Math.abs(c.b - tb);
    // 深い色ほど点数が高い
    if (dist(0xdc, 0x7a, 0xdc) < 90) return 100; // 20m以上
    if (dist(0xf2, 0x85, 0xc9) < 90) return 90; // 10-20m
    if (dist(0xff, 0x91, 0x91) < 90) return 80; // 5-10m
    if (dist(0xff, 0xb7, 0xb7) < 90) return 60; // 3-5m
    if (dist(0xff, 0xd8, 0xc0) < 90) return 40; // 0.5-3m
    if (dist(0xf7, 0xf5, 0xa9) < 90) return 20; // 0.5m未満
    if (dist(0xff, 0x2a, 0x00) < 120) return 95; // 土砂特別警戒
    if (dist(0xff, 0xff, 0x00) < 120) return 70; // 土砂警戒
    return 10; // その他のリスク色
  };

  withRisk.sort((a, b) => score(b) - score(a));
  return withRisk[0];
}

// 旧API互換のためのラッパー
async function fetchTilePixel(
  baseUrl: string,
  lat: number,
  lon: number,
  zoom: number = TILE_ZOOM
): Promise<RGBA | null> {
  return fetchTilePixelsMax(baseUrl, lat, lon, zoom);
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
  // 津波・高潮は沿岸部で判定漏れを防ぐため、精密（zoom16）＋広域（zoom12）の二段構え
  const [flood, highTideNear, highTideWide, tsunamiNear, tsunamiWide, landslide] =
    await Promise.all([
      fetchTilePixel(TILE_URLS.flood, lat, lon, TILE_ZOOM),
      fetchTilePixel(TILE_URLS.highTide, lat, lon, TILE_ZOOM),
      fetchTilePixel(TILE_URLS.highTide, lat, lon, COASTAL_ZOOM),
      fetchTilePixel(TILE_URLS.tsunami, lat, lon, TILE_ZOOM),
      fetchTilePixel(TILE_URLS.tsunami, lat, lon, COASTAL_ZOOM),
      fetchTilePixel(TILE_URLS.landslide, lat, lon, TILE_ZOOM),
    ]);

  const tsunamiNearResult = interpretFloodDepth(tsunamiNear);
  const tsunamiWideResult = interpretFloodDepth(tsunamiWide);
  const highTideNearResult = interpretFloodDepth(highTideNear);
  const highTideWideResult = interpretFloodDepth(highTideWide);

  // 精密点で想定なしでも広域で見つかったら「近隣想定あり」として警告
  const tsunami =
    tsunamiNearResult.hasRisk
      ? tsunamiNearResult
      : tsunamiWideResult.hasRisk
      ? {
          depth: `近隣に津波想定域あり（${tsunamiWideResult.depth}、当該地点は区域外の可能性）`,
          hasRisk: true,
        }
      : tsunamiNearResult;

  const highTide =
    highTideNearResult.hasRisk
      ? highTideNearResult
      : highTideWideResult.hasRisk
      ? {
          depth: `近隣に高潮想定域あり（${highTideWideResult.depth}、当該地点は区域外の可能性）`,
          hasRisk: true,
        }
      : highTideNearResult;

  return {
    flood: interpretFloodDepth(flood),
    highTide,
    tsunami,
    landslide: interpretLandslide(landslide),
    portalUrl: `https://disaportal.gsi.go.jp/hazardmapportal/hazardmap/maps/index.html?ll=${lat},${lon}&z=16&base=pale&vs=c1j0l0u0t0h0z0&disp=11111`,
  };
}
