// ================================
// Timer Bar Component
// ================================

import { calculateTimeBarPercent } from '@/utils/timer';
import styles from './TimerBar.module.css';

interface TimerBarProps {
    timeLeft: number;
    timeLimit: number;
    maxWidth?: number;
    dangerThreshold?: number;
}

export function TimerBar({
    timeLeft,
    timeLimit,
    maxWidth = 600,
    dangerThreshold,
}: TimerBarProps) {
    const isDanger = dangerThreshold !== undefined && timeLeft < dangerThreshold;
    return (
        <div className={styles.timerWrapper} style={{ maxWidth }}>
            <div className={styles.timerBarContainer}>
                <div
                    className={`${styles.timerBar} ${isDanger ? styles.timerDanger : ''}`}
                    style={{ width: `${calculateTimeBarPercent(timeLeft, timeLimit)}%` }}
                />
            </div>
            <div className={styles.timerLabel}>
                残り {timeLeft} / {timeLimit} 秒
            </div>
        </div>
    );
}

export default TimerBar;
