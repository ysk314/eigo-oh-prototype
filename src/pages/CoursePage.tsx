// ================================
// Course Page
// ================================

import { useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Header } from '@/components/Header';
import { SectionCard } from '@/components/SectionCard';
import { courseStructure, getSectionsByPart } from '@/data/questions';
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

    const sections = useMemo(() =>
        selectedPartId ? getSectionsByPart(selectedPartId) : [],
        [selectedPartId]
    );

    useEffect(() => {
        if (!state.selectedUnit && units[0]) {
            setUnit(units[0].id);
        }
        if (!state.selectedPart && units[0]?.parts[0]) {
            setPart(units[0].parts[0].id);
        }
    }, [state.selectedUnit, state.selectedPart, units, setUnit, setPart]);

    const handleUnitSelect = (unitId: string) => {
        setUnit(unitId);
        const nextUnit = units.find((unit) => unit.id === unitId);
        const nextPartId = nextUnit?.parts[0]?.id || null;
        setPart(nextPartId);
    };

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

    return (
        <div className={styles.page}>
            <Header
                breadcrumb={[courseStructure.name, selectedUnit?.name || '', selectedPartLabel]}
                showShuffleToggle
                showBackButton
                onBack={handleBack}
            />

            <div className={styles.content}>
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
                    {/* モード説明ヘッダー */}
                    <div className={styles.modeHeader}>
                        <div className={styles.modeLabel} data-mode="1">
                            <span className={styles.modeIcon}>🔊</span>
                            <span>音あり<br />スペルあり</span>
                        </div>
                        <div className={styles.modeLabel} data-mode="2">
                            <span className={styles.modeIcon}>🔊</span>
                            <span>音あり<br />スペルなし</span>
                        </div>
                        <div className={styles.modeLabel} data-mode="3">
                            <span className={styles.modeIcon}>🔇</span>
                            <span>音なし<br />スペルなし</span>
                        </div>
                    </div>

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
    );
}

export default CoursePage;
