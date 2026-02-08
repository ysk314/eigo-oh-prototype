// ================================
// Play Page
// ================================

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Header } from '@/components/Header';
import { GameHeader } from '@/components/GameHeader';
import { QuestionDisplay } from '@/components/QuestionDisplay';
import { TypingInput } from '@/components/TypingInput';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Confetti } from '@/components/Confetti';
import { useCourseBundle } from '@/hooks/useCourseBundle';
import { shuffleWithNoConsecutive } from '@/utils/shuffle';
import { Course, LearningMode, Question, Rank, SectionProgress, UserProgress } from '@/types';
import { buildScoreResult, ScoreResult } from '@/utils/score';
import { calculateTimeLimit, calculateTotalChars, getCourseTimeLimitMultiplier } from '@/utils/timer';
import { playSound } from '@/utils/sound';
import { useCountdown } from '@/hooks/useCountdown';
import { getRankMessage } from '@/utils/result';
import { logEvent } from '@/utils/analytics';
import { recordProgressSnapshot, recordSessionSummary, type SessionSummary, type SectionMeta } from '@/utils/dashboardStats';
import { buildSectionProgressTotals, buildUserProgressTotals, getTotalSectionsCount } from '@/utils/progressSummary';
import { ensureAllCoursesLoaded, getLoadedCourses } from '@/data/questions';
import { useSelectedLabels } from '@/hooks/useSelectedLabels';
import {
    buildMonthlyRankingState,
    buildRankingBestProgressKey,
    buildRankingPromotionCountProgressKey,
    extractRankingBestScores,
    extractRankingPromotionCounts,
    getMonthlyRankingConfig,
    RANKING_PROMOTION_REQUIRED_COUNT,
    withIncrementedPromotionCount,
    withUpdatedRankingBestScore,
    type RankingLeagueId,
} from '@/utils/monthlyRanking';
import { fetchMonthlyRankingLeagueSnapshot, upsertMonthlyRankingBoardEntry } from '@/utils/monthlyRankingBoard';
import styles from './PlayPage.module.css';

type XpSection = {
    sectionId: string;
    questionIds: string[];
};

const rankOrder: Rank[] = ['S', 'A', 'B', 'C'];
const rankMasteryXp: Record<Rank, number> = {
    S: 60,
    A: 45,
    B: 30,
    C: 15,
};
function isAdvanceRank(rank: Rank | null | undefined): boolean {
    return rank === 'S' || rank === 'A';
}

const MISSION_PROGRESS_PREFIX = 'mission:';
const MISSION_COMPLETE_XP = 50;
const PLAY_PROGRESS_KEY = 'play:completed';
const PLAY_COMPLETE_XP = 10;
const SHUFFLE_PROGRESS_KEY = 'play:shuffle';
const SHUFFLE_BONUS_XP = 5;

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

function computeLevelInfo(totalXp: number): { level: number; progressPercent: number; nextLevelRemaining: number } {
    let level = 1;
    while (totalXp >= xpForLevel(level + 1)) {
        level += 1;
    }
    const currentLevelXp = xpForLevel(level);
    const nextLevelXp = xpForLevel(level + 1);
    const denominator = Math.max(1, nextLevelXp - currentLevelXp);
    const rawPercent = ((totalXp - currentLevelXp) / denominator) * 100;
    const progressPercent = Math.min(100, Math.max(0, Number(rawPercent.toFixed(2))));
    return {
        level,
        progressPercent,
        nextLevelRemaining: Math.max(0, nextLevelXp - totalXp),
    };
}

function buildXpSections(courses: Course[]): XpSection[] {
    return courses.flatMap((course) =>
        course.units.flatMap((unit) =>
            unit.parts.flatMap((part) =>
                part.sections.map((section) => ({
                    sectionId: section.id,
                    questionIds: section.questionIds ?? [],
                }))
            )
        )
    );
}

function computeSectionXp(
    section: XpSection,
    attemptedQuestionIds: Set<string>,
    sectionProgressMap: Map<string, SectionProgress>
): number {
    const totalQuestions = Math.max(1, section.questionIds.length);
    const attemptedCount = section.questionIds.reduce((count, questionId) => {
        return attemptedQuestionIds.has(questionId) ? count + 1 : count;
    }, 0);
    const participationRatio = Math.min(1, attemptedCount / totalQuestions);
    const participationXp = Math.round(40 * participationRatio);
    const bestRank = getBestRank(sectionProgressMap.get(section.sectionId));
    const masteryXp = bestRank ? rankMasteryXp[bestRank] : 0;
    return participationXp + masteryXp;
}

function computeTotalXp(
    sections: XpSection[],
    attemptedQuestionIds: Set<string>,
    sectionProgressMap: Map<string, SectionProgress>
): number {
    return sections.reduce((sum, section) => sum + computeSectionXp(section, attemptedQuestionIds, sectionProgressMap), 0);
}

