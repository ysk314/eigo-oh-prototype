// ================================
// Typing Input Component
// ================================

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    createTypingState,
    processKeyInput,
    getDisplayState,
    TypingState
} from '@/utils/typing';
import styles from './TypingInput.module.css';

interface TypingInputProps {
    answer: string;
    onComplete: (result: { missCount: number; timeMs: number }) => void;
    onProgress?: (current: number, total: number) => void;
    onKeyResult?: (isCorrect: boolean) => void;
    onCurrentCharChange?: (char: string | null) => void;
    disabled?: boolean;
    showHint?: boolean;
}

export function TypingInput({
    answer,
    onComplete,
    onProgress,
    onKeyResult,
    onCurrentCharChange,
    disabled = false,
    showHint = true,
}: TypingInputProps) {
    const [typingState, setTypingState] = useState<TypingState>(() =>
        createTypingState(answer)
    );
    const [lastError, setLastError] = useState(false);
    const [consecutiveMiss, setConsecutiveMiss] = useState(0);
    const hasCompletedRef = useRef(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [inputValue, setInputValue] = useState('');
    const isComposingRef = useRef(false);
    const isInputFocusedRef = useRef(false);
    const prevDisabledRef = useRef(disabled);

    // 回答が変わったらリセット
    useEffect(() => {
        setTypingState(createTypingState(answer));
        setLastError(false);
        setConsecutiveMiss(0);
        hasCompletedRef.current = false;
        setInputValue('');
    }, [answer]);

    // 進捗を通知
    useEffect(() => {
        if (onProgress) {
            onProgress(typingState.currentIndex, typingState.normalizedAnswer.length);
        }
    }, [typingState.currentIndex, typingState.normalizedAnswer.length, onProgress]);

    useEffect(() => {
        if (!onCurrentCharChange) return;
        if (typingState.isComplete) {
            onCurrentCharChange(null);
            return;
        }
        const nextChar = typingState.normalizedAnswer[typingState.currentIndex] || null;
        onCurrentCharChange(nextChar);
    }, [typingState.currentIndex, typingState.normalizedAnswer, typingState.isComplete, onCurrentCharChange]);

    // 完了を通知
    useEffect(() => {
        if (typingState.answer !== answer) return;
        if (!typingState.isComplete || !typingState.startTime) return;
        if (hasCompletedRef.current) return;

        hasCompletedRef.current = true;
        const timeMs = Date.now() - typingState.startTime;
        onComplete({
            missCount: typingState.missCount,
            timeMs,
        });
    }, [typingState.isComplete, typingState.startTime, typingState.missCount, onComplete]);

    // キー入力ハンドラ
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (disabled || typingState.isComplete) return;
        if (isInputFocusedRef.current) return;

        // 特殊キーは無視
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key.length !== 1 && e.key !== ' ') return;

        e.preventDefault();

        const inputChar = e.key;
        const newState = processKeyInput(typingState, inputChar);

        setTypingState(newState);

        // エラー表示
        const isError = inputChar !== typingState.normalizedAnswer[typingState.currentIndex];
        setLastError(isError);
        onKeyResult?.(!isError);
        setConsecutiveMiss(prev => (isError ? prev + 1 : 0));

        if (isError) {
            // エラーアニメーション後にリセット
            setTimeout(() => setLastError(false), 300);
        }
    }, [typingState, disabled]);

    // キーボードイベントをリッスン
    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    // フォーカス管理
    useEffect(() => {
        containerRef.current?.focus();
    }, []);

    const focusInput = () => {
        const node = inputRef.current;
        if (!node) return;
        try {
            node.focus({ preventScroll: true });
        } catch {
            node.focus();
        }
    };

    useEffect(() => {
        if (disabled || typingState.isComplete) {
            prevDisabledRef.current = disabled;
            return;
        }

        const wasDisabled = prevDisabledRef.current;
        prevDisabledRef.current = disabled;

        if (wasDisabled || isInputFocusedRef.current) {
            focusInput();
        }
    }, [disabled, typingState.isComplete]);

    useEffect(() => {
        if (disabled || typingState.isComplete || isInputFocusedRef.current) return;
        focusInput();
    }, [answer, disabled, typingState.isComplete]);

    const handleInputChange = (nextValue: string) => {
        if (disabled || typingState.isComplete) return;
        if (isComposingRef.current) return;
        if (!nextValue) return;

        const chars = nextValue.replace(/\n/g, '').split('');
        let nextState = typingState;
        let missStreak = consecutiveMiss;

        chars.forEach((char) => {
            const expected = nextState.normalizedAnswer[nextState.currentIndex];
            const isError = char !== expected;
            nextState = processKeyInput(nextState, char);
            if (isError) {
                setLastError(true);
                setTimeout(() => setLastError(false), 300);
                missStreak += 1;
            } else {
                missStreak = 0;
            }
            onKeyResult?.(!isError);
        });

        setTypingState(nextState);
        setConsecutiveMiss(missStreak);
        setInputValue('');
    };

    const displayState = getDisplayState(typingState);
    const isComplete = typingState.isComplete;
    const currentCharDisplay = isComplete
        ? ''
        : showHint
            ? displayState.currentChar
            : (consecutiveMiss >= 2 ? displayState.currentChar : '_');
    const remainingDisplay = isComplete
        ? ''
        : (showHint ? displayState.remainingText : '');
    const isSpaceExpected = !isComplete && typingState.normalizedAnswer[typingState.currentIndex] === ' ';
    const answerLength = typingState.normalizedAnswer.length || 1;

    return (
        <div
            ref={containerRef}
            className={`${styles.container} ${lastError ? styles.error : ''} ${disabled ? styles.disabled : ''} ${isComplete ? styles.isComplete : ''}`}
            tabIndex={0}
            role="textbox"
            aria-label="タイピング入力"
            onClick={focusInput}
            onTouchStart={focusInput}
        >
            <input
                ref={inputRef}
                className={styles.hiddenInput}
                value={inputValue}
                onChange={(e) => {
                    setInputValue(e.target.value);
                    handleInputChange(e.target.value);
                }}
                onCompositionStart={() => { isComposingRef.current = true; }}
                onCompositionEnd={(e) => {
                    isComposingRef.current = false;
                    handleInputChange(e.currentTarget.value);
                    setInputValue('');
                }}
                onFocus={() => { isInputFocusedRef.current = true; }}
                onBlur={() => { isInputFocusedRef.current = false; }}
                autoComplete="one-time-code"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                inputMode="text"
                enterKeyHint="done"
                lang="en"
            />
            <div className={styles.completeIndicator} aria-hidden="true">
                ✓
            </div>
            {/* 入力表示エリア */}
            <div
                className={styles.display}
                style={{ ['--answer-length' as string]: answerLength }}
            >
                <span className={styles.completed}>{displayState.completedText}</span>
                <span className={`${styles.current} ${lastError ? styles.shake : ''} ${isSpaceExpected ? styles.space : ''}`}>
                    {currentCharDisplay || ''}
                </span>
                <span className={styles.remaining}>
                    {remainingDisplay}
                </span>
            </div>

            {/* 入力位置カーソル */}
            <div className={styles.cursor} />

        </div>
    );
}

export default TypingInput;
