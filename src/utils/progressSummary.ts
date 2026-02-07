// ================================
// Progress Summary Utilities
// ================================

import { countTotalSectionsAcrossCourses } from '@/data/questions';
import type { SectionProgress } from '@/types';

export type ProgressTotals = {
    totalAttempts: number;
    totalCorrect: number;
    totalMiss: number;
    clearedSectionsCount: number;
};

let totalSectionsCountCache: number | null = null;

export async function getTotalSectionsCount(): Promise<number> {
    if (totalSectionsCountCache !== null) return totalSectionsCountCache;
    totalSectionsCountCache = await countTotalSectionsAcrossCourses();
    return totalSectionsCountCache;
}

export function buildSectionProgressTotals(
    sectionProgress: Record<string, SectionProgress>,
    currentUserId?: string
): ProgressTotals {
    const entries = currentUserId
        ? Object.entries(sectionProgress).filter(([key]) => key.startsWith(`${currentUserId}-`))
        : Object.entries(sectionProgress);

    return entries.reduce(
        (acc, [, progress]) => {
            if (!progress) return acc;
            acc.totalAttempts += progress.totalAttempts || 0;
            acc.totalCorrect += progress.totalCorrect || 0;
            acc.totalMiss += progress.totalMiss || 0;
            const isCleared =
                progress.mode1Cleared ||
                progress.mode2Cleared ||
                progress.mode3Cleared ||
                progress.choice1Rank ||
                progress.choice2Rank ||
                progress.choice3Rank ||
                progress.choice4Rank;
            if (isCleared) {
                acc.clearedSectionsCount += 1;
            }
            return acc;
        },
        {
            totalAttempts: 0,
            totalCorrect: 0,
            totalMiss: 0,
            clearedSectionsCount: 0,
        }
    );
}

export function buildUserProgressTotals(
    userProgress: Record<string, { attemptsCount?: number; correctCount?: number; missCount?: number }>,
    currentUserId?: string
): Pick<ProgressTotals, 'totalAttempts' | 'totalCorrect' | 'totalMiss'> {
    const entries = currentUserId
        ? Object.entries(userProgress).filter(([key]) => key.startsWith(`${currentUserId}-`))
        : Object.entries(userProgress);

    return entries.reduce(
        (acc, [, progress]) => {
            if (!progress) return acc;
            acc.totalAttempts += progress.attemptsCount || 0;
            acc.totalCorrect += progress.correctCount || 0;
            acc.totalMiss += progress.missCount || 0;
            return acc;
        },
        { totalAttempts: 0, totalCorrect: 0, totalMiss: 0 }
    );
}
