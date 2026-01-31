// ================================
// Course Page
// ================================

import { useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Header } from '@/components/Header';
import { PartList } from '@/components/PartList';
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
                    <PartList
                        units={units}
                        selectedPartId={selectedPartId}
                        onPartSelect={handlePartSelect}
                        getCompletedCount={getCompletedCount}
                    />
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
