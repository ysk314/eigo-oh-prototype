// ================================
// Choice Page (4択)
// ================================

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Header } from '@/components/Header';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { AudioPlayer } from '@/components/AudioPlayer';
import { GameHeader } from '@/components/GameHeader';
import { Confetti } from '@/components/Confetti';
import { useCourseBundle } from '@/hooks/useCourseBundle';
import { buildScoreResult, ScoreResult } from '@/utils/score';
import { playSound } from '@/utils/sound';
import { getRankMessage } from '@/utils/result';
import { useCountdown } from '@/hooks/useCountdown';
import { logEvent } from '@/utils/analytics';
import { recordProgressSnapshot, recordSessionSummary, type SessionSummary, type SectionMeta } from '@/utils/dashboardStats';
import { buildSectionProgressTotals, buildUserProgressTotals, getTotalSectionsCount } from '@/utils/progressSummary';
import { getCourseTimeLimitMultiplier } from '@/utils/timer';
import { useSelectedLabels } from '@/hooks/useSelectedLabels';
import { ensureAllCoursesLoaded, getLoadedCourses } from '@/data/questions';
import type { ChoiceLevel, Course, Rank, SectionProgress, UserProgress } from '@/types';
import styles from './ChoicePage.module.css';

type ChoiceState = {
    options: string[];
    correct: string;
    prompt: string;
    maskOptions: boolean;
};

const MISSION_PROGRESS_PREFIX = 'mission:';
const MISSION_COMPLETE_XP = 50;
const PLAY_PROGRESS_KEY = 'play:completed';
const PLAY_COMPLETE_XP = 10;
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

type XpSection = {
    sectionId: string;
    questionIds: string[];
};

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

