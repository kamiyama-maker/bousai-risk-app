import { NextResponse } from "next/server";
import { geocode } from "@/lib/geocoding";
import { getElevation } from "@/lib/elevation";
import { getJshis } from "@/lib/jshis";
import { getHazardMap } from "@/lib/hazardmap";
import { getNearbyShelters } from "@/lib/shelter";
import { estimateFireRisk } from "@/lib/fire";
import { getJishin10 } from "@/lib/jishin10";
import type { ResearchResult } from "@/lib/types";

export const runtime = "nodejs";
// タイル取得・Overpass など複数I/Oを行うため、Vercelの
// デフォルト10秒では足りない。30秒まで延長。
export const maxDuration = 30;

export async function POST(req: Request) {
  const { address } = (await req.json()) as { address?: string };

  if (!address || address.trim().length < 3) {
    return NextResponse.json(
      { error: "住所は3文字以上入力してください" },
      { status: 400 }
    );
  }

  const errors: string[] = [];
  const queryAt = new Date().toISOString();

  const geo = await geocode(address);
  if (!geo) {
    return NextResponse.json(
      {
        error:
          "住所を座標に変換できませんでした。『都道府県＋市区町村＋町名＋番地』の形で入力してください。",
      },
      { status: 400 }
    );
  }

  // 以降は全て並列実行（1本失敗しても他が返るように）
  const [elev, jshis, hazard, shelters, fire, jishin10] = await Promise.all([
    getElevation(geo.lat, geo.lon).catch((e) => {
      errors.push("標高API失敗: " + String(e));
      return null;
    }),
    getJshis(geo.lat, geo.lon).catch((e) => {
      errors.push("J-SHIS失敗: " + String(e));
      return null;
    }),
    getHazardMap(geo.lat, geo.lon).catch((e) => {
      errors.push("重ねるハザードマップ失敗: " + String(e));
      return null;
    }),
    getNearbyShelters(geo.lat, geo.lon).catch((e) => {
      errors.push("避難所検索失敗: " + String(e));
      return {
        shelters: [],
        source: "OpenStreetMap Overpass API",
        error: String(e),
      };
    }),
    estimateFireRisk(geo.lat, geo.lon).catch((e) => {
      errors.push("火災リスク推定失敗: " + String(e));
      return {
        density: "unknown" as const,
        comment: "取得失敗",
      };
    }),
    getJishin10(geo.lat, geo.lon).catch((e) => {
      errors.push("地震10秒診断失敗: " + String(e));
      return null;
    }),
  ]);

  const result: ResearchResult = {
    address,
    queryAt,
    geocode: geo,
    elevation: elev,
    jshis,
    hazard,
    shelters,
    fire,
    jishin10,
    errors,
  };

  return NextResponse.json(result);
}
