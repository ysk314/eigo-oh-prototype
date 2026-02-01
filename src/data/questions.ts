// ================================
// Question Data (split by course)
// ================================

import { Course, Part, Question, Section } from '@/types';
import { courseStructure as aiCanCourse, questions as aiCanQuestions } from './courses/ai-can';

export const courses: Course[] = [aiCanCourse];

export const questions: Question[] = [
    ...aiCanQuestions,
];

// Backward-compatible single-course export
export const courseStructure: Course = aiCanCourse;

// Helper functions
export function getQuestionById(id: string): Question | undefined {
    return questions.find(q => q.id === id);
}

export function getQuestionsBySection(partId: string, sectionType: string): Question[] {
    return questions.filter(q => q.partId === partId && q.section === sectionType);
}

export function getParts(): Part[] {
    return courseStructure.units.flatMap(unit => unit.parts);
}

export function getSectionsByPart(partId: string): Section[] {
    const part = getParts().find(p => p.id === partId);
    return part?.sections || [];
}
