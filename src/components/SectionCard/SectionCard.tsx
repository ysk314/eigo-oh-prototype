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
                <div className={styles.choiceModes}>
                    <button
                        className={`${styles.choiceButton} ${styles.choiceButtonPrimary}`}
                        onClick={() => onChoiceSelect?.(section.id, 1)}
                    >
                        英語表示あり
                    </button>
                    <button
                        className={styles.choiceButton}
                        onClick={() => onChoiceSelect?.(section.id, 2)}
                    >
                        英語表示なし
                    </button>
                </div>
            )}
        </div>
    );
}

export default SectionCard;
