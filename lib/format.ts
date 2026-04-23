// 調査結果から「事業継続力強化計画 STEP2（災害リスク）欄」に
// そのまま貼れる整形済みテキストを生成する

import type { ResearchResult } from "./types";

const fmtPct = (v: number | null) =>
  v == null ? "データなし" : `${v.toFixed(1)}%`;

const fmtNum = (v: number | null, unit = "") =>
  v == null ? "データなし" : `${v}${unit}`;

export function formatPlanText(r: ResearchResult): string {
  const lines: string[] = [];

  lines.push("【当社所在地の災害リスクの整理】");
  lines.push(`調査対象所在地：${r.address}`);
  lines.push(`調査日：${r.queryAt.slice(0, 10)}`);
  lines.push("");

  // 立地・地形
  lines.push("■ 立地・地形の特徴");
  if (r.geocode) {
    lines.push(
      `当該地の位置は、緯度 ${r.geocode.lat.toFixed(
        5
      )}・経度 ${r.geocode.lon.toFixed(5)}。`
    );
  }
  if (r.elevation?.elevation != null) {
    lines.push(
      `標高は約 ${r.elevation.elevation.toFixed(
        1
      )}m（国土地理院 標高データ：${r.elevation.dataSource ?? "—"}）。`
    );
  }
  lines.push("");

  // 地震
  lines.push("■ 地震リスク");
  if (r.jshis) {
    const probParts: string[] = [];
    if (r.jshis.prob55 != null)
      probParts.push(`震度5強以上 ${fmtPct(r.jshis.prob55)}`);
    if (r.jshis.prob60 != null)
      probParts.push(`震度6弱以上 ${fmtPct(r.jshis.prob60)}`);
    if (r.jshis.prob65 != null)
      probParts.push(`震度6強以上 ${fmtPct(r.jshis.prob65)}`);
    if (probParts.length) {
      lines.push(
        `J-SHIS（防災科学技術研究所）による30年以内の発生確率は、${probParts.join(
          "／"
        )}です。`
      );
    }
    if (r.jshis.avs30 != null) {
      lines.push(
        `表層地盤のAVS30は ${r.jshis.avs30.toFixed(
          0
        )} m/sで、増幅率は約 ${
          r.jshis.amplification != null
            ? r.jshis.amplification.toFixed(2)
            : "—"
        } 倍と推定されます。`
      );
    }
    const liq = r.jshis.liquefactionRisk;
    const liqText =
      liq === "high"
        ? "液状化の起こりやすさは「高い」"
        : liq === "medium"
        ? "液状化の起こりやすさは「中程度」"
        : liq === "low"
        ? "液状化の起こりやすさは「低い」"
        : "液状化リスクは現地確認が必要";
    lines.push(`${liqText}と推定されます。`);
    lines.push(
      "発災時は、建物・設備の損壊、什器の転倒、ライフライン寸断、従業員の負傷などが想定されます。"
    );
  } else {
    lines.push("地震リスクのデータ取得ができませんでした。J-SHISで直接確認してください。");
  }
  lines.push("");

  // 水害
  lines.push("■ 水害リスク（洪水・内水・高潮・津波）");
  if (r.hazard) {
    const waterLines: string[] = [];
    waterLines.push(
      `・洪水浸水想定（想定最大規模）：${r.hazard.flood.depth}`
    );
    waterLines.push(`・高潮浸水想定：${r.hazard.highTide.depth}`);
    waterLines.push(`・津波浸水想定：${r.hazard.tsunami.depth}`);
    lines.push(...waterLines);
    if (
      r.hazard.flood.hasRisk ||
      r.hazard.highTide.hasRisk ||
      r.hazard.tsunami.hasRisk
    ) {
      lines.push(
        "浸水時は事業所の1階部分の浸水、在庫・設備の水損、通勤・物流経路の寸断が想定されます。"
      );
    } else {
      lines.push(
        "当該地点は想定浸水域に含まれていませんが、近隣地域からの二次影響（道路冠水・物流遅延）は考慮が必要です。"
      );
    }
  }
  lines.push("");

  // 土砂
  lines.push("■ 土砂災害リスク");
  if (r.hazard) {
    lines.push(`・判定：${r.hazard.landslide.category}`);
    if (r.hazard.landslide.hasRisk) {
      lines.push(
        "周辺斜面の崩壊・土石流による人的被害および建物被害を想定した避難計画が必要です。"
      );
    } else {
      lines.push("事業所周辺は土砂災害警戒区域に指定されていませんが、台風・豪雨時の状況監視は継続します。");
    }
  }
  lines.push("");

  // 火災
  lines.push("■ 地震火災・延焼リスク");
  if (r.fire) {
    lines.push(r.fire.comment);
  }
  lines.push("");

  // ライフライン停止想定（地震10秒診断・悪条件＝最長ケース）
  lines.push("■ ライフライン停止想定期間（悪条件＝最長ケース）");
  if (r.jishin10) {
    const j = r.jishin10;
    const fmt = (v: number | null) => (v == null ? "—" : `${v.toFixed(0)}日`);
    if (j.assumedIntensityLabel && j.assumedIntensityLabel !== "データなし") {
      lines.push(
        `想定揺れ：${j.assumedIntensityLabel}（計測震度${
          j.assumedIntensity != null ? j.assumedIntensity.toFixed(1) : "—"
        }）`
      );
    }
    lines.push(
      `停電：最長 ${fmt(j.powerOutDaysWorst)}（中央 ${fmt(
        j.powerOutDaysMid
      )}／最短 ${fmt(j.powerOutDaysBest)}）`
    );
    lines.push(
      `都市ガス：最長 ${fmt(j.gasOutDaysWorst)}（中央 ${fmt(
        j.gasOutDaysMid
      )}／最短 ${fmt(j.gasOutDaysBest)}）`
    );
    lines.push(
      `上水道：最長 ${fmt(j.waterOutDaysWorst)}（中央 ${fmt(
        j.waterOutDaysMid
      )}／最短 ${fmt(j.waterOutDaysBest)}）`
    );
    if (j.sewageDaysWorst != null) {
      lines.push(`下水道：最長 ${fmt(j.sewageDaysWorst)}`);
    }
    if (j.roadDamagePct != null) {
      lines.push(`道路損傷想定：${j.roadDamagePct.toFixed(1)}%`);
    }
    lines.push("");
    // 建物被害・火災
    if (
      j.buildingCollapsePct != null ||
      j.ignitionPct != null ||
      j.burndownPct != null
    ) {
      lines.push("【建物被害・火災想定（地域平均）】");
      if (j.buildingCollapsePct != null)
        lines.push(`・建物全壊率：${j.buildingCollapsePct.toFixed(2)}%`);
      if (j.ignitionPct != null)
        lines.push(`・出火率：${j.ignitionPct.toFixed(2)}%`);
      if (j.burndownPct != null)
        lines.push(`・焼失率（延焼含む）：${j.burndownPct.toFixed(2)}%`);
    }
    // 構造別全壊率推計
    const s = j.structureCollapseEstimate;
    if (s.woodenOld != null) {
      lines.push("");
      lines.push("【当社建物の構造・築年別 全壊率推計】");
      lines.push(`・木造 1981年以前（旧耐震）：${s.woodenOld.toFixed(2)}%`);
      lines.push(`・木造 1981〜2000年（新耐震）：${s.woodenMid!.toFixed(2)}%`);
      lines.push(`・木造 2000年以降：${s.woodenNew!.toFixed(2)}%`);
      lines.push(`・RC/S造 1981年以前：${s.rcOld!.toFixed(2)}%`);
      lines.push(`・RC/S造 1981年以降：${s.rcNew!.toFixed(2)}%`);
      lines.push(
        "※内閣府首都直下地震被害想定・建築研究所の耐震性能評価に基づく統計的推計。個別物件は耐震診断（一次・二次）で実測値を確認してください。"
      );
    }
    lines.push("");
    lines.push(
      "※上記は「30年発生確率3%（約1000年再現期間）」クラスの地震想定。復旧計画・備蓄水食料量・代替オフィス検討はこの最長日数を基本に設計します。"
    );
    lines.push(`（出典：${j.source}）`);
  } else {
    lines.push(
      "地震10秒診断データの取得に失敗しました。https://nied-weblabo.bosai.go.jp/10sec-sim/ で直接確認してください。"
    );
  }
  lines.push("");

  // 避難所
  lines.push("■ 最寄りの指定避難場所");
  if (r.shelters?.portalUrl) {
    lines.push(
      `（正式な指定緊急避難場所は国土地理院マップで確認： ${r.shelters.portalUrl} ）`
    );
  }
  if (r.shelters && r.shelters.shelters.length > 0) {
    r.shelters.shelters.slice(0, 3).forEach((s, i) => {
      const tagText = s.tags.length ? ` [${s.tags.join(", ")}]` : "";
      lines.push(
        `${i + 1}. ${s.name}（約${s.distanceKm.toFixed(2)}km）${tagText}`
      );
    });
    lines.push(
      "※上記はOSM登録の参考情報（駅の休憩所等は除外済み）。正式名称・収容人数・対応災害種別は所在自治体の『指定緊急避難場所一覧』でご確認ください。"
    );
  } else {
    lines.push(
      "OSM上では3km圏内に該当タグの避難場所が登録されていませんでした。所在地の自治体が公表する指定緊急避難場所一覧を上記リンクから確認してください。"
    );
  }
  lines.push("");

  // 総合対応方針
  lines.push("■ 以上を踏まえた事業継続力強化の方向性");
  lines.push(
    "上記リスクを踏まえ、当社では「①従業員および来訪者の人命を最優先に守ること」「②中核業務を可能な限り速やかに再開すること」「③取引先・地域社会への影響を最小化すること」を目的に、以下の事前対策・初動対応・平時の教育訓練を計画的に実施します。"
  );
  lines.push("");
  lines.push("【出典】");
  lines.push(
    "国土地理院ジオコーディング／標高API、防災科学技術研究所 J-SHIS、国土地理院 重ねるハザードマップ、OpenStreetMap（避難所・建物数）"
  );

  return lines.join("\n");
}
