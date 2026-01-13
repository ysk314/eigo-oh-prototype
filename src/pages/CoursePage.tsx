// ================================
// Course Page
// ================================

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Header } from '@/components/Header';
import { PageList } from '@/components/PageList';
import { SectionCard } from '@/components/SectionCard';
import { courseStructure, getSectionsByPageRange } from '@/data/questions';
import { LearningMode } from '@/types';
import styles from './CoursePage.module.css';

export function CoursePage() {
    const navigate = useNavigate();
    const { state, setPageRange, setSection, setMode } = useApp();

    const selectedPageId = state.selectedPageRange || courseStructure.units[0]?.pages[0]?.id;
    const pages = courseStructure.units[0]?.pages || [];
    const sections = useMemo(() =>
        getSectionsByPageRange(selectedPageId),
        [selectedPageId]
    );

    const handlePageSelect = (pageId: string) => {
        setPageRange(pageId);
    };

    const handleModeSelect = (sectionId: string, mode: LearningMode) => {
        setSection(sectionId);
        setMode(mode);
        navigate('/play');
    };

    const handleBack = () => {
        navigate('/');
    };

    const getCompletedCount = (_pageId: string) => {
        // TODO: 進捗から完了数を計算
        return 0;
    };

    return (
        <div className={styles.page}>
            <Header
                breadcrumb={[courseStructure.name, courseStructure.units[0]?.name || '']}
                showShuffleToggle
                showBackButton
                onBack={handleBack}
            />

            <div className={styles.content}>
                {/* 左サイドバー: ページ一覧 */}
                <aside className={styles.sidebar}>
                    <PageList
                        pages={pages}
                        selectedPageId={selectedPageId}
                        onPageSelect={handlePageSelect}
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
                                <p>このページにはまだ問題がありません</p>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}

export default CoursePage;
