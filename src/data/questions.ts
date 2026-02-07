// ================================
// Question Data (split by course)
// ================================

import { Course, Part, Question, Section } from '@/types';
import { courseStructure as aiCanCourse, questions as aiCanQuestions } from './courses/ai-can';
import { courseStructure as getThroughCourse, questions as getThroughQuestions } from './courses/getthrough';
import { courseStructure as scoreUpEast2Course, questions as scoreUpEast2Questions } from './courses/score-up-east2';
import { courseStructure as scoreUpEast3Course, questions as scoreUpEast3Questions } from './courses/score-up-east3';
import { courseStructure as alphabetStarterCourse, questions as alphabetStarterQuestions } from './courses/alphabet-starter';
import { courseStructure as typingFoundationCourse, questions as typingFoundationQuestions } from './courses/typing-foundation';

export const courses: Course[] = [
    aiCanCourse,
    getThroughCourse,
    scoreUpEast2Course,
    scoreUpEast3Course,
    alphabetStarterCourse,
    typingFoundationCourse,
];

export const questions: Question[] = [
    ...aiCanQuestions,
    ...getThroughQuestions,
    ...scoreUpEast2Questions,
    ...scoreUpEast3Questions,
    ...alphabetStarterQuestions,
    ...typingFoundationQuestions,
];

// Backward-compatible single-course export
export const courseStructure: Course = aiCanCourse;

// Helper functions
export function getCourseById(courseId?: string | null): Course | undefined {
    if (!courseId) return undefined;
    return courses.find(course => course.id === courseId);
}

export function getQuestionsByCourseId(courseId?: string | null): Question[] {
    if (!courseId) return questions;
    const course = getCourseById(courseId);
    if (!course) return questions;
    return questions.filter(q => q.course === course.name);
}

export function getQuestionById(id: string): Question | undefined {
    return questions.find(q => q.id === id);
}

export function getQuestionsBySection(
    partId: string,
    sectionType: string,
    courseId?: string | null
): Question[] {
    const pool = courseId ? getQuestionsByCourseId(courseId) : questions;
    return pool.filter(q => q.partId === partId && q.section === sectionType);
}

export function getParts(courseId?: string | null): Part[] {
    const course = getCourseById(courseId) ?? courseStructure;
    return course.units.flatMap(unit => unit.parts);
}

export function getSectionsByPart(partId: string, courseId?: string | null): Section[] {
    const part = getParts(courseId).find(p => p.id === partId);
    return part?.sections || [];
}
