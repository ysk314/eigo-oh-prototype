// ================================
// Course Page
// ================================

import { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { flushSync } from 'react-dom';
import { useApp } from '@/context/AppContext';
import { Header } from '@/components/Header';
import { SectionList } from '@/components/SectionList';
import { Button } from '@/components/Button';
import { courseCatalog } from '@/data/questions';
import { useCourseBundle } from '@/hooks/useCourseBundle';
import { LearningMode, ChoiceLevel } from '@/types';
import { logEvent } from '@/utils/analytics';
import styles from './CoursePage.module.css';

export function CoursePage() {
    const navigate = useNavigate();
    const { state, setCourse, setUnit, setPart, setSection, setMode, setStudyMode, setChoiceLevel } = useApp();

    const {
        courseId: activeCourseId,
        course: currentCourse,
        questions: courseQuestions,
        loading: courseLoading,
        error: courseError,
    } = useCourseBundle(state.selectedCourse);
    const formatUnitLabel = useCallback((name?: string | null) => {
        if (!name) return '';
        const stripped = name.replace(/^unit\s*\d+\s*[:：]\s*/i, '').trim();
        return stripped || name;
    }, []);
    const units = useMemo(() => currentCourse?.units ?? [], [currentCourse]);
    const selectedUnitId = state.selectedUnit || units[0]?.id || null;
    const selectedUnit = units.find((unit) => unit.id === selectedUnitId) || units[0] || null;
    const selectedUnitLabel = formatUnitLabel(selectedUnit?.name);
    const selectedPartId = state.selectedPart || selectedUnit?.parts[0]?.id || null;
    const selectedPartLabel = selectedUnit?.parts.find((part) => part.id === selectedPartId)?.label || '';
    const [openUnitId, setOpenUnitId] = useState<string | null>(null);
    const [closingUnitId, setClosingUnitId] = useState<string | null>(null);
    const hasInitializedRef = useRef(false);
    const accordionItemRefs = useRef(new Map<string, HTMLElement>());
    const scrollAnimationRef = useRef<number | null>(null);
    const manualCloseRef = useRef(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.scrollTo(0, 0);
    }, []);

    const questionIdToPartId = useMemo(() => {
        const map = new Map<string, string>();
        courseQuestions.forEach((question) => {
            map.set(question.id, question.partId);
        });
        return map;
    }, [courseQuestions]);

    const partIdToUnitId = useMemo(() => {
        const map = new Map<string, string>();
        units.forEach((unit) => {
            unit.parts.forEach((part) => {
                map.set(part.id, unit.id);
            });
        });
        return map;
    }, [units]);

    const sectionIdToPartUnit = useMemo(() => {
        const map = new Map<string, { partId: string; unitId: string }>();
        units.forEach((unit) => {
            unit.parts.forEach((part) => {
                part.sections.forEach((section) => {
                    map.set(section.id, { partId: part.id, unitId: unit.id });
                });
            });
        });
        return map;
    }, [units]);

    const lastPlayed = useMemo(() => {
        let latestTime = 0;
        let unitId: string | null = null;
        let partId: string | null = null;
        const currentUserId = state.currentUser?.id;
        const progressEntries = currentUserId
            ? Object.entries(state.userProgress)
                .filter(([key]) => key.startsWith(`${currentUserId}-`))
                .map(([, progress]) => progress)
            : Object.values(state.userProgress);

        progressEntries.forEach((progress) => {
            if (!progress.lastPlayedAt) return;
            const timestamp = Date.parse(progress.lastPlayedAt);
            if (Number.isNaN(timestamp) || timestamp <= latestTime) return;

            const questionPartId = questionIdToPartId.get(progress.questionId);
            if (!questionPartId) return;
            const questionUnitId = partIdToUnitId.get(questionPartId);
            if (!questionUnitId) return;

            latestTime = timestamp;
            unitId = questionUnitId;
            partId = questionPartId;
        });

        return { unitId, partId };
    }, [state.currentUser?.id, state.userProgress, questionIdToPartId, partIdToUnitId]);

    const sections = useMemo(
        () => selectedUnit?.parts.find((part) => part.id === selectedPartId)?.sections ?? [],
        [selectedUnit, selectedPartId]
    );

    const progressQuestionIds = useMemo(() => {
        if (!state.currentUser) return new Set<string>();
        const prefix = `${state.currentUser.id}-`;
        return new Set(
            Object.keys(state.userProgress)
                .filter((key) => key.startsWith(prefix))
                .map((key) => key.slice(prefix.length))
        );
    }, [state.currentUser, state.userProgress]);

    useEffect(() => {
        if (state.selectedCourse || !courseCatalog[0]) return;
        setCourse(courseCatalog[0].id);
    }, [state.selectedCourse, setCourse]);

    useEffect(() => {
        if (!state.selectedSection) return;
        if (state.selectedPart && state.selectedUnit) return;
        const match = sectionIdToPartUnit.get(state.selectedSection);
        if (!match) return;
        setUnit(match.unitId);
        setPart(match.partId);
    }, [state.selectedSection, state.selectedPart, state.selectedUnit, sectionIdToPartUnit, setUnit, setPart]);

    useEffect(() => {
        if (hasInitializedRef.current || units.length === 0) return;

        const initialUnitId = state.selectedUnit ?? lastPlayed.unitId ?? units[0]?.id ?? null;
        const initialUnit = units.find((unit) => unit.id === initialUnitId) || units[0];
        const initialPartId =
            (state.selectedPart && initialUnit.parts.some((part) => part.id === state.selectedPart))
                ? state.selectedPart
                : (lastPlayed.partId && initialUnit.parts.some((part) => part.id === lastPlayed.partId))
                    ? lastPlayed.partId
                    : initialUnit.parts[0]?.id || null;

        if (initialUnit?.id) {
            setUnit(initialUnit.id);
        }
        if (initialPartId) {
            setPart(initialPartId);
        }

        hasInitializedRef.current = true;
    }, [lastPlayed.unitId, lastPlayed.partId, state.selectedUnit, state.selectedPart, units, setUnit, setPart]);

    useEffect(() => {
        if (closingUnitId === null) return;
        const timer = window.setTimeout(() => {
            setOpenUnitId(null);
            setClosingUnitId(null);
        }, 100);
        return () => window.clearTimeout(timer);
    }, [closingUnitId]);

    const handleUnitSelect = (unitId: string) => {
        hasInitializedRef.current = true;
        setUnit(unitId);
        const nextUnit = units.find((unit) => unit.id === unitId);
        const nextPartId =
            (selectedPartId && nextUnit?.parts.some((part) => part.id === selectedPartId))
                ? selectedPartId
                : nextUnit?.parts[0]?.id || null;
        setPart(nextPartId);
    };

    const handleUnitToggle = (unitId: string) => {
        if (closingUnitId) return;
        if (unitId === openUnitId) {
            manualCloseRef.current = true;
            setClosingUnitId(unitId);
            return;
        }
        manualCloseRef.current = false;
        setOpenUnitId(unitId);
        handleUnitSelect(unitId);
    };

    useEffect(() => {
        if (!openUnitId) return;
        if (typeof window === 'undefined') return;
        if (!window.matchMedia('(max-width: 768px)').matches) return;

        const target = accordionItemRefs.current.get(openUnitId);
        if (!target) return;
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const headerEl = document.querySelector('header');
        const headerHeight = headerEl ? headerEl.getBoundingClientRect().height : 0;
        const offset = headerHeight + 12;

        if (scrollAnimationRef.current) {
            cancelAnimationFrame(scrollAnimationRef.current);
            scrollAnimationRef.current = null;
        }

        const smoothScrollTo = (top: number, durationMs: number) => {
            if (prefersReducedMotion) {
                window.scrollTo({ top, behavior: 'auto' });
                return;
            }

            const startTop = window.scrollY;
            const delta = top - startTop;
            const startTime = performance.now();

            const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
            const tick = (now: number) => {
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / durationMs, 1);
                const nextTop = startTop + delta * easeOutCubic(progress);
                window.scrollTo(0, nextTop);
                if (progress < 1) {
                    scrollAnimationRef.current = requestAnimationFrame(tick);
                } else {
                    scrollAnimationRef.current = null;
                }
            };

            scrollAnimationRef.current = requestAnimationFrame(tick);
        };

        const openAnimationMs = 360;
        window.setTimeout(() => {
            const rect = target.getBoundingClientRect();
            const top = rect.top + window.scrollY - offset;
            smoothScrollTo(top, 420);
        }, openAnimationMs);
    }, [openUnitId]);

    const handlePartSelect = (unitId: string, partId: string) => {
        hasInitializedRef.current = true;
        setUnit(unitId);
        setPart(partId);
    };

    const handleModeSelect = (sectionId: string, mode: LearningMode) => {
        if (!selectedPartId) return;
        hasInitializedRef.current = true;
        flushSync(() => {
            setPart(selectedPartId);
            setSection(sectionId);
            setMode(mode);
            setStudyMode('typing');
        });
        logEvent({
            eventType: 'section_launch_clicked',
            userId: state.currentUser?.id ?? null,
            payload: {
                sectionId,
                studyMode: 'typing',
                level: mode,
                courseId: activeCourseId ?? null,
                unitId: selectedUnitId ?? null,
                partId: selectedPartId,
            },
        }).catch(() => {});
        navigate('/play', {
            state: {
                courseId: activeCourseId ?? undefined,
                unitId: selectedUnitId ?? undefined,
                partId: selectedPartId,
                sectionId,
                mode,
            },
        });
    };

    const handleChoiceSelect = (sectionId: string, level: ChoiceLevel) => {
        if (!selectedPartId) return;
        hasInitializedRef.current = true;
        const unitId = partIdToUnitId.get(selectedPartId) ?? selectedUnitId;
        flushSync(() => {
            if (unitId) {
                setUnit(unitId);
            }
            setPart(selectedPartId);
            setSection(sectionId);
            setChoiceLevel(level);
            setStudyMode('choice');
        });
        logEvent({
            eventType: 'section_launch_clicked',
            userId: state.currentUser?.id ?? null,
            payload: {
                sectionId,
                studyMode: 'choice',
                level,
                courseId: activeCourseId ?? null,
                unitId: selectedUnitId ?? null,
                partId: selectedPartId,
            },
        }).catch(() => {});
        navigate('/choice', {
            state: {
                courseId: activeCourseId ?? undefined,
                unitId: unitId ?? undefined,
                partId: selectedPartId,
                sectionId,
                level,
            },
        });
    };

    const handleBack = () => {
        navigate('/dashboard');
    };

    const getCompletedCount = (partId: string) => {
        const partSections = units
            .flatMap((unit) => unit.parts)
            .find((part) => part.id === partId)
            ?.sections ?? [];
        return partSections.reduce((sum, section) => {
            const completed = section.questionIds.filter((questionId) => progressQuestionIds.has(questionId)).length;
            return sum + completed;
        }, 0);
    };

    const getSectionCompletedCount = (questionIds: string[]) => {
        return questionIds.filter((questionId) => progressQuestionIds.has(questionId)).length;
    };

    const sectionProgressRows = useMemo(() => {
        return sections.map((section) => ({
            section,
            completed: section.questionIds.filter((questionId) => progressQuestionIds.has(questionId)).length,
            total: section.questionIds.length,
        }));
    }, [sections, progressQuestionIds]);

    const startedSectionsCount = sectionProgressRows.filter((row) => row.completed > 0).length;
    const completedSectionsCount = sectionProgressRows.filter((row) => row.completed === row.total && row.total > 0).length;
    const recommendedSection = sectionProgressRows.find((row) => row.completed < row.total) ?? sectionProgressRows[0];

    const handleStartRecommended = () => {
        if (!recommendedSection) return;
        if (state.studyMode === 'choice') {
            handleChoiceSelect(recommendedSection.section.id, 1);
            return;
        }
        handleModeSelect(recommendedSection.section.id, 1);
    };

    const getUnitTotalQuestions = (unitId: string) => {
        const unit = units.find((item) => item.id === unitId);
        if (!unit) return 0;
        return unit.parts.reduce((sum, part) => sum + part.totalQuestions, 0);
    };

    useEffect(() => {
        if (openUnitId) return;
        if (manualCloseRef.current) return;
        if (!state.selectedUnit) return;
        if (!units.some((unit) => unit.id === state.selectedUnit)) return;
        setOpenUnitId(state.selectedUnit);
    }, [openUnitId, state.selectedUnit, units]);

    if (courseLoading) {
        return (
            <div className={styles.page}>
                <div className={styles.stickyHeader}>
                    <Header
                        breadcrumb={['コース読込中', '', '']}
                        showShuffleToggle
                        showBackButton
                        showStudyModeToggle
                        onBack={handleBack}
                    />
                </div>
                <div className={styles.content}>
                    <div className={styles.emptyState}>コースデータを読み込んでいます…</div>
                </div>
            </div>
        );
    }

    if (!currentCourse) {
        return (
            <div className={styles.page}>
                <div className={styles.stickyHeader}>
                    <Header
                        breadcrumb={['コース未選択', '', '']}
                        showBackButton
                        onBack={handleBack}
                    />
                </div>
                <div className={styles.content}>
                    <div className={styles.emptyState}>{courseError ?? 'コースが見つかりません。'}</div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <div className={styles.stickyHeader}>
                <Header
                    breadcrumb={[currentCourse?.name || '', selectedUnitLabel || '', selectedPartLabel]}
                    showShuffleToggle
                    showBackButton
                    showStudyModeToggle
                    onBack={handleBack}
                />
            </div>

            <div className={styles.content}>
                <section className={styles.flowPanel}>
                    <div className={styles.flowHeader}>
                        <div>
                            <h2 className={styles.flowTitle}>学習ナビ</h2>
                            <p className={styles.flowSub}>
                                {selectedUnitLabel || '-'} / {selectedPartLabel || '-'}
                            </p>
                        </div>
                        <div className={styles.flowActions}>
                            <Button variant="primary" size="sm" onClick={handleStartRecommended} disabled={!recommendedSection}>
                                {state.studyMode === 'choice' ? '4択でおすすめ開始' : 'タイピングでおすすめ開始'}
                            </Button>
                            {recommendedSection && (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                        setSection(recommendedSection.section.id);
                                    }}
                                >
                                    セクションを選択
                                </Button>
                            )}
                        </div>
                    </div>
                    <div className={styles.flowStats}>
                        <div className={styles.flowStat}>
                            <span>開始済み</span>
                            <strong>{startedSectionsCount}</strong>
                        </div>
                        <div className={styles.flowStat}>
                            <span>完了</span>
                            <strong>{completedSectionsCount}</strong>
                        </div>
                        <div className={styles.flowStat}>
                            <span>対象セクション</span>
                            <strong>{sectionProgressRows.length}</strong>
                        </div>
                    </div>
                    <div className={styles.flowNext}>
                        {recommendedSection
                            ? `次の候補: ${recommendedSection.section.label} (${recommendedSection.completed}/${recommendedSection.total})`
                            : 'このパートにはまだセクションがありません。'}
                    </div>
                </section>

                <div className={styles.mobileAccordion} aria-label="ユニット一覧">
                    {units.map((unit) => {
                        const totalQuestions = getUnitTotalQuestions(unit.id);
                        const isSelected = unit.id === selectedUnitId;
                        const isEmpty = totalQuestions === 0;
                        const isOpen = unit.id === openUnitId;
                        const isClosing = unit.id === closingUnitId;

                        return (
                            <section
                                key={unit.id}
                                className={styles.accordionItem}
                                ref={(node) => {
                                    if (node) {
                                        accordionItemRefs.current.set(unit.id, node);
                                    } else {
                                        accordionItemRefs.current.delete(unit.id);
                                    }
                                }}
                            >
                                <button
                                    className={`${styles.accordionButton} ${isSelected ? styles.selected : ''} ${isEmpty ? styles.empty : ''}`}
                                    onClick={() => !isEmpty && handleUnitToggle(unit.id)}
                                    disabled={isEmpty}
                                    aria-expanded={isOpen}
                                    aria-controls={`unit-panel-${unit.id}`}
                                >
                                    <span className={styles.accordionTitle}>{formatUnitLabel(unit.name)}</span>
                                    <span className={styles.accordionMeta}>
                                        {isEmpty ? '-' : `${totalQuestions}問`}
                                    </span>
                                </button>

                                <div
                                    id={`unit-panel-${unit.id}`}
                                    className={`${styles.accordionPanel} ${isOpen ? styles.accordionPanelOpen : ''} ${isClosing ? styles.accordionPanelClosing : ''}`}
                                    aria-hidden={!isOpen}
                                >
                                    <div className={styles.accordionPanelContent}>
                                        <div className={styles.mobilePartList} aria-label="パート一覧">
                                            {(unit.parts || []).map((part) => {
                                                const completed = getCompletedCount(part.id);
                                                const isPartSelected = part.id === selectedPartId;
                                                const isPartEmpty = part.totalQuestions === 0;

                                                return (
                                                    <button
                                                        key={part.id}
                                                        className={`${styles.navItem} ${isPartSelected ? styles.selected : ''} ${isPartEmpty ? styles.empty : ''}`}
                                                        onClick={() => !isPartEmpty && handlePartSelect(unit.id, part.id)}
                                                        disabled={isPartEmpty}
                                                        aria-current={isPartSelected ? 'page' : undefined}
                                                    >
                                                        <span className={styles.navLabel}>{part.label}</span>
                                                        <span className={styles.navCount}>
                                                            {isPartEmpty ? '-' : `${completed}/${part.totalQuestions}`}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <SectionList
                                            sections={sections}
                                            modeType={state.studyMode}
                                            onModeSelect={handleModeSelect}
                                            onChoiceSelect={handleChoiceSelect}
                                            getCompletedCount={getSectionCompletedCount}
                                            className={styles.sections}
                                            emptyClassName={styles.emptyState}
                                        />
                                    </div>
                                </div>
                            </section>
                        );
                    })}
                </div>

                <div className={styles.desktopLayout}>
                    {/* 左サイドバー: Unit / Part 一覧 */}
                    <aside className={styles.sidebar}>
                        <div className={styles.sidebarGrid}>
                            <section className={styles.sidebarColumn} aria-label="ユニット一覧">
                                <h3 className={styles.sidebarTitle}>Unit</h3>
                                <div className={styles.navList}>
                                    {units.map((unit) => {
                                        const totalQuestions = getUnitTotalQuestions(unit.id);
                                        const isSelected = unit.id === selectedUnitId;
                                        const isEmpty = totalQuestions === 0;

                                        return (
                                            <button
                                                key={unit.id}
                                                className={`${styles.navItem} ${isSelected ? styles.selected : ''} ${isEmpty ? styles.empty : ''}`}
                                                onClick={() => !isEmpty && handleUnitSelect(unit.id)}
                                                disabled={isEmpty}
                                                aria-current={isSelected ? 'page' : undefined}
                                            >
                                                <span className={styles.navLabel}>{formatUnitLabel(unit.name)}</span>
                                                <span className={styles.navCount}>
                                                    {isEmpty ? '-' : `${totalQuestions}問`}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>

                            <section className={styles.sidebarColumn} aria-label="パート一覧">
                                <h3 className={styles.sidebarTitle}>Part</h3>
                                <div className={styles.navList}>
                                    {(selectedUnit?.parts || []).map((part) => {
                                        const completed = getCompletedCount(part.id);
                                        const isSelected = part.id === selectedPartId;
                                        const isEmpty = part.totalQuestions === 0;

                                        return (
                                            <button
                                                key={part.id}
                                                className={`${styles.navItem} ${isSelected ? styles.selected : ''} ${isEmpty ? styles.empty : ''}`}
                                                onClick={() => !isEmpty && handlePartSelect(selectedUnit?.id || '', part.id)}
                                                disabled={isEmpty}
                                                aria-current={isSelected ? 'page' : undefined}
                                            >
                                                <span className={styles.navLabel}>{part.label}</span>
                                                <span className={styles.navCount}>
                                                    {isEmpty ? '-' : `${completed}/${part.totalQuestions}`}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>
                        </div>
                    </aside>

                    {/* メインエリア: セクションカード */}
                    <main className={styles.main}>
                        {/* セクションリスト */}
                        <SectionList
                            sections={sections}
                            modeType={state.studyMode}
                            onModeSelect={handleModeSelect}
                            onChoiceSelect={handleChoiceSelect}
                            getCompletedCount={getSectionCompletedCount}
                            className={styles.sections}
                            emptyClassName={styles.emptyState}
                        />
                    </main>
                </div>
            </div>
        </div>
    );
}

export default CoursePage;
