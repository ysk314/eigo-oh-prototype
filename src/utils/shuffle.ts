// ================================
// Shuffle Utilities
// ================================

// Fisher-Yates シャッフル
export function shuffleArray<T>(array: T[]): T[] {
    const result = [...array];

    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
}

// 同一要素の連続を避けるシャッフル
export function shuffleWithNoConsecutive<T>(
    array: T[],
    getKey: (item: T) => string
): T[] {
    if (array.length <= 1) return [...array];

    const result = shuffleArray(array);

    // 最大試行回数（無限ループ防止）
    const maxAttempts = array.length * 10;
    let attempts = 0;

    // 連続をチェックして修正
    for (let i = 0; i < result.length - 1 && attempts < maxAttempts; i++) {
        if (getKey(result[i]) === getKey(result[i + 1])) {
            // 連続している場合、後ろの要素と別の位置の要素を交換
            for (let j = i + 2; j < result.length; j++) {
                if (getKey(result[j]) !== getKey(result[i])) {
                    [result[i + 1], result[j]] = [result[j], result[i + 1]];
                    break;
                }
            }
            attempts++;
        }
    }

    return result;
}

// IDリストをシャッフル
export function shuffleQuestionIds(ids: string[]): string[] {
    return shuffleArray(ids);
}
