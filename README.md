# 事業継続力強化計画サポート｜住所から調べる災害リスク

BCP JAPAN（株式会社BCPJAPAN）の無料勉強会で使う、住所ベースの災害リスク自動調査ツールです。

住所を1つ入力するだけで、以下を取得して「事業継続力強化計画（単独型）」の
STEP2（災害等のリスクの確認・影響の整理）欄にそのまま貼れる文章を自動生成します。

| 調査項目 | データソース |
|---------|------------|
| 緯度・経度・標高 | 国土地理院 ジオコーディングAPI／標高API |
| 地震発生確率（震度5強／6弱／6強） | J-SHIS（防災科学技術研究所） |
| 表層地盤 AVS30・増幅率・液状化 | J-SHIS 表層地盤データ |
| 洪水浸水想定（想定最大規模） | 重ねるハザードマップ 洪水タイル |
| 高潮浸水想定 | 重ねるハザードマップ 高潮タイル |
| 津波浸水想定 | 重ねるハザードマップ 津波タイル |
| 土砂災害警戒区域 | 重ねるハザードマップ 土砂タイル |
| 最寄り避難所（半径2km・上位5件） | OpenStreetMap Overpass API |
| 火災延焼リスク（建物密集度） | OpenStreetMap（建物棟数） |

出力形式：
- リスク一覧カード（画面表示）
- 申請様式コピペ用テキスト（クリップボードコピー対応）
- PDF（ブラウザ印刷経由でA4保存）
- JSON（開発者向け生データ）

---

## ローカル動作確認（任意）

Node.js 18以上が必要です。

```bash
npm install
npm run dev
# http://localhost:3000 を開く
```

---

## Vercelへのデプロイ手順（5分）

### 前提

- GitHubアカウント（既にお持ちの `kamiyamake2020@gmail.com` 連携のもので可）
- Vercelアカウント（無料 Hobby プランで可）
  → https://vercel.com/signup

### 手順1：GitHubに新規リポジトリを作成

1. https://github.com/new を開く
2. Repository name: `bousai-risk-app` （任意）
3. Privateでも Publicでも可（今回は Public推奨：URL共有時に見せられる）
4. 「Create repository」

### 手順2：このフォルダをGitHubにプッシュ

ターミナルでこのフォルダに移動して、以下を順に実行：

```bash
git init
git add .
git commit -m "initial: 事業継続力強化計画サポートツールv1"
git branch -M main
git remote add origin https://github.com/<あなたのユーザー名>/bousai-risk-app.git
git push -u origin main
```

（Gitの認証でトークンを求められる場合は、
　GitHub設定 → Developer settings → Personal access tokens で作成したものを使用）

### 手順3：Vercelでインポート

1. https://vercel.com/new を開く
2. 左側「Import Git Repository」で、手順2のリポジトリを選択 → Import
3. Framework Preset は自動で **Next.js** になっていることを確認
4. 環境変数：不要（APIキーを使っていないためそのままでOK）
5. 「Deploy」

2〜3分でデプロイが完了し、`https://bousai-risk-app-xxxx.vercel.app` の URL が発行されます。

### 手順4（任意）：独自ドメインの設定

独自ドメイン（例：`risk.bcpjapan.jp`）を使う場合：

1. Vercelダッシュボード → 該当プロジェクト → Settings → Domains
2. 使いたいドメインを入力 → Add
3. 表示される CNAME 値を、ドメインのDNS設定に追加
4. 5〜10分で反映

### 手順5：勉強会で共有

発行された URL を、勉強会参加者にLINE／メールで共有するだけで全員使えます。
ログイン不要・誰でもアクセス可能。

---

## アーキテクチャ

```
[ブラウザ] 住所入力
   │
   ▼
POST /api/research {address}
   │
   ▼
[Next.js API Route (Node.js Serverless Function on Vercel)]
   ├─ 国土地理院 ジオコーディング  ──→ lat,lon
   ├─ 国土地理院 標高API         ──→ elevation
   ├─ J-SHIS 確率論的地震動API    ──→ 地震確率
   ├─ J-SHIS 表層地盤API         ──→ AVS30・液状化
   ├─ 重ねるハザードマップ タイル ──→ 浸水・土砂（PNG pixel判定）
   ├─ Overpass API (OSM)         ──→ 避難所・建物数
   │
   ▼
ResearchResult JSON → クライアントで整形表示
```

