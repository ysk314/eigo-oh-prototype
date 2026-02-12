// ================================
// Home Page
// ================================

import { useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useApp } from '@/context/AppContext';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { courseCatalog, ensureAllCoursesLoaded, getLoadedCourses, preloadCourse } from '@/data/questions';
import { db } from '@/firebase';
import { logEvent } from '@/utils/analytics';
import type { ChoiceLevel, Course, LearningMode, Rank, SectionProgress, UserProgress } from '@/types';
import {
    buildMonthlyRankingState,
    extractRankingBestScores,
    extractRankingPromotionCounts,
    getMonthlyRankingConfig,
    RANKING_PROMOTION_REQUIRED_COUNT,
    type MonthlyRankingConfig,
    type MonthlyRankingState,
} from '@/utils/monthlyRanking';
import { fetchMonthlyRankingLeagueSnapshot, type RankingLeagueSnapshot } from '@/utils/monthlyRankingBoard';
import styles from './HomePage.module.css';

type DashboardStats = {
    totalStudyTimeMs_7d?: number;
    totalStudyTimeMs_28d?: number;
    avgWpm_7d?: number;
    bestWpm_7d?: number;
    avgAccuracy_7d?: number;
    clearedSectionsCount?: number;
    totalSectionsCount?: number;
    daily?: Record<string, {
        timeMs?: number;
        wpmSum?: number;
        wpmCount?: number;
        accSum?: number;
        accCount?: number;
        maxWpm?: number;
    }>;
};

type RecentSectionItem = {
    courseId: string;
    unitId?: string;
    partId: string;
    sectionId: string;
    label: string;
    lastPlayedAt?: string;
    mode?: 'typing' | 'choice';
    level?: number;
};

type MissionOptionId = 'review_previous' | 'new_challenge' | 'weakness_fix' | 'monthly_ranking';

type RecentSessionItem = {
    sessionId: string;
    mode: 'typing' | 'choice';
    accuracy: number;
    wpm?: number;
    missCount: number;
    totalTimeMs: number;
    rank: string;
    level?: number;
    sectionId?: string;
    partId?: string;
    courseId?: string;
    missionOption?: MissionOptionId;
    playedAt: string;
};

type SectionDescriptor = {
    courseId: string;
    courseName: string;
    unitId: string;
    unitName: string;
    partId: string;
    partLabel: string;
    sectionId: string;
    sectionLabel: string;
    questionIds: string[];
};

type MissionTarget = {
    optionId: MissionOptionId;
    descriptor: SectionDescriptor | null;
    mode: 'typing' | 'choice';
    typingMode?: LearningMode;
    choiceLevel?: ChoiceLevel;
    caption: string;
    rankingConfig?: MonthlyRankingConfig;
    rankingState?: MonthlyRankingState;
    rankingLeagueSnapshot?: RankingLeagueSnapshot;
};

type FrozenMissionEntry = {
    courseId: string;
    unitId: string;
    partId: string;
    sectionId: string;
    mode: 'typing' | 'choice';
    typingMode?: LearningMode;
    choiceLevel?: ChoiceLevel;
    caption: string;
};

type FrozenMissionPlan = Partial<Record<'new_challenge' | 'review_previous' | 'weakness_fix', FrozenMissionEntry>>;

const missionOptionMeta: Array<{ id: MissionOptionId; title: string; description: string }> = [
    { id: 'new_challenge', title: '前回の続きからスタート', description: '直近の続きから進める' },
    { id: 'review_previous', title: '前回のセクションを復習する', description: '直近の学習を定着させる' },
    { id: 'weakness_fix', title: '苦手を克服', description: 'ミスが多い内容を重点的に練習' },
    { id: 'monthly_ranking', title: '今月のランキングに挑戦', description: '月間自己ベスト更新にチャレンジ' },
];

const rankOrder: Rank[] = ['S', 'A', 'B', 'C'];
const rankMasteryXp: Record<Rank, number> = {
    S: 60,
    A: 45,
    B: 30,
    C: 15,
};
function isUnlockRank(rank: Rank | null | undefined): boolean {
    if (!rank) return false;
    return rank === 'S' || rank === 'A';
}

const MISSION_PROGRESS_PREFIX = 'mission:';
const MISSION_COMPLETE_XP = 50;
const PLAY_PROGRESS_KEY = 'play:completed';
const PLAY_COMPLETE_XP = 10;
const SHUFFLE_PROGRESS_KEY = 'play:shuffle';
const SHUFFLE_BONUS_XP = 5;
const RECENT_SECTION_WINDOW = 5;
const FROZEN_MISSION_PLAN_PREFIX = 'mission-plan';

function formatDuration(ms?: number): string {
    if (!ms || ms <= 0) return '0分';
    const totalMinutes = Math.round(ms / 60000);
    if (totalMinutes < 60) return `${totalMinutes}分`;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes === 0 ? `${hours}時間` : `${hours}時間${minutes}分`;
}

function formatDateTime(value?: string): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function getDateKeyLocal(date = new Date()): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function isSameLocalDate(value: string, dateKey: string): boolean {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return false;
    return getDateKeyLocal(parsed) === dateKey;
}

function isMissionProgressQuestionId(questionId: string): boolean {
    return questionId.startsWith(MISSION_PROGRESS_PREFIX);
}

function extractMissionOptionKey(questionId: string): string | null {
    if (!isMissionProgressQuestionId(questionId)) return null;
    const raw = questionId.slice(MISSION_PROGRESS_PREFIX.length);
    const matched = raw.match(/^(\d{4}-\d{2}-\d{2})(?::([a-z_]+))?$/);
    if (!matched) return null;
    const dateKey = matched[1];
    const optionId = matched[2] ?? 'legacy';
    return `${dateKey}:${optionId}`;
}

function normalizeMode(value: unknown): 'typing' | 'choice' {
    if (typeof value !== 'string') return 'typing';
    const mode = value.trim().toLowerCase();
    if (
        mode === 'choice' ||
        mode === '4choice' ||
        mode === 'multiple-choice' ||
        mode === 'multiple_choice' ||
        mode === 'select' ||
        mode === '4択' ||
        mode === '選択'
    ) {
        return 'choice';
    }
    return 'typing';
}

function normalizeChoiceLevel(value: unknown): 1 | 2 | 3 | 4 {
    if (typeof value === 'number' && value >= 1 && value <= 4) {
        return value as 1 | 2 | 3 | 4;
    }
    return 1;
}

