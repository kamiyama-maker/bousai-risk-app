"use client";

import { useState } from "react";
import AddressForm from "@/components/AddressForm";
import ResultView from "@/components/ResultView";
import type { ResearchResult } from "@/lib/types";

export default function Home() {
  const [data, setData] = useState<ResearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (address: string) => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as ResearchResult;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen">
      {/* ヘッダ */}
      <header className="bg-navy text-white py-5 md:py-8 px-4 md:px-6 no-print">
        <div className="max-w-5xl mx-auto">
          {/* ブランドライン */}
          <div className="flex items-center gap-3 mb-3">
            {/* ロゴ（BCP 実践的 事業継続力強化計画） */}
            <img
              src="/logo.svg"
              alt="BCP 実践的 事業継続力強化計画"
              className="w-14 h-14 md:w-20 md:h-20 rounded-lg shadow-lg flex-shrink-0 bg-white/10"
            />
            <div className="flex flex-col">
              <div className="text-[11px] md:text-sm tracking-widest text-white font-bold leading-tight">
                BCPJAPAN × 神山 健
              </div>
              <div className="text-[10px] md:text-xs tracking-wider text-white/80 leading-tight mt-0.5">
                土地診断メソッド
              </div>
            </div>
          </div>
          <h1 className="text-xl md:text-3xl font-bold leading-tight">
            事業継続力強化計画サポート
            <span className="block text-sm md:text-lg font-normal text-white/90 mt-1">
              住所を入力するだけで、所在地の災害リスクを公的データから自動取得
            </span>
          </h1>
          <p className="mt-3 text-[11px] md:text-xs text-white/80 leading-relaxed">
            「防災は土地から始めなさい」— 著者・地盤調査8,000件超の神山健が設計した、
            経営者・BCP担当者のための無料リスク診断ツールです。
          </p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-5 md:py-8">
        {/* 説明 */}
        <div className="mb-5 md:mb-6 no-print">
          <p className="text-sm md:text-base text-ink/80 leading-relaxed">
            経済産業省「事業継続力強化計画（単独型）」の STEP2
            「災害等のリスクの確認・影響の整理」に使える災害リスク情報を、
            国土地理院・J-SHIS・重ねるハザードマップ・OpenStreetMap等の公的／準公的データから一括取得します。
            結果は「リスク一覧カード」「申請様式コピペ用テキスト」「PDF」の3形式でご利用いただけます。
          </p>
        </div>

        <AddressForm onSubmit={handleSubmit} loading={loading} />

        {loading && (
          <div className="mt-8 p-6 bg-white border border-ink/10 rounded-lg no-print">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
              <div className="text-ink/70">
                公的データソースに問い合わせ中です（約10〜20秒）
              </div>
            </div>
            <ul className="mt-3 text-xs text-ink/50 space-y-0.5">
              <li>・国土地理院 ジオコーディング／標高API</li>
              <li>・J-SHIS 地震動予測地図API</li>
              <li>・重ねるハザードマップ 浸水・土砂タイル</li>
              <li>・OpenStreetMap 避難所・建物密集度</li>
            </ul>
          </div>
        )}

        {error && (
          <div className="mt-8 p-4 bg-danger/10 border border-danger/30 rounded text-sm text-ink/80 no-print">
            <strong className="text-danger">エラー：</strong>
            {error}
          </div>
        )}

        {data && <ResultView data={data} />}

        {/* フッタ注意書き */}
        <footer className="mt-12 md:mt-16 pt-6 md:pt-8 border-t border-ink/10 text-[11px] md:text-xs text-ink/50 leading-relaxed no-print">
          <p>
            <strong>ご利用にあたって：</strong>
            本ツールは公的データを機械的に集約したもので、個別の立地・建物・
            用途による差異は反映されません。申請文書として使用される前に、
            最寄りの経済産業局・自治体防災担当窓口・専門家等にご確認ください。
          </p>
          <p className="mt-2">
            提供：株式会社BCPJAPAN（防災×BCPパワーチーム）／ 設計：神山 健
          </p>
        </footer>
      </div>
    </main>
  );
}
