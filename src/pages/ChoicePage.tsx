// ================================
// Choice Page (4択)
// ================================

import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Header } from '@/components/Header';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { courses, getCourseById, getQuestionsBySection } from '@/data/questions';
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
        .split(' ')
        .map((token) => {
            if (!token) return token;
            if (token.length <= 2) return token[0] + '…';
            return token[0] + '…'.repeat(Math.min(3, token.length - 1));
        })
        .join(' ');
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

    const currentQuestion = questions[currentIndex];

    useEffect(() => {
        if (!selectedSection || questions.length === 0) {
            navigate('/course');
        }
    }, [selectedSection, questions, navigate]);

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

        const options: string[] = [currentQuestion.answerEn];
        shuffle(samePos)
            .map((q) => q.answerEn)
            .filter((answer) => !options.includes(answer))
            .slice(0, 3)
            .forEach((answer) => options.push(answer));

        if (options.length < 4) {
            shuffle(pool)
                .map((q) => q.answerEn)
                .filter((answer) => !options.includes(answer))
                .slice(0, 4 - options.length)
                .forEach((answer) => options.push(answer));
        }

        setChoiceState({
            options: shuffle(options),
            correct: currentQuestion.answerEn,
        });
        setSelected(null);
    }, [currentQuestion, questions]);

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
            setCurrentIndex((prev) => prev + 1);
        }, 500);
    };

    if (currentIndex >= questions.length && questions.length > 0) {
        const total = correctCount + missCount;
        const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;
        return (
            <div className={styles.page}>
                <Header title="結果発表" showUserSelect={false} />
                <main className={styles.resultMain}>
                    <Card className={styles.resultCard} padding="lg">
                        <h2 className={styles.resultTitle}>4択結果</h2>
                        <div className={styles.resultStats}>
                            <div>
                                <span className={styles.resultLabel}>正解</span>
                                <span className={styles.resultValue}>{correctCount}</span>
                            </div>
                            <div>
                                <span className={styles.resultLabel}>ミス</span>
                                <span className={styles.resultValue}>{missCount}</span>
                            </div>
                            <div>
                                <span className={styles.resultLabel}>正答率</span>
                                <span className={styles.resultValue}>{accuracy}%</span>
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
            <Header title="4択モード" showUserSelect={false} />
            <main className={styles.main}>
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
