// ================================
// Choice Page (4択)
// ================================

import { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Header } from '@/components/Header';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { courses, getCourseById, getQuestionsBySection } from '@/data/questions';
import { ProgressBar } from '@/components/ProgressBar';
import { buildScoreResult, ScoreResult } from '@/utils/score';
import { calculateTimeLimit, calculateTotalChars, calculateTimeBarPercent } from '@/utils/timer';
import styles from './ChoicePage.module.css';

type ChoiceState = {
    options: string[];
    correct: string;
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
        .split('')
        .map((char) => (char === ' ' ? ' ' : '_'))
        .join('');
}

export function ChoicePage() {
    const navigate = useNavigate();
    const { state } = useApp();
    const { selectedCourse, selectedPart, selectedSection, selectedChoiceLevel } = state;
    const currentCourse = getCourseById(selectedCourse) ?? courses[0];

    const questions = useMemo(() => {
        if (!selectedPart || !selectedSection) return [];
        return getQuestionsBySection(selectedPart, selectedSection, currentCourse?.id);
    }, [selectedPart, selectedSection, currentCourse?.id]);

    const [currentIndex, setCurrentIndex] = useState(0);
    const [choiceState, setChoiceState] = useState<ChoiceState | null>(null);
    const [selected, setSelected] = useState<string | null>(null);
    const [correctCount, setCorrectCount] = useState(0);
    const [missCount, setMissCount] = useState(0);
    const [isFinished, setIsFinished] = useState(false);
    const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);
    const [timeLimit, setTimeLimit] = useState(0);
    const [timeLeft, setTimeLeft] = useState(0);
    const [timeUp, setTimeUp] = useState(false);
    const timeUpRef = useRef(false);

    const currentQuestion = questions[currentIndex];

    useEffect(() => {
        if (!selectedSection || questions.length === 0) {
            navigate('/course');
        }
    }, [selectedSection, questions, navigate]);

    useEffect(() => {
        if (state.studyMode === 'typing') {
            navigate('/play');
        }
    }, [state.studyMode, navigate]);

    useEffect(() => {
        if (questions.length === 0) return;
        const totalChars = calculateTotalChars(questions);
        const limit = calculateTimeLimit(totalChars, 1, 10);
        setCurrentIndex(0);
        setIsFinished(false);
        setTimeUp(false);
        setCorrectCount(0);
        setMissCount(0);
        setScoreResult(null);
        setTimeLimit(limit);
        setTimeLeft(limit);
    }, [questions]);

    useEffect(() => {
        if (isFinished || timeLimit === 0) return;
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
    }, [isFinished, timeLeft, timeLimit, timeUp]);

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

        const options: string[] = [];
        const displaySet = new Set<string>();

        const addOption = (answer: string) => {
            if (options.includes(answer)) return false;
            const display = selectedChoiceLevel === 2 ? maskWord(answer) : answer;
            if (displaySet.has(display)) return false;
            options.push(answer);
            displaySet.add(display);
            return true;
        };

        addOption(currentQuestion.answerEn);
        shuffle(samePos)
            .map((q) => q.answerEn)
            .forEach((answer) => {
                if (options.length >= 4) return;
                addOption(answer);
            });

        if (options.length < 4) {
            shuffle(pool)
                .map((q) => q.answerEn)
                .forEach((answer) => {
                    if (options.length >= 4) return;
                    addOption(answer);
                });
        }

        setChoiceState({
            options: shuffle(options),
            correct: currentQuestion.answerEn,
        });
        setSelected(null);
    }, [currentQuestion, questions, selectedChoiceLevel]);

    const handleChoice = (answer: string) => {
        if (!choiceState || selected) return;
        setSelected(answer);
        const isCorrect = answer === choiceState.correct;
        if (isCorrect) {
            setCorrectCount((prev) => prev + 1);
        } else {
            setMissCount((prev) => prev + 1);
        }

        window.setTimeout(() => {
            setSelected(null);
            if (currentIndex < questions.length - 1 && !timeUpRef.current) {
                setCurrentIndex((prev) => prev + 1);
                return;
            }
            finishSession(timeUpRef.current);
        }, 500);
    };

    const finishSession = (timeUpFlag: boolean) => {
        setIsFinished(true);
        const score = buildScoreResult({
            missCount,
            timeLeft,
            timeLimit,
            timeUp: timeUpFlag,
        });
        setScoreResult(score);
    };

    if (isFinished && scoreResult) {
        const total = correctCount + missCount;
        const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;
        return (
            <div className={styles.page}>
                <Header title="結果発表" showUserSelect={false} showStudyModeToggle />
                <main className={styles.resultMain}>
                    <Card className={styles.resultCard} padding="lg">
                        <h2 className={styles.resultTitle}>4択結果</h2>
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
                        <div className={styles.actions}>
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
            <Header title="4択モード" showUserSelect={false} showStudyModeToggle />
            <main className={styles.main}>
                <div className={styles.timerWrapper}>
                    <div className={styles.timerBarContainer}>
                        <div
                            className={styles.timerBar}
                            style={{ width: `${calculateTimeBarPercent(timeLeft, timeLimit)}%` }}
                        />
                    </div>
                    <div className={styles.timerLabel}>
                        残り {timeLeft} / {timeLimit} 秒
                    </div>
                </div>

                <div className={styles.progressContainer}>
                    <ProgressBar current={currentIndex + 1} total={questions.length} />
                </div>
                <div className={styles.promptCard}>
                    <div className={styles.promptLabel}>日本語</div>
                    <div className={styles.promptText}>{currentQuestion?.promptJp}</div>
                </div>

                <div className={styles.choices}>
                    {choiceState?.options.map((option) => {
                        const isCorrect = selected && option === choiceState.correct;
                        const isWrong = selected && option === selected && option !== choiceState.correct;
                        const displayText =
                            selectedChoiceLevel === 2 ? maskWord(option) : option;
                        return (
                            <button
                                key={option}
                                className={`${styles.choiceButton} ${isCorrect ? styles.correct : ''} ${isWrong ? styles.wrong : ''}`}
                                onClick={() => handleChoice(option)}
                                disabled={!!selected}
                            >
                                {displayText}
                            </button>
                        );
                    })}
                </div>

                <div className={styles.progress}>
                    {currentIndex + 1} / {questions.length}
                </div>
            </main>
        </div>
    );
}

export default ChoicePage;
