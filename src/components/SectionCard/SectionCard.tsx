// ================================
// Section Card Component
// ================================

import { Section, LearningMode, Rank, ChoiceLevel, StudyMode } from '@/types';
import { useApp } from '@/context/AppContext';
import { ModeButton } from '@/components/ModeButton';
import styles from './SectionCard.module.css';

interface SectionCardProps {
    section: Section;
    completedCount?: number;
    onModeSelect: (sectionId: string, mode: LearningMode) => void;
    onChoiceSelect?: (sectionId: string, level: ChoiceLevel) => void;
    modeType?: StudyMode;
}

export function SectionCard({
    section,
    completedCount = 0,
    onModeSelect,
    onChoiceSelect,
    modeType = 'typing',
}: SectionCardProps) {
    const { isModeUnlocked, getSectionProgressData } = useApp();
    const totalCount = section.questionIds.length;
    const progress = getSectionProgressData(section.id);

    const getRankForMode = (mode: LearningMode): Rank | null => {
        if (!progress) return null;
        const key = `mode${mode}Rank` as const;
        return progress[key] ?? null;
    };

    const getRankForChoice = (level: ChoiceLevel): Rank | null => {
        if (!progress) return null;
        const key = `choice${level}Rank` as const;
        return progress[key] ?? null;
    };

    const isChoiceUnlocked = (level: ChoiceLevel) => {
        if (level === 3) return getRankForChoice(1) === 'S';
        if (level === 4) return getRankForChoice(2) === 'S';
        return true;
    };

    const getChoiceLabel = (level: ChoiceLevel, fallback: string) => {
        const rank = getRankForChoice(level);
        return rank ?? fallback;
    };

    const getChoiceRankClass = (level: ChoiceLevel) => {
        if (!isChoiceUnlocked(level)) return '';
        const rank = getRankForChoice(level);
        if (!rank) return '';
        switch (rank) {
            case 'S':
                return styles.rankS;
            case 'A':
                return styles.rankA;
            case 'B':
                return styles.rankB;
            case 'C':
                return styles.rankC;
            default:
                return '';
        }
    };

    const handleModeClick = (mode: LearningMode) => {
        if (isModeUnlocked(section.id, mode)) {
            onModeSelect(section.id, mode);
        }
    };

    return (
        <div className={styles.card}>
            <div className={styles.info}>
                <h3 className={styles.title}>{section.label}</h3>
                <span className={styles.count}>
                    {completedCount}/{totalCount}問
                </span>
            </div>

            {modeType === 'typing' ? (
                <div className={styles.modes}>
                    <ModeButton
                        mode={1}
                        isUnlocked={isModeUnlocked(section.id, 1)}
                        rank={getRankForMode(1)}
                        onClick={() => handleModeClick(1)}
                    />
                    <ModeButton
                        mode={2}
                        isUnlocked={isModeUnlocked(section.id, 2)}
                        rank={getRankForMode(2)}
                        onClick={() => handleModeClick(2)}
                    />
                    <ModeButton
                        mode={3}
                        isUnlocked={isModeUnlocked(section.id, 3)}
                        rank={getRankForMode(3)}
                        onClick={() => handleModeClick(3)}
                    />
                </div>
            ) : (
                <div className={styles.choiceGroups}>
                    <div className={styles.choiceGroup}>
                        <span className={styles.choiceLabel}>英語→日本語</span>
                        <div className={styles.choiceModes}>
                            <button
                                className={`${styles.choiceButton} ${styles.choiceButtonPrimary} ${getChoiceRankClass(1)}`}
                                onClick={() => onChoiceSelect?.(section.id, 1)}
                            >
                                <span className={styles.number}>{getChoiceLabel(1, '1')}</span>
                            </button>
                            <button
                                className={`${styles.choiceButton} ${styles.choiceButtonSecondary} ${getChoiceRankClass(3)} ${!isChoiceUnlocked(3) ? styles.locked : ''}`}
                                onClick={() => onChoiceSelect?.(section.id, 3)}
                                disabled={!isChoiceUnlocked(3)}
                            >
                                {isChoiceUnlocked(3) ? (
                                    <span className={styles.number}>{getChoiceLabel(3, '2')}</span>
                                ) : (
                                    <span className={styles.lockIcon} aria-hidden="true">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
                                        </svg>
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>
                    <div className={styles.choiceGroup}>
                        <span className={styles.choiceLabel}>日本語→英語</span>
                        <div className={styles.choiceModes}>
                            <button
                                className={`${styles.choiceButton} ${styles.choiceButtonPrimary} ${getChoiceRankClass(2)}`}
                                onClick={() => onChoiceSelect?.(section.id, 2)}
                            >
                                <span className={styles.number}>{getChoiceLabel(2, '1')}</span>
                            </button>
                            <button
                                className={`${styles.choiceButton} ${styles.choiceButtonSecondary} ${getChoiceRankClass(4)} ${!isChoiceUnlocked(4) ? styles.locked : ''}`}
                                onClick={() => onChoiceSelect?.(section.id, 4)}
                                disabled={!isChoiceUnlocked(4)}
                            >
                                {isChoiceUnlocked(4) ? (
                                    <span className={styles.number}>{getChoiceLabel(4, '2')}</span>
                                ) : (
                                    <span className={styles.lockIcon} aria-hidden="true">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
                                        </svg>
                                    </span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default SectionCard;
