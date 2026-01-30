# eigo-oh-prototype
英語タイピング学習アプリ（React + Vite + TypeScript）

## 概要
日本語のプロンプトに対して英語タイピングを行う学習アプリ。  
ユーザー選択、コース/ページ/セクション選択、3つの学習モード、ローカル保存の進捗管理を備えています。

## 画面構成
- Home: ユーザー選択 + コース選択
- Course: ページ一覧 + セクション選択 + 学習モード選択
- Play: タイピング学習 + 進捗表示 + 結果画面

## ルーティング
- `/` Home: `src/pages/HomePage.tsx`
- `/course` Course: `src/pages/CoursePage.tsx`
- `/play` Play: `src/pages/PlayPage.tsx`
- その他は `/` にリダイレクト（`src/App.tsx`）

## 学習モード
- モード1: 音あり / スペルあり
- モード2: 音あり / スペルなし
- モード3: 音なし / スペルなし

## データ構造
- 型定義: `src/types/index.ts`
- 問題データ + コース構造: `src/data/questions.ts`
  - `questions[]` が問題一覧
  - `courseStructure` がページ/セクション構成
  - `getQuestionById`, `getQuestionsBySection`, `getSectionsByPageRange` などのヘルパー

## 状態管理（Context/Reducer）
- `src/context/AppContext.tsx`: Context Provider、localStorage 連携、便利メソッド
- `src/context/AppReducer.ts`: state 更新ロジック
- 主な state
  - ユーザー: `currentUser`, `users`
  - 選択状態: `selectedCourse`, `selectedPageRange`, `selectedSection`, `selectedMode`
  - プレイ状態: `currentQuestionIndex`, `shuffleMode`, `shuffledQuestionIds`
  - 進捗: `userProgress`, `sectionProgress`
  - 設定: `autoPlayAudio`

## 主要コンポーネント
- `Header`: ユーザー選択/シャッフル切替/パンくず/戻る
- `PageList`: ページ一覧 + 進捗表示
- `SectionCard`: セクション + モード選択（ロック表示あり）
- `QuestionDisplay`: 日本語プロンプト + 英語表示 + 音声
- `TypingInput`: タイピング判定 + ヒント + ミス数 + 完了表示
- `ProgressBar`, `QuestionNav`, `AudioPlayer`, `Button`, `Card`, `ModeButton`

## ユーティリティ
- `src/utils/typing.ts`: 文字入力判定/正規化/表示状態/ハイライト
- `src/utils/shuffle.ts`: シャッフル/連続重複回避
- `src/utils/progress.ts`: 正答率計算/クリア判定
- `src/utils/storage.ts`: localStorage 永続化

## スタイル
- グローバル: `src/styles/global.css`, `src/styles/variables.css`
- コンポーネント/ページごとに `*.module.css`

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
