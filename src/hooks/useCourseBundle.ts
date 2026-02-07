import { useEffect, useMemo, useState } from 'react';
import type { Course, Question } from '@/types';
import { courseCatalog, getCourseByIdAsync, getQuestionsByCourseIdAsync } from '@/data/questions';

type UseCourseBundleResult = {
    courseId: string | null;
    course: Course | undefined;
    questions: Question[];
    loading: boolean;
    error: string | null;
};

function resolveCourseId(courseId?: string | null): string | null {
    if (courseId) return courseId;
    return courseCatalog[0]?.id ?? null;
}

export function useCourseBundle(courseId?: string | null): UseCourseBundleResult {
    const resolvedCourseId = useMemo(() => resolveCourseId(courseId), [courseId]);
    const [course, setCourse] = useState<Course | undefined>(undefined);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!resolvedCourseId) {
            setCourse(undefined);
            setQuestions([]);
            setLoading(false);
            setError('コースが見つかりません。');
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);

        Promise.all([
            getCourseByIdAsync(resolvedCourseId),
            getQuestionsByCourseIdAsync(resolvedCourseId),
        ])
            .then(([nextCourse, nextQuestions]) => {
                if (cancelled) return;
                setCourse(nextCourse);
                setQuestions(nextQuestions);
            })
            .catch((loadError) => {
                if (cancelled) return;
                console.error('Failed to load course bundle:', loadError);
                setCourse(undefined);
                setQuestions([]);
                setError('コースデータの読み込みに失敗しました。');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [resolvedCourseId]);

    return {
        courseId: resolvedCourseId,
        course,
        questions,
        loading,
        error,
    };
}

export default useCourseBundle;