重要なポイント：
- すべてのAPI呼び出しは `Promise.all` で並列実行。
- 1つのAPIが失敗しても他の結果は返る（errors配列に詳細）。
- API側で `next.revalidate` によりVercel Edge Cacheを活用し、
  同じ住所の2回目以降は高速に応答。

---

## ディレクトリ構成

```
bousai-risk-app/
├── app/
│   ├── layout.tsx              # 共通レイアウト
│   ├── page.tsx                # メインページ（住所入力〜結果表示）
│   ├── globals.css             # Tailwindと印刷用CSS
│   └── api/research/route.ts   # APIルート：全データ取得を並列実行
├── components/
│   ├── AddressForm.tsx         # 住所入力フォーム
│   ├── ResultView.tsx          # タブ切替（カード/文章/JSON）
│   └── RiskBadge.tsx           # 高/中/低のバッジ
├── lib/
│   ├── types.ts                # 共通型定義
│   ├── geocoding.ts            # 国土地理院ジオコーディング
│   ├── elevation.ts            # 国土地理院標高API
│   ├── jshis.ts                # J-SHIS Map API
│   ├── hazardmap.ts            # 重ねるハザードマップ タイル読取
│   ├── shelter.ts              # OSM避難所検索
│   ├── fire.ts                 # OSM建物密集度
│   └── format.ts               # 申請様式用テキスト整形
├── package.json
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── README.md                   # これ
```

---

## カスタマイズしたい時

### 調査項目を足したい

1. `lib/` 配下に `xxx.ts` を新規作成
2. `lib/types.ts` の `ResearchResult` にフィールドを追加
3. `app/api/research/route.ts` で `Promise.all` に追加
4. `components/ResultView.tsx` にカードを追加
5. `lib/format.ts` にテキスト出力を追加

### 申請様式の文面を微調整したい

`lib/format.ts` の `formatPlanText()` を編集。
文言のトーン（です・ます調／である調）・見出し・注記はここで制御します。

### 色味・レイアウトを変えたい

`tailwind.config.ts` の `colors` を編集。BCP JAPANブランドに合わせた navy／accent／paper を定義済み。

---

## よくある質問

### Q. Vercel無料プランで大丈夫？

A. 勉強会規模（同時数十人）であれば Hobbyプランで十分。
月間 Function Invocations 10万回まで無料です。1人が10回使っても月1,000人までさばけます。

### Q. APIの利用規約は？

A. 使用しているAPIはすべて利用規約で商用・教育利用を許諾しているものです：

- 国土地理院：出典を明示することを条件に自由利用（ https://www.gsi.go.jp/LAW/20231228-01.html ）
- J-SHIS：防災科研のオープンデータ利用規約に準拠（ https://www.j-shis.bosai.go.jp/labs/api ）
- OpenStreetMap：ODbLライセンス。出典表示のみ必要
- Overpass API：Fair Use Policy（過度なクエリは避ける）

本アプリは各結果に出典を表示しているため規約準拠です。

### Q. サイバー攻撃で落ちない？

A. 現状はレートリミットなし。大規模アクセスが予想される場合は、
Vercel Edge Config や Upstash でシンプルなIP単位のレート制限を追加してください。

### Q. 個人情報は？

A. サーバ側で住所・座標のログを出力していますが永続保存はしません
（Vercel標準のFunction Logs のみ、72時間保存）。
ユーザーが入力した住所は第三者に共有されません。

---

## 動作確認用サンプル住所

| 住所 | 想定される結果 |
|------|--------------|
| 東京都千代田区千代田1-1 | 地震確率高め・浸水なし・建物密集度 高 |
| 大阪府大阪市北区梅田3-1-3 | 地震確率高め・津波想定あり・密集度 高 |
| 静岡県静岡市清水区港町1-1 | 南海トラフで震度大・津波想定 高・沿岸部 |
| 福島県いわき市平1-1 | 津波想定・太平洋沿岸 |
| 熊本県熊本市中央区水前寺6-18-1 | 中程度地震確率・河川氾濫想定域の可能性 |

---

## 出典表記（申請書・勉強会資料に入れる場合）

本ツールは以下の公的データソースを利用しています：
- 国土地理院（測量法第29条「出典の明示」に基づく）
- 防災科学技術研究所 J-SHIS（地震ハザードステーション）
- OpenStreetMap contributors（ODbL）

© 2026 株式会社BCPJAPAN / 防災×BCPパワーチーム