function buildAttemptedQuestionIds(progressMap: Map<string, UserProgress>): Set<string> {
    const attempted = new Set<string>();
    progressMap.forEach((progress, questionId) => {
        if ((progress.attemptsCount ?? 0) > 0) {
            attempted.add(questionId);
        }
    });
    return attempted;
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

function applyChoiceRankToProgress(
    sectionId: string,
    current: SectionProgress | undefined,
    level: ChoiceLevel,
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
    const rankKey = `choice${level}Rank` as 'choice1Rank' | 'choice2Rank' | 'choice3Rank' | 'choice4Rank';
    const currentRank = base[rankKey];
    const isBetter = !currentRank || rankOrder.indexOf(rank) < rankOrder.indexOf(currentRank);
    return {
        ...base,
        sectionId,
        [rankKey]: isBetter ? rank : currentRank,
    };
}

function getDateKeyLocal(date = new Date()): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function buildMissionProgressQuestionId(dateKey: string, optionId: string): string {
    return `${MISSION_PROGRESS_PREFIX}${dateKey}:${optionId}`;
}

function shuffle<T>(items: T[]): T[] {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function maskWord(word: string): string {
    return word
        .split(/(\s+)/)
        .map((segment) => {
            if (segment.trim() === '') return segment;
            const length = segment.length;
            if (length <= 1) {
                return `${segment}(${length})`;
            }
            const first = segment[0];
            const last = segment[length - 1];
            const middleLength = Math.max(1, length - 2);
            const middle = '_'.repeat(middleLength);
            return `${first}${middle}${last}(${length})`;
        })
        .join('');
}

function stripTags(text: string): string {
    return text.replace(/\[[^\]]+\]/g, '').trim();
}

function isTypingOnlyQuestion(question: { category?: string[] }): boolean {
    return question.category?.includes('typing-only') ?? false;
}

function hasChoiceLevelTag(question: { category?: string[] }): boolean {
    return question.category?.some((item) => /^choice-l[1234]$/.test(item)) ?? false;
}

function getChoiceLevelTag(level: ChoiceLevel): string {
    return `choice-l${level}`;
}

export function ChoicePage() {
    const navigate = useNavigate();
    const location = useLocation();
    const {
        state,
        setChoiceRank,
        updateProgress,
        setCourse,
        setUnit,
        setPart,
        setSection,
        setStudyMode,
        setChoiceLevel,
        beginSectionSession,
        completeSectionSession,
        abortSectionSession,
    } = useApp();
    const { selectedCourse, selectedPart, selectedSection, selectedChoiceLevel } = state;
    const launchState = (location.state ?? {}) as {
        courseId?: string;
        unitId?: string;
        partId?: string;
        sectionId?: string;
        level?: ChoiceLevel;
        missionOption?: string;
        returnTo?: string;
    };
    const activeCourseId = launchState.courseId ?? selectedCourse ?? null;
    const activeUnitId = launchState.unitId ?? state.selectedUnit ?? null;
    const activePartId = launchState.partId ?? selectedPart ?? null;
    const activeSectionId = launchState.sectionId ?? selectedSection ?? null;
    const activeChoiceLevel: ChoiceLevel = launchState.level ?? selectedChoiceLevel ?? 1;
    const returnToPath = launchState.returnTo === '/dashboard' ? '/dashboard' : '/course';
    const {
        course: currentCourse,
        questions: courseQuestions,
        loading: courseLoading,
    } = useCourseBundle(activeCourseId);

    const questions = useMemo(() => {
        if (!activePartId || !activeSectionId) return [];
        const sectionPool = courseQuestions.filter(
            (question) =>
                question.partId === activePartId &&
                question.section === activeSectionId &&
                !isTypingOnlyQuestion(question)
        );
        if (sectionPool.length === 0) return [];

        const levelTag = getChoiceLevelTag(activeChoiceLevel);
        const hasLevelSpecific = sectionPool.some((question) => hasChoiceLevelTag(question));
        if (!hasLevelSpecific) return sectionPool;

        const matched = sectionPool.filter((question) => question.category?.includes(levelTag));
        return matched.length > 0 ? matched : sectionPool;
    }, [activePartId, activeSectionId, activeChoiceLevel, courseQuestions]);

    const [currentIndex, setCurrentIndex] = useState(0);
    const [choiceState, setChoiceState] = useState<ChoiceState | null>(null);
    const [selected, setSelected] = useState<string | null>(null);
    const [lastWrong, setLastWrong] = useState<string | null>(null);
    const [correctCount, setCorrectCount] = useState(0);
    const [missCount, setMissCount] = useState(0);
    const [isFinished, setIsFinished] = useState(false);
    const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);
    const [timeLimit, setTimeLimit] = useState(0);
    const [timeLeft, setTimeLeft] = useState(0);
    const [timeUp, setTimeUp] = useState(false);
    const [loadedCourses, setLoadedCourses] = useState<Course[]>([]);
    const [animatedXpBar, setAnimatedXpBar] = useState(0);
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const timeUpRef = useRef(false);
    const sessionIdRef = useRef('');
    const initializedSessionKeyRef = useRef<string | null>(null);
    const xpBaselineRef = useRef<{
        baseXp: number;
        missionXp: number;
        playBonusXp: number;
        totalXp: number;
    } | null>(null);
    const xpAnimatedSessionRef = useRef<string | null>(null);
    const isFinishingRef = useRef(false);
    const { countdown, isCountingDown, start: startCountdown } = useCountdown(3, () => playSound('countdown'));

    const currentQuestion = questions[currentIndex];
    const sessionSetupKey = `${activeCourseId ?? ''}:${activePartId ?? ''}:${activeSectionId ?? ''}:${activeChoiceLevel}`;
    const currentUserId = state.currentUser?.id;
    const userQuestionProgressMapForXp = useMemo(
        () => extractUserQuestionProgressMap(state.userProgress, currentUserId),
        [state.userProgress, currentUserId]
    );
    const userSectionProgressMapForXp = useMemo(
        () => extractUserSectionProgressMap(state.sectionProgress, currentUserId),
        [state.sectionProgress, currentUserId]
    );
    const attemptedQuestionIdsForXp = useMemo(
        () => buildAttemptedQuestionIds(userQuestionProgressMapForXp),
        [userQuestionProgressMapForXp]
    );
    const allXpSections = useMemo(() => buildXpSections(loadedCourses), [loadedCourses]);
    const fallbackXpSections = useMemo(
        () => (currentCourse ? buildXpSections([currentCourse]) : []),
        [currentCourse]
    );
    const xpSectionsForCalc = allXpSections.length > 0 ? allXpSections : fallbackXpSections;

    useEffect(() => {
        let isMounted = true;
        ensureAllCoursesLoaded()
            .then(() => {
                if (!isMounted) return;
                setLoadedCourses(getLoadedCourses());
            })
            .catch((error) => {
                console.error('Failed to load course catalog for choice XP:', error);
            });
        return () => {
            isMounted = false;
        };
    }, []);

    const missionDateKey = useMemo(() => getDateKeyLocal(), []);
    const missionProgressQuestionId = useMemo(() => {
        if (!launchState.missionOption) return null;
        return buildMissionProgressQuestionId(missionDateKey, launchState.missionOption);
    }, [launchState.missionOption, missionDateKey]);
    const missionAlreadyCompleted = useMemo(() => {
        if (!launchState.missionOption) return false;
        return hasMissionCompletedForOption(userQuestionProgressMapForXp, missionDateKey, launchState.missionOption);
    }, [launchState.missionOption, userQuestionProgressMapForXp, missionDateKey]);

    useEffect(() => {
        if (courseLoading) return;
        if (!activePartId || !activeSectionId || questions.length === 0) {
            navigate('/course');
        }
    }, [activePartId, activeSectionId, questions, navigate, courseLoading]);

    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, []);

    useEffect(() => {
        if (questions.length === 0) return;
        if (initializedSessionKeyRef.current === sessionSetupKey) return;
        initializedSessionKeyRef.current = sessionSetupKey;
        const timeMultiplier = getCourseTimeLimitMultiplier(activeCourseId);
        const limit = Math.max(1, Math.floor(questions.length * 5 * timeMultiplier));
        sessionIdRef.current = `choice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        setCurrentIndex(0);
        setIsFinished(false);
        setTimeUp(false);
        setCorrectCount(0);
        setMissCount(0);
        setScoreResult(null);
        setAnimatedXpBar(0);
        setShowExitConfirm(false);
        xpAnimatedSessionRef.current = null;
        isFinishingRef.current = false;
        setTimeLimit(limit);
        setTimeLeft(limit);
        startCountdown(3);
        beginSectionSession();

        const baselineBaseXp = computeTotalXp(xpSectionsForCalc, attemptedQuestionIdsForXp, userSectionProgressMapForXp);
        const baselineMissionXp = computeMissionBonusXp(userQuestionProgressMapForXp);
        const baselinePlayBonusXp = computePlayBonusXp(userQuestionProgressMapForXp);
        const baselineTotalXp = baselineBaseXp + baselineMissionXp + baselinePlayBonusXp;
        xpBaselineRef.current = {
            baseXp: baselineBaseXp,
            missionXp: baselineMissionXp,
            playBonusXp: baselinePlayBonusXp,
            totalXp: baselineTotalXp,
        };

        logEvent({
            eventType: 'session_started',
            userId: state.currentUser?.id ?? null,
            payload: {
                sessionId: sessionIdRef.current,
                mode: 'choice',
                questionCount: questions.length,
                level: activeChoiceLevel,
                startedAt: new Date().toISOString(),
            },
        }).catch(() => {});
    }, [
        questions,
        sessionSetupKey,
        startCountdown,
        activeChoiceLevel,
        state.currentUser?.id,
        beginSectionSession,
        activeCourseId,
        xpSectionsForCalc,
        attemptedQuestionIdsForXp,
        userSectionProgressMapForXp,
        userQuestionProgressMapForXp,
    ]);

    const finishSession = useCallback(() => {
        if (isFinishingRef.current) return;
        isFinishingRef.current = true;
        setIsFinished(true);
        const total = correctCount + missCount;
        const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;
        const score = buildScoreResult({
            accuracy,
            timeLeft,
            timeLimit,
            isPerfect: missCount === 0,
        });
        setScoreResult(score);
        if (launchState.missionOption && missionProgressQuestionId && !missionAlreadyCompleted) {
            updateProgress(missionProgressQuestionId, {
                attemptsCount: 1,
                correctCount: 1,
                missCount: 0,
                clearedMode: 0,
            });
        }
        updateProgress(PLAY_PROGRESS_KEY, {
            attemptsCount: 1,
            correctCount: 1,
            missCount: 0,
            clearedMode: 0,
        });
        const totalTimeMs = (timeLimit - timeLeft) * 1000;
        const sectionLabel = activeSectionId && activePartId
            ? currentCourse?.units
                .flatMap((unit) => unit.parts)
                .find((part) => part.id === activePartId)
                ?.sections.find((item) => item.id === activeSectionId)
                ?.label
            : undefined;
        logEvent({
            eventType: 'session_ended',
            userId: state.currentUser?.id ?? null,
            payload: {
                sessionId: sessionIdRef.current,
                mode: 'choice',
                totalQuestions: questions.length,
                correctCount,
                missCount,
                totalTimeMs,
                accuracy,
                rank: score.rank,
                level: activeChoiceLevel,
            },
        }).catch(() => {});

        if (state.currentUser?.id) {
            const currentUserId = state.currentUser.id;
            const resolvedUnitId = activeUnitId
                ?? currentCourse?.units.find((unit) => unit.parts.some((part) => part.id === activePartId))?.id;
            const sectionMeta: SectionMeta | undefined = activeCourseId && activePartId && activeSectionId
                ? {
                    courseId: activeCourseId,
                    unitId: resolvedUnitId,
                    partId: activePartId,
                    sectionId: activeSectionId,
                    label: sectionLabel || activeSectionId,
                    mode: 'choice' as const,
                    level: activeChoiceLevel,
                }
                : undefined;

            const sessionSummary: SessionSummary = {
                sessionId: sessionIdRef.current,
                mode: 'choice',
                accuracy,
                missCount,
                totalTimeMs,
                rank: score.rank,
                level: activeChoiceLevel,
                sectionId: activeSectionId ?? undefined,
                partId: activePartId ?? undefined,
                courseId: activeCourseId ?? undefined,
                missionOption: launchState.missionOption,
                playedAt: new Date().toISOString(),
            };

            recordSessionSummary(currentUserId, sessionSummary, sectionMeta).catch((error) => {
                console.error('Failed to record choice session summary:', error);
            });

            void (async () => {
                const progressTotals = buildUserProgressTotals(state.userProgress, currentUserId);
                const sectionTotals = buildSectionProgressTotals(state.sectionProgress, currentUserId);
                const totalSectionsCount = await getTotalSectionsCount();
                recordProgressSnapshot(currentUserId, {
                    ...progressTotals,
                    clearedSectionsCount: sectionTotals.clearedSectionsCount,
                    totalSectionsCount,
                    lastMode: 'choice',
                    lastActiveAt: new Date().toISOString(),
                    lastSectionId: activeSectionId ?? undefined,
                    lastSectionLabel: sectionLabel ?? activeSectionId ?? undefined,
                    lastCourseId: activeCourseId ?? undefined,
                    lastUnitId: activeUnitId ?? undefined,
                    lastPartId: activePartId ?? undefined,
                }).catch((error) => {
                    console.error('Failed to record choice progress snapshot:', error);
                });
            })();
        }

        completeSectionSession();

        if (score.rank === 'S') {
            playSound('fanfare');
        } else if (score.rank === 'A' || score.rank === 'B') {
            playSound('success');
        } else {
            playSound('try-again');
        }
        if (activeSectionId) {
            setChoiceRank(activeSectionId, activeChoiceLevel, score.rank);
        }
    }, [
        correctCount,
        missCount,
        timeLeft,
        timeLimit,
        questions.length,
        activeCourseId,
        activeUnitId,
        activePartId,
        activeSectionId,
        activeChoiceLevel,
        launchState.missionOption,
        missionProgressQuestionId,
        missionAlreadyCompleted,
        setChoiceRank,
        updateProgress,
        state.currentUser,
        state.sectionProgress,
        state.userProgress,
        currentCourse?.units,
        completeSectionSession,
    ]);

    const xpSummary = useMemo(() => {
        if (!isFinished || !scoreResult) return null;

        const baseBeforeXp = computeTotalXp(xpSectionsForCalc, attemptedQuestionIdsForXp, userSectionProgressMapForXp);
        const missionBeforeXp = xpBaselineRef.current?.missionXp ?? computeMissionBonusXp(userQuestionProgressMapForXp);
        const beforeBaseXp = xpBaselineRef.current?.baseXp ?? baseBeforeXp;
        const playBeforeXp = xpBaselineRef.current?.playBonusXp ?? computePlayBonusXp(userQuestionProgressMapForXp);
        const beforeTotalXp = xpBaselineRef.current?.totalXp ?? (beforeBaseXp + missionBeforeXp + playBeforeXp);
        const beforeLevelInfo = computeLevelInfo(beforeTotalXp);

        const afterQuestionProgressMap = new Map(userQuestionProgressMapForXp);
        const afterSectionProgressMap = new Map(userSectionProgressMapForXp);
        if (activeSectionId) {
            const updatedProgress = applyChoiceRankToProgress(
                activeSectionId,
                afterSectionProgressMap.get(activeSectionId),
                activeChoiceLevel,
                scoreResult.rank
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

        const afterAttemptedQuestionIds = buildAttemptedQuestionIds(afterQuestionProgressMap);
        const afterBaseXp = computeTotalXp(xpSectionsForCalc, afterAttemptedQuestionIds, afterSectionProgressMap);
        const afterMissionXp = computeMissionBonusXp(afterQuestionProgressMap);
        const afterPlayXp = computePlayBonusXp(afterQuestionProgressMap);
        const afterTotalXp = afterBaseXp + afterMissionXp + afterPlayXp;
        const afterLevelInfo = computeLevelInfo(afterTotalXp);

        return {
            beforeTotalXp,
            afterTotalXp,
            gainedXp: Math.max(0, afterTotalXp - beforeTotalXp),
            gainedBaseXp: Math.max(0, afterBaseXp - beforeBaseXp),
            gainedMissionXp: Math.max(0, afterMissionXp - missionBeforeXp),
            gainedPlayXp: Math.max(0, afterPlayXp - playBeforeXp),
            beforeLevel: beforeLevelInfo.level,
            beforeProgressPercent: beforeLevelInfo.progressPercent,
            afterLevel: afterLevelInfo.level,
            afterProgressPercent: afterLevelInfo.progressPercent,
            nextLevelRemaining: afterLevelInfo.nextLevelRemaining,
        };
    }, [
        isFinished,
        scoreResult,
        xpSectionsForCalc,
        attemptedQuestionIdsForXp,
        userQuestionProgressMapForXp,
        userSectionProgressMapForXp,
        activeSectionId,
        activeChoiceLevel,
        launchState.missionOption,
        missionProgressQuestionId,
        missionAlreadyCompleted,
    ]);

    useEffect(() => {
        if (!isFinished || !xpSummary) return;
        if (xpAnimatedSessionRef.current === sessionIdRef.current) return;
        xpAnimatedSessionRef.current = sessionIdRef.current;

        setAnimatedXpBar(xpSummary.beforeLevel < xpSummary.afterLevel ? 0 : xpSummary.beforeProgressPercent);
        let raf1 = 0;
        let raf2 = 0;
        raf1 = window.requestAnimationFrame(() => {
            raf2 = window.requestAnimationFrame(() => {
                setAnimatedXpBar(xpSummary.afterProgressPercent);
            });
        });

        return () => {
            window.cancelAnimationFrame(raf1);
            window.cancelAnimationFrame(raf2);
        };
    }, [isFinished, xpSummary]);

    useEffect(() => {
        if (isCountingDown || isFinished || timeLimit === 0) return;
        if (timeLeft <= 0) {
            if (!timeUp) {
                setTimeUp(true);
                finishSession();
            }
            return;
        }

        const interval = setInterval(() => {
            setTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1));
        }, 1000);

        return () => clearInterval(interval);
    }, [isCountingDown, isFinished, timeLeft, timeLimit, timeUp, finishSession]);

    useEffect(() => {
        timeUpRef.current = timeUp;
    }, [timeUp]);

    useEffect(() => {
        if (!currentQuestion) return;

        const pos = currentQuestion.pos?.[0] ?? 'noun';
        const uniqueByAnswer = new Map<string, (typeof currentQuestion)>();
        questions.forEach((q) => {
            if (!uniqueByAnswer.has(q.answerEn)) {
                uniqueByAnswer.set(q.answerEn, q);
            }
        });

        const pool = Array.from(uniqueByAnswer.values());
        const samePos = pool.filter(
            (q) => q.id !== currentQuestion.id && q.pos?.includes(pos)
        );

        const isEnToJp = activeChoiceLevel === 1 || activeChoiceLevel === 3;
        const isMasked = activeChoiceLevel === 3 || activeChoiceLevel === 4;
        const prompt = isEnToJp ? currentQuestion.answerEn : stripTags(currentQuestion.promptJp);
        const shouldMaskPrompt = isEnToJp && isMasked;
        const promptText = shouldMaskPrompt ? maskWord(prompt) : prompt;
        const correctOption = isEnToJp ? stripTags(currentQuestion.promptJp) : currentQuestion.answerEn;
        const maskOptions = !isEnToJp && isMasked;

        const options: string[] = [];
        const displaySet = new Set<string>();

        const addOption = (answer: string) => {
            if (options.includes(answer)) return false;
            const display = maskOptions ? maskWord(answer) : answer;
            if (displaySet.has(display)) return false;
            options.push(answer);
            displaySet.add(display);
            return true;
        };

        addOption(correctOption);
        shuffle(samePos)
            .map((q) => (isEnToJp ? stripTags(q.promptJp) : q.answerEn))
            .forEach((answer) => {
                if (options.length >= 4) return;
                addOption(answer);
            });

        if (options.length < 4) {
            shuffle(pool)
                .map((q) => (isEnToJp ? stripTags(q.promptJp) : q.answerEn))
                .forEach((answer) => {
                    if (options.length >= 4) return;
                    addOption(answer);
                });
        }

        setChoiceState({
            options: shuffle(options),
            correct: correctOption,
            prompt: promptText,
            maskOptions,
        });
        setSelected(null);
    }, [currentQuestion, questions, activeChoiceLevel]);

    const handleChoice = useCallback((answer: string) => {
        if (isCountingDown) return;
        if (!choiceState || selected || isFinished) return;
        const isCorrect = answer === choiceState.correct;
        if (isCorrect) {
            playSound('success');
            setSelected(answer);
            setCorrectCount((prev) => prev + 1);
            if (currentQuestion) {
                updateProgress(currentQuestion.id, {
                    attemptsCount: 1,
                    correctCount: 1,
                    missCount: 0,
                    clearedMode: 0,
                });
            }
            window.setTimeout(() => {
                setSelected(null);
                if (currentIndex < questions.length - 1 && !timeUpRef.current) {
                    setCurrentIndex((prev) => prev + 1);
                    return;
                }
                finishSession();
            }, 400);
        } else {
            playSound('error');
            setMissCount((prev) => prev + 1);
            if (currentQuestion) {
                updateProgress(currentQuestion.id, {
                    attemptsCount: 1,
                    correctCount: 0,
                    missCount: 1,
                    clearedMode: 0,
                });
            }
            setLastWrong(answer);
            logEvent({
                eventType: 'question_answered',
                userId: state.currentUser?.id ?? null,
                payload: {
                    sessionId: sessionIdRef.current,
                    questionId: currentQuestion?.id ?? null,
                    missCount: 1,
                },
            }).catch(() => {});
            window.setTimeout(() => {
                setLastWrong(null);
            }, 300);
        }
    }, [choiceState, selected, isFinished, currentIndex, questions.length, isCountingDown, finishSession, currentQuestion, state.currentUser?.id, updateProgress]);

    useEffect(() => {
        if (!choiceState || isFinished) return;
        const handler = (event: KeyboardEvent) => {
            if (selected) return;
            const key = event.key;
            if (!['1', '2', '3', '4'].includes(key)) return;
            const index = Number(key) - 1;
            const option = choiceState.options[index];
            if (!option) return;
            event.preventDefault();
            handleChoice(option);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [choiceState, handleChoice, selected, isFinished]);

    const { unitLabel: selectedUnitLabel, partLabel: selectedPartLabelText, sectionLabel: selectedSectionLabel } =
        useSelectedLabels(currentCourse, activeUnitId, activePartId, activeSectionId);

    const shouldPlayAudio = activeChoiceLevel === 1;
    const selectedCourseLabel = currentCourse?.name || activeCourseId || '';
    const contextMetaText = `${selectedCourseLabel || '-'} / ${selectedUnitLabel || '-'} / ${selectedPartLabelText || '-'} / ${selectedSectionLabel || '-'} / Level${activeChoiceLevel}`;

    const handleBack = useCallback(() => {
        if (isFinished) {
            navigate(returnToPath);
            return;
        }
        setShowExitConfirm(true);
    }, [isFinished, navigate, returnToPath]);

    const handleCancelExit = () => {
        setShowExitConfirm(false);
    };

    const handleConfirmExit = () => {
        setShowExitConfirm(false);
        abortSectionSession();
        navigate(returnToPath);
    };

    const handleRetry = useCallback(() => {
        if (questions.length === 0) return;
        sessionIdRef.current = `choice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        setCurrentIndex(0);
        setIsFinished(false);
        setTimeUp(false);
        setCorrectCount(0);
        setMissCount(0);
        setScoreResult(null);
        setAnimatedXpBar(0);
        setShowExitConfirm(false);
        xpAnimatedSessionRef.current = null;
        isFinishingRef.current = false;
        setSelected(null);
        setLastWrong(null);
        setTimeLeft(timeLimit);
        startCountdown(3);
        beginSectionSession();
        const baselineBaseXp = computeTotalXp(xpSectionsForCalc, attemptedQuestionIdsForXp, userSectionProgressMapForXp);
        const baselineMissionXp = computeMissionBonusXp(userQuestionProgressMapForXp);
        const baselinePlayBonusXp = computePlayBonusXp(userQuestionProgressMapForXp);
        const baselineTotalXp = baselineBaseXp + baselineMissionXp + baselinePlayBonusXp;
        xpBaselineRef.current = {
            baseXp: baselineBaseXp,
            missionXp: baselineMissionXp,
            playBonusXp: baselinePlayBonusXp,
            totalXp: baselineTotalXp,
        };
    }, [
        questions.length,
        timeLimit,
        startCountdown,
        beginSectionSession,
        xpSectionsForCalc,
        attemptedQuestionIdsForXp,
        userSectionProgressMapForXp,
        userQuestionProgressMapForXp,
    ]);

    if (isFinished && scoreResult) {
        const total = correctCount + missCount;
        const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;
        const missionBonusEarned = (xpSummary?.gainedMissionXp ?? 0) > 0;
        const isCleared = isAdvanceRank(scoreResult.rank);
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
        const canGoNext = isCleared && (activeChoiceLevel < 4 || Boolean(nextSectionTarget));
        const canGoPrevious = !isCleared && activeChoiceLevel > 1;
        const retryVariant: 'primary' | 'secondary' = (canGoNext || canGoPrevious) ? 'secondary' : 'primary';
        const nextButtonLabel = activeChoiceLevel < 4 ? '次のレベルへ' : '次のセクションへ';

        const handleGoNext = () => {
            if (!canGoNext || !activeCourseId) return;
            setStudyMode('choice');
            if (activeChoiceLevel < 4 && activePartId && activeSectionId) {
                const nextLevel = (activeChoiceLevel + 1) as ChoiceLevel;
                setCourse(activeCourseId);
                setUnit(activeUnitId ?? null);
                setPart(activePartId);
                setSection(activeSectionId);
                setChoiceLevel(nextLevel);
                navigate('/choice', {
                    state: {
                        courseId: activeCourseId,
                        unitId: activeUnitId,
                        partId: activePartId,
                        sectionId: activeSectionId,
                        level: nextLevel,
                        returnTo: returnToPath,
                    },
                });
                return;
            }
            if (activeChoiceLevel === 4 && nextSectionTarget) {
                setCourse(activeCourseId);
                setUnit(nextSectionTarget.unitId);
                setPart(nextSectionTarget.partId);
                setSection(nextSectionTarget.sectionId);
                setChoiceLevel(1);
                navigate('/choice', {
                    state: {
                        courseId: activeCourseId,
                        unitId: nextSectionTarget.unitId,
                        partId: nextSectionTarget.partId,
                        sectionId: nextSectionTarget.sectionId,
                        level: 1,
                        returnTo: returnToPath,
                    },
                });
            }
        };

        const handleGoPrevious = () => {
            if (!canGoPrevious || !activeCourseId || !activePartId || !activeSectionId) return;
            const previousLevel = (activeChoiceLevel - 1) as ChoiceLevel;
            setStudyMode('choice');
            setCourse(activeCourseId);
            setUnit(activeUnitId ?? null);
            setPart(activePartId);
            setSection(activeSectionId);
            setChoiceLevel(previousLevel);
            navigate('/choice', {
                state: {
                    courseId: activeCourseId,
                    unitId: activeUnitId,
                    partId: activePartId,
                    sectionId: activeSectionId,
                    level: previousLevel,
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
                    {scoreResult.rank === 'S' && (
                        <Confetti
                            count={24}
                            wrapperClassName={styles.confettiWrapper}
                            itemClassName={styles.confetti}
                        />
                    )}
                    <Card className={styles.resultCard} padding="lg">
                        <h2 className={styles.resultTitle}>
                            {scoreResult.rank === 'S' ? '🎉 Excellent! 🎉' : 'Good Job!'}
                        </h2>
                        <div className={styles.stats}>
                            <div className={styles.statItem}>
                                <span className={styles.statLabel}>ランク</span>
                                <span className={`${styles.statValue} ${isCleared ? styles.success : ''}`}>{scoreResult.rank}</span>
                            </div>
                            <div className={styles.statItem}>
                                <span className={styles.statLabel}>正答率</span>
                                <span className={`${styles.statValue} ${isCleared ? styles.success : ''}`}>{accuracy}%</span>
                            </div>
                            <div className={styles.statItem}>
                                <span className={styles.statLabel}>ミス回数</span>
                                <span className={styles.statValue}>{missCount}回</span>
                            </div>
                            <div className={styles.statItem}>
                                <span className={styles.statLabel}>スコア</span>
                                <span className={styles.statValue}>{scoreResult.totalScore}</span>
                            </div>
                        </div>
                        <div className={styles.message}>
                            {getRankMessage(scoreResult.rank)}
                        </div>
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
                            <Button
                                onClick={handleRetry}
                                variant={retryVariant}
                                size="lg"
                            >
                                もう一度
                            </Button>
                            {canGoNext && (
                                <Button onClick={handleGoNext} variant="primary" size="lg">
                                    {nextButtonLabel}
                                </Button>
                            )}
                            <Button
                                onClick={() => navigate('/course')}
                                variant="secondary"
                                size="lg"
                            >
                                コース選択へ
                            </Button>
                            <Button
                                onClick={() => navigate('/dashboard')}
                                variant="secondary"
                                size="lg"
                            >
                                トップへ
                            </Button>
                        </div>
                    </Card>
                </main>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <GameHeader
                current={currentIndex + 1}
                total={questions.length}
                userName={state.currentUser?.name}
                onBack={handleBack}
                metaText={contextMetaText}
                timeLeft={timeLeft}
                timeLimit={timeLimit}
                timerMaxWidth={680}
            />
            <main className={styles.main}>
                <div className={styles.promptCard}>
                    <div className={styles.promptText}>{choiceState?.prompt}</div>
                    {shouldPlayAudio && currentQuestion && (
                        <div className={styles.audioRow}>
                            <AudioPlayer
                                text={currentQuestion.answerEn}
                                audioUrl={currentQuestion.audioUrl}
                                autoPlay={state.autoPlayAudio && !isCountingDown}
                                size="sm"
                                speakAsLetters={currentQuestion.course === 'Typing Foundation'}
                            />
                        </div>
                    )}
                </div>

                <div className={styles.choices}>
                    {choiceState?.options.map((option, index) => {
                        const isCorrect = selected && option === choiceState.correct;
                        const isWrong = lastWrong && option === lastWrong;
                        const displayText =
                            choiceState?.maskOptions ? maskWord(option) : option;
                        return (
                            <button
                                key={option}
                                className={`${styles.choiceButton} ${isCorrect ? styles.correct : ''} ${isWrong ? styles.wrong : ''}`}
                                onClick={() => handleChoice(option)}
                                disabled={!!selected}
                            >
                                <span className={styles.choiceIndex}>{index + 1}</span>
                                <span className={styles.choiceText}>{displayText}</span>
                            </button>
                        );
                    })}
                </div>
            </main>
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

export default ChoicePage;
