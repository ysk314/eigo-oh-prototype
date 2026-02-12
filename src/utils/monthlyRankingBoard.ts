import {
    collection,
    doc,
    getDoc,
    getDocs,
    serverTimestamp,
    setDoc,
} from 'firebase/firestore';
import { db } from '@/firebase';
import type { RankingBestScores, RankingLeagueId, RankingPromotionCounts } from '@/utils/monthlyRanking';

type RankingBoardDoc = {
    uid: string;
    displayName: string;
    activeLeague: RankingLeagueId;
    bestScores: RankingBestScores;
    promotionCounts: RankingPromotionCounts;
    updatedAtIso: string;
};

type RankingBoardListItem = {
    uid: string;
    displayName: string;
    activeLeague: RankingLeagueId;
    bestScores: RankingBestScores;
    promotionCounts: RankingPromotionCounts;
    updatedAtIso: string;
};

export type RankingLeagueSnapshot = {
    rank: number | null;
    total: number;
    bestScore: number;
};

const emptyScores: RankingBestScores = {
    bronze: 0,
    silver: 0,
    gold: 0,
    master: 0,
};

const emptyCounts: RankingPromotionCounts = {
    bronze: 0,
    silver: 0,
    gold: 0,
    master: 0,
};

function getLeagueScore(item: RankingBoardListItem, leagueId: RankingLeagueId): number {
    return Math.max(0, item.bestScores[leagueId] ?? 0);
}

function normalizeDoc(uid: string, data: Partial<RankingBoardDoc>): RankingBoardListItem {
    return {
        uid,
        displayName: typeof data.displayName === 'string' && data.displayName.trim().length > 0
            ? data.displayName
            : 'ゲスト',
        activeLeague: (data.activeLeague ?? 'bronze') as RankingLeagueId,
        bestScores: { ...emptyScores, ...(data.bestScores ?? {}) },
        promotionCounts: { ...emptyCounts, ...(data.promotionCounts ?? {}) },
        updatedAtIso: typeof data.updatedAtIso === 'string' ? data.updatedAtIso : new Date(0).toISOString(),
    };
}

function sortLeagueItems(items: RankingBoardListItem[], leagueId: RankingLeagueId): RankingBoardListItem[] {
    return [...items].sort((a, b) => {
        const scoreDiff = getLeagueScore(b, leagueId) - getLeagueScore(a, leagueId);
        if (scoreDiff !== 0) return scoreDiff;
        return Date.parse(a.updatedAtIso) - Date.parse(b.updatedAtIso);
    });
}

export async function upsertMonthlyRankingBoardEntry(params: {
    monthKey: string;
    uid: string;
    displayName: string;
    activeLeague: RankingLeagueId;
    bestScores: RankingBestScores;
    promotionCounts: RankingPromotionCounts;
}): Promise<void> {
    const userRef = doc(db, 'monthly_rankings', params.monthKey, 'users', params.uid);
    const snap = await getDoc(userRef);
    const prev = snap.exists() ? normalizeDoc(params.uid, snap.data() as Partial<RankingBoardDoc>) : null;

    const mergedBestScores: RankingBestScores = {
        bronze: Math.max(prev?.bestScores.bronze ?? 0, params.bestScores.bronze ?? 0),
        silver: Math.max(prev?.bestScores.silver ?? 0, params.bestScores.silver ?? 0),
        gold: Math.max(prev?.bestScores.gold ?? 0, params.bestScores.gold ?? 0),
        master: Math.max(prev?.bestScores.master ?? 0, params.bestScores.master ?? 0),
    };
    const mergedCounts: RankingPromotionCounts = {
        bronze: Math.max(prev?.promotionCounts.bronze ?? 0, params.promotionCounts.bronze ?? 0),
        silver: Math.max(prev?.promotionCounts.silver ?? 0, params.promotionCounts.silver ?? 0),
        gold: Math.max(prev?.promotionCounts.gold ?? 0, params.promotionCounts.gold ?? 0),
        master: Math.max(prev?.promotionCounts.master ?? 0, params.promotionCounts.master ?? 0),
    };

    await setDoc(userRef, {
        uid: params.uid,
        displayName: params.displayName,
        activeLeague: params.activeLeague,
        bestScores: mergedBestScores,
        promotionCounts: mergedCounts,
        updatedAt: serverTimestamp(),
        updatedAtIso: new Date().toISOString(),
    }, { merge: true });
}

export async function fetchMonthlyRankingLeagueSnapshot(params: {
    monthKey: string;
    leagueId: RankingLeagueId;
    uid?: string | null;
}): Promise<RankingLeagueSnapshot> {
    const usersRef = collection(db, 'monthly_rankings', params.monthKey, 'users');
    const snap = await getDocs(usersRef);
    const all = snap.docs.map((item) => normalizeDoc(item.id, item.data() as Partial<RankingBoardDoc>));
    const leagueItems = all.filter((item) => item.activeLeague === params.leagueId);
    const sorted = sortLeagueItems(leagueItems, params.leagueId);
    const targetUid = params.uid ?? null;
    const rankIndex = targetUid ? sorted.findIndex((item) => item.uid === targetUid) : -1;
    const score = targetUid
        ? (sorted.find((item) => item.uid === targetUid)?.bestScores[params.leagueId] ?? 0)
        : 0;

    return {
        rank: rankIndex >= 0 ? rankIndex + 1 : null,
        total: sorted.length,
        bestScore: Math.max(0, score),
    };
}

