// ================================
// Mode Button Component
// ================================

import React from 'react';
import { LearningMode } from '@/types';
import styles from './ModeButton.module.css';

interface ModeButtonProps {
    mode: LearningMode;
    isUnlocked: boolean;
    isActive?: boolean;
    onClick?: () => void;
    size?: 'sm' | 'md' | 'lg';
}

const modeLabels: Record<LearningMode, { title: string; subtitle: string }> = {
    1: { title: '1', subtitle: '音あり\nスペルあり' },
    2: { title: '2', subtitle: '音あり\nスペルなし' },
    3: { title: '3', subtitle: '音なし\nスペルなし' },
};

export function ModeButton({
    mode,
    isUnlocked,
    isActive = false,
    onClick,
    size = 'md',
}: ModeButtonProps) {
    const label = modeLabels[mode];

    const buttonClass = [
        styles.button,
        styles[`mode${mode}`],
        styles[size],
        isUnlocked ? styles.unlocked : styles.locked,
        isActive ? styles.active : '',
    ].filter(Boolean).join(' ');

    return (
        <button
            className={buttonClass}
            onClick={onClick}
            disabled={!isUnlocked}
            aria-label={`モード${mode}: ${label.subtitle.replace('\n', '・')}`}
        >
            {isUnlocked ? (
                <span className={styles.number}>{label.title}</span>
            ) : (
                <span className={styles.lockIcon}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
                    </svg>
                </span>
            )}
        </button>
    );
}

export default ModeButton;
