# Alphabet Bridge カリキュラム v3（Duolingo ABC移植方針）

最終更新: 2026-02-08

## 1. 何を移植したか
Duolingo ABCの「同じ文字を複数アクティビティで段階習得する」構造を、
このアプリの既存UI（タイピング3モード / 4択4レベル）に移植。

- 同じ Section で学習文字セットは共通
- 出題はモード別に完全分離
- さらにレベル別に出題タイプを固定（足場かけ）

## 2. データ構造
- 骨格: `Unit > Part > Section`（共通）
- 問題バンク: 同一Section内で
  - `typing-only` + `typing-l1|l2|l3`
  - `choice-only` + `choice-l1|l2|l3|l4`

## 3. レベル別の学習意図
### タイピング
- L1: 小文字を正しく打つ（認識 -> 再現）
- L2: 大文字を正しく打つ（Shiftを含む再現）
- L3: 大小セットを打つ（統合）

### 4択
- L1: 記号 -> 文字名（認識）
- L2: 文字名/手掛かり -> 記号（想起）
- L3: 英単語 -> キーワード意味（語と文字の連結）
- L4: キーワード意味 -> 英単語（逆引き）

## 4. 出題テンプレート（実装済み）
### タイピング
- L1: `【L1】文字名「エー」の小文字を入力` -> `a`
- L2: `【L2】apple の頭文字（大文字）を入力` -> `A`
- L3: `【L3】apple の文字セット（大→小）を入力` -> `Aa`

### 4択
- L1: `A` を見て `文字名「エー」` を選ぶ
- L2: `文字名「エー」の大文字` を見て `A` を選ぶ
- L3: `apple` を見て `キーワード「りんご」` を選ぶ
- L4: `「りんご」の英語` を見て `apple` を選ぶ

## 5. カリキュラム骨格（共通）
## Unit 1: A-M ペアカード
- Part 1: A-M 導入
  - Section 1: A-F
  - Section 2: G-M
- Part 2: A-M 定着
  - Section 1: A-M 反復1
  - Section 2: A-M 反復2

## Unit 2: N-Z ペアカード
- Part 1: N-Z 導入
  - Section 1: N-T
  - Section 2: U-Z
- Part 2: N-Z 定着
  - Section 1: N-Z 反復1
  - Section 2: N-Z 反復2

## Unit 3: まぎらわし対策 + 全体復習
- Part 1: まぎらわし集中
  - Section 1: B/D/P/Q
  - Section 2: I/L/J/T
  - Section 3: M/N/U/V/W/Y
- Part 2: 全26スパイラル
  - Section 1: 全26チェック1
  - Section 2: 全26チェック2
  - Section 3: 総合ミックス
