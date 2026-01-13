// ================================
// Typing Utilities
// ================================

// 文字列の正規化（連続スペースを1つに）
export function normalizeText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

// 1文字ずつの判定結果
export interface CharResult {
    char: string;
    expected: string;
    isCorrect: boolean;
    index: number;
}

// タイピング状態
export interface TypingState {
    answer: string;
    normalizedAnswer: string;
    currentIndex: number;
    inputChars: CharResult[];
    missCount: number;
    isComplete: boolean;
    startTime: number | null;
}

// 初期状態を作成
export function createTypingState(answer: string): TypingState {
    return {
        answer,
        normalizedAnswer: normalizeText(answer),
        currentIndex: 0,
        inputChars: [],
        missCount: 0,
        isComplete: false,
        startTime: null,
    };
}

// 1文字入力を処理
export function processKeyInput(
    state: TypingState,
    inputChar: string
): TypingState {
    // 既に完了している場合は何もしない
    if (state.isComplete) {
        return state;
    }

    // 開始時間を記録
    const startTime = state.startTime ?? Date.now();

    const expectedChar = state.normalizedAnswer[state.currentIndex];
    const isCorrect = inputChar === expectedChar;

    const charResult: CharResult = {
        char: inputChar,
        expected: expectedChar,
        isCorrect,
        index: state.currentIndex,
    };

    const newInputChars = [...state.inputChars, charResult];
    const newMissCount = state.missCount + (isCorrect ? 0 : 1);

    // 正解の場合のみ次の文字へ進む
    const newIndex = isCorrect ? state.currentIndex + 1 : state.currentIndex;
    const isComplete = newIndex >= state.normalizedAnswer.length;

    return {
        ...state,
        currentIndex: newIndex,
        inputChars: newInputChars,
        missCount: newMissCount,
        isComplete,
        startTime,
    };
}

// 正答率を計算
export function calculateAccuracy(state: TypingState): number {
    const totalAttempts = state.inputChars.length;
    if (totalAttempts === 0) return 0;

    const correctAttempts = state.inputChars.filter(c => c.isCorrect).length;
    return correctAttempts / totalAttempts;
}

// 経過時間を取得（ミリ秒）
export function getElapsedTime(state: TypingState): number {
    if (!state.startTime) return 0;
    return Date.now() - state.startTime;
}

// WPM計算（Words Per Minute）
export function calculateWPM(state: TypingState): number {
    const elapsedMs = getElapsedTime(state);
    if (elapsedMs === 0) return 0;

    const words = state.normalizedAnswer.length / 5; // 5文字 = 1ワード
    const minutes = elapsedMs / 60000;

    return Math.round(words / minutes);
}

// 入力文字とハイライト位置を取得
export function getDisplayState(state: TypingState): {
    completedText: string;
    currentChar: string;
    remainingText: string;
} {
    const { normalizedAnswer, currentIndex } = state;

    return {
        completedText: normalizedAnswer.slice(0, currentIndex),
        currentChar: normalizedAnswer[currentIndex] || '',
        remainingText: normalizedAnswer.slice(currentIndex + 1),
    };
}

// 英文のハイライトトークンをマークアップ
export function highlightTokens(
    text: string,
    tokens: string[]
): { text: string; isHighlight: boolean }[] {
    if (!tokens || tokens.length === 0) {
        return [{ text, isHighlight: false }];
    }

    const result: { text: string; isHighlight: boolean }[] = [];
    let remaining = text;

    while (remaining.length > 0) {
        let found = false;

        for (const token of tokens) {
            const index = remaining.toLowerCase().indexOf(token.toLowerCase());
            if (index === 0) {
                // トークンが先頭にある
                result.push({ text: remaining.slice(0, token.length), isHighlight: true });
                remaining = remaining.slice(token.length);
                found = true;
                break;
            } else if (index > 0) {
                // トークンより前のテキストを追加
                result.push({ text: remaining.slice(0, index), isHighlight: false });
                result.push({ text: remaining.slice(index, index + token.length), isHighlight: true });
                remaining = remaining.slice(index + token.length);
                found = true;
                break;
            }
        }

        if (!found) {
            // トークンが見つからない場合は残りをすべて追加
            result.push({ text: remaining, isHighlight: false });
            break;
        }
    }

    return result;
}
