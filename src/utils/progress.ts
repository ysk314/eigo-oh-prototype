// ================================
// Progress Utilities
// ================================

import { LearningMode, SectionProgress, UserProgress } from '@/types';

// ロック解除の正答率基準
const UNLOCK_ACCURACY_THRESHOLD = 0.9; // 90%

// モードがアンロックされているかチェック
export function isModeUnlocked(
    sectionProgress: SectionProgress | undefined,
    mode: LearningMode
): boolean {
    if (!sectionProgress) {
        // 進捗がない場合、モード1のみアンロック
        return mode === 1;
    }

    switch (mode) {
        case 1:
            return true; // モード1は常にアンロック
        case 2:
            return sectionProgress.mode1Cleared;
        case 3:
            return sectionProgress.mode2Cleared;
        default:
            return false;
    }
}

// セクションのクリア条件をチェック
export function checkSectionCleared(
    questionProgresses: UserProgress[],
    mode: LearningMode
): boolean {
    if (questionProgresses.length === 0) return false;

    // 全問題が対象モード以上でクリアされているか
    const allCleared = questionProgresses.every(p => p.clearedMode >= mode);
    if (!allCleared) return false;

    // 正答率が基準以上か
    const totalAttempts = questionProgresses.reduce((sum, p) => sum + p.attemptsCount, 0);
    const totalCorrect = questionProgresses.reduce((sum, p) => sum + p.correctCount, 0);

    if (totalAttempts === 0) return false;

    const accuracy = totalCorrect / totalAttempts;
    return accuracy >= UNLOCK_ACCURACY_THRESHOLD;
}

// 進捗の正答率を計算
export function calculateProgressAccuracy(progress: UserProgress): number {
    if (progress.attemptsCount === 0) return 0;
    return progress.correctCount / progress.attemptsCount;
}

// セクション全体の正答率を計算
export function calculateSectionAccuracy(progresses: UserProgress[]): number {
    const totalAttempts = progresses.reduce((sum, p) => sum + p.attemptsCount, 0);
    const totalCorrect = progresses.reduce((sum, p) => sum + p.correctCount, 0);

    if (totalAttempts === 0) return 0;
    return totalCorrect / totalAttempts;
}

// セクションの完了数を計算
export function calculateSectionCompletion(
    progresses: UserProgress[],
    mode: LearningMode
): { completed: number; total: number } {
    const total = progresses.length;
    const completed = progresses.filter(p => p.clearedMode >= mode).length;
    return { completed, total };
}

// 初期進捗を作成
export function createInitialProgress(questionId: string): UserProgress {
    return {
        questionId,
        attemptsCount: 0,
        correctCount: 0,
        missCount: 0,
        clearedMode: 0,
    };
}

// 進捗を更新
export function updateProgress(
    current: UserProgress,
    result: { correct: number; miss: number; cleared: boolean },
    mode: LearningMode
): UserProgress {
    const newProgress = {
        ...current,
        attemptsCount: current.attemptsCount + result.correct + result.miss,
        correctCount: current.correctCount + result.correct,
        missCount: current.missCount + result.miss,
        lastPlayedAt: new Date().toISOString(),
    };

    // クリア判定
    if (result.cleared && newProgress.clearedMode < mode) {
        newProgress.clearedMode = mode;
    }

    return newProgress;
}

// セクション進捗を更新
export function updateSectionProgress(
    current: SectionProgress | undefined,
    sectionId: string,
    mode: LearningMode,
    cleared: boolean
): SectionProgress {
    const base: SectionProgress = current || {
        sectionId,
        mode1Cleared: false,
        mode2Cleared: false,
        mode3Cleared: false,
        totalAttempts: 0,
        totalCorrect: 0,
        totalMiss: 0,
    };

    const updated = { ...base };

    if (cleared) {
        switch (mode) {
            case 1:
                updated.mode1Cleared = true;
                break;
            case 2:
                updated.mode2Cleared = true;
                break;
            case 3:
                updated.mode3Cleared = true;
                break;
        }
    }

    return updated;
}

// 完了率をパーセント文字列で取得
export function getCompletionPercentage(completed: number, total: number): string {
    if (total === 0) return '0%';
    return `${Math.round((completed / total) * 100)}%`;
}