function normalizeRecentSections(value: unknown): RecentSectionItem[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const record = item as Record<string, unknown>;
            if (
                typeof record.courseId !== 'string' ||
                typeof record.partId !== 'string' ||
                typeof record.sectionId !== 'string' ||
                typeof record.label !== 'string'
            ) {
                return null;
            }
            return {
                courseId: record.courseId,
                unitId: typeof record.unitId === 'string' ? record.unitId : undefined,
                partId: record.partId,
                sectionId: record.sectionId,
                label: record.label,
                lastPlayedAt: typeof record.lastPlayedAt === 'string' ? record.lastPlayedAt : undefined,
                mode: normalizeMode(record.mode),
                level: typeof record.level === 'number' ? record.level : undefined,
            } as RecentSectionItem;
        })
        .filter((item): item is RecentSectionItem => item !== null)
        .sort((a, b) => {
            const aTime = a.lastPlayedAt ? Date.parse(a.lastPlayedAt) : 0;
            const bTime = b.lastPlayedAt ? Date.parse(b.lastPlayedAt) : 0;
            return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
        });
}

function isMissionOptionId(value: unknown): value is MissionOptionId {
    return missionOptionMeta.some((item) => item.id === value);
}

function getMissionPlanStorageKey(userId: string | undefined, dateKey: string): string {
    return `${FROZEN_MISSION_PLAN_PREFIX}:${userId ?? 'guest'}:${dateKey}`;
}

function parseFrozenMissionPlan(value: string | null): FrozenMissionPlan | null {
    if (!value) return null;
    try {
        const parsed = JSON.parse(value) as Record<string, unknown>;
        const plan: FrozenMissionPlan = {};
        const keys: Array<'new_challenge' | 'review_previous' | 'weakness_fix'> = [
            'new_challenge',
            'review_previous',
            'weakness_fix',
        ];
        keys.forEach((key) => {
            const item = parsed[key];
            if (!item || typeof item !== 'object') return;
            const record = item as Record<string, unknown>;
            if (
                typeof record.courseId !== 'string' ||
                typeof record.unitId !== 'string' ||
                typeof record.partId !== 'string' ||
                typeof record.sectionId !== 'string' ||
                typeof record.mode !== 'string' ||
                typeof record.caption !== 'string'
            ) {
                return;
            }
            plan[key] = {
                courseId: record.courseId,
                unitId: record.unitId,
                partId: record.partId,
                sectionId: record.sectionId,
                mode: record.mode === 'choice' ? 'choice' : 'typing',
                typingMode: typeof record.typingMode === 'number' ? record.typingMode as LearningMode : undefined,
                choiceLevel: typeof record.choiceLevel === 'number' ? record.choiceLevel as ChoiceLevel : undefined,
                caption: record.caption,
            };
        });
        return plan;
    } catch {
        return null;
    }
}

function normalizeRecentSessions(value: unknown): RecentSessionItem[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const record = item as Record<string, unknown>;
            if (
                typeof record.sessionId !== 'string' ||
                typeof record.accuracy !== 'number' ||
                typeof record.missCount !== 'number' ||
                typeof record.totalTimeMs !== 'number' ||
                typeof record.rank !== 'string' ||
                typeof record.playedAt !== 'string'
            ) {
                return null;
            }
            return {
                sessionId: record.sessionId,
                mode: normalizeMode(record.mode),
                accuracy: record.accuracy,
                wpm: typeof record.wpm === 'number' ? record.wpm : undefined,
                missCount: record.missCount,
                totalTimeMs: record.totalTimeMs,
                rank: record.rank,
                level: typeof record.level === 'number' ? record.level : undefined,
                sectionId: typeof record.sectionId === 'string' ? record.sectionId : undefined,
                partId: typeof record.partId === 'string' ? record.partId : undefined,
                courseId: typeof record.courseId === 'string' ? record.courseId : undefined,
                missionOption: isMissionOptionId(record.missionOption) ? record.missionOption : undefined,
                playedAt: record.playedAt,
            } as RecentSessionItem;
        })
        .filter((item): item is RecentSessionItem => item !== null)
        .sort((a, b) => {
            const aTime = Date.parse(a.playedAt);
            const bTime = Date.parse(b.playedAt);
            return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
        });
}

function getBestRank(progress?: SectionProgress): Rank | null {
    if (!progress) return null;
    const ranks = [
        progress.mode1Rank,
        progress.mode2Rank,
        progress.mode3Rank,
        progress.choice1Rank,
        progress.choice2Rank,
        progress.choice3Rank,
        progress.choice4Rank,
    ].filter((value): value is Rank => value !== null);

    if (ranks.length === 0) return null;

    return ranks.reduce((best, current) => {
        if (!best) return current;
        return rankOrder.indexOf(current) < rankOrder.indexOf(best) ? current : best;
    }, null as Rank | null);
}

function xpForLevel(level: number): number {
    return 60 * Math.pow(Math.max(0, level - 1), 2);
}

function computeLevelInfo(totalXp: number): { level: number; currentLevelXp: number; nextLevelXp: number; progressPercent: number } {
    let level = 1;
    while (totalXp >= xpForLevel(level + 1)) {
        level += 1;
    }
    const currentLevelXp = xpForLevel(level);
    const nextLevelXp = xpForLevel(level + 1);
    const denominator = Math.max(1, nextLevelXp - currentLevelXp);
    const progressPercent = Math.min(100, Math.max(0, Math.round(((totalXp - currentLevelXp) / denominator) * 100)));
    return { level, currentLevelXp, nextLevelXp, progressPercent };
}

