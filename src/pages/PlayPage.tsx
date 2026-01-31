// ================================
// Play Page
// ================================

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Header } from '@/components/Header';
import { QuestionDisplay } from '@/components/QuestionDisplay';
import { TypingInput } from '@/components/TypingInput';
import { ProgressBar } from '@/components/ProgressBar';
import { QuestionNav } from '@/components/QuestionNav'; // ナビ追加
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { getQuestionsBySection } from '@/data/questions';
import { shuffleWithNoConsecutive } from '@/utils/shuffle';
import { UserProgress } from '@/types';
import { buildScoreResult, ScoreResult } from '@/utils/score';
import { calculateTimeLimit, calculateTotalChars, calculateTimeBarPercent } from '@/utils/timer';
import { playSound } from '@/utils/sound';
import styles from './PlayPage.module.css';

export function PlayPage() {
    const navigate = useNavigate();
    const {
        state,
        updateProgress,
        setQuestionIndex,
        markSectionCleared,
        setSectionRank
    } = useApp();

    const { selectedPageRange, selectedSection, selectedMode, currentUser, shuffleMode } = state;

    // セクションの問題をロード & シャッフル
    const questions = useMemo(() => {
        if (!selectedPageRange || !selectedSection) return [];
        const baseQuestions = getQuestionsBySection(selectedPageRange, selectedSection);

        if (shuffleMode) {
            return shuffleWithNoConsecutive(baseQuestions, (q) => q.answerEn);
        }
        return baseQuestions.sort((a, b) => a.orderIndex - b.orderIndex);
    }, [selectedPageRange, selectedSection, shuffleMode]);

    // 現在の状態
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFinished, setIsFinished] = useState(false);
    const [sessionResults, setSessionResults] = useState<UserProgress[]>([]);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [isCountingDown, setIsCountingDown] = useState(false);
    const [timeLimit, setTimeLimit] = useState(0);
    const [timeLeft, setTimeLeft] = useState(0);
    const [timeUp, setTimeUp] = useState(false);
    const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);
    const sessionResultsRef = useRef<UserProgress[]>([]);
    const isAdvancingRef = useRef(false);
    const timeUpRef = useRef(false);
    const isFinishedRef = useRef(false);

    const currentQuestion = questions[currentIndex];
    // 初期化チェック
    useEffect(() => {
        if (!selectedSection || questions.length === 0) {
            navigate('/course'); // 何も選択されてなければ戻る
        }
    }, [selectedSection, questions, navigate]);

    // セッション初期化（問題セット変更時）
    useEffect(() => {
        if (questions.length === 0) return;
        const totalChars = calculateTotalChars(questions);
        const limit = calculateTimeLimit(totalChars, 1, 10);

        setCurrentIndex(0);
        setQuestionIndex(0);
        setIsFinished(false);
        setTimeUp(false);
        setSessionResults([]);
        sessionResultsRef.current = [];
        setScoreResult(null);
        setTimeLimit(limit);
        setTimeLeft(limit);
        setCountdown(3);
        setIsCountingDown(true);
    }, [questions]);

    // カウントダウン処理
    useEffect(() => {
        if (!isCountingDown || countdown === null) return;

        playSound('countdown');
        const interval = setInterval(() => {
            setCountdown((prev) => {
                if (prev === null) return null;
                if (prev <= 1) return 0;
                playSound('countdown');
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [isCountingDown]);

    useEffect(() => {
        if (!isCountingDown || countdown !== 0) return;

        const timer = setTimeout(() => {
            setIsCountingDown(false);
            setCountdown(null);
        }, 300);

        return () => clearTimeout(timer);
    }, [isCountingDown, countdown]);

    // タイマー処理
    useEffect(() => {
        if (isCountingDown || isFinished || timeLimit === 0) return;

        if (timeLeft <= 0) {
            if (!timeUp && !isFinished) {
                setTimeUp(true);
                finishSession(true);
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
        return scoreResult ?? buildScoreResult({
            missCount: totalMiss,
            timeLeft,
            timeLimit,
            timeUp,
        });
    }, [isFinished, scoreResult, sessionResults, timeLeft, timeLimit, timeUp]);

    useEffect(() => {
        if (!isFinished || !finalScore || !selectedSection) return;
        if (finalScore.rank === 'S') {
            markSectionCleared(selectedSection, selectedMode);
        }
        setSectionRank(selectedSection, selectedMode, finalScore.rank);
    }, [isFinished, finalScore, selectedSection, selectedMode, markSectionCleared, setSectionRank]);

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

        // セッション結果を記録（後でクリア判定に使用）
        const nextResult: UserProgress = {
            questionId: currentQuestion.id,
            attemptsCount: 1,
            correctCount: 1,
            missCount: result.missCount,
            clearedMode: selectedMode, // 仮
        };
        const nextResults = [...sessionResultsRef.current, nextResult];
        sessionResultsRef.current = nextResults;
        setSessionResults(nextResults);

        if (isCorrect) {
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
            finishSession(timeUpRef.current, nextResults);
        }, 800);
    }, [currentQuestion, currentIndex, questions.length, updateProgress, setQuestionIndex, selectedMode, isFinished, timeUp]);

    // セッション完了処理
    const finishSession = (timeUpFlag: boolean, resultsOverride?: UserProgress[]) => {
        setIsFinished(true);
        const results = resultsOverride ?? sessionResultsRef.current;
        const totalMiss = results.reduce((acc, cur) => acc + cur.missCount, 0);
        const score = buildScoreResult({
            missCount: totalMiss,
            timeLeft,
            timeLimit,
            timeUp: timeUpFlag,
        });
        setScoreResult(score);

        if (score.rank === 'S') {
            playSound('fanfare');
        } else if (score.rank === 'A' || score.rank === 'B') {
            playSound('success');
        } else {
            playSound('try-again');
        }
    };

    const handleRetry = () => {
        setCurrentIndex(0);
        setQuestionIndex(0);
        setIsFinished(false);
        setSessionResults([]);
        setScoreResult(null);
        setTimeUp(false);
        setTimeLeft(timeLimit);
        setCountdown(3);
        setIsCountingDown(true);
    };

    const handleBack = () => {
        const confirm = window.confirm('学習を中断して戻りますか？');
        if (confirm) {
            navigate('/course');
        }
    };

    // 完了画面
    if (isFinished) {
        const totalMiss = sessionResults.reduce((acc, cur) => acc + cur.missCount, 0);
        const totalChars = questions.reduce((acc, q) => acc + q.answerEn.length, 0); // 概算
        // 厳密な正答率計算: (総文字数) / (総文字数 + 総ミス)
        const accuracy = totalChars > 0
            ? Math.round((totalChars / (totalChars + totalMiss)) * 100)
            : 0;

        if (!finalScore) return null;
        const isCleared = finalScore.rank === 'S';

        return (
            <div className={styles.page}>
                <Header title="結果発表" showUserSelect={false} />
                <main className={styles.resultMain}>
                    {finalScore.rank === 'S' && (
                        <div className={styles.confettiWrapper} aria-hidden="true">
                            {Array.from({ length: 30 }).map((_, i) => {
                                const colors = ['#FFC107', '#2196F3', '#4CAF50', '#E91E63'];
                                const left = `${Math.random() * 100}%`;
                                const delay = `${Math.random() * 2}s`;
                                const duration = `${2 + Math.random() * 3}s`;
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

                        {isCleared ? (
                            <div className={styles.message}>
                                目標達成！次のモードが解放されました！
                            </div>
                        ) : (
                            <div className={styles.message}>
                                惜しい！90%以上を目指してもう一度チャレンジしよう！
                            </div>
                        )}

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

    // プレイ画面
    return (
        <div className={styles.page}>
            <header className={styles.playHeader}>
                <button className={styles.backButton} onClick={handleBack}>
                    ← 戻る
                </button>
                <div className={styles.progressContainer}>
                    <ProgressBar current={currentIndex + 1} total={questions.length} />
                </div>
                <div className={styles.userInfo}>
                    {currentUser?.name}
                </div>
            </header>

            <main className={styles.playMain}>
                <div className={styles.timerWrapper}>
                    <div className={styles.timerBarContainer}>
                        <div
                            className={`${styles.timerBar} ${timeLeft < 10 ? styles.timerDanger : ''}`}
                            style={{ width: `${calculateTimeBarPercent(timeLeft, timeLimit)}%` }}
                        />
                    </div>
                    <div className={styles.timerLabel}>
                        残り {timeLeft} / {timeLimit} 秒
                    </div>
                </div>

                {/* 問題番号ナビゲーション (オプション) */}
                <div className={styles.navWrapper}>
                    <QuestionNav
                        total={questions.length}
                        current={currentIndex}
                        enableJump={false} // プレイ中はジャンプ不可
                    />
                </div>

                {currentQuestion ? (
                    <div className={styles.questionArea}>
                        <QuestionDisplay
                            question={currentQuestion}
                            mode={selectedMode}
                            autoPlayAudio={state.autoPlayAudio && !isCountingDown}
                        />

                        <div className={styles.inputArea}>
                            <TypingInput
                                answer={currentQuestion.answerEn}
                                onComplete={handleQuestionComplete}
                                onKeyResult={(isCorrect) => playSound(isCorrect ? 'type' : 'error')}
                                disabled={isCountingDown || timeUp}
                                showHint={selectedMode === 1} // ヒントはモード1のみ表示
                            />
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
        </div>
    );
}

export default PlayPage;
