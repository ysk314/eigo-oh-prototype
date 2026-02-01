// ================================
// Game Header Component
// ================================

import { ProgressBar } from '@/components/ProgressBar';
import styles from './GameHeader.module.css';

interface GameHeaderProps {
    current: number;
    total: number;
    userName?: string | null;
    onBack: () => void;
}

export function GameHeader({
    current,
    total,
    userName,
    onBack,
}: GameHeaderProps) {
    return (
        <header className={styles.playHeader}>
            <button className={styles.backButton} onClick={onBack}>
                ← 戻る
            </button>
            <div className={styles.progressContainer}>
                <ProgressBar current={current} total={total} />
            </div>
            <div className={styles.userInfo}>
                {userName}
            </div>
        </header>
    );
}

export default GameHeader;
