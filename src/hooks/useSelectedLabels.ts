// ================================
// useSelectedLabels Hook
// ================================

import { useMemo } from 'react';
import type { Course } from '@/types';

interface SelectedLabels {
    unitLabel: string;
    partLabel: string;
    sectionLabel: string;
}

export function useSelectedLabels(
    course: Course | undefined,
    selectedUnitId?: string | null,
    selectedPartId?: string | null,
    selectedSectionId?: string | null
): SelectedLabels {
    const unitLabel = useMemo(() => {
        if (!selectedUnitId) return '';
        return course?.units.find((unit) => unit.id === selectedUnitId)?.name || '';
    }, [course, selectedUnitId]);

    const partLabel = useMemo(() => {
        if (!selectedPartId) return '';
        const part = course?.units.flatMap((unit) => unit.parts).find((item) => item.id === selectedPartId);
        return part?.label || '';
    }, [course, selectedPartId]);

    const sectionLabel = useMemo(() => {
        if (!selectedPartId || !selectedSectionId) return '';
        const section = course?.units
            .flatMap((unit) => unit.parts)
            .find((part) => part.id === selectedPartId)
            ?.sections
            .find((item) => item.id === selectedSectionId);
        return section?.label || '';
    }, [selectedPartId, selectedSectionId, course]);

    return { unitLabel, partLabel, sectionLabel };
}

export default useSelectedLabels;
