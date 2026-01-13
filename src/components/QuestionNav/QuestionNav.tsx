// ================================
// Question Navigation Component
// ================================

import React from 'react';
import styles from './QuestionNav.module.css';

interface QuestionNavProps {
    total: number;
    current: number;
    onSelect?: (index: number) => void;
    enableJump?: boolean;
}

export function QuestionNav({
    total,
    current,
    onSelect,
    enableJump = false,
}: QuestionNavProps) {
    return (
        <nav className={styles.nav} aria-label="問題番号">
            <div className={styles.numbers}>
                {Array.from({ length: total }, (_, i) => (
                    <button
                        key={i}
                        className={`${styles.number} ${i === current ? styles.active : ''}`}
                        onClick={() => enableJump && onSelect?.(i)}
                        disabled={!enableJump}
                        aria-label={`問題 ${i + 1}`}
                        aria-current={i === current ? 'step' : undefined}
                    >
                        {i + 1}
                    </button>
                ))}
            </div>
        </nav>
    );
}

export default QuestionNav;