export function HomePage() {
    const navigate = useNavigate();
    const { state, setCourse, setUnit, setPart, setSection, setMode, setStudyMode, setChoiceLevel } = useApp();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [recentSections, setRecentSections] = useState<RecentSectionItem[]>([]);
    const [recentSessions, setRecentSessions] = useState<RecentSessionItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadedCourses, setLoadedCourses] = useState<Course[]>([]);
    const [recentOpen, setRecentOpen] = useState(false);
    const [coursesOpen, setCoursesOpen] = useState(false);
    const [frozenMissionPlan, setFrozenMissionPlan] = useState<FrozenMissionPlan | null>(null);
    const [rankingLeagueSnapshot, setRankingLeagueSnapshot] = useState<RankingLeagueSnapshot | null>(null);
    const [showRankingLaunchDialog, setShowRankingLaunchDialog] = useState(false);
    const viewedUidRef = useRef<string | null>(null);
    const todayKey = useMemo(() => getDateKeyLocal(new Date()), []);
    const monthlyRankingConfig = useMemo(() => getMonthlyRankingConfig(), []);

    useEffect(() => {
        let isMounted = true;
        ensureAllCoursesLoaded()
            .then(() => {
                if (!isMounted) return;
                setLoadedCourses(getLoadedCourses());
            })
            .catch((error) => {
                console.error('Failed to load course catalog for dashboard:', error);
            });
        return () => {
            isMounted = false;
        };
    }, []);

    const handleCourseSelect = (courseId: string) => {
        setCourse(courseId);
        navigate('/course');
    };

    const handleBackToLogin = () => {
        navigate('/');
    };

    const allSections = useMemo<SectionDescriptor[]>(() => {
        return loadedCourses.flatMap((course) =>
            course.units.flatMap((unit) =>
                unit.parts.flatMap((part) =>
                    part.sections.map((section) => ({
                        courseId: course.id,
                        courseName: course.name,
                        unitId: unit.id,
                        unitName: unit.name,
                        partId: part.id,
                        partLabel: part.label,
                        sectionId: section.id,
                        sectionLabel: section.label,
                        questionIds: section.questionIds ?? [],
                    }))
                )
            )
        );
    }, [loadedCourses]);

    const sectionById = useMemo(() => {
        const map = new Map<string, SectionDescriptor>();
        allSections.forEach((section) => {
            if (!map.has(section.sectionId)) {
                map.set(section.sectionId, section);
            }
        });
        return map;
    }, [allSections]);

    const sectionByComposite = useMemo(() => {
        const map = new Map<string, SectionDescriptor>();
        allSections.forEach((section) => {
            const key = `${section.courseId}:${section.partId}:${section.sectionId}`;
            map.set(key, section);
        });
        return map;
    }, [allSections]);

    const sectionIndexByComposite = useMemo(() => {
        const map = new Map<string, number>();
        allSections.forEach((section, index) => {
            const key = `${section.courseId}:${section.partId}:${section.sectionId}`;
            map.set(key, index);
        });
        return map;
    }, [allSections]);

    const missionEligibleSections = useMemo(
        () => allSections.filter((section) => section.courseId !== monthlyRankingConfig.courseId),
        [allSections, monthlyRankingConfig.courseId]
    );

    const fallbackClearedSections = useMemo(() => {
        const currentUserId = state.currentUser?.id;
        const entries = currentUserId
            ? Object.entries(state.sectionProgress).filter(([key]) => key.startsWith(`${currentUserId}-`))
            : Object.entries(state.sectionProgress);
        return entries.filter(([, progress]) =>
            progress.mode2Cleared ||
            progress.mode3Cleared
        ).length;
    }, [state.sectionProgress, state.currentUser?.id]);

    const clearedSections = fallbackClearedSections;
    const totalSections = stats?.totalSectionsCount ?? allSections.length;

    const progressRate = totalSections > 0
        ? Math.round((clearedSections / totalSections) * 100)
        : 0;

    const currentUserId = state.currentUser?.id;
    const userQuestionProgressMap = useMemo(() => {
        const map = new Map<string, UserProgress>();
        const prefix = currentUserId ? `${currentUserId}-` : '';
        Object.entries(state.userProgress).forEach(([key, progress]) => {
            const questionId = currentUserId && key.startsWith(prefix) ? key.slice(prefix.length) : key;
            if (!currentUserId || key.startsWith(prefix)) {
                map.set(questionId, progress);
            }
        });
        return map;
    }, [state.userProgress, currentUserId]);

    const sectionProgressMap = useMemo(() => {
        const map = new Map<string, SectionProgress>();
        const prefix = currentUserId ? `${currentUserId}-` : '';
        Object.entries(state.sectionProgress).forEach(([key, progress]) => {
            if (currentUserId && !key.startsWith(prefix)) return;
            map.set(progress.sectionId, progress);
        });
        return map;
    }, [state.sectionProgress, currentUserId]);

    const monthlyRankingState = useMemo(() => {
        const bestScores = extractRankingBestScores(userQuestionProgressMap, monthlyRankingConfig);
        const promotionCounts = extractRankingPromotionCounts(userQuestionProgressMap, monthlyRankingConfig);
        return buildMonthlyRankingState(monthlyRankingConfig, bestScores, promotionCounts);
    }, [userQuestionProgressMap, monthlyRankingConfig]);

    useEffect(() => {
        let isMounted = true;
        fetchMonthlyRankingLeagueSnapshot({
            monthKey: monthlyRankingConfig.monthKey,
            leagueId: monthlyRankingState.activeLeague.id,
            uid: currentUserId ?? null,
        })
            .then((snapshot) => {
                if (!isMounted) return;
                setRankingLeagueSnapshot(snapshot);
            })
            .catch((error) => {
                console.error('Failed to load monthly ranking snapshot:', error);
                if (!isMounted) return;
                setRankingLeagueSnapshot(null);
            });
        return () => {
            isMounted = false;
        };
    }, [monthlyRankingConfig.monthKey, monthlyRankingState.activeLeague.id, currentUserId]);

    const attemptedQuestionIds = useMemo(() => {
        const attempted = new Set<string>();
        userQuestionProgressMap.forEach((progress, questionId) => {
            if ((progress.attemptsCount ?? 0) > 0) {
                attempted.add(questionId);
            }
        });
        return attempted;
    }, [userQuestionProgressMap]);

    const missionBonusXp = useMemo(() => {
        const completedMissionKeys = new Set<string>();
        userQuestionProgressMap.forEach((progress, questionId) => {
            if ((progress.attemptsCount ?? 0) <= 0) return;
            const missionOptionKey = extractMissionOptionKey(questionId);
            if (!missionOptionKey) return;
            completedMissionKeys.add(missionOptionKey);
        });
        return completedMissionKeys.size * MISSION_COMPLETE_XP;
    }, [userQuestionProgressMap]);

    const playBonusXp = useMemo(() => {
        const completedSessions = Math.max(0, userQuestionProgressMap.get(PLAY_PROGRESS_KEY)?.attemptsCount ?? 0);
        return completedSessions * PLAY_COMPLETE_XP;
    }, [userQuestionProgressMap]);

    const shuffleBonusXp = useMemo(() => {
        const shuffleSessions = Math.max(0, userQuestionProgressMap.get(SHUFFLE_PROGRESS_KEY)?.attemptsCount ?? 0);
        return shuffleSessions * SHUFFLE_BONUS_XP;
    }, [userQuestionProgressMap]);

    const rankCounts = useMemo(() => {
        const counts: Record<Rank, number> = { S: 0, A: 0, B: 0, C: 0 };
        allSections.forEach((section) => {
            const best = getBestRank(sectionProgressMap.get(section.sectionId));
            if (best) counts[best] += 1;
        });
        return counts;
    }, [allSections, sectionProgressMap]);

    const gamification = useMemo(() => {
        let totalXp = missionBonusXp + playBonusXp + shuffleBonusXp;

        allSections.forEach((section) => {
            const totalQuestionsInSection = Math.max(1, section.questionIds.length);
            const attemptedCount = section.questionIds.reduce((count, questionId) => {
                return attemptedQuestionIds.has(questionId) ? count + 1 : count;
            }, 0);
            const participationRatio = Math.min(1, attemptedCount / totalQuestionsInSection);
            const participationXp = Math.round(40 * participationRatio);
            const bestRank = getBestRank(sectionProgressMap.get(section.sectionId));
            const masteryXp = bestRank ? rankMasteryXp[bestRank] : 0;
            totalXp += participationXp + masteryXp;
        });

        const levelInfo = computeLevelInfo(totalXp);
        return {
            totalXp,
            missionBonusXp,
            playBonusXp,
            shuffleBonusXp,
            ...levelInfo,
        };
    }, [allSections, attemptedQuestionIds, sectionProgressMap, missionBonusXp, playBonusXp, shuffleBonusXp]);

    useEffect(() => {
        const isDesktop = window.matchMedia('(min-width: 769px)').matches;
        setRecentOpen(isDesktop);
        setCoursesOpen(isDesktop);
    }, []);

    useEffect(() => {
        const uid = state.currentUser?.id;
        if (!uid) return;
        let isMounted = true;

        if (viewedUidRef.current !== uid) {
            viewedUidRef.current = uid;
            logEvent({
                eventType: 'dashboard_viewed',
                userId: uid,
                payload: {
                    source: 'home',
                },
            }).catch(() => {});
        }

        setLoading(true);

        Promise.all([
            getDoc(doc(db, 'user_stats', uid)),
            getDoc(doc(db, 'user_recent_sections', uid)),
            getDoc(doc(db, 'user_recent_sessions', uid)),
        ])
            .then(([statsSnap, sectionsSnap, sessionsSnap]) => {
                if (!isMounted) return;
                setStats(statsSnap.exists() ? (statsSnap.data() as DashboardStats) : null);
                const sectionsData = sectionsSnap.exists() ? (sectionsSnap.data() as { items?: RecentSectionItem[] }) : {};
                const sessionsData = sessionsSnap.exists() ? (sessionsSnap.data() as { items?: RecentSessionItem[] }) : {};
                setRecentSections(normalizeRecentSections(sectionsData.items));
                setRecentSessions(normalizeRecentSessions(sessionsData.items));
            })
            .catch((error) => {
                console.error('Failed to load dashboard data:', error);
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [state.currentUser?.id]);

    const latestSession = recentSessions[0];
    const recentSectionSessions = useMemo(() => recentSessions.slice(0, RECENT_SECTION_WINDOW), [recentSessions]);
    const recentSectionSummary = useMemo(() => {
        const count = recentSectionSessions.length;
        if (count === 0) {
            return {
                count: 0,
                totalTimeMs: 0,
                avgAccuracy: 0,
                avgWpm: null as number | null,
            };
        }
        const totalTimeMs = recentSectionSessions.reduce((sum, session) => sum + Math.max(0, session.totalTimeMs), 0);
        const avgAccuracy = Math.round(
            recentSectionSessions.reduce((sum, session) => sum + Math.max(0, session.accuracy), 0) / count
        );
        const wpmSamples = recentSectionSessions
            .map((session) => session.wpm)
            .filter((value): value is number => typeof value === 'number' && value > 0);
        const avgWpm = wpmSamples.length > 0
            ? Math.round(wpmSamples.reduce((sum, value) => sum + value, 0) / wpmSamples.length)
            : null;
        return {
            count,
            totalTimeMs,
            avgAccuracy,
            avgWpm,
        };
    }, [recentSectionSessions]);

    const getSectionCompositeKey = (section: SectionDescriptor) =>
        `${section.courseId}:${section.partId}:${section.sectionId}`;

    const buildSectionMissScore = useMemo(() => (section: SectionDescriptor): number => {
        return section.questionIds.reduce((sum, questionId) => {
            return sum + (userQuestionProgressMap.get(questionId)?.missCount ?? 0);
        }, 0);
    }, [userQuestionProgressMap]);

    const resolveDescriptorFromRecent = useMemo(() => (item: RecentSectionItem): SectionDescriptor | undefined => {
        const compositeKey = `${item.courseId}:${item.partId}:${item.sectionId}`;
        return sectionByComposite.get(compositeKey) ?? sectionById.get(item.sectionId);
    }, [sectionByComposite, sectionById]);

    const getNextSectionFrom = useMemo(() => (section: SectionDescriptor | null): SectionDescriptor | null => {
        if (!section) return null;
        const key = getSectionCompositeKey(section);
        const index = sectionIndexByComposite.get(key);
        if (index === undefined) return null;
        return allSections[index + 1] ?? null;
    }, [sectionIndexByComposite, allSections]);

    const getNextTypingMode = useMemo(() => (sectionId: string): LearningMode | null => {
        const progress = sectionProgressMap.get(sectionId);
        if (!progress || !isUnlockRank(progress.mode1Rank)) return 1;
        if (!isUnlockRank(progress.mode2Rank)) return 2;
        if (!isUnlockRank(progress.mode3Rank)) return 3;
        return null;
    }, [sectionProgressMap]);

    const resolveTypingPath = useMemo(
        () => (startCandidates: Array<SectionDescriptor | null | undefined>): { descriptor: SectionDescriptor | null; typingMode: LearningMode } => {
            const starts: SectionDescriptor[] = [];
            const seenStart = new Set<string>();

            startCandidates.forEach((candidate) => {
                if (!candidate) return;
                const key = getSectionCompositeKey(candidate);
                if (seenStart.has(key)) return;
                seenStart.add(key);
                starts.push(candidate);
            });

            for (const start of starts) {
                let cursor: SectionDescriptor | null = start;
                const visited = new Set<string>();
                while (cursor) {
                    const key = getSectionCompositeKey(cursor);
                    if (visited.has(key)) break;
                    visited.add(key);

                    const nextMode = getNextTypingMode(cursor.sectionId);
                    if (nextMode) {
                        return { descriptor: cursor, typingMode: nextMode };
                    }

                    cursor = getNextSectionFrom(cursor);
                }
            }

            const fallbackDescriptor = missionEligibleSections[0] ?? null;
            const fallbackMode = fallbackDescriptor ? (getNextTypingMode(fallbackDescriptor.sectionId) ?? 1) : 1;
            return { descriptor: fallbackDescriptor, typingMode: fallbackMode };
        },
        [missionEligibleSections, getNextSectionFrom, getNextTypingMode]
    );

    const reviewTarget = useMemo<MissionTarget>(() => {
        const previousDayCandidates = recentSections
            .filter((item) => item.courseId !== monthlyRankingConfig.courseId)
            .filter((item) => !item.lastPlayedAt || !isSameLocalDate(item.lastPlayedAt, todayKey))
            .map((item) => resolveDescriptorFromRecent(item))
            .filter((item): item is SectionDescriptor => Boolean(item));

        const fallbackCandidates = recentSections
            .filter((item) => item.courseId !== monthlyRankingConfig.courseId)
            .map((item) => resolveDescriptorFromRecent(item))
            .filter((item): item is SectionDescriptor => Boolean(item));
        const selectedStarts = previousDayCandidates.length > 0 ? previousDayCandidates : fallbackCandidates;
        const path = resolveTypingPath(selectedStarts);
        const picked = path.descriptor;

        return {
            optionId: 'review_previous',
            descriptor: picked,
            mode: 'typing',
            typingMode: path.typingMode,
            caption: '前日以前の学習履歴をベースに復習',
        };
    }, [recentSections, resolveDescriptorFromRecent, resolveTypingPath, todayKey, monthlyRankingConfig.courseId]);

    const newChallengeTarget = useMemo<MissionTarget>(() => {
        const latestRecent = recentSections.length > 0 ? resolveDescriptorFromRecent(recentSections[0]) : null;
        const latestMainlineRecent = latestRecent?.courseId === monthlyRankingConfig.courseId ? null : latestRecent;
        const unattempted = missionEligibleSections.find((section) => {
            return section.questionIds.every((questionId) => !attemptedQuestionIds.has(questionId));
        });
        const path = resolveTypingPath([latestMainlineRecent, unattempted, missionEligibleSections[0]]);
        const nextTarget = path.descriptor;

        return {
            optionId: 'new_challenge',
            descriptor: nextTarget,
            mode: 'typing',
            typingMode: path.typingMode,
            caption: 'A以上達成済みなら次のモード・次のセクションへ',
        };
    }, [missionEligibleSections, attemptedQuestionIds, recentSections, resolveDescriptorFromRecent, resolveTypingPath, monthlyRankingConfig.courseId]);

    const supportMissionScope = useMemo<SectionDescriptor[]>(() => {
        const scoped: SectionDescriptor[] = [];
        const seen = new Set<string>();
        const pushUnique = (section: SectionDescriptor | null | undefined) => {
            if (!section) return;
            if (section.courseId === monthlyRankingConfig.courseId) return;
            const key = getSectionCompositeKey(section);
            if (seen.has(key)) return;
            seen.add(key);
            scoped.push(section);
        };

        pushUnique(newChallengeTarget.descriptor);
        pushUnique(reviewTarget.descriptor);
        recentSections
            .slice(0, RECENT_SECTION_WINDOW)
            .map((item) => resolveDescriptorFromRecent(item))
            .forEach((section) => pushUnique(section));

        if (newChallengeTarget.descriptor) {
            const mainlineKey = getSectionCompositeKey(newChallengeTarget.descriptor);
            const mainlineIndex = sectionIndexByComposite.get(mainlineKey);
            if (typeof mainlineIndex === 'number') {
                pushUnique(allSections[Math.max(0, mainlineIndex - 2)]);
                pushUnique(allSections[Math.max(0, mainlineIndex - 1)]);
                pushUnique(allSections[mainlineIndex + 1]);
            }
        }

        if (scoped.length === 0 && missionEligibleSections[0]) {
            pushUnique(missionEligibleSections[0]);
        }
        return scoped;
    }, [
        allSections,
        missionEligibleSections,
        newChallengeTarget.descriptor,
        recentSections,
        resolveDescriptorFromRecent,
        reviewTarget.descriptor,
        sectionIndexByComposite,
        monthlyRankingConfig.courseId,
    ]);

    const weaknessTarget = useMemo<MissionTarget>(() => {
        let maxMiss = 0;
        let target: SectionDescriptor | null = null;

        supportMissionScope.forEach((section) => {
            const miss = buildSectionMissScore(section);
            if (miss > maxMiss) {
                maxMiss = miss;
                target = section;
            }
        });

        const picked = target ?? newChallengeTarget.descriptor ?? reviewTarget.descriptor ?? supportMissionScope[0] ?? missionEligibleSections[0] ?? null;

        return {
            optionId: 'weakness_fix',
            descriptor: picked,
            mode: 'choice',
            choiceLevel: 1,
            caption: maxMiss > 0
                ? '本線に近い範囲で苦手を重点練習'
                : '本線の進行セクションで定着確認',
        };
    }, [supportMissionScope, newChallengeTarget.descriptor, reviewTarget.descriptor, buildSectionMissScore, missionEligibleSections]);

    const rankingTarget = useMemo<MissionTarget>(() => {
        const rankingPracticeSection = allSections.find(
            (section) => section.courseId === monthlyRankingConfig.courseId
        ) ?? null;
        const activeLeague = monthlyRankingState.activeLeague;
        const bestScore = monthlyRankingState.bestScores[activeLeague.id] ?? 0;
        const rankText = rankingLeagueSnapshot?.rank
            ? `${rankingLeagueSnapshot.rank}位 / ${Math.max(1, rankingLeagueSnapshot.total)}人`
            : '順位 --';
        const promotionCaption = !monthlyRankingState.nextLeague
            ? '現在の最高リーグ'
            : `次リーグまで ${monthlyRankingState.pointsToNextLeague}点 / ${monthlyRankingState.currentPromotionCount}/${RANKING_PROMOTION_REQUIRED_COUNT}回`;

        return {
            optionId: 'monthly_ranking',
            descriptor: rankingPracticeSection,
            mode: 'typing',
            typingMode: activeLeague.mode,
            caption: `ステージ ${activeLeague.label} / BEST ${bestScore}点 / ${rankText} / ${promotionCaption}`,
            rankingConfig: monthlyRankingConfig,
            rankingState: monthlyRankingState,
            rankingLeagueSnapshot: rankingLeagueSnapshot ?? undefined,
        };
    }, [allSections, monthlyRankingConfig, monthlyRankingState, rankingLeagueSnapshot]);

    const dynamicMissionTargets = useMemo<Record<MissionOptionId, MissionTarget>>(() => ({
        review_previous: reviewTarget,
        new_challenge: newChallengeTarget,
        weakness_fix: weaknessTarget,
        monthly_ranking: rankingTarget,
    }), [reviewTarget, newChallengeTarget, weaknessTarget, rankingTarget]);

    useEffect(() => {
        if (allSections.length === 0) return;
        if (loading) return;
        const key = getMissionPlanStorageKey(currentUserId, todayKey);
        const stored = parseFrozenMissionPlan(localStorage.getItem(key));
        if (stored) {
            setFrozenMissionPlan(stored);
            return;
        }

        const nextPlan: FrozenMissionPlan = {};
        (['new_challenge', 'review_previous', 'weakness_fix'] as const).forEach((optionId) => {
            const target = dynamicMissionTargets[optionId];
            if (!target.descriptor) return;
            nextPlan[optionId] = {
                courseId: target.descriptor.courseId,
                unitId: target.descriptor.unitId,
                partId: target.descriptor.partId,
                sectionId: target.descriptor.sectionId,
                mode: target.mode,
                typingMode: target.typingMode,
                choiceLevel: target.choiceLevel,
                caption: target.caption,
            };
        });
        setFrozenMissionPlan(nextPlan);
        localStorage.setItem(key, JSON.stringify(nextPlan));
    }, [allSections.length, currentUserId, todayKey, dynamicMissionTargets, loading]);

    const missionTargets = useMemo<Record<MissionOptionId, MissionTarget>>(() => {
        const merged: Record<MissionOptionId, MissionTarget> = {
            ...dynamicMissionTargets,
        };
        (['new_challenge', 'review_previous', 'weakness_fix'] as const).forEach((optionId) => {
            const frozen = frozenMissionPlan?.[optionId];
            if (!frozen) return;
            const descriptor = sectionByComposite.get(`${frozen.courseId}:${frozen.partId}:${frozen.sectionId}`)
                ?? dynamicMissionTargets[optionId].descriptor;
            merged[optionId] = {
                ...dynamicMissionTargets[optionId],
                descriptor,
                mode: frozen.mode,
                typingMode: frozen.typingMode ?? dynamicMissionTargets[optionId].typingMode,
                choiceLevel: frozen.choiceLevel ?? dynamicMissionTargets[optionId].choiceLevel,
                caption: frozen.caption || dynamicMissionTargets[optionId].caption,
            };
        });
        return merged;
    }, [dynamicMissionTargets, frozenMissionPlan, sectionByComposite]);

    const completedMissionSet = useMemo(() => {
        const completed = new Set<MissionOptionId>();
        recentSessions.forEach((session) => {
            if (!session.missionOption) return;
            if (!isSameLocalDate(session.playedAt, todayKey)) return;
            completed.add(session.missionOption);
        });
        return completed;
    }, [recentSessions, todayKey]);

    const launchStandardMission = (optionId: MissionOptionId, target: MissionTarget) => {
        if (!target.descriptor) return;
        const descriptor = target.descriptor;
        setCourse(descriptor.courseId);
        setUnit(descriptor.unitId);
        setPart(descriptor.partId);
        setSection(descriptor.sectionId);

        logEvent({
            eventType: 'daily_mission_selected',
            userId: state.currentUser?.id ?? null,
            payload: {
                optionId,
                courseId: descriptor.courseId,
                partId: descriptor.partId,
                sectionId: descriptor.sectionId,
            },
        }).catch(() => {});

        if (target.mode === 'choice') {
            const level = target.choiceLevel ?? 1;
            setStudyMode('choice');
            setChoiceLevel(level);
            navigate('/choice', {
                state: {
                    courseId: descriptor.courseId,
                    unitId: descriptor.unitId,
                    partId: descriptor.partId,
                    sectionId: descriptor.sectionId,
                    level,
                    missionOption: optionId,
                    returnTo: '/dashboard',
                },
            });
            return;
        }

        const typingMode = target.typingMode ?? 1;
        setStudyMode('typing');
        setMode(typingMode);
        navigate('/play', {
            state: {
                courseId: descriptor.courseId,
                unitId: descriptor.unitId,
                partId: descriptor.partId,
                sectionId: descriptor.sectionId,
                mode: typingMode,
                missionOption: optionId,
                returnTo: '/dashboard',
            },
        });
    };

    const launchRankingChallengeMission = (target: MissionTarget) => {
        if (!target.rankingConfig || !target.rankingState) return;
        const config = target.rankingConfig;
        const rankingState = target.rankingState;
        const activeLeague = rankingState.activeLeague;
        setCourse(config.courseId);
        setUnit(null);
        setPart(null);
        setSection(null);
        setStudyMode('typing');
        setMode(activeLeague.mode);
        navigate('/play', {
            state: {
                courseId: config.courseId,
                mode: activeLeague.mode,
                missionOption: 'monthly_ranking',
                returnTo: '/dashboard',
                rankingChallenge: true,
                rankingMonthKey: config.monthKey,
                rankingLeagueId: activeLeague.id,
                rankingQuestionCount: config.challengeQuestionCount,
                rankingTheme: config.theme,
                rankingCourseName: config.courseName,
            },
        });
    };

    const launchRankingPracticeMission = (target: MissionTarget) => {
        if (!target.descriptor) {
            if (target.rankingConfig) {
                setCourse(target.rankingConfig.courseId);
                navigate('/course');
            }
            return;
        }
        const descriptor = target.descriptor;
        setCourse(descriptor.courseId);
        setUnit(descriptor.unitId);
        setPart(descriptor.partId);
        setSection(descriptor.sectionId);
        setStudyMode('typing');
        setMode(1);
        navigate('/play', {
            state: {
                courseId: descriptor.courseId,
                unitId: descriptor.unitId,
                partId: descriptor.partId,
                sectionId: descriptor.sectionId,
                mode: 1,
                missionOption: 'monthly_ranking',
                returnTo: '/dashboard',
            },
        });
    };

    const launchMission = (optionId: MissionOptionId) => {
        const target = missionTargets[optionId];
        if (!target) return;
        if (optionId === 'monthly_ranking') {
            setShowRankingLaunchDialog(true);
            return;
        }
        launchStandardMission(optionId, target);
    };

    const handleCloseRankingDialog = () => {
        setShowRankingLaunchDialog(false);
    };

    const handleStartRankingPractice = () => {
        const target = missionTargets.monthly_ranking;
        if (!target) return;
        setShowRankingLaunchDialog(false);
        logEvent({
            eventType: 'daily_mission_selected',
            userId: state.currentUser?.id ?? null,
            payload: {
                optionId: 'monthly_ranking',
                action: 'practice',
                courseId: target.rankingConfig?.courseId ?? target.descriptor?.courseId ?? null,
            },
        }).catch(() => {});
        launchRankingPracticeMission(target);
    };

    const handleStartRankingChallenge = () => {
        const target = missionTargets.monthly_ranking;
        if (!target) return;
        setShowRankingLaunchDialog(false);
        logEvent({
            eventType: 'daily_mission_selected',
            userId: state.currentUser?.id ?? null,
            payload: {
                optionId: 'monthly_ranking',
                action: 'challenge',
                courseId: target.rankingConfig?.courseId ?? null,
                league: target.rankingState?.activeLeague.id ?? null,
            },
        }).catch(() => {});
        launchRankingChallengeMission(target);
    };

    const handleOpenRecentSection = (item: RecentSectionItem) => {
        const recentMode = normalizeMode(item.mode);
        const choiceLevel = normalizeChoiceLevel(item.level);

        setCourse(item.courseId);
        setUnit(item.unitId ?? null);
        setPart(item.partId);
        setSection(item.sectionId);

        if (recentMode === 'choice') {
            setStudyMode('choice');
            setChoiceLevel(choiceLevel);
            navigate('/choice', {
                state: {
                    courseId: item.courseId,
                    unitId: item.unitId,
                    partId: item.partId,
                    sectionId: item.sectionId,
                    level: choiceLevel,
                    returnTo: '/dashboard',
                },
            });
            return;
        }

        setStudyMode('typing');
        setMode(1);
        navigate('/play', {
            state: {
                courseId: item.courseId,
                unitId: item.unitId,
                partId: item.partId,
                sectionId: item.sectionId,
                mode: 1,
                returnTo: '/dashboard',
            },
        });
    };

    const renderTargetLabel = (target: MissionTarget) => {
        if (target.optionId === 'monthly_ranking' && target.rankingConfig && target.rankingState) {
            const config = target.rankingConfig;
            return `${config.courseName} / ${config.theme}`;
        }
        if (!target.descriptor) return 'おすすめセクションを準備中';
        return `${target.descriptor.courseName} / ${target.descriptor.partLabel} / ${target.descriptor.sectionLabel}`;
    };

    const renderTargetMeta = (target: MissionTarget) => {
        if (target.optionId === 'monthly_ranking' && target.rankingState) {
            const ranking = target.rankingState;
            const league = ranking.activeLeague;
            const best = ranking.bestScores[league.id] ?? 0;
            const rank = target.rankingLeagueSnapshot?.rank
                ? `${target.rankingLeagueSnapshot.rank}位`
                : '--位';
            const total = target.rankingLeagueSnapshot?.total ?? 0;
            const promotionText = !ranking.nextLeague
                ? '現在の最高リーグ'
                : `昇格条件: ${league.promotionScore}点以上を${RANKING_PROMOTION_REQUIRED_COUNT}回（${ranking.currentPromotionCount}/${RANKING_PROMOTION_REQUIRED_COUNT}）`;
            return `ステージ: ${league.label} / BEST ${best}点 / 順位 ${rank}${total > 0 ? ` (${total}人中)` : ''} / ${promotionText}`;
        }
        return target.caption;
    };

    return (
        <div className={styles.page}>
            <main className={styles.main}>
                <div className={styles.hero}>
                    <div className={styles.heroTopRow}>
                        <h1 className={styles.title}>今日もワクワク学ぼう</h1>
                        <div className={styles.versionBadge}>v2</div>
                    </div>
                    <p className={styles.subtitle}>自分で選んで、続けて、できたを増やす</p>
                    {state.currentUser?.memberNo && (
                        <p className={styles.memberNo}>会員番号: {state.currentUser.memberNo}</p>
                    )}
                    <div className={styles.heroActions}>
                        <Button
                            variant="secondary"
                            size="sm"
                            className={`${styles.profileButton} ${styles.heroActionButton}`}
                            onClick={() => navigate('/account')}
                        >
                            会員情報を変更
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className={`${styles.backButton} ${styles.heroActionButton}`}
                            onClick={handleBackToLogin}
                        >
                            ログイン画面に戻る
                        </Button>
                    </div>
                </div>

                <Card className={styles.missionCard} padding="lg">
                    <div className={styles.missionHeader}>
                        <span className={styles.missionBadge}>Today</span>
                        <span className={styles.sectionNote}>{loading ? '更新中…' : 'おすすめ4ミッション'}</span>
                    </div>
                    <h2 className={styles.missionTitle}>今日は何をする？</h2>
                    <div className={styles.missionChoiceGrid}>
                        {missionOptionMeta.map((option) => {
                            const target = missionTargets[option.id];
                            const completed = completedMissionSet.has(option.id);
                            return (
                                <button
                                    key={option.id}
                                    type="button"
                                    className={`${styles.missionChoiceButton} ${completed ? styles.missionChoiceDone : ''}`}
                                    onClick={() => launchMission(option.id)}
                                    disabled={option.id === 'monthly_ranking'
                                        ? !target.rankingConfig
                                        : !target.descriptor}
                                >
                                    <div className={styles.missionChoiceHeader}>
                                        <span className={styles.missionChoiceTitle}>{option.title}</span>
                                        {completed && <span className={styles.missionChoiceDoneBadge}>+50XP</span>}
                                    </div>
                                    <span className={styles.missionChoiceTarget}>{renderTargetLabel(target)}</span>
                                    <span className={styles.missionChoiceMeta}>{renderTargetMeta(target)}</span>
                                </button>
                            );
                        })}
                    </div>
                </Card>

                <div className={styles.container}>
                    <div className={styles.dashboardColumn}>
                        <Card className={styles.dashboardCard} padding="lg">
                            <div className={styles.sectionHeader}>
                                <h2 className={styles.sectionTitle}>学習ステータス</h2>
                                <span className={styles.sectionNote}>ランクとレベル</span>
                            </div>
                            <div className={styles.rankBadgeRow}>
                                <span className={`${styles.rankBadge} ${styles.rankS}`}>S {rankCounts.S}</span>
                                <span className={`${styles.rankBadge} ${styles.rankA}`}>A {rankCounts.A}</span>
                                <span className={`${styles.rankBadge} ${styles.rankB}`}>B {rankCounts.B}</span>
                                <span className={`${styles.rankBadge} ${styles.rankC}`}>C {rankCounts.C}</span>
                            </div>
                            <div className={styles.xpPanel}>
                                <div className={styles.xpHeader}>
                                    <strong>Lv. {gamification.level}</strong>
                                    <span>{gamification.totalXp} XP</span>
                                </div>
                                <div className={styles.xpBar}>
                                    <span className={styles.xpFill} style={{ width: `${gamification.progressPercent}%` }} />
                                </div>
                                <div className={styles.xpMeta}>
                                    次のレベルまで {Math.max(0, gamification.nextLevelXp - gamification.totalXp)} XP
                                </div>
                                {gamification.missionBonusXp > 0 && (
                                    <div className={styles.xpMeta}>
                                        ミッションクリア累計 +{gamification.missionBonusXp} XP
                                    </div>
                                )}
                                {gamification.playBonusXp > 0 && (
                                    <div className={styles.xpMeta}>
                                        プレイ完了累計 +{gamification.playBonusXp} XP
                                    </div>
                                )}
                                {gamification.shuffleBonusXp > 0 && (
                                    <div className={styles.xpMeta}>
                                        ランダム挑戦累計 +{gamification.shuffleBonusXp} XP
                                    </div>
                                )}
                            </div>
                        </Card>

                        <Card className={styles.dashboardCard} padding="lg">
                            <div className={styles.sectionHeader}>
                                <h2 className={styles.sectionTitle}>学習サマリー</h2>
                                <span className={styles.sectionNote}>{loading ? '読み込み中…' : `直近${RECENT_SECTION_WINDOW}セクション`}</span>
                            </div>
                            <div className={styles.statsGrid}>
                                <div className={styles.statItem}>
                                    <span className={styles.statLabel}>学習時間</span>
                                    <span className={styles.statValue}>{formatDuration(recentSectionSummary.totalTimeMs)}</span>
                                    <span className={styles.statSub}>対象 {recentSectionSummary.count} セクション</span>
                                </div>
                                <div className={styles.statItem}>
                                    <span className={styles.statLabel}>平均正答率</span>
                                    <span className={styles.statValue}>{recentSectionSummary.avgAccuracy}%</span>
                                </div>
                                <div className={styles.statItem}>
                                    <span className={styles.statLabel}>平均 WPM</span>
                                    <span className={styles.statValue}>{recentSectionSummary.avgWpm ?? '-'}</span>
                                </div>
                                <div className={styles.statItem}>
                                    <span className={styles.statLabel}>セクション進捗</span>
                                    <span className={styles.statValue}>{clearedSections} / {totalSections}</span>
                                    <span className={styles.statSub}>達成率 {progressRate}%</span>
                                </div>
                            </div>
                        </Card>

                        <Card className={styles.dashboardCard} padding="lg">
                            <details
                                className={styles.accordion}
                                open={recentOpen}
                                onToggle={(event) => setRecentOpen((event.currentTarget as HTMLDetailsElement).open)}
                            >
                                <summary className={styles.accordionSummary}>
                                    <span>最近の挑戦</span>
                                    <span className={styles.sectionNote}>
                                        {latestSession ? formatDateTime(latestSession.playedAt) : '—'}
                                    </span>
                                </summary>
                                <div className={styles.accordionBody}>
                                    {latestSession ? (
                                        <div className={styles.sessionSummary}>
                                            <div>
                                                <span className={styles.sessionLabel}>ランク</span>
                                                <span className={styles.sessionValue}>{latestSession.rank}</span>
                                            </div>
                                            <div>
                                                <span className={styles.sessionLabel}>正答率</span>
                                                <span className={styles.sessionValue}>{latestSession.accuracy}%</span>
                                            </div>
                                            <div>
                                                <span className={styles.sessionLabel}>WPM</span>
                                                <span className={styles.sessionValue}>{latestSession.wpm ?? '-'}</span>
                                            </div>
                                            <div>
                                                <span className={styles.sessionLabel}>ミス</span>
                                                <span className={styles.sessionValue}>{latestSession.missCount}回</span>
                                            </div>
                                            <div>
                                                <span className={styles.sessionLabel}>時間</span>
                                                <span className={styles.sessionValue}>{formatDuration(latestSession.totalTimeMs)}</span>
                                            </div>
                                            <div>
                                                <span className={styles.sessionLabel}>モード</span>
                                                <span className={styles.sessionValue}>{latestSession.mode === 'typing' ? 'タイピング' : '4択'}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className={styles.emptyText}>まだセッションがありません。</p>
                                    )}
                                    {recentSections.length > 0 ? (
                                        <div className={styles.recentList}>
                                            {recentSections.map((item) => {
                                                const descriptor = resolveDescriptorFromRecent(item);
                                                const modeLabel = item.mode === 'choice' ? '4択' : 'タイピング';
                                                return (
                                                    <button
                                                        key={`${item.courseId}:${item.unitId}:${item.partId}:${item.sectionId}:${item.mode ?? 'typing'}:${item.level ?? 0}:${item.lastPlayedAt ?? ''}`}
                                                        className={styles.recentItem}
                                                        onClick={() => handleOpenRecentSection(item)}
                                                    >
                                                        <div>
                                                            <div className={styles.recentContext}>
                                                                <span className={styles.recentCourse}>{descriptor?.courseName ?? item.courseId}</span>
                                                                <span className={styles.recentDivider}>/</span>
                                                                <span className={styles.recentUnit}>{descriptor?.unitName ?? item.unitId ?? '—'}</span>
                                                            </div>
                                                            <div className={styles.recentLabel}>
                                                                {descriptor?.partLabel ?? item.partId} / {descriptor?.sectionLabel ?? item.label}
                                                            </div>
                                                            <div className={styles.recentMeta}>
                                                                {formatDateTime(item.lastPlayedAt)} · {modeLabel}
                                                            </div>
                                                        </div>
                                                        <span className={styles.recentArrow}>→</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <p className={styles.emptyText}>まだ挑戦履歴がありません。</p>
                                    )}
                                </div>
                            </details>
                        </Card>
                    </div>

                    <div className={styles.sideColumn}>
                        <Card className={styles.courseCard} padding="lg">
                            <details
                                className={styles.accordion}
                                open={coursesOpen}
                                onToggle={(event) => setCoursesOpen((event.currentTarget as HTMLDetailsElement).open)}
                            >
                                <summary className={styles.accordionSummary}>
                                    <span>コースを選択</span>
                                    <span className={styles.sectionNote}>学習を開始</span>
                                </summary>
                                <div className={styles.accordionBody}>
                                    <div className={styles.courseList}>
                                        {courseCatalog.map((course) => (
                                            <button
                                                key={course.id}
                                                type="button"
                                                className={styles.courseItem}
                                                onClick={() => handleCourseSelect(course.id)}
                                                onMouseEnter={() => {
                                                    void preloadCourse(course.id);
                                                }}
                                                onFocus={() => {
                                                    void preloadCourse(course.id);
                                                }}
                                            >
                                                <div className={styles.courseIcon}>📚</div>
                                                <div className={styles.courseInfo}>
                                                    <h3 className={styles.courseName}>{course.name}</h3>
                                                </div>
                                                <div className={styles.arrow}>→</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </details>
                        </Card>
                    </div>
                </div>
            </main>
            {showRankingLaunchDialog && (
                <div className={styles.launchDialogOverlay} role="dialog" aria-modal="true" aria-label="ランキング挑戦">
                    <div className={styles.launchDialog}>
                        <h3 className={styles.launchDialogTitle}>今月のランキングに挑戦</h3>
                        <p className={styles.launchDialogText}>まずは練習がおすすめ！</p>
                        <div className={styles.launchDialogActions}>
                            <Button variant="secondary" size="md" onClick={handleStartRankingPractice}>
                                練習
                            </Button>
                            <Button variant="primary" size="md" onClick={handleStartRankingChallenge}>
                                本番
                            </Button>
                        </div>
                        <Button variant="ghost" size="sm" onClick={handleCloseRankingDialog}>
                            閉じる
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default HomePage;
