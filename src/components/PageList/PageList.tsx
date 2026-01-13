// ================================
// Page List Component
// ================================

import React from 'react';
import { PageRange } from '@/types';
import styles from './PageList.module.css';

interface PageListProps {
    pages: PageRange[];
    selectedPageId: string | null;
    onPageSelect: (pageId: string) => void;
    getCompletedCount?: (pageId: string) => number;
}

export function PageList({
    pages,
    selectedPageId,
    onPageSelect,
    getCompletedCount = () => 0,
}: PageListProps) {
    return (
        <nav className={styles.list} aria-label="ページ一覧">
            {pages.map((page) => {
                const completed = getCompletedCount(page.id);
                const isSelected = page.id === selectedPageId;
                const isEmpty = page.totalQuestions === 0;

                return (
                    <button
                        key={page.id}
                        className={`${styles.item} ${isSelected ? styles.selected : ''} ${isEmpty ? styles.empty : ''}`}
                        onClick={() => !isEmpty && onPageSelect(page.id)}
                        disabled={isEmpty}
                        aria-current={isSelected ? 'page' : undefined}
                    >
                        <span className={styles.range}>{page.range}</span>
                        <span className={styles.count}>
                            {isEmpty ? '-' : `${completed}/${page.totalQuestions}`}
                        </span>
                    </button>
                );
            })}
        </nav>
    );
}

export default PageList;
