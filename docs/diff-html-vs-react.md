# HTML版 vs React版 差分詳細（移植仕様）

このドキュメントは、`index.html`（HTML版）を「仕様の基準」として、React版（`src/`）との差分を機能単位で詳細化したものです。  
移植時は「HTML版の挙動」を再現することを優先します。

---

## 1. 画面構成・ナビゲーション

### HTML版（index.html）
- 画面状態: `view` を文字列で切替
  - `home` / `course` / `countdown` / `play` / `result`
- 画面遷移
  - Home → Course: 「はじめる」ボタン
  - Course → Countdown: セクション/モード選択
  - Countdown → Play: 3..2..1 終了時
  - Play → Result: 全問終了 or タイムアップ
  - Result → Course: ボタン

### React版
- ルーティング: `/` / `/course` / `/play`
- Countdown/Result は PlayPage 内で描画
- 遷移は `useNavigate`

**移植ポイント**
- React版にも `countdown` 相当の UI を追加
- `result` 画面は現在 PlayPage で表示されるので、結果表示を強化する

---

## 2. タイピング開始演出（カウントダウン）

### HTML版
- 3秒カウントダウン
- 画面全体オーバーレイ
- 毎秒 `countdown` 音
- 終了時に play へ切替

### React版
- なし

**移植ポイント**
- PlayPageに `countdown` state を追加
- 画面上でCountdown Overlayを表示
- 音の再生タイミングを再現

---

## 3. タイムリミット & タイムバー

### HTML版
- timeLimit = `totalChars * 1.0 + 10` を切り捨て
- timeLeft を 1秒ごとに減少
- timeLeft == 0 で強制終了
- 画面に残り時間バーを表示
- timeLeft < 10 の時バー色をエラー色に変更

### React版
- なし

**移植ポイント**
- React側で timeLimit/timeLeft を計算
- Timer bar を追加
- タイムアップ処理を `finishSession` 相当で実行

---

## 4. 入力判定とヒント表示

### HTML版
- 1文字ずつ入力
- 正解 → input 進行 + type 音
- 不正解 → miss + error フラッシュ + error 音
- 連続ミス2回で「次の文字」をヒント表示
- 文字は strict match（大文字小文字も厳密）

### React版
- `TypingInput` で `processKeyInput` を使用
- ミスはカウントするが、ヒントはモード別に固定表示
- 連続ミス判定なし

**移植ポイント**
- `TypingInput` に「連続ミス回数」と「次文字ヒント」ロジック追加
- HTML版のヒント仕様を mode 条件と統合するか要調整

---

## 5. スコア計算とランク

### HTML版
- Accuracy score: `100 - miss * 5` (min 0)
- Time score: `(timeLeft / timeLimit) * 50` （miss > 0 なら 0）
- Total = accuracyScore + timeScore
- Rank
  - S: total >= 100 && not timeUp
  - A: total >= 80 && not timeUp
  - B: total >= 60 && not timeUp
  - C: それ以外
- S の場合は紙吹雪 + ファンファーレ

### React版
- accuracy（総文字数/総ミス）で % 表示
- S/A/B/C なし
- クリア基準は正答率 90% 以上

**移植ポイント**
- まず HTML版のスコア式を React に移植
- 結果画面にランク表示追加
- 既存 accuracy 表示は残す/置換の検討

---

## 6. 進捗保存とアンロック条件

### HTML版
- 進捗はメモリ
- アンロック条件: 前モードで S ランク
- `progress[key][mode] = rank` を保持
- 既存が S の場合は上書きしない

### React版
- `sectionProgress` が保存される
- mode1/2/3 のクリアは boolean
- クリア条件: accuracy >= 90%

**移植ポイント**
- `SectionProgress` に最高ランクを持たせる構造追加
- アンロック条件を S ランク基準に切替
- 既存ユーザーのデータマイグレーションが必要

---

## 7. 効果音

### HTML版
- Web Audio API で効果音生成
- 種類:
  - type（入力成功）
  - error（入力ミス）
  - success（小成功音）
  - fanfare（Sランク用）
  - try-again（失敗音）
  - countdown（カウント音）

### React版
- 効果音なし

**移植ポイント**
- `utils/sound.ts` を追加して HTML版の音ロジックを移植
- 各入力/完了/カウントダウンで音を再生

---

## 8. 音声再生（問題音声）

### HTML版
- TTSのみ（SpeechSynthesis）
- 英語ボイス優先選定
  - Google US / Zira / Samantha / Tom など
- autoPlay: 500ms 後に再生
- 再生中は波アニメーション
- 2秒後に `playing` を解除

### React版
- `audioUrl` があれば audio、なければ TTS
- voice 選定なし（デフォルト）
- autoPlay: 300ms 後
- `onended` で playing 終了
- `stop` ボタンあり

**移植ポイント**
- HTML版の voice 選択ロジックを `AudioPlayer` に組み込み
- autoPlay の遅延を揃える
- 再生完了の扱い（固定2秒 or onended）を選択

---

## 9. UI/演出

### HTML版
- Countdown overlay
- Rank S で紙吹雪
- タイムバーが赤色に変化
- Modeボタンに Rank 色表示（S/A/B）

### React版
- Countdown 없음
- Rank UI 없음
- Modeボタンに lock 表示のみ

**移植ポイント**
- Rank色付きModeButtonを追加
- Resultで紙吹雪演出
- Time bar の UI を追加

---

## 10. データ規模と構造

### HTML版
- QUESTIONS/PAGES/SECTIONS は小規模固定配列
- highlightは `highlight` フィールド

### React版
- `data/questions.ts` に大きめの構造がある
- highlightは `highlightTokens`

**移植ポイント**
- React版のデータ構造を維持しつつ、HTML版の演出とロジックを移植
- highlight 表示はすでに対応済み

---

## 11. 実装方針（移植優先順）

1. **スコア/ランク計算ユーティリティ**
2. **カウントダウン・タイムリミット**
3. **効果音（タイピング/ミス/成功）**
4. **Result画面強化（ランク・紙吹雪）**
5. **アンロック条件の切替**
6. **AudioPlayerのvoice選定ロジック統合**

---

## 12. 未確定点（要相談）

- Rank判定と既存の「正答率90%基準」の扱い（完全に置換するか併用するか）
- `AudioPlayer` の終了条件（HTMLは2秒固定、Reactはonended）
- HTML版の「連続ミス2回ヒント」とReactの「モード別ヒント」両立仕様

