import type { LearningMode, UserProgress } from '@/types';

export type RankingLeagueId = 'bronze' | 'silver' | 'gold' | 'master';

export type RankingLeague = {
    id: RankingLeagueId;
    label: string;
    mode: LearningMode;
    promotionScore: number | null;
};

export type MonthlyRankingConfig = {
    monthKey: string;
    courseId: string;
    courseName: string;
    theme: string;
    challengeQuestionCount: number;
    leagues: RankingLeague[];
};

export type RankingBestScores = Record<RankingLeagueId, number>;
export type RankingPromotionCounts = Record<RankingLeagueId, number>;

export type MonthlyRankingState = {
    activeLeague: RankingLeague;
    activeLeagueIndex: number;
    unlockedLeagues: RankingLeague[];
    bestScores: RankingBestScores;
    promotionCounts: RankingPromotionCounts;
    promotionRequiredCount: number;
    currentPromotionCount: number;
    nextLeague: RankingLeague | null;
    nextPromotionScore: number | null;
    pointsToNextLeague: number;
};

const EMPTY_BEST_SCORES: RankingBestScores = {
    bronze: 0,
    silver: 0,
    gold: 0,
    master: 0,
};
const EMPTY_PROMOTION_COUNTS: RankingPromotionCounts = {
    bronze: 0,
    silver: 0,
    gold: 0,
    master: 0,
};

export const RANKING_PROMOTION_REQUIRED_COUNT = 3;

const CONFIGS: MonthlyRankingConfig[] = [
    {
        monthKey: '2026-02',
        courseId: 'course-monthly-ranking-2026-02',
        courseName: '2月のランキング',
        theme: 'フルーツ',
        challengeQuestionCount: 10,
        leagues: [
            { id: 'bronze', label: 'ブロンズ', mode: 1, promotionScore: 82 },
            { id: 'silver', label: 'シルバー', mode: 2, promotionScore: 85 },
            { id: 'gold', label: 'ゴールド', mode: 3, promotionScore: 88 },
        ],
    },
];

function compareMonthKey(a: string, b: string): number {
    return a.localeCompare(b);
}

export function getCurrentMonthKey(date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

export function getMonthlyRankingConfig(date = new Date()): MonthlyRankingConfig {
    const monthKey = getCurrentMonthKey(date);
    const exact = CONFIGS.find((item) => item.monthKey === monthKey);
    if (exact) return exact;

    const sorted = [...CONFIGS].sort((a, b) => compareMonthKey(a.monthKey, b.monthKey));
    const nearestPast = [...sorted].reverse().find((item) => compareMonthKey(item.monthKey, monthKey) <= 0);
    if (nearestPast) {
        return { ...nearestPast, monthKey };
    }
    return { ...sorted[0], monthKey };
}

export function buildRankingBestProgressKey(monthKey: string, leagueId: RankingLeagueId): string {
    return `ranking:${monthKey}:${leagueId}:best`;
}
export function buildRankingPromotionCountProgressKey(monthKey: string, leagueId: RankingLeagueId): string {
    return `ranking:${monthKey}:${leagueId}:promotion-count`;
}

export function extractRankingBestScores(
    progressMap: Map<string, UserProgress>,
    config: MonthlyRankingConfig
): RankingBestScores {
    const scores: RankingBestScores = { ...EMPTY_BEST_SCORES };
    config.leagues.forEach((league) => {
        const key = buildRankingBestProgressKey(config.monthKey, league.id);
        const progress = progressMap.get(key);
        scores[league.id] = Math.max(0, progress?.correctCount ?? 0);
    });
    return scores;
}
export function extractRankingPromotionCounts(
    progressMap: Map<string, UserProgress>,
    config: MonthlyRankingConfig
): RankingPromotionCounts {
    const counts: RankingPromotionCounts = { ...EMPTY_PROMOTION_COUNTS };
    config.leagues.forEach((league) => {
        const key = buildRankingPromotionCountProgressKey(config.monthKey, league.id);
        const progress = progressMap.get(key);
        counts[league.id] = Math.max(0, progress?.correctCount ?? 0);
    });
    return counts;
}

export function buildMonthlyRankingState(
    config: MonthlyRankingConfig,
    bestScores: RankingBestScores,
    promotionCounts: RankingPromotionCounts = EMPTY_PROMOTION_COUNTS
): MonthlyRankingState {
    let activeLeagueIndex = 0;
    for (let index = 0; index < config.leagues.length - 1; index += 1) {
        const league = config.leagues[index];
        if (league.promotionScore === null) break;
        const reachedScore = bestScores[league.id] >= league.promotionScore;
        const reachedCount = promotionCounts[league.id] >= RANKING_PROMOTION_REQUIRED_COUNT;
        if (reachedScore && reachedCount) {
            activeLeagueIndex = index + 1;
        } else {
            break;
        }
    }

    const activeLeague = config.leagues[activeLeagueIndex];
    const unlockedLeagues = config.leagues.slice(0, activeLeagueIndex + 1);
    const nextLeague = config.leagues[activeLeagueIndex + 1] ?? null;
    const nextPromotionScore = nextLeague ? activeLeague.promotionScore : null;
    const currentPromotionCount = promotionCounts[activeLeague.id] ?? 0;
    const pointsToNextLeague = !nextLeague || activeLeague.promotionScore === null
        ? 0
        : Math.max(0, activeLeague.promotionScore - (bestScores[activeLeague.id] ?? 0));

    return {
        activeLeague,
        activeLeagueIndex,
        unlockedLeagues,
        bestScores,
        promotionCounts,
        promotionRequiredCount: RANKING_PROMOTION_REQUIRED_COUNT,
        currentPromotionCount,
        nextLeague,
        nextPromotionScore,
        pointsToNextLeague,
    };
}

export function withUpdatedRankingBestScore(
    scores: RankingBestScores,
    leagueId: RankingLeagueId,
    score: number
): RankingBestScores {
    return {
        ...scores,
        [leagueId]: Math.max(scores[leagueId], Math.max(0, score)),
    };
}
export function withIncrementedPromotionCount(
    counts: RankingPromotionCounts,
    leagueId: RankingLeagueId,
    increment: number
): RankingPromotionCounts {
    return {
        ...counts,
        [leagueId]: Math.max(0, counts[leagueId] + Math.max(0, increment)),
    };
}
