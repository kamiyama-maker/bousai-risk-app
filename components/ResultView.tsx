"use client";

import { useMemo, useState } from "react";
import type { ResearchResult } from "@/lib/types";
import { formatPlanText } from "@/lib/format";
import RiskBadge, { RiskLevel } from "./RiskBadge";

interface Props {
  data: ResearchResult;
}

function hasRiskToLevel(hasRisk: boolean, depth: string): RiskLevel {
  if (!hasRisk) return "none";
  if (/20m|10〜20m|5〜10m/.test(depth)) return "high";
  if (/3〜5m|0.5〜3m/.test(depth)) return "medium";
  if (/0.5m未満|浸水想定あり/.test(depth)) return "low";
  return "unknown";
}

function probToLevel(p: number | null): RiskLevel {
  if (p == null) return "unknown";
  if (p >= 26) return "high";
  if (p >= 6) return "medium";
  return "low";
}

function jshisLiqToLevel(v: "high" | "medium" | "low" | "unknown"): RiskLevel {
  if (v === "high" || v === "medium" || v === "low") return v;
  return "unknown";
}

function densityToLevel(d: "high" | "medium" | "low" | "unknown"): RiskLevel {
  if (d === "unknown") return "unknown";
  return d;
}

export default function ResultView({ data }: Props) {
  const [tab, setTab] = useState<"cards" | "plan" | "json">("cards");
  const [copied, setCopied] = useState(false);

  const planText = useMemo(() => formatPlanText(data), [data]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(planText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      alert("コピーに失敗しました。手動で選択してコピーしてください。");
    }
  };

  const handlePrint = () => window.print();

  return (
    <div className="mt-8">
      {/* タブ */}
      <div className="flex gap-1 border-b border-ink/10 mb-4 no-print">
        <TabBtn active={tab === "cards"} onClick={() => setTab("cards")}>
          リスク一覧カード
        </TabBtn>
        <TabBtn active={tab === "plan"} onClick={() => setTab("plan")}>
          申請様式コピペ用
        </TabBtn>
        <TabBtn active={tab === "json"} onClick={() => setTab("json")}>
          生データ (JSON)
        </TabBtn>
        <div className="ml-auto flex gap-2">
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 text-sm bg-navy text-white rounded hover:bg-navy/90"
          >
            {copied ? "✓ コピー完了" : "申請原稿をコピー"}
          </button>
          <button
            onClick={handlePrint}
            className="px-3 py-1.5 text-sm border border-navy text-navy rounded hover:bg-navy/5"
          >
            PDFとして保存 / 印刷
          </button>
        </div>
      </div>

      {/* ヘッダ：対象住所 */}
      <div className="mb-6 p-4 bg-white border border-ink/10 rounded-lg">
        <div className="text-xs text-ink/60">調査対象住所</div>
        <div className="text-lg font-medium">
          {data.geocode?.normalizedAddress ?? data.address}
        </div>
        {data.geocode && (
          <div className="text-xs text-ink/60 mt-1">
            緯度 {data.geocode.lat.toFixed(5)} / 経度{" "}
            {data.geocode.lon.toFixed(5)}
            {data.elevation?.elevation != null && (
              <>
                ／標高 約 {data.elevation.elevation.toFixed(1)}m
                {data.elevation.dataSource && ` (${data.elevation.dataSource})`}
              </>
            )}
          </div>
        )}
        <div className="text-xs text-ink/40 mt-1">
          調査日時：{new Date(data.queryAt).toLocaleString("ja-JP")}
        </div>
      </div>

      {tab === "cards" && (
        <div className="grid md:grid-cols-2 gap-4">
          {/* 地震 */}
          <Card title="地震リスク（J-SHIS）" icon="🌀">
            {data.jshis ? (
              <>
                <Row
                  label="震度5強以上（30年以内）"
                  value={
                    data.jshis.prob55 == null
                      ? "—"
                      : `${data.jshis.prob55.toFixed(1)}%`
                  }
                  badge={probToLevel(data.jshis.prob55)}
                />
                <Row
                  label="震度6弱以上（30年以内）"
                  value={
                    data.jshis.prob60 == null
                      ? "—"
                      : `${data.jshis.prob60.toFixed(1)}%`
                  }
                  badge={probToLevel(data.jshis.prob60)}
                />
                <Row
                  label="震度6強以上（30年以内）"
                  value={
                    data.jshis.prob65 == null
                      ? "—"
                      : `${data.jshis.prob65.toFixed(1)}%`
                  }
                  badge={probToLevel(data.jshis.prob65)}
                />
                <Row
                  label="表層地盤 AVS30"
                  value={
                    data.jshis.avs30 == null
                      ? "—"
                      : `${data.jshis.avs30.toFixed(0)} m/s`
                  }
                />
                <Row
                  label="地盤増幅率"
                  value={
                    data.jshis.amplification == null
                      ? "—"
                      : `${data.jshis.amplification.toFixed(2)} 倍`
                  }
                />
                <Row
                  label="液状化の起こりやすさ"
                  value={
                    data.jshis.liquefactionRisk === "unknown"
                      ? "要確認"
                      : data.jshis.liquefactionRisk === "high"
                      ? "高い"
                      : data.jshis.liquefactionRisk === "medium"
                      ? "中程度"
                      : "低い"
                  }
                  badge={jshisLiqToLevel(data.jshis.liquefactionRisk)}
                />
              </>
            ) : (
              <p className="text-ink/60">データ取得に失敗しました</p>
            )}
          </Card>

          {/* 水害 */}
          <Card title="水害リスク（重ねるハザードマップ）" icon="🌊">
            {data.hazard ? (
              <>
                <Row
                  label="洪水浸水想定（想定最大規模）"
                  value={data.hazard.flood.depth}
                  badge={hasRiskToLevel(
                    data.hazard.flood.hasRisk,
                    data.hazard.flood.depth
                  )}
                />
                <Row
                  label="高潮浸水想定"
                  value={data.hazard.highTide.depth}
                  badge={hasRiskToLevel(
                    data.hazard.highTide.hasRisk,
                    data.hazard.highTide.depth
                  )}
                />
                <Row
                  label="津波浸水想定"
                  value={data.hazard.tsunami.depth}
                  badge={hasRiskToLevel(
                    data.hazard.tsunami.hasRisk,
                    data.hazard.tsunami.depth
                  )}
                />
                <a
                  href={data.hazard.portalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block mt-2 text-xs underline text-navy"
                >
                  → 重ねるハザードマップで直接確認
                </a>
              </>
            ) : (
              <p className="text-ink/60">データ取得に失敗しました</p>
            )}
          </Card>

          {/* 土砂 */}
          <Card title="土砂災害リスク" icon="⛰️">
            {data.hazard ? (
              <Row
                label="警戒区域の判定"
                value={data.hazard.landslide.category}
                badge={
                  data.hazard.landslide.hasRisk
                    ? /特別/.test(data.hazard.landslide.category)
                      ? "high"
                      : "medium"
                    : "none"
                }
              />
            ) : (
              <p className="text-ink/60">データ取得に失敗しました</p>
            )}
          </Card>

          {/* ライフライン停止想定 */}
          <Card title="ライフライン停止想定（悪条件＝最長）" icon="⚡" span2>
            {data.jishin10 ? (
              <>
                {data.jishin10.assumedIntensityLabel &&
                  data.jishin10.assumedIntensityLabel !== "データなし" && (
                    <div className="mb-3 p-3 bg-navy/5 border border-navy/20 rounded text-sm">
                      <strong>想定揺れ：{data.jishin10.assumedIntensityLabel}</strong>
                      {data.jishin10.assumedIntensity != null && (
                        <span className="ml-2 text-ink/60">
                          （計測震度 {data.jishin10.assumedIntensity.toFixed(1)}）
                        </span>
                      )}
                      <p className="text-xs text-ink/60 mt-1">
                        30年発生確率3%（≒1000年再現期間）クラスの地震想定。BCP上の最悪ケースとして復旧計画に利用してください。
                      </p>
                    </div>
                  )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <LifelineBox
                    label="停電"
                    icon="💡"
                    worst={data.jishin10.powerOutDaysWorst}
                    mid={data.jishin10.powerOutDaysMid}
                    best={data.jishin10.powerOutDaysBest}
                  />
                  <LifelineBox
                    label="都市ガス"
                    icon="🔥"
                    worst={data.jishin10.gasOutDaysWorst}
                    mid={data.jishin10.gasOutDaysMid}
                    best={data.jishin10.gasOutDaysBest}
                  />
                  <LifelineBox
                    label="上水道"
                    icon="💧"
                    worst={data.jishin10.waterOutDaysWorst}
                    mid={data.jishin10.waterOutDaysMid}
                    best={data.jishin10.waterOutDaysBest}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-sm text-ink/70">
                  {data.jishin10.sewageDaysWorst != null && (
                    <span>
                      下水道：最長{" "}
                      <strong>
                        {data.jishin10.sewageDaysWorst.toFixed(0)}日
                      </strong>
                    </span>
                  )}
                  {data.jishin10.roadDamagePct != null && (
                    <span>
                      道路損傷：約{" "}
                      <strong>
                        {data.jishin10.roadDamagePct.toFixed(1)}%
                      </strong>
                    </span>
                  )}
                </div>
                <p className="text-xs text-ink/50 mt-3">
                  出典：{data.jishin10.source}
                </p>
                <a
                  href="https://nied-weblabo.bosai.go.jp/10sec-sim/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block mt-1 text-xs underline text-navy"
                >
                  → 地震10秒診断（防災科研）で公式サイト表示
                </a>
              </>
            ) : (
              <p className="text-ink/60">
                地震10秒診断データの取得に失敗しました。
                <a
                  href="https://nied-weblabo.bosai.go.jp/10sec-sim/"
                  target="_blank"
                  rel="noreferrer"
                  className="underline text-navy ml-1"
                >
                  公式サイト
                </a>
                で直接確認してください。
              </p>
            )}
          </Card>

          {/* 火災 */}
          <Card title="地震火災・延焼リスク" icon="🔥">
            {data.fire ? (
              <>
                <Row
                  label="周辺500m圏内 建物密集度"
                  value={
                    data.fire.density === "high"
                      ? "高い"
                      : data.fire.density === "medium"
                      ? "中程度"
                      : data.fire.density === "low"
                      ? "低い"
                      : "要確認"
                  }
                  badge={densityToLevel(data.fire.density)}
                />
                <p className="text-sm text-ink/80 mt-2 leading-relaxed">
                  {data.fire.comment}
                </p>
              </>
            ) : (
              <p className="text-ink/60">データ取得に失敗しました</p>
            )}
          </Card>

          {/* 避難所 */}
          <Card title="最寄りの指定避難場所候補" icon="🚪" span2>
            {data.shelters?.portalUrl && (
              <div className="mb-3 p-3 bg-navy/5 border border-navy/20 rounded text-sm">
                <strong>📍 公式の指定緊急避難場所は下記で確認してください</strong>
                <a
                  href={data.shelters.portalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block mt-1 text-navy underline"
                >
                  → 国土地理院 指定緊急避難場所マップ（地図上で確認）
                </a>
                <p className="text-xs text-ink/60 mt-1">
                  以下はOpenStreetMapに「emergency」「disaster」タグで登録された参考情報（駅の休憩所等は除外済み）。自治体公式の避難場所一覧とマップも必ず参照してください。
                </p>
              </div>
            )}
            {data.shelters && data.shelters.shelters.length > 0 ? (
              <div className="space-y-2">
                {data.shelters.shelters.map((s, i) => (
                  <div
                    key={s.osmUrl}
                    className="flex justify-between items-start py-1 border-b border-ink/5 last:border-0"
                  >
                    <div>
                      <div className="font-medium">
                        {i + 1}. {s.name}
                      </div>
                      {s.tags.length > 0 && (
                        <div className="text-xs text-ink/60">
                          タグ: {s.tags.join(", ")}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-mono">
                        約 {s.distanceKm.toFixed(2)} km
                      </div>
                      <a
                        href={s.osmUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs underline text-navy"
                      >
                        地図で見る
                      </a>
                    </div>
                  </div>
                ))}
                <p className="text-xs text-ink/50 mt-2">
                  ※OSM登録の参考情報。正式な指定緊急避難場所は上記の国土地理院マップまたは所在自治体の公式一覧をご確認ください。
                </p>
              </div>
            ) : (
              <p className="text-ink/60 text-sm">
                OSM上では該当タグの避難場所が3km圏内に登録されていません。
                上部の国土地理院マップリンクで公式の指定緊急避難場所をご確認ください。
                {data.shelters?.error && (
                  <span className="block text-xs text-ink/40 mt-1">
                    ({data.shelters.error})
                  </span>
                )}
              </p>
            )}
          </Card>
        </div>
      )}

      {tab === "plan" && (
        <div className="bg-white border border-ink/10 rounded-lg p-6">
          <p className="text-sm text-ink/70 mb-3">
            以下を「事業継続力強化計画」申請書の STEP2（災害リスクと影響）欄
            に貼り付けて、自社の状況に合わせて文言を調整してください。
          </p>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed bg-paper p-4 rounded border border-ink/10">
            {planText}
          </pre>
        </div>
      )}

      {tab === "json" && (
        <div className="bg-white border border-ink/10 rounded-lg p-6">
          <p className="text-sm text-ink/70 mb-3">
            取得した生データ。社内の別システム連携や検証用に。
          </p>
          <pre className="whitespace-pre-wrap font-mono text-xs bg-paper p-4 rounded border border-ink/10 overflow-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}

      {/* 印刷時専用：全情報を1ページに */}
      <div className="hidden print:block mt-6">
        <h2 className="text-xl font-bold border-b border-ink pb-2 mb-4">
          事業継続力強化計画 申請参考資料
        </h2>
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
          {planText}
        </pre>
      </div>

      {data.errors.length > 0 && (
        <div className="mt-4 p-3 bg-warn/10 border border-warn/30 rounded text-xs text-ink/70 no-print">
          <strong>取得に失敗したデータがあります：</strong>
          <ul className="list-disc pl-5 mt-1">
            {data.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm border-b-2 ${
        active
          ? "border-navy text-navy font-medium"
          : "border-transparent text-ink/60 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function Card({
  title,
  icon,
  children,
  span2,
}: {
  title: string;
  icon?: string;
  children: React.ReactNode;
  span2?: boolean;
}) {
  return (
    <div
      className={`bg-white border border-ink/10 rounded-lg p-5 ${
        span2 ? "md:col-span-2" : ""
      }`}
    >
      <h3 className="font-bold text-navy mb-3">
        {icon && <span className="mr-2">{icon}</span>}
        {title}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge?: RiskLevel;
}) {
  return (
    <div className="flex justify-between items-center text-sm py-0.5">
      <span className="text-ink/70">{label}</span>
      <span className="flex items-center gap-2">
        <span className="font-medium">{value}</span>
        {badge && <RiskBadge level={badge} />}
      </span>
    </div>
  );
}

function LifelineBox({
  label,
  icon,
  worst,
  mid,
  best,
}: {
  label: string;
  icon: string;
  worst: number | null;
  mid: number | null;
  best: number | null;
}) {
  const fmt = (v: number | null) => (v == null ? "—" : `${v.toFixed(0)}日`);
  // 最長日数で色分け
  let badge: RiskLevel = "unknown";
  if (worst != null) {
    if (worst >= 14) badge = "high";
    else if (worst >= 7) badge = "medium";
    else if (worst >= 0) badge = "low";
  }
  return (
    <div className="border border-ink/10 rounded-lg p-3 bg-paper/50">
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium">
          <span className="mr-1">{icon}</span>
          {label}
        </div>
        <RiskBadge level={badge} />
      </div>
      <div className="space-y-0.5 text-sm">
        <div className="flex justify-between">
          <span className="text-ink/60">最長（悪条件）</span>
          <span className="font-bold text-danger">{fmt(worst)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink/60">中央値</span>
          <span>{fmt(mid)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink/60">最短</span>
          <span className="text-ink/60">{fmt(best)}</span>
        </div>
      </div>
    </div>
  );
}
