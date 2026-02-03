// ================================
// Game Header Component
// ================================

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
    const shouldShowTimer = typeof timeLeft === 'number' && typeof timeLimit === 'number';
    return (
        <header className={styles.playHeader}>
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
