# tap-type-english
Tap! Type! English! / 英語タイピング学習アプリ（React + Vite + TypeScript）

## 概要
英語タイピング + 4択の語彙学習を提供する学習アプリ。Firebase Auth + Firestore を使い、
ログイン（会員番号 or メール + パスワード / ゲスト）と進捗のクラウド保存に対応しています。

## 画面構成
- Login: ログイン（会員番号 or メール）/ ゲスト
- Dashboard: 学習サマリー、直近セッション、直近セクション、コース選択
- Course: Unit/Part/Section 選択、学習モード選択
- Play: タイピング学習 + 結果
- Choice: 4択学習 + 結果

## ルーティング
- `/` Login: `src/pages/LoginPage.tsx`
- `/dashboard` Dashboard: `src/pages/HomePage.tsx`
- `/course` Course: `src/pages/CoursePage.tsx`
- `/play` Typing: `src/pages/PlayPage.tsx`
- `/choice` 4択: `src/pages/ChoicePage.tsx`

## 学習モード
- タイピング
  - モード1: 音あり / スペルあり
  - モード2: 音あり / スペルなし
  - モード3: 音なし / スペルなし
- 4択
  - レベル1: 英語→日本語（音声あり）
  - レベル2: 日本語→英語
  - レベル3: 英語→日本語（マスク）
  - レベル4: 日本語→英語（マスク）

## データ構造
- 型定義: `src/types/index.ts`
- 問題データ + コース構造: `src/data/questions.ts`
  - `questions[]` が問題一覧
  - `courseStructure` が Unit/Part/Section 構成
  - `getQuestionsBySection`, `getSectionsByPart` などのヘルパー

## Firebase 構成（Spark 想定）
- Auth: 匿名ログイン + メール/パスワード
- Firestore コレクション
  - `users/{uid}`: ユーザープロフィール
  - `users/{uid}/userProgress/*`: 問題ごとの進捗
  - `users/{uid}/sectionProgress/*`: セクションの進捗/ランク
  - `member_counters/{yearId}`: 会員番号採番
  - `analytics_events/*`: イベントログ（create-only）
  - `user_stats/{uid}`: ダッシュボード集計
  - `user_recent_sections/{uid}`: 直近セクション（最大5件）
  - `user_recent_sessions/{uid}`: 直近セッション（最大3件）
- ルール: `firestore.rules`

## 状態管理（Context/Reducer）
- `src/context/AppContext.tsx`: Context Provider、localStorage 連携、Firebase同期
- `src/context/AppReducer.ts`: state 更新ロジック

## 主要ユーティリティ
- `src/utils/storage.ts`: localStorage 永続化
- `src/utils/remoteStorage.ts`: Firestore 同期
- `src/utils/analytics.ts`: イベント送信
- `src/utils/dashboardStats.ts`: ダッシュボード集計
- `src/utils/score.ts`: ランク判定/スコア算出

## 開発
```bash
npm install
npm run dev
```

## ビルド
```bash
npm run build
npm run preview
```
