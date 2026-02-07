// ================================
// Dashboard Stats Utilities
// ================================

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase';

export type SessionMode = 'typing' | 'choice';

export type ProgressSnapshot = {
    totalAttempts: number;
    totalCorrect: number;
    totalMiss: number;
    clearedSectionsCount: number;
    totalSectionsCount: number;
    lastMode: SessionMode;
    lastActiveAt: string;
    lastSectionId?: string;
    lastSectionLabel?: string;
    lastCourseId?: string;
    lastUnitId?: string;
    lastPartId?: string;
};

export interface SectionMeta {
    courseId: string;
    unitId: string;
    partId: string;
    sectionId: string;
    label: string;
    mode?: SessionMode;
    level?: number;
}

export interface SessionSummary {
    sessionId: string;
    mode: SessionMode;
    accuracy: number;
    wpm?: number;
    missCount: number;
    totalTimeMs: number;
    rank: string;
    level?: number;
    playedAt: string;
}

type DailyStat = {
    timeMs: number;
    wpmSum: number;
    wpmCount: number;
    accSum: number;
    accCount: number;
    maxWpm: number;
};

type DailyStatMap = Record<string, DailyStat>;

function getDateKeyLocal(date = new Date()): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function toLocalDate(dateKey: string): Date {
    const [y, m, d] = dateKey.split('-').map(Number);
    return new Date(y, m - 1, d);
}

function daysDiffFromToday(dateKey: string, today: Date): number {
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const target = toLocalDate(dateKey);
    const diffMs = todayStart.getTime() - target.getTime();
    return Math.floor(diffMs / 86400000);
}

function ensureDailyStat(stat?: DailyStat): DailyStat {
    return stat ?? { timeMs: 0, wpmSum: 0, wpmCount: 0, accSum: 0, accCount: 0, maxWpm: 0 };
}

async function updateUserStats(uid: string, summary: SessionSummary): Promise<void> {
    const statsRef = doc(db, 'user_stats', uid);
    const snap = await getDoc(statsRef);
    const data = snap.exists() ? (snap.data() as { daily?: DailyStatMap }) : {};
    const daily: DailyStatMap = { ...(data.daily ?? {}) };

    const now = new Date();
    const dateKey = getDateKeyLocal(now);
    const day = ensureDailyStat(daily[dateKey]);

    day.timeMs += Math.max(0, summary.totalTimeMs);
    day.accSum += Math.max(0, summary.accuracy);
    day.accCount += 1;

    if (summary.mode === 'typing' && typeof summary.wpm === 'number') {
        day.wpmSum += Math.max(0, summary.wpm);
        day.wpmCount += 1;
        day.maxWpm = Math.max(day.maxWpm, summary.wpm);
    }

    daily[dateKey] = day;

    // Prune older than 28 days
    Object.keys(daily).forEach((key) => {
        if (daysDiffFromToday(key, now) > 28) {
            delete daily[key];
        }
    });

    let totalStudyTimeMs_7d = 0;
    let totalStudyTimeMs_28d = 0;
    let wpmSum7 = 0;
    let wpmCount7 = 0;
    let accSum7 = 0;
    let accCount7 = 0;
    let bestWpm_7d = 0;

    Object.entries(daily).forEach(([key, value]) => {
        const diff = daysDiffFromToday(key, now);
        if (diff <= 28) {
            totalStudyTimeMs_28d += value.timeMs;
        }
        if (diff < 7) {
            totalStudyTimeMs_7d += value.timeMs;
            accSum7 += value.accSum;
            accCount7 += value.accCount;
            if (value.wpmCount > 0) {
                wpmSum7 += value.wpmSum;
                wpmCount7 += value.wpmCount;
                bestWpm_7d = Math.max(bestWpm_7d, value.maxWpm || 0);
            }
        }
    });

    const avgWpm_7d = wpmCount7 > 0 ? Math.round(wpmSum7 / wpmCount7) : 0;
    const avgAccuracy_7d = accCount7 > 0 ? Math.round(accSum7 / accCount7) : 0;

    await setDoc(
        statsRef,
        {
            daily,
            totalStudyTimeMs_7d,
            totalStudyTimeMs_28d,
            avgWpm_7d,
            bestWpm_7d,
            avgAccuracy_7d,
            lastUpdatedAt: serverTimestamp(),
        },
        { merge: true }
    );
}

