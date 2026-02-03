// ================================
// Score Utilities
// ================================

import { Rank } from '@/types';

export interface ScoreResult {
    accuracyScore: number;
    timeScore: number;
    totalScore: number;
    rank: Rank;
}

export function calculateAccuracyScore(missCount: number): number {
    return Math.max(0, 100 - missCount * 5);
}

export function calculateTimeScore(
    timeLeft: number,
    timeLimit: number,
    missCount: number
): number {
    if (timeLimit <= 0) return 0;
    if (missCount > 0) return 0;
    return Math.floor((timeLeft / timeLimit) * 50);
}

export function calculateRank(totalScore: number, timeUp: boolean): Rank {
    if (!timeUp && totalScore >= 100) return 'S';
    if (!timeUp && totalScore >= 80) return 'A';
    if (!timeUp && totalScore >= 60) return 'B';
    return 'C';
}

export function buildScoreResult(params: {
    missCount: number;
    timeLeft: number;
    timeLimit: number;
    timeUp: boolean;
}): ScoreResult {
    const accuracyScore = calculateAccuracyScore(params.missCount);
    const timeScore = calculateTimeScore(
        params.timeLeft,
        params.timeLimit,
        params.missCount
    );
    const totalScore = accuracyScore + timeScore;
    const rank = calculateRank(totalScore, params.timeUp);

    return { accuracyScore, timeScore, totalScore, rank };
}
