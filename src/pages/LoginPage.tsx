// ================================
// Login Page
// ================================

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/Button';
import { useApp } from '@/context/AppContext';
import styles from './LoginPage.module.css';

export function LoginPage() {
    const navigate = useNavigate();
    const { state } = useApp();

    const displayName = useMemo(() => {
        if (!state.currentUser) return 'ゲスト';
        return state.currentUser.name || 'ゲスト';
    }, [state.currentUser]);

    const handleGuestStart = () => {
        navigate('/dashboard');
    };

    return (
        <div className={styles.page}>
            <main className={styles.main}>
                <div className={styles.hero}>
                    <div className={styles.badge}>Tap! Type! English!</div>
                    <h1 className={styles.title}>タイピングで英語を身につけよう</h1>
                    <p className={styles.subtitle}>
                        まずはゲストで始めて、学習の流れを体験できます。
                    </p>
                </div>

                <section className={styles.card}>
                    <div className={styles.cardHeader}>
                        <div>
                            <p className={styles.cardLabel}>ようこそ</p>
                            <h2 className={styles.cardTitle}>{displayName} さん</h2>
                        </div>
                        <span className={styles.status}>匿名ログイン準備中</span>
                    </div>

                    <div className={styles.actions}>
                        <Button size="lg" fullWidth onClick={handleGuestStart}>
                            ゲストで始める
                        </Button>
                        <Button size="lg" variant="secondary" fullWidth disabled>
                            メールでログイン（準備中）
                        </Button>
                    </div>

                    <p className={styles.note}>
                        進捗は自動で保存されます。あとから本登録に切り替え可能です。
                    </p>
                </section>
            </main>
        </div>
    );
}

export default LoginPage;
