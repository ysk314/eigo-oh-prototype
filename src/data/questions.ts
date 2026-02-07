// ================================
// Question Data Loader (course-split lazy loading)
// ================================

import type { Course, Part, Question, Section } from '@/types';

type CourseModule = {
    courseStructure: Course;
    questions: Question[];
};

type CourseCatalogItem = {
    id: string;
    name: string;
};

type CourseManifestItem = CourseCatalogItem & {
    load: () => Promise<CourseModule>;
};

const courseManifest: CourseManifestItem[] = [
    {
        id: 'course-1',
        name: 'あいキャン',
        load: async () => import('./courses/ai-can'),
    },
    {
        id: 'course-2',
        name: 'ゲットスルー2600',
        load: async () => import('./courses/getthrough'),
    },
    {
        id: 'course-score-up-east-2',
        name: 'NewHorizon中２',
        load: async () => import('./courses/score-up-east2'),
    },
    {
        id: 'course-newhorizon-3',
        name: 'NewHorizon中３',
        load: async () => import('./courses/score-up-east3'),
    },
    {
        id: 'course-alphabet-starter',
        name: 'Alphabet Starter',
        load: async () => import('./courses/alphabet-starter'),
    },
    {
        id: 'course-typing-foundation',
        name: 'Typing Foundation',
        load: async () => import('./courses/typing-foundation'),
    },
];

const manifestByCourseId = new Map(courseManifest.map((item) => [item.id, item]));
const courseCache = new Map<string, CourseModule>();
let totalSectionsCountCache: number | null = null;

export const courseCatalog: CourseCatalogItem[] = courseManifest.map(({ id, name }) => ({ id, name }));

function resolveCourseId(courseId?: string | null): string | null {
    if (courseId && manifestByCourseId.has(courseId)) return courseId;
    return courseManifest[0]?.id ?? null;
}

async function loadCourseModule(courseId?: string | null): Promise<CourseModule | null> {
    const resolvedCourseId = resolveCourseId(courseId);
    if (!resolvedCourseId) return null;

    const cached = courseCache.get(resolvedCourseId);
    if (cached) return cached;

    const manifest = manifestByCourseId.get(resolvedCourseId);
    if (!manifest) return null;

    const module = await manifest.load();
    const loaded: CourseModule = {
        courseStructure: module.courseStructure,
        questions: module.questions,
    };
    courseCache.set(resolvedCourseId, loaded);
    return loaded;
}

export async function preloadCourse(courseId?: string | null): Promise<void> {
    await loadCourseModule(courseId);
}

export async function ensureAllCoursesLoaded(): Promise<void> {
    await Promise.all(courseManifest.map((item) => loadCourseModule(item.id)));
}

export function getLoadedCourses(): Course[] {
    return courseCatalog
        .map((item) => courseCache.get(item.id)?.courseStructure)
        .filter((course): course is Course => Boolean(course));
}

export function getCourseById(courseId?: string | null): Course | undefined {
    const resolvedCourseId = resolveCourseId(courseId);
    if (!resolvedCourseId) return undefined;
    return courseCache.get(resolvedCourseId)?.courseStructure;
}

export async function getCourseByIdAsync(courseId?: string | null): Promise<Course | undefined> {
    const loaded = await loadCourseModule(courseId);
    return loaded?.courseStructure;
}

export function getQuestionsByCourseId(courseId?: string | null): Question[] {
    const resolvedCourseId = resolveCourseId(courseId);
    if (!resolvedCourseId) {
        return Array.from(courseCache.values()).flatMap((item) => item.questions);
    }
    return courseCache.get(resolvedCourseId)?.questions ?? [];
}

export async function getQuestionsByCourseIdAsync(courseId?: string | null): Promise<Question[]> {
    const resolvedCourseId = resolveCourseId(courseId);
    if (!resolvedCourseId) return [];
    const loaded = await loadCourseModule(resolvedCourseId);
    return loaded?.questions ?? [];
}

export function getQuestionById(id: string): Question | undefined {
    for (const item of courseCache.values()) {
        const found = item.questions.find((question) => question.id === id);
        if (found) return found;
    }
    return undefined;
}

export function getQuestionsBySection(
    partId: string,
    sectionType: string,
    courseId?: string | null
): Question[] {
    const pool = getQuestionsByCourseId(courseId);
    return pool.filter((question) => question.partId === partId && question.section === sectionType);
}

export async function getQuestionsBySectionAsync(
    partId: string,
    sectionType: string,
    courseId?: string | null
): Promise<Question[]> {
    const pool = await getQuestionsByCourseIdAsync(courseId);
    return pool.filter((question) => question.partId === partId && question.section === sectionType);
}

export function getParts(courseId?: string | null): Part[] {
    const course = getCourseById(courseId);
    return course ? course.units.flatMap((unit) => unit.parts) : [];
}

export function getSectionsByPart(partId: string, courseId?: string | null): Section[] {
    const part = getParts(courseId).find((item) => item.id === partId);
    return part?.sections ?? [];
}

export async function getSectionsByPartAsync(partId: string, courseId?: string | null): Promise<Section[]> {
    const course = await getCourseByIdAsync(courseId);
    if (!course) return [];
    const part = course.units.flatMap((unit) => unit.parts).find((item) => item.id === partId);
    return part?.sections ?? [];
}

export async function countTotalSectionsAcrossCourses(): Promise<number> {
    if (totalSectionsCountCache !== null) return totalSectionsCountCache;

    await ensureAllCoursesLoaded();
    const total = getLoadedCourses().reduce((acc, course) => {
        const count = course.units.flatMap((unit) => unit.parts).flatMap((part) => part.sections).length;
        return acc + count;
    }, 0);

    totalSectionsCountCache = total;
    return total;
}
