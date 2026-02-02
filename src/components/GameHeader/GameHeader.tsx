// ================================
// Game Header Component
// ================================

import { useLayoutEffect, useRef } from 'react';
import { ProgressBar } from '@/components/ProgressBar';
import { TimerBar } from '@/components/TimerBar';
import styles from './GameHeader.module.css';

interface GameHeaderProps {
    current: number;
    total: number;
    userName?: string | null;
    onBack: () => void;
    timeLeft?: number;
    timeLimit?: number;
    timerMaxWidth?: number;
    dangerThreshold?: number;
}

export function GameHeader({
    current,
    total,
    userName,
    onBack,
    timeLeft,
    timeLimit,
    timerMaxWidth,
    dangerThreshold,
}: GameHeaderProps) {
    const headerRef = useRef<HTMLElement | null>(null);
    const maxHeightRef = useRef(0);
    const shouldShowTimer = typeof timeLeft === 'number' && typeof timeLimit === 'number';

    useLayoutEffect(() => {
        const node = headerRef.current;
        if (!node) return;
        const updateHeight = () => {
            const height = node.getBoundingClientRect().height;
            if (height > maxHeightRef.current) {
                maxHeightRef.current = height;
                document.documentElement.style.setProperty('--game-header-height', `${height}px`);
            }
        };

        updateHeight();
        const rafId = requestAnimationFrame(updateHeight);

        if (typeof ResizeObserver !== 'undefined') {
            const observer = new ResizeObserver(() => updateHeight());
            observer.observe(node);
            return () => {
                cancelAnimationFrame(rafId);
                observer.disconnect();
                document.documentElement.style.removeProperty('--game-header-height');
            };
        }

        window.addEventListener('resize', updateHeight);
        return () => {
            cancelAnimationFrame(rafId);
            window.removeEventListener('resize', updateHeight);
            document.documentElement.style.removeProperty('--game-header-height');
        };
    }, []);

    return (
        <header className={styles.playHeader} ref={headerRef}>
            <div className={styles.topRow}>
                <button className={styles.backButton} onClick={onBack}>
                    ← 戻る
                </button>
                <div className={styles.progressContainer}>
                    <ProgressBar current={current} total={total} />
                </div>
                <div className={styles.userInfo}>
                    {userName}
                </div>
            </div>
            {shouldShowTimer && (
                <TimerBar
                    timeLeft={timeLeft as number}
                    timeLimit={timeLimit as number}
                    maxWidth={timerMaxWidth}
                    dangerThreshold={dangerThreshold}
                />
            )}
        </header>
    );
}

export default GameHeader;
