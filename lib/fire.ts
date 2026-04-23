// 火災延焼リスクの簡易推定
// OSMで500m圏内の建物数を数えて建物密集度を目安化する
// （本来は国交省「地震時等に著しく危険な密集市街地」データが理想だが
//   APIが無いためMVPは建物数で代替）

import type { FireRiskResult } from "./types";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const SEARCH_RADIUS_M = 500;

export async function estimateFireRisk(
  lat: number,
  lon: number
): Promise<FireRiskResult> {
  const query = `
    [out:json][timeout:25];
    (
      way(around:${SEARCH_RADIUS_M},${lat},${lon})[building];
    );
    out count;
  `;

  try {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "BCP-JAPAN-Bousai-Risk-App/1.0",
      },
      body: "data=" + encodeURIComponent(query),
      next: { revalidate: 86400 },
    });
    if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
    const data = (await res.json()) as {
      elements?: Array<{ tags?: { total?: string; ways?: string } }>;
    };

    let count = 0;
    for (const el of data.elements ?? []) {
      if (el.tags?.ways) {
        count += parseInt(el.tags.ways, 10) || 0;
      } else if (el.tags?.total) {
        count += parseInt(el.tags.total, 10) || 0;
      }
    }

    // 500m圏内（約78万m²）の建物棟数から密集度を推定
    // ざっくり: 300棟超=高、150-300棟=中、それ以下=低
    let density: "high" | "medium" | "low" = "low";
    let comment = "";
    if (count >= 300) {
      density = "high";
      comment = `半径500m圏内に約${count}棟の建物を確認。密集市街地に近い特性のため、地震火災・延焼リスクに対する備え（初期消火・避難経路・耐火性設備）が重要です。`;
    } else if (count >= 150) {
      density = "medium";
      comment = `半径500m圏内に約${count}棟の建物。中程度の市街地で、隣接建物への延焼リスクを想定した備えが望まれます。`;
    } else {
      density = "low";
      comment = `半径500m圏内に約${count}棟の建物。比較的空間が広く延焼リスクは相対的に低いものの、自社内の初期消火体制は必須です。`;
    }

    return { density, comment };
  } catch (err) {
    console.error("fire risk error:", err);
    return {
      density: "unknown",
      comment:
        "建物密集度の自動取得に失敗しました。現地確認のうえ、建物密集状況と延焼リスクを記載してください。",
    };
  }
}
