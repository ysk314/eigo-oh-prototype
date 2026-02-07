// ================================
// Section List Component
// ================================

import type { Section, LearningMode, ChoiceLevel, StudyMode } from '@/types';
import { SectionCard } from '@/components/SectionCard';

interface SectionListProps {
    sections: Section[];
    modeType: StudyMode;
    onModeSelect: (sectionId: string, mode: LearningMode) => void;
    onChoiceSelect?: (sectionId: string, level: ChoiceLevel) => void;
    getCompletedCount?: (questionIds: string[]) => number;
    className?: string;
    emptyClassName?: string;
    emptyMessage?: string;
}

export function SectionList({
    sections,
    modeType,
    onModeSelect,
    onChoiceSelect,
    getCompletedCount = () => 0,
    className,
    emptyClassName,
    emptyMessage = 'このパートにはまだ問題がありません',
}: SectionListProps) {
    if (sections.length === 0) {
        return (
            <div className={emptyClassName}>
                <p>{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div className={className}>
            {sections.map((section) => (
                <SectionCard
                    key={section.id}
                    section={section}
                    completedCount={getCompletedCount(section.questionIds)}
                    onModeSelect={onModeSelect}
                    onChoiceSelect={onChoiceSelect}
                    modeType={modeType}
                />
            ))}
        </div>
    );
}

export default SectionList;
