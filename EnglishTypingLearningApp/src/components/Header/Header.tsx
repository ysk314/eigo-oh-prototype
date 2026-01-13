// ================================
// Header Component
// ================================

import React from 'react';
import { useApp } from '@/context/AppContext';
import styles from './Header.module.css';

interface HeaderProps {
    title?: string;
    breadcrumb?: string[];
    showUserSelect?: boolean;
    showShuffleToggle?: boolean;
    showBackButton?: boolean;
    onBack?: () => void;
}

export function Header({
    title,
    breadcrumb = [],
    showUserSelect = true,
    showShuffleToggle = false,
    showBackButton = false,
    onBack,
}: HeaderProps) {
    const { state, setUser, toggleShuffle } = useApp();

    const handleUserChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const user = state.users.find(u => u.id === e.target.value);
        if (user) {
            setUser(user);
        }
    };

    return (
        <header className={styles.header}>
            <div className={styles.left}>
                {showBackButton && onBack && (
                    <button
                        className={styles.backButton}
                        onClick={onBack}
                        aria-label="戻る"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M15 18l-6-6 6-6" />
                        </svg>
                    </button>
                )}

                {breadcrumb.length > 0 ? (
                    <nav className={styles.breadcrumb} aria-label="パンくずリスト">
                        {breadcrumb.map((item, index) => (
                            <React.Fragment key={index}>
                                {index > 0 && <span className={styles.separator}>/</span>}
                                <span className={index === breadcrumb.length - 1 ? styles.current : ''}>
                                    {item}
                                </span>
                            </React.Fragment>
                        ))}
                    </nav>
                ) : title ? (
                    <h1 className={styles.title}>{title}</h1>
                ) : null}
            </div>

            <div className={styles.right}>
                {showShuffleToggle && (
                    <div className={styles.shuffleToggle}>
                        <span className={styles.shuffleLabel}>シャッフルモード</span>
                        <button
                            className={`${styles.toggleButton} ${state.shuffleMode ? styles.active : ''}`}
                            onClick={toggleShuffle}
                            role="switch"
                            aria-checked={state.shuffleMode}
                        >
                            <span className={styles.toggleOption} data-active={state.shuffleMode}>ON</span>
                            <span className={styles.toggleOption} data-active={!state.shuffleMode}>OFF</span>
                        </button>
                    </div>
                )}

                {showUserSelect && state.users.length > 0 && (
                    <div className={styles.userSelect}>
                        <select
                            value={state.currentUser?.id || ''}
                            onChange={handleUserChange}
                            className={styles.select}
                        >
                            {state.users.map(user => (
                                <option key={user.id} value={user.id}>
                                    {user.name}
                                </option>
                            ))}
                        </select>
                        <span className={styles.selectIcon}>▼</span>
                    </div>
                )}
            </div>
        </header>
    );
}

export default Header;
