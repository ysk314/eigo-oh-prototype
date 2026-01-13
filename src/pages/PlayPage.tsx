// ================================
// Play Page
// ================================

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Header } from '@/components/Header';
import { QuestionDisplay } from '@/components/QuestionDisplay';
import { TypingInput } from '@/components/TypingInput';
import { ProgressBar } from '@/components/ProgressBar';
import { QuestionNav } from '@/components/QuestionNav'; // ナビ追加
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { getQuestionById, getQuestionsBySection } from '@/data/questions';
import { shuffleWithNoConsecutive } from '@/utils/shuffle';
import { checkSectionCleared } from '@/utils/progress';
import { UserProgress } from '@/types';
import styles from './PlayPage.module.css';

export function PlayPage() {
    const navigate = useNavigate();
    const {
        state,
        updateProgress,
        setQuestionIndex,
        markSectionCleared
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

    const currentQuestion = questions[currentIndex];
    const progressPercent = questions.length > 0 ? Math.round(((currentIndex) / questions.length) * 100) : 0;

    // 初期化チェック
    useEffect(() => {
        if (!selectedSection || questions.length === 0) {
            navigate('/course'); // 何も選択されてなければ戻る
        }
    }, [selectedSection, questions, navigate]);

    // デバッグ用: 進捗ログ
    useEffect(() => {
        // console.log('Current Question:', currentQuestion);
    }, [currentQuestion]);

    // 問題完了時の処理
    const handleQuestionComplete = useCallback((result: { missCount: number; timeMs: number }) => {
        if (!currentQuestion) return;

        const isCorrect = result.missCount === 0; // 一度もミスなしならPerfect扱い？(要件次第だが今回は完了ベース)

        // 進捗保存
        updateProgress(currentQuestion.id, {
            attemptsCount: 1, // 加算用
            correctCount: 1,  // 完了したので1回正解とみなす (仕様要確認: 逐次判定なので入力完了=正解)
            missCount: result.missCount,
        });

        // セッション結果を記録（後でクリア判定に使用）
        setSessionResults(prev => [...prev, {
            questionId: currentQuestion.id,
            attemptsCount: 1,
            correctCount: 1,
            missCount: result.missCount,
            clearedMode: selectedMode, // 仮
        }]);

        // 少し待って次の問題へ
        setTimeout(() => {
            if (currentIndex < questions.length - 1) {
                setCurrentIndex(prev => prev + 1);
                setQuestionIndex(currentIndex + 1);
            } else {
                finishSession();
            }
        }, 800);
    }, [currentQuestion, currentIndex, questions.length, updateProgress, setQuestionIndex, selectedMode]);

    // セッション完了処理
    const finishSession = () => {
        setIsFinished(true);

        // セクションクリア判定
        // 注: sessionResultsはstate更新のタイミングでまだ最新じゃない可能性があるため、ここで最新の計算を行う必要があるが
        // 簡易的に現状のsessionResults + 今回の結果で判定すべき。
        // ここではContext側のProgressが更新されていることを前提に、後ほど判定するか
        // あるいはローカルの集計で判定する。

        // 簡易実装: 今回のセッションで全問正解(入力完了)しているので、ミス率だけで判定
        // 仕様: 正答率90%以上

        // 実際の判定はResult画面で行うか、ここで行ってResultに渡す
    };

    const handleNextMode = () => {
        // 次のモードへ（未実装：モード切替してリロード）
        // とりあえずコース画面へ戻る
        navigate('/course');
    };

    const handleRetry = () => {
        setCurrentIndex(0);
        setQuestionIndex(0);
        setIsFinished(false);
        setSessionResults([]);
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

        const isCleared = accuracy >= 90;

        // クリア状態を保存
        if (isCleared && selectedSection) {
            markSectionCleared(selectedSection, selectedMode);
        }

        return (
            <div className={styles.page}>
                <Header title="結果発表" showUserSelect={false} />
                <main className={styles.resultMain}>
                    <Card className={styles.resultCard} padding="lg">
                        <h2 className={styles.resultTitle}>
                            {isCleared ? '🎉 Excellent! 🎉' : 'Good Job!'}
                        </h2>

                        <div className={styles.stats}>
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
                            autoPlayAudio={state.autoPlayAudio}
                        />

                        <div className={styles.inputArea}>
                            <TypingInput
                                answer={currentQuestion.answerEn}
                                onComplete={handleQuestionComplete}
                                disabled={false}
                                showHint={selectedMode !== 3} // モード3以外はヒント（アンダースコア等）あり
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
        </div>
    );
}

export default PlayPage;