async function updateRecentSections(uid: string, section: SectionMeta): Promise<void> {
    const ref = doc(db, 'user_recent_sections', uid);
    const snap = await getDoc(ref);
    const data = snap.exists() ? (snap.data() as { items?: SectionMeta[] }) : {};
    const existing = Array.isArray(data.items) ? data.items : [];
    const mode = section.mode ?? 'typing';
    const level = section.level ?? null;
    const filtered = existing.filter((item) => {
        const sameSection =
            item.courseId === section.courseId &&
            item.unitId === section.unitId &&
            item.partId === section.partId &&
            item.sectionId === section.sectionId;
        if (!sameSection) return true;
        const itemMode = item.mode ?? 'typing';
        const itemLevel = item.level ?? null;
        return itemMode !== mode || itemLevel !== level;
    });
    const nowIso = new Date().toISOString();
    const next = [
        { ...section, lastPlayedAt: nowIso } as SectionMeta & { lastPlayedAt: string },
        ...filtered,
    ]
        .sort((a, b) => {
            const aTime = 'lastPlayedAt' in a ? Date.parse(String(a.lastPlayedAt)) : 0;
            const bTime = 'lastPlayedAt' in b ? Date.parse(String(b.lastPlayedAt)) : 0;
            return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
        })
        .slice(0, 5);

    await setDoc(
        ref,
        {
            items: next,
            lastUpdatedAt: serverTimestamp(),
        },
        { merge: true }
    );
}

async function updateRecentSessions(uid: string, summary: SessionSummary): Promise<void> {
    const ref = doc(db, 'user_recent_sessions', uid);
    const snap = await getDoc(ref);
    const data = snap.exists() ? (snap.data() as { items?: SessionSummary[] }) : {};
    const existing = Array.isArray(data.items) ? data.items : [];
    const filtered = existing.filter((item) => item.sessionId !== summary.sessionId);
    const next = [summary, ...filtered]
        .sort((a, b) => {
            const aTime = Date.parse(a.playedAt);
            const bTime = Date.parse(b.playedAt);
            return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
        })
        .slice(0, 3);

    await setDoc(
        ref,
        {
            items: next,
            lastUpdatedAt: serverTimestamp(),
        },
        { merge: true }
    );
}

export async function recordSessionSummary(
    uid: string,
    summary: SessionSummary,
    sectionMeta?: SectionMeta
): Promise<void> {
    const tasks = [updateUserStats(uid, summary), updateRecentSessions(uid, summary)];
    if (sectionMeta) {
        tasks.push(updateRecentSections(uid, sectionMeta));
    }
    await Promise.all(tasks);
}

export async function recordProgressSnapshot(uid: string, snapshot: ProgressSnapshot): Promise<void> {
    const statsRef = doc(db, 'user_stats', uid);
    await setDoc(
        statsRef,
        {
            totalAttempts: snapshot.totalAttempts,
            totalCorrect: snapshot.totalCorrect,
            totalMiss: snapshot.totalMiss,
            clearedSectionsCount: snapshot.clearedSectionsCount,
            totalSectionsCount: snapshot.totalSectionsCount,
            lastMode: snapshot.lastMode,
            lastSectionId: snapshot.lastSectionId ?? null,
            lastSectionLabel: snapshot.lastSectionLabel ?? null,
            lastCourseId: snapshot.lastCourseId ?? null,
            lastUnitId: snapshot.lastUnitId ?? null,
            lastPartId: snapshot.lastPartId ?? null,
            lastActiveAt: serverTimestamp(),
            lastActiveAtIso: snapshot.lastActiveAt,
            lastUpdatedAt: serverTimestamp(),
        },
        { merge: true }
    );
}
