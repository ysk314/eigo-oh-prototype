// ================================
// Grade Utilities
// ================================

export type SchoolType = 'elementary' | 'junior' | 'high' | 'other';

export function calculateGradeFromBirthDate(birthDate: string, baseDate = new Date()): {
    grade: number;
    schoolType: SchoolType;
} | null {
    const parsed = new Date(birthDate);
    if (Number.isNaN(parsed.getTime())) return null;

    const year = baseDate.getFullYear();
    let age = year - parsed.getFullYear();
    const cutoff = new Date(year, 3, 1);
    if (parsed > cutoff) {
        age -= 1;
    }

    if (age < 6) {
        return { grade: 0, schoolType: 'other' };
    }
    if (age <= 11) {
        return { grade: age - 5, schoolType: 'elementary' };
    }
    if (age <= 14) {
        return { grade: age - 11, schoolType: 'junior' };
    }
    if (age <= 17) {
        return { grade: age - 14, schoolType: 'high' };
    }

    return { grade: age - 17, schoolType: 'other' };
}
