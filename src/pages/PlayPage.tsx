// ================================
// Play Page
// ================================

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Header } from '@/components/Header';
import { GameHeader } from '@/components/GameHeader';
import { QuestionDisplay } from '@/components/QuestionDisplay';
import { TypingInput } from '@/components/TypingInput';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Confetti } from '@/components/Confetti';
import { courses, getCourseById, getQuestionsBySection } from '@/data/questions';
import { shuffleWithNoConsecutive } from '@/utils/shuffle';
import { UserProgress } from '@/types';
import { buildScoreResult, ScoreResult } from '@/utils/score';
import { calculateTimeLimit, calculateTotalChars } from '@/utils/timer';
import { playSound } from '@/utils/sound';
import { useCountdown } from '@/hooks/useCountdown';
import { getRankMessage } from '@/utils/result';
import { logEvent } from '@/utils/analytics';
import { recordProgressSnapshot, recordSessionSummary, type SessionSummary } from '@/utils/dashboardStats';
import { buildSectionProgressTotals, buildUserProgressTotals, getTotalSectionsCount } from '@/utils/progressSummary';
import { useSelectedLabels } from '@/hooks/useSelectedLabels';
import styles from './PlayPage.module.css';

export function PlayPage() {
    const navigate = useNavigate();
    const {
        state,
        updateProgress,
        setQuestionIndex,
        markSectionCleared,
        setSectionRank,
        beginSectionSession,
        completeSectionSession,
        abortSectionSession,
    } = useApp();

    const { selectedCourse, selectedPart, selectedSection, selectedMode, currentUser, shuffleMode } = state;
    const currentCourse = getCourseById(selectedCourse) ?? courses[0];

    useEffect(() => {
        if (state.studyMode === 'choice') {
            navigate('/choice');
        }
    }, [state.studyMode, navigate]);

    // セクションの問題をロード & シャッフル
    const questions = useMemo(() => {
        if (!selectedPart || !selectedSection) return [];
        const baseQuestions = getQuestionsBySection(selectedPart, selectedSection, currentCourse?.id);

        if (shuffleMode) {
            return shuffleWithNoConsecutive(baseQuestions, (q) => q.answerEn);
        }
        return baseQuestions.sort((a, b) => a.orderIndex - b.orderIndex);
    }, [selectedPart, selectedSection, shuffleMode, currentCourse?.id]);

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
    const sessionResultsRef = useRef<UserProgress[]>([]);
    const isAdvancingRef = useRef(false);
    const timeUpRef = useRef(false);
    const isFinishedRef = useRef(false);
    const sessionIdRef = useRef(`typing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    const currentQuestion = questions[currentIndex];
    // 初期化チェック
    useEffect(() => {
        if (!selectedSection || questions.length === 0) {
            navigate('/course'); // 何も選択されてなければ戻る
        }
    }, [selectedSection, questions, navigate]);

    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, []);

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
            },
        }).catch(() => {});
    }, [questions, startCountdown, currentUser?.id, beginSectionSession]);

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
        });
    }, [isFinished, scoreResult, sessionResults, timeLeft, timeLimit, questions]);

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
            finishSession(nextResults);
        }, 800);
    }, [currentQuestion, currentIndex, questions.length, updateProgress, setQuestionIndex, selectedMode, isFinished, timeUp, currentUser?.id]);

    // セッション完了処理
    const finishSession = (resultsOverride?: UserProgress[]) => {
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
        });
        setScoreResult(score);

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
            },
        }).catch(() => {});

        if (currentUser?.id) {
            const sectionMeta = selectedCourse && state.selectedUnit && selectedPart && selectedSection
                ? {
                    courseId: selectedCourse,
                    unitId: state.selectedUnit,
                    partId: selectedPart,
                    sectionId: selectedSection,
                    label: selectedSectionLabel || selectedSection,
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
                playedAt: new Date().toISOString(),
            };

            recordSessionSummary(currentUser.id, sessionSummary, sectionMeta).catch(() => {});

            const progressTotals = buildUserProgressTotals(state.userProgress, currentUser.id);
            const sectionTotals = buildSectionProgressTotals(state.sectionProgress, currentUser.id);
            recordProgressSnapshot(currentUser.id, {
                ...progressTotals,
                clearedSectionsCount: sectionTotals.clearedSectionsCount,
                totalSectionsCount: getTotalSectionsCount(),
                lastMode: 'typing',
                lastActiveAt: new Date().toISOString(),
                lastSectionId: selectedSection ?? undefined,
                lastSectionLabel: selectedSectionLabel ?? selectedSection ?? undefined,
                lastCourseId: selectedCourse ?? undefined,
                lastUnitId: state.selectedUnit ?? undefined,
                lastPartId: selectedPart ?? undefined,
            }).catch(() => {});
        }

        completeSectionSession();

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
        startCountdown(3);
        beginSectionSession();
    };

    const handleBack = () => {
        const confirm = window.confirm('学習を中断して戻りますか？');
        if (confirm) {
            abortSectionSession();
            navigate('/course');
        }
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

    const activeFingerId = selectedMode === 1 ? getFingerIdForChar(currentChar) : null;
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

    const activeKeyId = selectedMode === 1 ? getKeyIdForChar(currentChar) : null;
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
        useSelectedLabels(currentCourse, state.selectedUnit, state.selectedPart, state.selectedSection);

    const selectedModeLabel = useMemo(() => {
        switch (selectedMode) {
            case 1:
                return '音あり / スペルあり';
            case 2:
                return '音あり / スペルなし';
            case 3:
                return '音なし / スペルなし';
            default:
                return '';
        }
    }, [selectedMode]);

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
        const resultMessage = finalScore.rank === 'S'
            ? (selectedMode === 3
                ? '最高！次のセクションに進もう！'
                : '目標達成！次のモードが解放されました！')
            : getRankMessage(finalScore.rank);

        return (
            <div className={styles.page}>
                <Header title="結果発表" showUserSelect={false} showBackButton onBack={handleBack} />
                <main className={styles.resultMain}>
                    {finalScore.rank === 'S' && (
                        <Confetti
                            count={30}
                            wrapperClassName={styles.confettiWrapper}
                            itemClassName={styles.confetti}
                        />
                    )}
                    <Card className={styles.resultCard} padding="lg">
                        <h2 className={styles.resultTitle}>
                            {finalScore.rank === 'S' ? '🎉 Excellent! 🎉' : 'Good Job!'}
                        </h2>
                        <div className={styles.resultMeta}>
                            <span>Unit: {selectedUnitLabel || '-'}</span>
                            <span>Part: {selectedPartLabelText || '-'}</span>
                            <span>Section: {selectedSectionLabel || '-'}</span>
                            <span>Level: {selectedModeLabel || '-'}</span>
                        </div>

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
            <GameHeader
                current={currentIndex + 1}
                total={questions.length}
                userName={currentUser?.name}
                onBack={handleBack}
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
                            mode={selectedMode}
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
                                    showHint={selectedMode === 1} // ヒントはモード1のみ表示
                                />
                            }
                        />

                        <div className={styles.inputArea}>
                            {selectedMode === 1 && (
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
        </div>
    );
}

export default PlayPage;
