// ================================
// Question Display Component
// ================================

import React from 'react';
import { Question, LearningMode } from '@/types';
import { highlightTokens } from '@/utils/typing';
import { AudioPlayer } from '@/components/AudioPlayer';
import styles from './QuestionDisplay.module.css';

interface QuestionDisplayProps {
    question: Question;
    mode: LearningMode;
    showEnglish?: boolean;
    autoPlayAudio?: boolean;
}

export function QuestionDisplay({
    question,
    mode,
    showEnglish = true,
    autoPlayAudio = false,
}: QuestionDisplayProps) {
    const isAudioEnabled = mode !== 3;
    const isSpellingVisible = mode === 1;
    const hasHighlights = question.highlightTokens && question.highlightTokens.length > 0;

    // ハイライト処理
    const renderEnglishText = () => {
        if (!isSpellingVisible) {
            return <span className={styles.hidden}>{'_'.repeat(question.answerEn.length)}</span>;
        }

        if (hasHighlights) {
            const parts = highlightTokens(question.answerEn, question.highlightTokens!);
            return (
                <>
                    {parts.map((part, index) => (
                        <span
                            key={index}
                            className={part.isHighlight ? styles.highlight : ''}
                        >
                            {part.text}
                        </span>
                    ))}
                </>
            );
        }

        return question.answerEn;
    };

    return (
        <div className={styles.container}>
            {/* 日本語プロンプト */}
            <p className={styles.prompt}>{question.promptJp}</p>

            {/* 英語表示エリア */}
            <div className={styles.englishArea}>
                {/* 音声ボタン */}
                <AudioPlayer
                    text={question.answerEn}
                    audioUrl={question.audioUrl}
                    disabled={!isAudioEnabled}
                    autoPlay={autoPlayAudio && isAudioEnabled}
                    size="lg"
                />

                {/* 英語テキスト */}
                <div className={styles.english}>
                    {showEnglish && renderEnglishText()}
                </div>
            </div>

            {/* モード表示 */}
            <div className={styles.modeIndicator}>
                <span className={styles.modeLabel}>
                    {mode === 1 && '音声あり・スペルあり'}
                    {mode === 2 && '音声あり・スペルなし'}
                    {mode === 3 && '音声なし・スペルなし'}
                </span>
            </div>
        </div>
    );
}

export default QuestionDisplay;
