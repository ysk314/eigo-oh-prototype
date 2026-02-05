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

export function calculateAccuracyScore(accuracy: number): number {
    return Math.max(0, Math.min(100, Math.round(accuracy)));
}

export function calculateTimeScore(timeLeft: number, timeLimit: number): number {
    if (timeLimit <= 0) return 0;
    const ratio = Math.max(0, Math.min(1, timeLeft / timeLimit));
    return Math.round(ratio * 100);
}

export function calculateRank(totalScore: number): Rank {
    if (totalScore >= 90) return 'S';
    if (totalScore >= 75) return 'A';
    if (totalScore >= 60) return 'B';
    return 'C';
}

export function buildScoreResult(params: {
    accuracy: number;
    timeLeft: number;
    timeLimit: number;
}): ScoreResult {
    const accuracyScore = calculateAccuracyScore(params.accuracy);
    const timeScore = calculateTimeScore(params.timeLeft, params.timeLimit);
    const totalScore = Math.round(accuracyScore * 0.7 + timeScore * 0.3);
    const rank = calculateRank(totalScore);

    return { accuracyScore, timeScore, totalScore, rank };
}
