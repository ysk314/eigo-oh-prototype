// ================================
// Part List Component
// ================================

import { Unit } from '@/types';
import styles from './PartList.module.css';

interface PartListProps {
    units: Unit[];
    selectedPartId: string | null;
    onPartSelect: (unitId: string, partId: string) => void;
    getCompletedCount?: (partId: string) => number;
}

export function PartList({
    units,
    selectedPartId,
    onPartSelect,
    getCompletedCount = () => 0,
}: PartListProps) {
    return (
        <nav className={styles.list} aria-label="ユニットとパート一覧">
            {units.map((unit) => (
                <div key={unit.id} className={styles.unitBlock}>
                    <div className={styles.unitHeader}>{unit.name}</div>
                    <div className={styles.partList}>
                        {unit.parts.map((part) => {
                            const completed = getCompletedCount(part.id);
                            const isSelected = part.id === selectedPartId;
                            const isEmpty = part.totalQuestions === 0;

                            return (
                                <button
                                    key={part.id}
                                    className={`${styles.item} ${isSelected ? styles.selected : ''} ${isEmpty ? styles.empty : ''}`}
                                    onClick={() => !isEmpty && onPartSelect(unit.id, part.id)}
                                    disabled={isEmpty}
                                    aria-current={isSelected ? 'page' : undefined}
                                >
                                    <span className={styles.range}>{part.label}</span>
                                    <span className={styles.count}>
                                        {isEmpty ? '-' : `${completed}/${part.totalQuestions}`}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
        </nav>
    );
}

export default PartList;