function getDateKeyLocal(date = new Date()): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function buildMissionProgressQuestionId(dateKey: string, _optionId: string): string {
    return `${MISSION_PROGRESS_PREFIX}${dateKey}:${_optionId}`;
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

function hasMissionCompletedForOption(progressMap: Map<string, UserProgress>, dateKey: string, optionId: string): boolean {
    const progress = progressMap.get(buildMissionProgressQuestionId(dateKey, optionId));
    return (progress?.attemptsCount ?? 0) > 0;
}

function buildAttemptedQuestionIds(progressMap: Map<string, UserProgress>): Set<string> {
    const attempted = new Set<string>();
    progressMap.forEach((progress, questionId) => {
        if ((progress.attemptsCount ?? 0) > 0) {
            attempted.add(questionId);
        }
    });
    return attempted;
}

function computeMissionBonusXp(progressMap: Map<string, UserProgress>): number {
    const completedMissionKeys = new Set<string>();
    progressMap.forEach((progress, questionId) => {
        if ((progress.attemptsCount ?? 0) <= 0) return;
        const missionOptionKey = extractMissionOptionKey(questionId);
        if (!missionOptionKey) return;
        completedMissionKeys.add(missionOptionKey);
    });
    return completedMissionKeys.size * MISSION_COMPLETE_XP;
}

function computePlayBonusXp(progressMap: Map<string, UserProgress>): number {
    const completedSessions = Math.max(0, progressMap.get(PLAY_PROGRESS_KEY)?.attemptsCount ?? 0);
    return completedSessions * PLAY_COMPLETE_XP;
}

function computeShuffleBonusXp(progressMap: Map<string, UserProgress>): number {
    const shuffleSessions = Math.max(0, progressMap.get(SHUFFLE_PROGRESS_KEY)?.attemptsCount ?? 0);
    return shuffleSessions * SHUFFLE_BONUS_XP;
}

function extractUserQuestionProgressMap(
    userProgress: Record<string, UserProgress>,
    userId?: string
): Map<string, UserProgress> {
    const map = new Map<string, UserProgress>();
    const prefix = userId ? `${userId}-` : '';
    Object.entries(userProgress).forEach(([key, progress]) => {
        if (userId && !key.startsWith(prefix)) return;
        const questionId = userId ? key.slice(prefix.length) : key;
        map.set(questionId, progress);
    });
    return map;
}

function extractUserSectionProgressMap(
    sectionProgress: Record<string, SectionProgress>,
    userId?: string
): Map<string, SectionProgress> {
    const map = new Map<string, SectionProgress>();
    const prefix = userId ? `${userId}-` : '';
    Object.entries(sectionProgress).forEach(([key, progress]) => {
        if (userId && !key.startsWith(prefix)) return;
        map.set(progress.sectionId, progress);
    });
    return map;
}

function applyTypingRankToProgress(
    sectionId: string,
    current: SectionProgress | undefined,
    mode: LearningMode,
    rank: Rank
): SectionProgress {
    const base: SectionProgress = current ?? {
        sectionId,
        mode1Cleared: false,
        mode2Cleared: false,
        mode3Cleared: false,
        mode1Rank: null,
        mode2Rank: null,
        mode3Rank: null,
        choice1Rank: null,
        choice2Rank: null,
        choice3Rank: null,
        choice4Rank: null,
        totalAttempts: 0,
        totalCorrect: 0,
        totalMiss: 0,
    };
    const rankKey = `mode${mode}Rank` as 'mode1Rank' | 'mode2Rank' | 'mode3Rank';
    const currentRank = base[rankKey];
    const isBetter = !currentRank || rankOrder.indexOf(rank) < rankOrder.indexOf(currentRank);
    return {
        ...base,
        sectionId,
        [rankKey]: isBetter ? rank : currentRank,
    };
}

function pickRandomQuestions(questions: Question[], count: number, seed: number): Question[] {
    if (questions.length <= count) {
        return [...questions];
    }
    const pool = [...questions];
    let value = Math.abs(seed) % 2147483647;
    if (value <= 0) value = 1;
    const nextRandom = () => {
        value = (value * 48271) % 2147483647;
        return (value - 1) / 2147483646;
    };
    for (let i = pool.length - 1; i > 0; i -= 1) {
        const j = Math.floor(nextRandom() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
}

function isChoiceOnlyQuestion(question: Question): boolean {
    return question.category?.includes('choice-only') ?? false;
}

function hasTypingLevelTag(question: Question): boolean {
    return question.category?.some((item) => /^typing-l[123]$/.test(item)) ?? false;
}

function getTypingLevelTag(mode: LearningMode): string {
    return `typing-l${mode}`;
}

export function PlayPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const {
        state,
        updateProgress,
        setCourse,
        setUnit,
        setPart,
        setSection,
        setMode,
        setStudyMode,
        setQuestionIndex,
        markSectionCleared,
        setSectionRank,
        beginSectionSession,
        completeSectionSession,
        abortSectionSession,
    } = useApp();

    const { selectedCourse, selectedPart, selectedSection, selectedMode, currentUser, shuffleMode } = state;
    const launchState = (location.state ?? {}) as {
        courseId?: string;
        unitId?: string;
        partId?: string;
        sectionId?: string;
        mode?: LearningMode;
        missionOption?: string;
        returnTo?: string;
        rankingChallenge?: boolean;
        rankingMonthKey?: string;
        rankingLeagueId?: RankingLeagueId;
        rankingQuestionCount?: number;
        rankingTheme?: string;
        rankingCourseName?: string;
    };
    const isRankingChallenge = launchState.rankingChallenge === true;
    const fallbackRankingConfig = getMonthlyRankingConfig();
    const rankingMonthKey = launchState.rankingMonthKey ?? fallbackRankingConfig.monthKey;
    const rankingLeagueId = launchState.rankingLeagueId ?? 'bronze';
    const rankingQuestionCount = Math.max(1, launchState.rankingQuestionCount ?? fallbackRankingConfig.challengeQuestionCount);
    const rankingTheme = launchState.rankingTheme ?? fallbackRankingConfig.theme;
    const rankingCourseName = launchState.rankingCourseName ?? fallbackRankingConfig.courseName;
    const activeCourseId = launchState.courseId ?? selectedCourse ?? null;
    const activeUnitId = launchState.unitId ?? state.selectedUnit ?? null;
    const activePartId = isRankingChallenge ? null : (launchState.partId ?? selectedPart ?? null);
    const activeSectionId = isRankingChallenge ? null : (launchState.sectionId ?? selectedSection ?? null);
    const activeMode = launchState.mode ?? selectedMode ?? 1;
    const returnToPath = launchState.returnTo === '/dashboard' ? '/dashboard' : '/course';
    const {
        course: currentCourse,
        questions: courseQuestions,
        loading: courseLoading,
    } = useCourseBundle(activeCourseId);
    const [rankingQuestionSeed, setRankingQuestionSeed] = useState(() => Date.now());

    // セクションの問題をロード & シャッフル
    const questions = useMemo(() => {
        const pickTypingPool = (basePool: Question[]): Question[] => {
            const typingPool = basePool.filter((question) => !isChoiceOnlyQuestion(question));
            if (typingPool.length === 0) return [];

            const levelTag = getTypingLevelTag(activeMode);
            const hasLevelSpecific = typingPool.some((question) => hasTypingLevelTag(question));
            if (!hasLevelSpecific) return typingPool;

            const matched = typingPool.filter((question) => question.category?.includes(levelTag));
            return matched.length > 0 ? matched : typingPool;
        };

        if (isRankingChallenge) {
            const rankingPool = pickTypingPool(courseQuestions);
            if (rankingPool.length === 0) return [];
            return pickRandomQuestions(rankingPool, rankingQuestionCount, rankingQuestionSeed);
        }
        if (!activePartId || !activeSectionId) return [];
        const sectionPool = courseQuestions.filter(
            (question) =>
                question.partId === activePartId &&
                question.section === activeSectionId
        );
        const baseQuestions = pickTypingPool(sectionPool);

        if (shuffleMode) {
            return shuffleWithNoConsecutive(baseQuestions, (q) => q.answerEn);
        }
        return baseQuestions.sort((a, b) => a.orderIndex - b.orderIndex);
    }, [activePartId, activeSectionId, activeMode, shuffleMode, courseQuestions, isRankingChallenge, rankingQuestionCount, rankingQuestionSeed]);

    // 現在の状態
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFinished, setIsFinished] = useState(false);
    const [sessionResults, setSessionResults] = useState<UserProgress[]>([]);
    const { countdown, isCountingDown, start: startCountdown } = useCountdown(3, () => playSound('countdown'));
    const [timeLimit, setTimeLimit] = useState(0);
    const [timeLeft, setTimeLeft] = useState(0);
    const [timeUp, setTimeUp] = useState(false);
    const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);
    const [currentChar, setCurrentChar] = useState<string | null>(null);
    const [loadedCourses, setLoadedCourses] = useState<Course[]>([]);
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const [animatedXpBar, setAnimatedXpBar] = useState(0);
    const [showLevelUpFx, setShowLevelUpFx] = useState(false);
    const [rankingResult, setRankingResult] = useState<{
        leagueLabel: string;
        bestScore: number;
        previousBestScore: number;
        promotionCount: number;
        promotionRequired: number;
        pointsToNextLeague: number;
        hasNextLeague: boolean;
        rank: number | null;
        rankTotal: number;
        promotedTo: string | null;
        promotedLeagueId: RankingLeagueId | null;
        promotedMode: LearningMode | null;
    } | null>(null);
    const sessionResultsRef = useRef<UserProgress[]>([]);
    const isAdvancingRef = useRef(false);
    const timeUpRef = useRef(false);
    const isFinishedRef = useRef(false);
    const sessionIdRef = useRef(`typing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const xpBaselineRef = useRef<{
        baseXp: number;
        missionXp: number;
        playBonusXp: number;
        shuffleBonusXp: number;
        totalXp: number;
    } | null>(null);
    const latestXpStateRef = useRef<{
        sections: XpSection[];
        questionProgressMap: Map<string, UserProgress>;
        sectionProgressMap: Map<string, SectionProgress>;
    }>({
        sections: [],
        questionProgressMap: new Map<string, UserProgress>(),
        sectionProgressMap: new Map<string, SectionProgress>(),
    });
    const xpAnimatedSessionRef = useRef<string | null>(null);
    const initializedSessionKeyRef = useRef<string | null>(null);

    const currentQuestion = questions[currentIndex];
    const sessionSetupKey = isRankingChallenge
        ? `ranking:${activeCourseId ?? ''}:${rankingMonthKey}:${rankingLeagueId}:${rankingQuestionCount}:${activeMode}:${rankingQuestionSeed}`
        : `${activeCourseId ?? ''}:${activePartId ?? ''}:${activeSectionId ?? ''}:${activeMode}`;

    useEffect(() => {
        let isMounted = true;
        ensureAllCoursesLoaded()
            .then(() => {
                if (!isMounted) return;
                setLoadedCourses(getLoadedCourses());
            })
            .catch((error) => {
                console.error('Failed to load course catalog for XP:', error);
            });
        return () => {
            isMounted = false;
        };
    }, []);

    const allXpSections = useMemo(() => buildXpSections(loadedCourses), [loadedCourses]);
    const fallbackXpSections = useMemo(
        () => (currentCourse ? buildXpSections([currentCourse]) : []),
        [currentCourse]
    );
    const xpSectionsForCalc = allXpSections.length > 0 ? allXpSections : fallbackXpSections;
    const currentUserId = currentUser?.id;
    const userQuestionProgressMapForXp = useMemo(
        () => extractUserQuestionProgressMap(state.userProgress, currentUserId),
        [state.userProgress, currentUserId]
    );
    const userSectionProgressMapForXp = useMemo(
        () => extractUserSectionProgressMap(state.sectionProgress, currentUserId),
        [state.sectionProgress, currentUserId]
    );

    const attemptedQuestionIdsForXp = useMemo(() => {
        return buildAttemptedQuestionIds(userQuestionProgressMapForXp);
    }, [userQuestionProgressMapForXp]);

    const missionDateKey = useMemo(() => getDateKeyLocal(), []);
    const missionProgressQuestionId = useMemo(() => {
        if (!launchState.missionOption) return null;
        return buildMissionProgressQuestionId(missionDateKey, launchState.missionOption);
    }, [launchState.missionOption, missionDateKey]);
    const missionAlreadyCompleted = useMemo(() => {
        if (!launchState.missionOption) return false;
        return hasMissionCompletedForOption(userQuestionProgressMapForXp, missionDateKey, launchState.missionOption);
    }, [launchState.missionOption, userQuestionProgressMapForXp, missionDateKey]);
    const rankingConfig = useMemo(() => ({
        ...fallbackRankingConfig,
        monthKey: rankingMonthKey,
        courseId: activeCourseId ?? fallbackRankingConfig.courseId,
        courseName: rankingCourseName,
        theme: rankingTheme,
        challengeQuestionCount: rankingQuestionCount,
    }), [
        fallbackRankingConfig,
        rankingMonthKey,
        activeCourseId,
        rankingCourseName,
        rankingTheme,
        rankingQuestionCount,
    ]);
    const rankingStateBefore = useMemo(() => {
        const best = extractRankingBestScores(userQuestionProgressMapForXp, rankingConfig);
        const counts = extractRankingPromotionCounts(userQuestionProgressMapForXp, rankingConfig);
        return buildMonthlyRankingState(rankingConfig, best, counts);
    }, [userQuestionProgressMapForXp, rankingConfig]);
    const activeRankingLeagueId = useMemo<RankingLeagueId>(() => {
        const exists = rankingConfig.leagues.some((league) => league.id === rankingLeagueId);
        return exists ? rankingLeagueId : 'bronze';
    }, [rankingConfig, rankingLeagueId]);

    useEffect(() => {
        latestXpStateRef.current = {
            sections: xpSectionsForCalc,
            questionProgressMap: userQuestionProgressMapForXp,
            sectionProgressMap: userSectionProgressMapForXp,
        };
    }, [xpSectionsForCalc, userQuestionProgressMapForXp, userSectionProgressMapForXp]);
    // 初期化チェック
    useEffect(() => {
        if (courseLoading) return;
        if (!isRankingChallenge && (!activePartId || !activeSectionId || questions.length === 0)) {
            navigate('/course'); // 何も選択されてなければ戻る
            return;
        }
        if (isRankingChallenge && questions.length === 0) {
            navigate('/course'); // 何も選択されてなければ戻る
        }
    }, [activePartId, activeSectionId, questions, navigate, courseLoading, isRankingChallenge]);

    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, []);

    // セッション初期化（問題セット変更時）
    useEffect(() => {
        if (questions.length === 0) return;
        if (initializedSessionKeyRef.current === sessionSetupKey) return;
        initializedSessionKeyRef.current = sessionSetupKey;
        sessionIdRef.current = `typing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const totalChars = calculateTotalChars(questions);
        const timeMultiplier = getCourseTimeLimitMultiplier(activeCourseId);
        const baseLimit = calculateTimeLimit(totalChars, 1, 10);
        const limit = Math.max(1, Math.floor(baseLimit * timeMultiplier));

        setCurrentIndex(0);
        setQuestionIndex(0);
        setIsFinished(false);
        setTimeUp(false);
        setSessionResults([]);
        sessionResultsRef.current = [];
        setScoreResult(null);
        setShowExitConfirm(false);
        setAnimatedXpBar(0);
        setShowLevelUpFx(false);
        setRankingResult(null);
        xpAnimatedSessionRef.current = null;
        setTimeLimit(limit);
        setTimeLeft(limit);
        startCountdown(3);
        beginSectionSession();

        const { sections, questionProgressMap, sectionProgressMap } = latestXpStateRef.current;
        const attemptedQuestionIds = buildAttemptedQuestionIds(questionProgressMap);
        const baselineBaseXp = computeTotalXp(sections, attemptedQuestionIds, sectionProgressMap);
        const baselineMissionXp = computeMissionBonusXp(questionProgressMap);
        const baselinePlayBonusXp = computePlayBonusXp(questionProgressMap);
        const baselineShuffleBonusXp = computeShuffleBonusXp(questionProgressMap);
        const baselineTotalXp = baselineBaseXp + baselineMissionXp + baselinePlayBonusXp + baselineShuffleBonusXp;
        xpBaselineRef.current = {
            baseXp: baselineBaseXp,
            missionXp: baselineMissionXp,
            playBonusXp: baselinePlayBonusXp,
            shuffleBonusXp: baselineShuffleBonusXp,
            totalXp: baselineTotalXp,
        };

        logEvent({
            eventType: 'session_started',
            userId: currentUser?.id ?? null,
            payload: {
                sessionId: sessionIdRef.current,
                mode: 'typing',
                questionCount: questions.length,
                startedAt: new Date().toISOString(),
                rankingChallenge: isRankingChallenge,
                rankingMonthKey: isRankingChallenge ? rankingMonthKey : undefined,
                rankingLeagueId: isRankingChallenge ? activeRankingLeagueId : undefined,
            },
        }).catch(() => {});
    }, [
        questions,
        sessionSetupKey,
        startCountdown,
        currentUser?.id,
        beginSectionSession,
        activeCourseId,
        activeRankingLeagueId,
        isRankingChallenge,
        rankingMonthKey,
        setQuestionIndex,
    ]);

    // タイマー処理
    useEffect(() => {
        if (isCountingDown || isFinished || timeLimit === 0) return;

        if (timeLeft <= 0) {
            if (!timeUp && !isFinished) {
                setTimeUp(true);
                finishSession();
            }
            return;
        }

        const interval = setInterval(() => {
            setTimeLeft(prev => (prev <= 1 ? 0 : prev - 1));
        }, 1000);

        return () => clearInterval(interval);
    }, [isCountingDown, isFinished, timeLeft, timeLimit, timeUp]);

    useEffect(() => {
        timeUpRef.current = timeUp;
    }, [timeUp]);

    useEffect(() => {
        isFinishedRef.current = isFinished;
    }, [isFinished]);

    useEffect(() => {
        isAdvancingRef.current = false;
    }, [currentIndex]);

    const finalScore = useMemo(() => {
        if (!isFinished) return null;
        const totalMiss = sessionResults.reduce((acc, cur) => acc + cur.missCount, 0);
        const totalChars = questions.reduce((acc, q) => acc + q.answerEn.length, 0);
        const accuracy = totalChars > 0
            ? Math.round((totalChars / (totalChars + totalMiss)) * 100)
            : 0;
        return scoreResult ?? buildScoreResult({
            accuracy,
            timeLeft,
            timeLimit,
            isPerfect: totalMiss === 0,
        });
    }, [isFinished, scoreResult, sessionResults, timeLeft, timeLimit, questions]);

    const xpSummary = useMemo(() => {
        if (!isFinished || !finalScore) return null;

        const baseBeforeXp =
            xpBaselineRef.current?.baseXp
            ?? computeTotalXp(xpSectionsForCalc, attemptedQuestionIdsForXp, userSectionProgressMapForXp);
        const missionBeforeXp =
            xpBaselineRef.current?.missionXp
            ?? computeMissionBonusXp(userQuestionProgressMapForXp);
        const playBeforeXp =
            xpBaselineRef.current?.playBonusXp
            ?? computePlayBonusXp(userQuestionProgressMapForXp);
        const shuffleBeforeXp =
            xpBaselineRef.current?.shuffleBonusXp
            ?? computeShuffleBonusXp(userQuestionProgressMapForXp);
        const beforeTotalXp = xpBaselineRef.current?.totalXp ?? (baseBeforeXp + missionBeforeXp + playBeforeXp + shuffleBeforeXp);
        const beforeLevelInfo = computeLevelInfo(beforeTotalXp);

        const afterQuestionProgressMap = new Map(userQuestionProgressMapForXp);
        const afterSectionProgressMap = new Map(userSectionProgressMapForXp);
        if (activeSectionId) {
            const updatedProgress = applyTypingRankToProgress(
                activeSectionId,
                afterSectionProgressMap.get(activeSectionId),
                activeMode,
                finalScore.rank
            );
            afterSectionProgressMap.set(activeSectionId, updatedProgress);
        }

        const missionEarnedNow = Boolean(launchState.missionOption && missionProgressQuestionId && !missionAlreadyCompleted);
        if (missionEarnedNow && missionProgressQuestionId) {
            afterQuestionProgressMap.set(missionProgressQuestionId, {
                questionId: missionProgressQuestionId,
                attemptsCount: 1,
                correctCount: 1,
                missCount: 0,
                clearedMode: 0,
                lastPlayedAt: new Date().toISOString(),
            });
        }

        const baselinePlayCount = Math.floor(playBeforeXp / PLAY_COMPLETE_XP);
        const currentPlayCount = Math.max(0, userQuestionProgressMapForXp.get(PLAY_PROGRESS_KEY)?.attemptsCount ?? 0);
        const targetPlayCount = Math.max(currentPlayCount, baselinePlayCount + 1);
        afterQuestionProgressMap.set(PLAY_PROGRESS_KEY, {
            questionId: PLAY_PROGRESS_KEY,
            attemptsCount: targetPlayCount,
            correctCount: targetPlayCount,
            missCount: 0,
            clearedMode: 0,
            lastPlayedAt: new Date().toISOString(),
        });
        if (shuffleMode) {
            const baselineShuffleCount = Math.floor(shuffleBeforeXp / SHUFFLE_BONUS_XP);
            const currentShuffleCount = Math.max(0, userQuestionProgressMapForXp.get(SHUFFLE_PROGRESS_KEY)?.attemptsCount ?? 0);
            const targetShuffleCount = Math.max(currentShuffleCount, baselineShuffleCount + 1);
            afterQuestionProgressMap.set(SHUFFLE_PROGRESS_KEY, {
                questionId: SHUFFLE_PROGRESS_KEY,
                attemptsCount: targetShuffleCount,
                correctCount: targetShuffleCount,
                missCount: 0,
                clearedMode: 0,
                lastPlayedAt: new Date().toISOString(),
            });
        }

        const afterAttemptedQuestionIds = buildAttemptedQuestionIds(afterQuestionProgressMap);
        const afterBaseXp = computeTotalXp(xpSectionsForCalc, afterAttemptedQuestionIds, afterSectionProgressMap);
        const afterMissionXp = computeMissionBonusXp(afterQuestionProgressMap);
        const afterPlayXp = computePlayBonusXp(afterQuestionProgressMap);
        const afterShuffleXp = computeShuffleBonusXp(afterQuestionProgressMap);
        const afterTotalXp = afterBaseXp + afterMissionXp + afterPlayXp + afterShuffleXp;
        const afterLevelInfo = computeLevelInfo(afterTotalXp);

        return {
            beforeTotalXp,
            afterTotalXp,
            gainedXp: Math.max(0, afterTotalXp - beforeTotalXp),
            gainedBaseXp: Math.max(0, afterBaseXp - baseBeforeXp),
            gainedMissionXp: Math.max(0, afterMissionXp - missionBeforeXp),
            gainedPlayXp: Math.max(0, afterPlayXp - playBeforeXp),
            gainedShuffleXp: Math.max(0, afterShuffleXp - shuffleBeforeXp),
            beforeLevel: beforeLevelInfo.level,
            beforeProgressPercent: beforeLevelInfo.progressPercent,
            afterLevel: afterLevelInfo.level,
            afterProgressPercent: afterLevelInfo.progressPercent,
            nextLevelRemaining: afterLevelInfo.nextLevelRemaining,
        };
    }, [
        isFinished,
        finalScore,
        xpSectionsForCalc,
        attemptedQuestionIdsForXp,
        userQuestionProgressMapForXp,
        userSectionProgressMapForXp,
        activeSectionId,
        activeMode,
        launchState.missionOption,
        missionProgressQuestionId,
        missionAlreadyCompleted,
        shuffleMode,
    ]);

    useEffect(() => {
        if (!isFinished || !xpSummary) return;
        if (xpAnimatedSessionRef.current === sessionIdRef.current) return;
        xpAnimatedSessionRef.current = sessionIdRef.current;

        const leveledUp = xpSummary.afterLevel > xpSummary.beforeLevel;
        const startPercent = leveledUp ? 0 : xpSummary.beforeProgressPercent;
        setAnimatedXpBar(startPercent);
        let raf1 = 0;
        let raf2 = 0;
        raf1 = window.requestAnimationFrame(() => {
            raf2 = window.requestAnimationFrame(() => {
                setAnimatedXpBar(xpSummary.afterProgressPercent);
            });
        });

        if (leveledUp) {
            setShowLevelUpFx(true);
            const fxTimer = window.setTimeout(() => {
                setShowLevelUpFx(false);
            }, 1200);
            return () => {
                window.cancelAnimationFrame(raf1);
                window.cancelAnimationFrame(raf2);
                window.clearTimeout(fxTimer);
            };
        }

        return () => {
            window.cancelAnimationFrame(raf1);
            window.cancelAnimationFrame(raf2);
        };
    }, [isFinished, xpSummary]);

    useEffect(() => {
        if (!isFinished || !finalScore || !activeSectionId) return;
        if (isAdvanceRank(finalScore.rank)) {
            markSectionCleared(activeSectionId, activeMode);
        }
        setSectionRank(activeSectionId, activeMode, finalScore.rank);
    }, [isFinished, finalScore, activeSectionId, activeMode, markSectionCleared, setSectionRank]);

    // デバッグ用: 進捗ログ
    useEffect(() => {
        // console.log('Current Question:', currentQuestion);
    }, [currentQuestion]);

    // 問題完了時の処理
    const handleQuestionComplete = useCallback((result: { missCount: number; timeMs: number }) => {
        if (!currentQuestion || isFinished || timeUp || isAdvancingRef.current) return;
        isAdvancingRef.current = true;

        const isCorrect = result.missCount === 0; // 一度もミスなしならPerfect扱い？(要件次第だが今回は完了ベース)

        // 進捗保存
        updateProgress(currentQuestion.id, {
            attemptsCount: 1, // 加算用
            correctCount: 1,  // 完了したので1回正解とみなす (仕様要確認: 逐次判定なので入力完了=正解)
            missCount: result.missCount,
        });

        if (result.missCount > 0) {
            logEvent({
                eventType: 'question_answered',
                userId: currentUser?.id ?? null,
                payload: {
                    sessionId: sessionIdRef.current,
                    questionId: currentQuestion.id,
                    missCount: result.missCount,
                    timeMs: result.timeMs,
                },
            }).catch(() => {});
        }

        // セッション結果を記録（後でクリア判定に使用）
        const nextResult: UserProgress = {
            questionId: currentQuestion.id,
            attemptsCount: 1,
            correctCount: 1,
            missCount: result.missCount,
            clearedMode: activeMode,
        };
        const nextResults = [...sessionResultsRef.current, nextResult];
        sessionResultsRef.current = nextResults;
        setSessionResults(nextResults);

        if (isCorrect && currentIndex < questions.length - 1 && !timeUpRef.current) {
            playSound('success');
        }

        // 少し待って次の問題へ
        setTimeout(() => {
            isAdvancingRef.current = false;
            if (isFinishedRef.current) {
                return;
            }
            if (currentIndex < questions.length - 1 && !timeUpRef.current) {
                setCurrentIndex(prev => prev + 1);
                setQuestionIndex(currentIndex + 1);
                return;
            }
            finishSession(nextResults);
        }, 800);
    }, [currentQuestion, currentIndex, questions.length, updateProgress, setQuestionIndex, activeMode, isFinished, timeUp, currentUser?.id]);

    // セッション完了処理
    const finishSession = (resultsOverride?: UserProgress[]) => {
        if (isFinishedRef.current) return;
        isFinishedRef.current = true;
        setIsFinished(true);
        const results = resultsOverride ?? sessionResultsRef.current;
        const totalMiss = results.reduce((acc, cur) => acc + cur.missCount, 0);
        const totalChars = questions.reduce((acc, q) => acc + q.answerEn.length, 0);
        const accuracy = totalChars > 0
            ? Math.round((totalChars / (totalChars + totalMiss)) * 100)
            : 0;
        const score = buildScoreResult({
            accuracy,
            timeLeft,
            timeLimit,
            isPerfect: totalMiss === 0,
        });
        setScoreResult(score);

        const beforeTotalXp = xpBaselineRef.current?.totalXp ?? 0;
        const { sections, questionProgressMap, sectionProgressMap } = latestXpStateRef.current;
        const afterQuestionProgressMap = new Map(questionProgressMap);
        const afterSectionProgressMap = new Map(sectionProgressMap);
        if (activeSectionId) {
            const updatedProgress = applyTypingRankToProgress(
                activeSectionId,
                afterSectionProgressMap.get(activeSectionId),
                activeMode,
                score.rank
            );
            afterSectionProgressMap.set(activeSectionId, updatedProgress);
        }
        if (launchState.missionOption && missionProgressQuestionId && !missionAlreadyCompleted) {
            afterQuestionProgressMap.set(missionProgressQuestionId, {
                questionId: missionProgressQuestionId,
                attemptsCount: 1,
                correctCount: 1,
                missCount: 0,
                clearedMode: 0,
                lastPlayedAt: new Date().toISOString(),
            });
        }
        const currentPlayCount = Math.max(0, questionProgressMap.get(PLAY_PROGRESS_KEY)?.attemptsCount ?? 0);
        afterQuestionProgressMap.set(PLAY_PROGRESS_KEY, {
            questionId: PLAY_PROGRESS_KEY,
            attemptsCount: currentPlayCount + 1,
            correctCount: currentPlayCount + 1,
            missCount: 0,
            clearedMode: 0,
            lastPlayedAt: new Date().toISOString(),
        });
        if (shuffleMode) {
            const currentShuffleCount = Math.max(0, questionProgressMap.get(SHUFFLE_PROGRESS_KEY)?.attemptsCount ?? 0);
            afterQuestionProgressMap.set(SHUFFLE_PROGRESS_KEY, {
                questionId: SHUFFLE_PROGRESS_KEY,
                attemptsCount: currentShuffleCount + 1,
                correctCount: currentShuffleCount + 1,
                missCount: 0,
                clearedMode: 0,
                lastPlayedAt: new Date().toISOString(),
            });
        }
        const afterAttemptedQuestionIds = buildAttemptedQuestionIds(afterQuestionProgressMap);
        const afterTotalXp =
            computeTotalXp(sections, afterAttemptedQuestionIds, afterSectionProgressMap) +
            computeMissionBonusXp(afterQuestionProgressMap) +
            computePlayBonusXp(afterQuestionProgressMap) +
            computeShuffleBonusXp(afterQuestionProgressMap);
        const didLevelUp = computeLevelInfo(afterTotalXp).level > computeLevelInfo(beforeTotalXp).level;
        if (isRankingChallenge) {
            const rankingBestKey = buildRankingBestProgressKey(rankingMonthKey, activeRankingLeagueId);
            const rankingPromotionKey = buildRankingPromotionCountProgressKey(rankingMonthKey, activeRankingLeagueId);
            const rankingBestBefore = rankingStateBefore.bestScores[activeRankingLeagueId] ?? 0;
            const rankingCountBefore = rankingStateBefore.promotionCounts[activeRankingLeagueId] ?? 0;
            const rankingBestAfter = Math.max(rankingBestBefore, score.totalScore);
            const reachedPromotionScore = rankingStateBefore.nextLeague !== null
                && rankingStateBefore.activeLeague.promotionScore !== null
                && score.totalScore >= rankingStateBefore.activeLeague.promotionScore;
            const rankingCountAfter = rankingCountBefore + (reachedPromotionScore ? 1 : 0);
            const rankingBestScoresAfter = withUpdatedRankingBestScore(
                rankingStateBefore.bestScores,
                activeRankingLeagueId,
                rankingBestAfter
            );
            const rankingPromotionCountsAfter = withIncrementedPromotionCount(
                rankingStateBefore.promotionCounts,
                activeRankingLeagueId,
                reachedPromotionScore ? 1 : 0
            );
            const rankingStateAfter = buildMonthlyRankingState(
                rankingConfig,
                rankingBestScoresAfter,
                rankingPromotionCountsAfter
            );
            const promotedTo = rankingStateAfter.activeLeagueIndex > rankingStateBefore.activeLeagueIndex
                ? rankingStateAfter.activeLeague.label
                : null;
            const promotedLeagueId = rankingStateAfter.activeLeagueIndex > rankingStateBefore.activeLeagueIndex
                ? rankingStateAfter.activeLeague.id
                : null;
            const promotedMode = rankingStateAfter.activeLeagueIndex > rankingStateBefore.activeLeagueIndex
                ? rankingStateAfter.activeLeague.mode
                : null;

            afterQuestionProgressMap.set(rankingBestKey, {
                questionId: rankingBestKey,
                attemptsCount: Math.max(0, (questionProgressMap.get(rankingBestKey)?.attemptsCount ?? 0) + 1),
                correctCount: rankingBestAfter,
                missCount: 0,
                clearedMode: 0,
                lastPlayedAt: new Date().toISOString(),
            });
            afterQuestionProgressMap.set(rankingPromotionKey, {
                questionId: rankingPromotionKey,
                attemptsCount: Math.max(0, (questionProgressMap.get(rankingPromotionKey)?.attemptsCount ?? 0) + 1),
                correctCount: rankingCountAfter,
                missCount: 0,
                clearedMode: 0,
                lastPlayedAt: new Date().toISOString(),
            });
            setRankingResult({
                leagueLabel: rankingStateAfter.activeLeague.label,
                bestScore: rankingBestAfter,
                previousBestScore: rankingBestBefore,
                promotionCount: rankingStateAfter.currentPromotionCount,
                promotionRequired: RANKING_PROMOTION_REQUIRED_COUNT,
                pointsToNextLeague: rankingStateAfter.pointsToNextLeague,
                hasNextLeague: rankingStateAfter.nextLeague !== null,
                rank: null,
                rankTotal: 0,
                promotedTo,
                promotedLeagueId,
                promotedMode,
            });
            if (currentUser?.id) {
                void (async () => {
                    try {
                        await upsertMonthlyRankingBoardEntry({
                            monthKey: rankingMonthKey,
                            uid: currentUser.id,
                            displayName: currentUser.name || 'ゲスト',
                            activeLeague: rankingStateAfter.activeLeague.id,
                            bestScores: rankingBestScoresAfter,
                            promotionCounts: rankingPromotionCountsAfter,
                        });
                        const snapshot = await fetchMonthlyRankingLeagueSnapshot({
                            monthKey: rankingMonthKey,
                            leagueId: rankingStateAfter.activeLeague.id,
                            uid: currentUser.id,
                        });
                        setRankingResult((prev) => {
                            if (!prev) return prev;
                            return {
                                ...prev,
                                rank: snapshot.rank,
                                rankTotal: snapshot.total,
                                leagueLabel: rankingStateAfter.activeLeague.label,
                            };
                        });
                    } catch (error) {
                        console.error('Failed to sync monthly ranking board:', error);
                    }
                })();
            }
        } else {
            setRankingResult(null);
        }

        updateProgress(PLAY_PROGRESS_KEY, {
            attemptsCount: 1,
            correctCount: 1,
            missCount: 0,
            clearedMode: 0,
        });
        if (shuffleMode) {
            updateProgress(SHUFFLE_PROGRESS_KEY, {
                attemptsCount: 1,
                correctCount: 1,
                missCount: 0,
                clearedMode: 0,
            });
        }

        if (launchState.missionOption && missionProgressQuestionId && !missionAlreadyCompleted) {
            updateProgress(missionProgressQuestionId, {
                attemptsCount: 1,
                correctCount: 1,
                missCount: 0,
                clearedMode: 0,
            });
        }
        if (isRankingChallenge) {
            const rankingBestBefore = rankingStateBefore.bestScores[activeRankingLeagueId] ?? 0;
            const rankingBestAfter = Math.max(rankingBestBefore, score.totalScore);
            const rankingBestDelta = Math.max(0, rankingBestAfter - rankingBestBefore);
            const rankingBestKey = buildRankingBestProgressKey(rankingMonthKey, activeRankingLeagueId);
            const rankingPromotionKey = buildRankingPromotionCountProgressKey(rankingMonthKey, activeRankingLeagueId);
            const reachedPromotionScore = rankingStateBefore.nextLeague !== null
                && rankingStateBefore.activeLeague.promotionScore !== null
                && score.totalScore >= rankingStateBefore.activeLeague.promotionScore;
            updateProgress(rankingBestKey, {
                attemptsCount: 1,
                correctCount: rankingBestDelta,
                missCount: 0,
                clearedMode: 0,
            });
            updateProgress(rankingPromotionKey, {
                attemptsCount: 1,
                correctCount: reachedPromotionScore ? 1 : 0,
                missCount: 0,
                clearedMode: 0,
            });
        }

        const totalTimeMs = (timeLimit - timeLeft) * 1000;
        const totalCorrectChars = Math.max(0, totalChars - totalMiss);
        const wpm = totalTimeMs > 0 ? Math.round((totalCorrectChars / 5) / (totalTimeMs / 60000)) : 0;
        logEvent({
            eventType: 'session_ended',
            userId: currentUser?.id ?? null,
            payload: {
                sessionId: sessionIdRef.current,
                mode: 'typing',
                totalQuestions: questions.length,
                totalMiss,
                totalChars,
                totalCorrectChars,
                totalTimeMs,
                accuracy,
                wpm,
                rank: score.rank,
                rankingChallenge: isRankingChallenge,
                rankingMonthKey: isRankingChallenge ? rankingMonthKey : undefined,
                rankingLeagueId: isRankingChallenge ? activeRankingLeagueId : undefined,
            },
        }).catch(() => {});

        if (currentUser?.id) {
            void (async () => {
                const resolvedUnitId = activeUnitId
                    ?? currentCourse?.units.find((unit) => unit.parts.some((part) => part.id === activePartId))?.id;
                const sectionMeta: SectionMeta | undefined = activeCourseId && activePartId && activeSectionId
                    ? {
                        courseId: activeCourseId,
                        unitId: resolvedUnitId,
                        partId: activePartId,
                        sectionId: activeSectionId,
                        label: selectedSectionLabel || activeSectionId,
                        mode: 'typing' as const,
                    }
                    : undefined;

            const sessionSummary: SessionSummary = {
                sessionId: sessionIdRef.current,
                mode: 'typing',
                accuracy,
                wpm,
                missCount: totalMiss,
                totalTimeMs,
                rank: score.rank,
                sectionId: activeSectionId ?? undefined,
                partId: activePartId ?? undefined,
                courseId: activeCourseId ?? undefined,
                missionOption: launchState.missionOption,
                playedAt: new Date().toISOString(),
            };

                recordSessionSummary(currentUser.id, sessionSummary, sectionMeta).catch((error) => {
                    console.error('Failed to record typing session summary:', error);
                });

                const progressTotals = buildUserProgressTotals(state.userProgress, currentUser.id);
                const sectionTotals = buildSectionProgressTotals(state.sectionProgress, currentUser.id);
                const totalSectionsCount = await getTotalSectionsCount();
                recordProgressSnapshot(currentUser.id, {
                    ...progressTotals,
                    clearedSectionsCount: sectionTotals.clearedSectionsCount,
                    totalSectionsCount,
                    lastMode: 'typing',
                    lastActiveAt: new Date().toISOString(),
                    lastSectionId: activeSectionId ?? undefined,
                    lastSectionLabel: selectedSectionLabel ?? activeSectionId ?? undefined,
                    lastCourseId: activeCourseId ?? undefined,
                    lastUnitId: activeUnitId ?? undefined,
                    lastPartId: activePartId ?? undefined,
                }).catch((error) => {
                    console.error('Failed to record typing progress snapshot:', error);
                });
            })();
        }

        completeSectionSession();

        if (didLevelUp) {
            playSound('fanfare');
        } else if (score.rank === 'S') {
            playSound('fanfare');
        } else if (score.rank === 'A' || score.rank === 'B') {
            playSound('success');
        } else {
            playSound('try-again');
        }
    };

    const handleRetry = () => {
        if (isRankingChallenge) {
            if (rankingResult?.promotedLeagueId && rankingResult.promotedMode) {
                navigate('/play', {
                    state: {
                        ...launchState,
                        courseId: activeCourseId ?? rankingConfig.courseId,
                        mode: rankingResult.promotedMode,
                        rankingLeagueId: rankingResult.promotedLeagueId,
                        rankingQuestionCount,
                        rankingMonthKey,
                        rankingTheme,
                        rankingCourseName,
                        rankingChallenge: true,
                        returnTo: returnToPath,
                    },
                    replace: true,
                });
                return;
            }
            setRankingQuestionSeed((prev) => prev + 1);
            return;
        }
        sessionIdRef.current = `typing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        setCurrentIndex(0);
        setQuestionIndex(0);
        setIsFinished(false);
        setSessionResults([]);
        setScoreResult(null);
        setShowExitConfirm(false);
        setAnimatedXpBar(0);
        setShowLevelUpFx(false);
        setRankingResult(null);
        xpAnimatedSessionRef.current = null;
        setTimeUp(false);
        setTimeLeft(timeLimit);

        const { sections, questionProgressMap, sectionProgressMap } = latestXpStateRef.current;
        const attemptedQuestionIds = buildAttemptedQuestionIds(questionProgressMap);
        const baselineBaseXp = computeTotalXp(sections, attemptedQuestionIds, sectionProgressMap);
        const baselineMissionXp = computeMissionBonusXp(questionProgressMap);
        const baselinePlayBonusXp = computePlayBonusXp(questionProgressMap);
        const baselineShuffleBonusXp = computeShuffleBonusXp(questionProgressMap);
        const baselineTotalXp = baselineBaseXp + baselineMissionXp + baselinePlayBonusXp + baselineShuffleBonusXp;
        xpBaselineRef.current = {
            baseXp: baselineBaseXp,
            missionXp: baselineMissionXp,
            playBonusXp: baselinePlayBonusXp,
            shuffleBonusXp: baselineShuffleBonusXp,
            totalXp: baselineTotalXp,
        };

        startCountdown(3);
        beginSectionSession();

        logEvent({
            eventType: 'session_started',
            userId: currentUser?.id ?? null,
            payload: {
                sessionId: sessionIdRef.current,
                mode: 'typing',
                questionCount: questions.length,
                startedAt: new Date().toISOString(),
                source: 'retry',
                rankingChallenge: isRankingChallenge,
                rankingMonthKey: isRankingChallenge ? rankingMonthKey : undefined,
                rankingLeagueId: isRankingChallenge ? activeRankingLeagueId : undefined,
            },
        }).catch(() => {});
    };

    const handleBack = () => {
        if (isFinished) {
            navigate(returnToPath);
            return;
        }
        setShowExitConfirm(true);
    };

    const handleCancelExit = () => {
        setShowExitConfirm(false);
    };

    const handleConfirmExit = () => {
        setShowExitConfirm(false);
        abortSectionSession();
        navigate(returnToPath);
    };

    const getFingerIdForChar = (char: string | null) => {
        if (!char) return null;
        const key = char.toLowerCase();
        if (key === ' ') return 'thumb';
        if ("`~1!qaz".includes(key)) return 'left-pinky';
        if ("2@wsx".includes(key)) return 'left-ring';
        if ("3#edc".includes(key)) return 'left-middle';
        if ("4$5%rtfgvb".includes(key)) return 'left-index';
        if ("6^7&yhnujm".includes(key)) return 'right-index';
        if ("8*ik,<".includes(key)) return 'right-middle';
        if ("9(ol.>".includes(key)) return 'right-ring';
        if ("0)-p;:/?[]'\\\"".includes(key)) return 'right-pinky';
        return 'right-pinky';
    };

    const activeFingerId = activeMode === 1 ? getFingerIdForChar(currentChar) : null;
    const getKeyIdForChar = (char: string | null) => {
        if (!char) return null;
        const key = char.toLowerCase();
        if (key === ' ') return 'space';
        if (key >= 'a' && key <= 'z') return key.toUpperCase();
        const map: Record<string, string> = {
            '1': '1',
            '2': '2',
            '3': '3',
            '4': '4',
            '5': '5',
            '6': '6',
            '7': '7',
            '8': '8',
            '9': '9',
            '0': '0',
            '-': '-',
            '@': '@',
            '.': '.',
            ',': ',',
            '/': '/',
            ';': ';',
        };
        return map[key] ?? null;
    };

    const activeKeyId = activeMode === 1 ? getKeyIdForChar(currentChar) : null;
    const getFingerIdForKeyLabel = (label: string) => {
        if (label === 'space') return 'thumb';
        if ("`~1!QAZ".includes(label)) return 'left-pinky';
        if ("2@WSX".includes(label)) return 'left-ring';
        if ("3#EDC".includes(label)) return 'left-middle';
        if ("4$5%RTFGVB".includes(label)) return 'left-index';
        if ("6^7&YHNUJM".includes(label)) return 'right-index';
        if ("8*IK,<".includes(label)) return 'right-middle';
        if ("9(OL.>".includes(label)) return 'right-ring';
        if ("0)-P;:/?[]@".includes(label)) return 'right-pinky';
        return null;
    };
    const fingerItems = [
        { id: 'left-pinky', label: '左小指' },
        { id: 'left-ring', label: '左薬指' },
        { id: 'left-middle', label: '左中指' },
        { id: 'left-index', label: '左人差指' },
        { id: 'thumb', label: '親指(スペース)' },
        { id: 'right-index', label: '右人差指' },
        { id: 'right-middle', label: '右中指' },
        { id: 'right-ring', label: '右薬指' },
        { id: 'right-pinky', label: '右小指' },
    ];

    const { unitLabel: selectedUnitLabel, partLabel: selectedPartLabelText, sectionLabel: selectedSectionLabel } =
        useSelectedLabels(currentCourse, activeUnitId, activePartId, activeSectionId);

    const selectedCourseLabel = currentCourse?.name || activeCourseId || '';
    const contextMetaText = isRankingChallenge
        ? `${rankingCourseName} / 本番 / ${rankingTheme} / ${rankingStateBefore.activeLeague.label} / Level${activeMode}`
        : [selectedCourseLabel, selectedUnitLabel, selectedPartLabelText, selectedSectionLabel, `Level${activeMode}`]
            .filter((item) => item && item.trim().length > 0)
            .join(' / ');

    // 完了画面
    if (isFinished) {
        const totalMiss = sessionResults.reduce((acc, cur) => acc + cur.missCount, 0);
        const totalChars = questions.reduce((acc, q) => acc + q.answerEn.length, 0); // 概算
        // 厳密な正答率計算: (総文字数) / (総文字数 + 総ミス)
        const accuracy = totalChars > 0
            ? Math.round((totalChars / (totalChars + totalMiss)) * 100)
            : 0;

        if (!finalScore) return null;
        const isRankingResult = isRankingChallenge;
        const isCleared = isAdvanceRank(finalScore.rank);
        const resultMessage = isRankingResult
            ? `${rankingStateBefore.activeLeague.label}リーグの自己ベスト更新に挑戦！`
            : isCleared
            ? (activeMode === 3
                ? '最高！次のセクションに進もう！'
                : '目標達成！次のモードが解放されました！')
            : getRankMessage(finalScore.rank);
        const sectionFlow = (currentCourse?.units ?? []).flatMap((unit) =>
            unit.parts.flatMap((part) =>
                part.sections.map((section) => ({
                    unitId: unit.id,
                    partId: part.id,
                    sectionId: section.id,
                }))
            )
        );
        const currentFlowIndex = sectionFlow.findIndex(
            (item) => item.partId === activePartId && item.sectionId === activeSectionId
        );
        const nextSectionTarget = currentFlowIndex >= 0 ? (sectionFlow[currentFlowIndex + 1] ?? null) : null;
        const canGoNext = !isRankingResult && isCleared && (activeMode < 3 || Boolean(nextSectionTarget));
        const canGoPrevious = !isRankingResult && !isCleared && activeMode > 1;
        const retryVariant: 'primary' | 'secondary' = (canGoNext || canGoPrevious) ? 'secondary' : 'primary';
        const nextButtonLabel = activeMode < 3 ? '次のレベルへ' : '次のセクションへ';
        const missionBonusEarned = (xpSummary?.gainedMissionXp ?? 0) > 0;

        const handleGoNext = () => {
            if (!isCleared) return;
            setStudyMode('typing');

            if (activeMode < 3 && activeCourseId && activePartId && activeSectionId) {
                const nextMode = (activeMode + 1) as LearningMode;
                setCourse(activeCourseId);
                setUnit(activeUnitId ?? null);
                setPart(activePartId);
                setSection(activeSectionId);
                setMode(nextMode);
                navigate('/play', {
                    state: {
                        courseId: activeCourseId,
                        unitId: activeUnitId,
                        partId: activePartId,
                        sectionId: activeSectionId,
                        mode: nextMode,
                        returnTo: returnToPath,
                    },
                });
                return;
            }

            if (activeMode === 3 && nextSectionTarget && activeCourseId) {
                setCourse(activeCourseId);
                setUnit(nextSectionTarget.unitId);
                setPart(nextSectionTarget.partId);
                setSection(nextSectionTarget.sectionId);
                setMode(1);
                navigate('/play', {
                    state: {
                        courseId: activeCourseId,
                        unitId: nextSectionTarget.unitId,
                        partId: nextSectionTarget.partId,
                        sectionId: nextSectionTarget.sectionId,
                        mode: 1,
                        returnTo: returnToPath,
                    },
                });
            }
        };
        const handleGoPrevious = () => {
            if (!canGoPrevious || !activeCourseId || !activePartId || !activeSectionId) return;
            const previousMode = (activeMode - 1) as LearningMode;
            setStudyMode('typing');
            setCourse(activeCourseId);
            setUnit(activeUnitId ?? null);
            setPart(activePartId);
            setSection(activeSectionId);
            setMode(previousMode);
            navigate('/play', {
                state: {
                    courseId: activeCourseId,
                    unitId: activeUnitId,
                    partId: activePartId,
                    sectionId: activeSectionId,
                    mode: previousMode,
                    returnTo: returnToPath,
                },
            });
        };

        return (
            <div className={styles.page}>
                <Header
                    title="結果発表"
                    metaText={contextMetaText}
                    showUserSelect={false}
                    showBackButton
                    onBack={handleBack}
                />
                <main className={styles.resultMain}>
                    {finalScore.rank === 'S' && (
                        <Confetti
                            count={30}
                            wrapperClassName={styles.confettiWrapper}
                            itemClassName={styles.confetti}
                        />
                    )}
                    {showLevelUpFx && (
                        <div className={styles.levelUpFx}>
                            LEVEL UP!
                        </div>
                    )}
                    <Card className={styles.resultCard} padding="lg">
                        <h2 className={styles.resultTitle}>
                            {finalScore.rank === 'S' ? '🎉 Excellent! 🎉' : 'Good Job!'}
                        </h2>
                        <div className={styles.stats}>
                            <div className={styles.statItem}>
                                <span className={styles.statLabel}>ランク</span>
                                <span className={`${styles.statValue} ${finalScore.rank === 'S' ? styles.success : ''}`}>
                                    {finalScore.rank}
                                </span>
                            </div>
                            <div className={styles.statItem}>
                                <span className={styles.statLabel}>正答率</span>
                                <span className={`${styles.statValue} ${isCleared ? styles.success : ''}`}>
                                    {accuracy}%
                                </span>
                            </div>
                            <div className={styles.statItem}>
                                <span className={styles.statLabel}>ミス回数</span>
                                <span className={styles.statValue}>{totalMiss}回</span>
                            </div>
                            <div className={styles.statItem}>
                                <span className={styles.statLabel}>スコア</span>
                                <span className={styles.statValue}>{finalScore.totalScore}</span>
                            </div>
                        </div>

                        <div className={styles.message}>
                            {resultMessage}
                        </div>
                        {isRankingChallenge && rankingResult && (
                            <div className={styles.rankingSummaryCard}>
                                <div className={styles.rankingSummaryHead}>
                                    <span>{rankingResult.leagueLabel}リーグ</span>
                                    <strong>今回 {finalScore.totalScore}点</strong>
                                </div>
                                <div className={styles.rankingSummaryMeta}>
                                    <span>BEST {rankingResult.bestScore}点</span>
                                    <span>前回BEST {rankingResult.previousBestScore}点</span>
                                    <span>
                                        順位 {rankingResult.rank ? `${rankingResult.rank}位` : '--'}
                                        {rankingResult.rankTotal > 0 ? ` / ${rankingResult.rankTotal}人` : ''}
                                    </span>
                                    <span>
                                        {rankingResult.hasNextLeague
                                            ? `昇格進捗 ${rankingResult.promotionCount}/${rankingResult.promotionRequired}`
                                            : '最高リーグ到達'}
                                    </span>
                                </div>
                                {rankingResult.promotedTo && (
                                    <div className={styles.rankingPromotedBadge}>
                                        昇格！ {rankingResult.promotedTo}リーグに到達
                                    </div>
                                )}
                                <div className={styles.rankingTitleRow}>
                                    {rankingResult.hasNextLeague
                                        ? `次リーグまであと ${rankingResult.pointsToNextLeague} 点`
                                        : '現在の最高リーグ'}
                                </div>
                            </div>
                        )}
                        {missionBonusEarned && (
                            <div className={styles.missionBonusBadge}>ミッション完了 +{xpSummary?.gainedMissionXp}XP</div>
                        )}

                        {xpSummary && (
                            <div className={styles.xpSummaryCard}>
                                <div className={styles.xpSummaryHead}>
                                    <span>今回の獲得XP</span>
                                    <strong>+{xpSummary.gainedXp}</strong>
                                </div>
                                <div className={styles.xpSummaryBreakdown}>
                                    <span>学習達成 +{xpSummary.gainedBaseXp} XP</span>
                                    {xpSummary.gainedMissionXp > 0 && (
                                        <span>ミッション達成 +{xpSummary.gainedMissionXp} XP</span>
                                    )}
                                    <span>プレイ完了 +{xpSummary.gainedPlayXp} XP</span>
                                    {xpSummary.gainedShuffleXp > 0 && (
                                        <span>ランダム挑戦 +{xpSummary.gainedShuffleXp} XP</span>
                                    )}
                                </div>
                                <div className={styles.xpSummaryLevel}>
                                    <span>Lv. {xpSummary.afterLevel}</span>
                                    <span>合計 {xpSummary.afterTotalXp} XP</span>
                                </div>
                                <div className={styles.xpTrack}>
                                    <span className={styles.xpTrackFill} style={{ width: `${animatedXpBar}%` }} />
                                </div>
                                <div className={styles.xpSummaryNext}>
                                    次のレベルまで {xpSummary.nextLevelRemaining} XP
                                </div>
                            </div>
                        )}

                        <div className={styles.actions}>
                            {canGoPrevious && (
                                <Button onClick={handleGoPrevious} variant="primary" size="lg">
                                    前のレベルへ
                                </Button>
                            )}
                            <Button onClick={handleRetry} variant={retryVariant} size="lg">
                                {isRankingChallenge ? 'ランキングに再挑戦' : 'もう一度'}
                            </Button>
                            {canGoNext && (
                                <Button onClick={handleGoNext} variant="primary" size="lg">
                                    {nextButtonLabel}
                                </Button>
                            )}
                            <Button
                                onClick={() => {
                                    if (isRankingChallenge) {
                                        setCourse(rankingConfig.courseId);
                                    }
                                    navigate('/course');
                                }}
                                variant="secondary"
                                size="lg"
                            >
                                {isRankingChallenge ? 'ランキング練習へ' : 'コース選択へ'}
                            </Button>
                            <Button onClick={() => navigate('/dashboard')} variant="secondary" size="lg">
                                トップへ
                            </Button>
                        </div>
                    </Card>
                </main>
            </div>
        );
    }

    // プレイ画面
    return (
        <div className={styles.page}>
            <GameHeader
                current={currentIndex + 1}
                total={questions.length}
                userName={currentUser?.name}
                onBack={handleBack}
                metaText={contextMetaText}
                timeLeft={timeLeft}
                timeLimit={timeLimit}
                dangerThreshold={10}
                timerMaxWidth={600}
            />

            <main className={styles.playMain}>
                {/* 問題番号ナビゲーション (オプション) */}
                {currentQuestion ? (
                    <div className={styles.questionArea}>
                        <QuestionDisplay
                            question={currentQuestion}
                            mode={activeMode}
                            autoPlayAudio={state.autoPlayAudio && !isCountingDown}
                            showEnglish={false}
                            showModeIndicator={false}
                            inputSlot={
                                <TypingInput
                                    answer={currentQuestion.answerEn}
                                    onComplete={handleQuestionComplete}
                                    onKeyResult={(isCorrect) => playSound(isCorrect ? 'type' : 'error')}
                                    onCurrentCharChange={setCurrentChar}
                                    disabled={isCountingDown || timeUp}
                                    showHint={activeMode === 1}
                                />
                            }
                        />

                        <div className={styles.inputArea}>
                            {activeMode === 1 && (
                                <div className={styles.keyboardGuide} aria-live="polite">
                                    <div className={styles.keyboard}>
                                        {[
                                            ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
                                            ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
                                            ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';'],
                                            ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/'],
                                        ].map((row, rowIndex) => (
                                            <div key={rowIndex} className={styles.keyboardRow}>
                                                {row.map((key) => (
                                                    <div
                                                        key={key}
                                                        className={`${styles.key} ${styles[`key-${getFingerIdForKeyLabel(key)}`] || ''} ${activeKeyId === key ? styles.keyActive : ''}`}
                                                    >
                                                        {key}
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                        <div className={styles.keyboardRow}>
                                            <div className={`${styles.spaceBar} ${styles['key-thumb']} ${activeKeyId === 'space' ? styles.spaceActive : ''}`}>
                                                space
                                            </div>
                                        </div>
                                    </div>
                                    <div className={styles.fingerRow}>
                                        {fingerItems.map((finger) => (
                                            <div
                                                key={finger.id}
                                                className={`${styles.fingerItem} ${styles[finger.id]} ${activeFingerId === finger.id ? styles.activeFinger : ''}`}
                                            >
                                                <span className={styles.fingerDot} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div>Loading...</div>
                )}
            </main>

            {/* キーボードガイド（画像表示） */}
            <footer className={styles.footer}>
                {/* 必要であればここにKeyboardGuideコンポーネントを配置 */}
                {/* 今回は画像のみの指定だったので簡易実装も可だが、要件にあったのでスペース確保 */}
            </footer>

            {isCountingDown && countdown !== null && (
                <div className={styles.countdownOverlay} aria-live="polite">
                    <div className={styles.countdownNumber}>{countdown}</div>
                </div>
            )}
            {showExitConfirm && (
                <div className={styles.exitOverlay} role="dialog" aria-modal="true" aria-label="中断確認">
                    <div className={styles.exitDialog}>
                        <h3 className={styles.exitTitle}>学習を中断しますか？</h3>
                        <p className={styles.exitText}>このプレイの途中進捗は保存せずに終了します。</p>
                        <div className={styles.exitActions}>
                            <Button variant="secondary" size="md" onClick={handleCancelExit}>
                                学習を続ける
                            </Button>
                            <Button variant="primary" size="md" onClick={handleConfirmExit}>
                                中断して戻る
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default PlayPage;
