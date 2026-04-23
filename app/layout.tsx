import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "事業継続力強化計画サポート｜住所から調べる災害リスク",
  description:
    "住所を入力するだけで、地震・水害・土砂・避難所・ライフラインなどの公的ハザード情報を収集。事業継続力強化計画の申請原稿に貼れる形で出力します。BCP JAPAN 無料勉強会ツール。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="font-sans">{children}</body>
    </html>
  );
}
