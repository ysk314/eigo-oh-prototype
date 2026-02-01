// ================================
// Course Page
// ================================

import { useMemo, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Header } from '@/components/Header';
import { SectionCard } from '@/components/SectionCard';
import { courseStructure, getSectionsByPart, questions } from '@/data/questions';
import { LearningMode } from '@/types';
import styles from './CoursePage.module.css';

export function CoursePage() {
    const navigate = useNavigate();
    const { state, setUnit, setPart, setSection, setMode } = useApp();

    const units = courseStructure.units || [];
    const selectedUnitId = state.selectedUnit || units[0]?.id || null;
    const selectedPartId = state.selectedPart || units[0]?.parts[0]?.id || null;
    const selectedUnit = units.find((unit) => unit.id === selectedUnitId) || units[0] || null;
    const selectedPartLabel = selectedUnit?.parts.find((part) => part.id === selectedPartId)?.label || '';
    const [openUnitId, setOpenUnitId] = useState<string | null>(null);
    const [closingUnitId, setClosingUnitId] = useState<string | null>(null);
    const hasInitializedRef = useRef(false);
    const accordionItemRefs = useRef(new Map<string, HTMLElement>());
    const scrollAnimationRef = useRef<number | null>(null);
    const manualCloseRef = useRef(false);

    const questionIdToPartId = useMemo(() => {
        const map = new Map<string, string>();
        questions.forEach((question) => {
            map.set(question.id, question.partId);
        });
        return map;
    }, []);

    const partIdToUnitId = useMemo(() => {
        const map = new Map<string, string>();
        units.forEach((unit) => {
            unit.parts.forEach((part) => {
                map.set(part.id, unit.id);
            });
        });
        return map;
    }, [units]);

    const lastPlayed = useMemo(() => {
        let latestTime = 0;
        let unitId: string | null = null;
        let partId: string | null = null;

        Object.values(state.userProgress).forEach((progress) => {
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
    }, [state.userProgress, questionIdToPartId, partIdToUnitId]);

    const sections = useMemo(() =>
        selectedPartId ? getSectionsByPart(selectedPartId) : [],
        [selectedPartId]
    );

    useEffect(() => {
        if (hasInitializedRef.current || units.length === 0) return;

        const initialUnitId = lastPlayed.unitId ?? state.selectedUnit ?? units[0]?.id ?? null;
        const initialUnit = units.find((unit) => unit.id === initialUnitId) || units[0];
        const initialPartId =
            (lastPlayed.partId && initialUnit.parts.some((part) => part.id === lastPlayed.partId))
                ? lastPlayed.partId
                : (state.selectedPart && initialUnit.parts.some((part) => part.id === state.selectedPart))
                    ? state.selectedPart
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
        const offset = 12;

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

        window.setTimeout(() => {
            const rect = target.getBoundingClientRect();
            const viewHeight = window.innerHeight || 0;
            const shouldScroll = rect.top < offset || rect.top > viewHeight * 0.6;
            if (!shouldScroll) return;
            const top = rect.top + window.scrollY - offset;
            smoothScrollTo(top, 420);
        }, 120);
    }, [openUnitId]);

    const handlePartSelect = (unitId: string, partId: string) => {
        setUnit(unitId);
        setPart(partId);
    };

    const handleModeSelect = (sectionId: string, mode: LearningMode) => {
        if (!selectedPartId) return;
        setPart(selectedPartId);
        setSection(sectionId);
        setMode(mode);
        navigate('/play');
    };

    const handleBack = () => {
        navigate('/');
    };

    const getCompletedCount = (_partId: string) => {
        // TODO: 進捗から完了数を計算
        return 0;
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

    return (
        <div className={styles.page}>
            <Header
                breadcrumb={[courseStructure.name, selectedUnit?.name || '', selectedPartLabel]}
                showShuffleToggle
                showBackButton
                onBack={handleBack}
            />

            <div className={styles.content}>
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
                                    <span className={styles.accordionTitle}>{unit.name}</span>
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

                                        <div className={styles.sections}>
                                            {sections.length > 0 ? (
                                                sections.map((section) => (
                                                    <SectionCard
                                                        key={section.id}
                                                        section={section}
                                                        completedCount={0}
                                                        onModeSelect={handleModeSelect}
                                                    />
                                                ))
                                            ) : (
                                                <div className={styles.emptyState}>
                                                    <p>このパートにはまだ問題がありません</p>
                                                </div>
                                            )}
                                        </div>
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
                                                <span className={styles.navLabel}>{unit.name}</span>
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
                        <div className={styles.sections}>
                            {sections.length > 0 ? (
                                sections.map((section) => (
                                    <SectionCard
                                        key={section.id}
                                        section={section}
                                        completedCount={0}
                                        onModeSelect={handleModeSelect}
                                    />
                                ))
                            ) : (
                                <div className={styles.emptyState}>
                                    <p>このパートにはまだ問題がありません</p>
                                </div>
                            )}
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
}

export default CoursePage;
