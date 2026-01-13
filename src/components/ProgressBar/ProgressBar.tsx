// ================================
// Progress Bar Component
// ================================

import React from 'react';
import styles from './ProgressBar.module.css';

interface ProgressBarProps {
    current: number;
    total: number;
    showLabel?: boolean;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export function ProgressBar({
    current,
    total,
    showLabel = true,
    size = 'md',
    className = '',
}: ProgressBarProps) {
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

    const progressClass = [
        styles.container,
        styles[size],
        className,
    ].filter(Boolean).join(' ');

    return (
        <div className={progressClass}>
            <div className={styles.bar}>
                <div
                    className={styles.fill}
                    style={{ width: `${percentage}%` }}
                    role="progressbar"
                    aria-valuenow={current}
                    aria-valuemin={0}
                    aria-valuemax={total}
                />
            </div>
            {showLabel && (
                <span className={styles.label}>
                    {current}/{total}
                </span>
            )}
        </div>
    );
}

export default ProgressBar;
