// ================================
// Timer Utilities
// ================================

import { Question } from '@/types';

export function calculateTotalChars(questions: Question[]): number {
    return questions.reduce((acc, q) => acc + q.answerEn.length, 0);
}

export function calculateTimeLimit(
    totalChars: number,
    perCharSeconds = 1,
    bufferSeconds = 10
): number {
    return Math.floor(totalChars * perCharSeconds + bufferSeconds);
}

export function calculateTimeBarPercent(timeLeft: number, timeLimit: number): number {
    if (timeLimit <= 0) return 0;
    return Math.max(0, Math.min(100, (timeLeft / timeLimit) * 100));
}
