// ================================
// Choice Page (4択)
// ================================

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Header } from '@/components/Header';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { AudioPlayer } from '@/components/AudioPlayer';
import { GameHeader } from '@/components/GameHeader';
import { TimerBar } from '@/components/TimerBar';
import { courses, getCourseById, getQuestionsBySection, getSectionsByPart } from '@/data/questions';
import { buildScoreResult, ScoreResult } from '@/utils/score';
import { calculateTimeLimit, calculateTotalChars } from '@/utils/timer';
import { playSound } from '@/utils/sound';
import { getRankMessage } from '@/utils/result';
import { useCountdown } from '@/hooks/useCountdown';
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
            const first = segment[0];
            const rest = '_'.repeat(Math.max(1, segment.length - 1));
            return `${first}${rest}`;
        })
        .join('');
}

function stripTags(text: string): string {
    return text.replace(/\[[^\]]+\]/g, '').trim();
}

export function ChoicePage() {
    const navigate = useNavigate();
    const { state, setChoiceRank } = useApp();
    const { selectedCourse, selectedPart, selectedSection, selectedChoiceLevel } = state;
    const currentCourse = getCourseById(selectedCourse) ?? courses[0];

    const questions = useMemo(() => {
        if (!selectedPart || !selectedSection) return [];
        return getQuestionsBySection(selectedPart, selectedSection, currentCourse?.id);
    }, [selectedPart, selectedSection, currentCourse?.id]);

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
    const { countdown, isCountingDown, start: startCountdown } = useCountdown(3, () => playSound('countdown'));

    const currentQuestion = questions[currentIndex];

    useEffect(() => {
        if (!selectedSection || questions.length === 0) {
            navigate('/course');
        }
    }, [selectedSection, questions, navigate]);

    useEffect(() => {
        const originalOverflow = document.body.style.overflow;
        if (!isFinished) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = originalOverflow;
        }
        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, [isFinished]);

    useEffect(() => {
        if (state.studyMode === 'typing') {
            navigate('/play');
        }
    }, [state.studyMode, navigate]);

    useEffect(() => {
        if (questions.length === 0) return;
        const totalChars = calculateTotalChars(questions);
        const limit = Math.max(1, Math.ceil(calculateTimeLimit(totalChars, 1, 10) / 3));
        setCurrentIndex(0);
        setIsFinished(false);
        setTimeUp(false);
        setCorrectCount(0);
        setMissCount(0);
        setScoreResult(null);
        setTimeLimit(limit);
        setTimeLeft(limit);
        startCountdown(3);
    }, [questions, startCountdown]);

    const finishSession = useCallback((timeUpFlag: boolean) => {
        setIsFinished(true);
        const score = buildScoreResult({
            missCount,
            timeLeft,
            timeLimit,
            timeUp: timeUpFlag,
        });
        setScoreResult(score);
        playSound(score.rank === 'S' ? 'fanfare' : 'try-again');
        if (selectedSection) {
            setChoiceRank(selectedSection, selectedChoiceLevel, score.rank);
        }
    }, [missCount, timeLeft, timeLimit, selectedSection, selectedChoiceLevel, setChoiceRank]);

    useEffect(() => {
        if (isCountingDown || isFinished || timeLimit === 0) return;
        if (timeLeft <= 0) {
            if (!timeUp) {
                setTimeUp(true);
                finishSession(true);
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

        const isEnToJp = selectedChoiceLevel === 1 || selectedChoiceLevel === 3;
        const isMasked = selectedChoiceLevel === 3 || selectedChoiceLevel === 4;
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
    }, [currentQuestion, questions, selectedChoiceLevel]);

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
                finishSession(timeUpRef.current);
            }, 400);
        } else {
            playSound('error');
            setMissCount((prev) => prev + 1);
            setLastWrong(answer);
            window.setTimeout(() => {
                setLastWrong(null);
            }, 300);
        }
    }, [choiceState, selected, isFinished, currentIndex, questions.length, isCountingDown, finishSession]);

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

    const selectedUnitLabel = useMemo(() => {
        if (!state.selectedUnit) return '';
        return currentCourse?.units.find((unit) => unit.id === state.selectedUnit)?.name || '';
    }, [state.selectedUnit, currentCourse?.id]);

    const selectedPartLabelText = useMemo(() => {
        if (!state.selectedPart) return '';
        const part = currentCourse?.units.flatMap((unit) => unit.parts).find((item) => item.id === state.selectedPart);
        return part?.label || '';
    }, [state.selectedPart, currentCourse?.id]);

    const selectedSectionLabel = useMemo(() => {
        if (!state.selectedPart || !state.selectedSection) return '';
        const section = getSectionsByPart(state.selectedPart, currentCourse?.id)
            .find((item) => item.id === state.selectedSection);
        return section?.label || '';
    }, [state.selectedPart, state.selectedSection, currentCourse?.id]);

    const selectedLevelLabel = useMemo(() => {
        switch (selectedChoiceLevel) {
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
    }, [selectedChoiceLevel]);

    const shouldPlayAudio = selectedChoiceLevel === 1;

    const handleBack = useCallback(() => {
        if (!isFinished) {
            const confirmLeave = window.confirm('中断してコース画面に戻りますか？');
            if (!confirmLeave) return;
        }
        navigate('/course');
    }, [isFinished, navigate]);

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
    }, [questions.length, timeLimit, startCountdown]);

    if (isFinished && scoreResult) {
        const total = correctCount + missCount;
        const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;
        return (
            <div className={styles.page}>
                <Header title="結果発表" showUserSelect={false} showBackButton onBack={handleBack} />
                <main className={styles.resultMain}>
                    {scoreResult.rank === 'S' && (
                        <div className={styles.confettiWrapper} aria-hidden="true">
                            {Array.from({ length: 24 }).map((_, i) => {
                                const colors = ['#FFC107', '#2196F3', '#4CAF50', '#E91E63'];
                                const left = `${Math.random() * 100}%`;
                                const delay = `${Math.random()}s`;
                                const duration = `${2 + Math.random() * 2}s`;
                                return (
                                    <span
                                        key={i}
                                        className={styles.confetti}
                                        style={{
                                            left,
                                            backgroundColor: colors[i % colors.length],
                                            animationDelay: delay,
                                            animationDuration: duration,
                                        }}
                                    />
                                );
                            })}
                        </div>
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
                            <Button onClick={handleRetry} variant="secondary" size="lg">
                                もう一度
                            </Button>
                            <Button onClick={() => navigate('/course')} variant="primary" size="lg">
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
            />
            <main className={styles.main}>
                <TimerBar timeLeft={timeLeft} timeLimit={timeLimit} maxWidth={680} />
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
