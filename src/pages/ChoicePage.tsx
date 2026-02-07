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
import { useSelectedLabels } from '@/hooks/useSelectedLabels';
import type { ChoiceLevel } from '@/types';
import styles from './ChoicePage.module.css';

type ChoiceState = {
    options: string[];
    correct: string;
    prompt: string;
    maskOptions: boolean;
};

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
            const visibleCount = segment.length <= 3 ? 1 : 2;
            const visible = segment.slice(0, visibleCount);
            const rest = '_'.repeat(Math.max(1, segment.length - visibleCount));
            return `${visible}${rest}`;
        })
        .join('');
}

function stripTags(text: string): string {
    return text.replace(/\[[^\]]+\]/g, '').trim();
}

export function ChoicePage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { state, setChoiceRank, beginSectionSession, completeSectionSession, abortSectionSession } = useApp();
    const { selectedCourse, selectedPart, selectedSection, selectedChoiceLevel } = state;
    const launchState = (location.state ?? {}) as {
        courseId?: string;
        unitId?: string;
        partId?: string;
        sectionId?: string;
        level?: ChoiceLevel;
    };
    const activeCourseId = selectedCourse ?? launchState.courseId ?? null;
    const activeUnitId = state.selectedUnit ?? launchState.unitId ?? null;
    const activePartId = selectedPart ?? launchState.partId ?? null;
    const activeSectionId = selectedSection ?? launchState.sectionId ?? null;
    const activeChoiceLevel: ChoiceLevel = selectedChoiceLevel ?? launchState.level ?? 1;
    const {
        course: currentCourse,
        questions: courseQuestions,
        loading: courseLoading,
    } = useCourseBundle(activeCourseId);

    const questions = useMemo(() => {
        if (!activePartId || !activeSectionId) return [];
        return courseQuestions.filter(
            (question) => question.partId === activePartId && question.section === activeSectionId
        );
    }, [activePartId, activeSectionId, courseQuestions]);

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
    const timeUpRef = useRef(false);
    const sessionIdRef = useRef('');
    const { countdown, isCountingDown, start: startCountdown } = useCountdown(3, () => playSound('countdown'));

    const currentQuestion = questions[currentIndex];

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
        if (state.studyMode === 'typing') {
            navigate('/play');
        }
    }, [state.studyMode, navigate]);

    useEffect(() => {
        if (questions.length === 0) return;
        const limit = Math.max(1, questions.length * 5);
        sessionIdRef.current = `choice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        setCurrentIndex(0);
        setIsFinished(false);
        setTimeUp(false);
        setCorrectCount(0);
        setMissCount(0);
        setScoreResult(null);
        setTimeLimit(limit);
        setTimeLeft(limit);
        startCountdown(3);
        beginSectionSession();

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
    }, [questions, startCountdown, activeChoiceLevel, state.currentUser?.id, beginSectionSession]);

    const finishSession = useCallback(() => {
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
            const sectionMeta: SectionMeta | undefined = activeCourseId && activeUnitId && activePartId && activeSectionId
                ? {
                    courseId: activeCourseId,
                    unitId: activeUnitId,
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
                playedAt: new Date().toISOString(),
            };

            recordSessionSummary(currentUserId, sessionSummary, sectionMeta).catch(() => {});

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
                }).catch(() => {});
            })();
        }

        completeSectionSession();

        playSound(score.rank === 'S' ? 'fanfare' : 'try-again');
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
        setChoiceRank,
        state.currentUser,
        state.sectionProgress,
        state.userProgress,
        currentCourse?.units,
        completeSectionSession,
    ]);

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
    }, [choiceState, selected, isFinished, currentIndex, questions.length, isCountingDown, finishSession, currentQuestion?.id, state.currentUser?.id]);

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

    const selectedLevelLabel = useMemo(() => {
        switch (activeChoiceLevel) {
            case 1:
                return '英語→日本語 1';
            case 2:
                return '日本語→英語 1';
            case 3:
                return '英語→日本語 2';
            case 4:
                return '日本語→英語 2';
            default:
                return '';
        }
    }, [activeChoiceLevel]);

    const shouldPlayAudio = activeChoiceLevel === 1;

    const handleBack = useCallback(() => {
        if (!isFinished) {
            const confirmLeave = window.confirm('中断してコース画面に戻りますか？');
            if (!confirmLeave) return;
        }
        abortSectionSession();
        navigate('/course');
    }, [isFinished, navigate, abortSectionSession]);

    const handleRetry = useCallback(() => {
        if (questions.length === 0) return;
        setCurrentIndex(0);
        setIsFinished(false);
        setTimeUp(false);
        setCorrectCount(0);
        setMissCount(0);
        setScoreResult(null);
        setSelected(null);
        setLastWrong(null);
        setTimeLeft(timeLimit);
        startCountdown(3);
        beginSectionSession();
    }, [questions.length, timeLimit, startCountdown, beginSectionSession]);

    if (isFinished && scoreResult) {
        const total = correctCount + missCount;
        const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;
        return (
            <div className={styles.page}>
                <Header
                    title="結果発表"
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
                            {scoreResult.rank === 'S' ? 'Perfect' : 'Good Job'}
                        </h2>
                        <div className={styles.resultMeta}>
                            <span>Unit: {selectedUnitLabel || '-'}</span>
                            <span>Part: {selectedPartLabelText || '-'}</span>
                            <span>Section: {selectedSectionLabel || '-'}</span>
                            <span>Level: {selectedLevelLabel || '-'}</span>
                        </div>
                        <div className={styles.stats}>
                            <div className={styles.statItem}>
                                <span className={styles.statLabel}>ランク</span>
                                <span className={styles.statValue}>{scoreResult.rank}</span>
                            </div>
                            <div className={styles.statItem}>
                                <span className={styles.statLabel}>正答率</span>
                                <span className={styles.statValue}>{accuracy}%</span>
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
                        <div className={styles.actions}>
                            <Button
                                onClick={handleRetry}
                                variant="secondary"
                                size="lg"
                            >
                                もう一度
                            </Button>
                            <Button
                                onClick={() => navigate('/course')}
                                variant="primary"
                                size="lg"
                            >
                                コースへ戻る
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
        </div>
    );
}

export default ChoicePage;
