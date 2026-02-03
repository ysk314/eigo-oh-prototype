// ================================
// Login Page
// ================================

import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/Button';
import { useApp } from '@/context/AppContext';
import styles from './LoginPage.module.css';

export function LoginPage() {
    const navigate = useNavigate();
    const { state, addUser } = useApp();
    const [nameInput, setNameInput] = useState('');

    const hasUser = Boolean(state.currentUser);

    const welcomeMessage = useMemo(() => {
        const name = state.currentUser?.name?.trim();
        if (name && name !== 'ゲスト') {
            return `おかえりなさい、${name}さん`;
        }
        return 'ようこそ！';
    }, [state.currentUser]);

    const handleGuestStart = () => {
        navigate('/dashboard');
    };

    const handleCreateUser = (event: FormEvent) => {
        event.preventDefault();
        const trimmed = nameInput.trim();
        if (!trimmed) return;
        addUser(trimmed);
        setNameInput('');
        navigate('/dashboard');
    };

    return (
        <div className={styles.page}>
            <main className={styles.main}>
                <div className={styles.hero}>
                    <div className={styles.badge}>Tap! Type! English!</div>
                    <h1 className={styles.title}>タイピングで英語を身につけよう</h1>
                </div>

                <section className={styles.card}>
                    <div className={styles.cardHeader}>
                        <div>
                            <p className={styles.cardLabel}>ログイン</p>
                            <h2 className={styles.cardTitle}>{welcomeMessage}</h2>
                        </div>
                        <span className={styles.status}>ゲストモード</span>
                    </div>

                    {hasUser ? (
                        <div className={styles.actions}>
                            <Button size="lg" fullWidth onClick={handleGuestStart}>
                                続ける
                            </Button>
                            <Button size="lg" variant="secondary" fullWidth disabled>
                                メールでログイン（準備中）
                            </Button>
                        </div>
                    ) : (
                        <form className={styles.actions} onSubmit={handleCreateUser}>
                            <label className={styles.inputLabel} htmlFor="login-name">
                                はじめに名前を入力してください
                            </label>
                            <input
                                id="login-name"
                                className={styles.input}
                                type="text"
                                value={nameInput}
                                onChange={(event) => setNameInput(event.target.value)}
                                placeholder="例: さくら"
                                autoFocus
                            />
                            <Button size="lg" fullWidth type="submit">
                                はじめる
                            </Button>
                            <Button size="lg" variant="secondary" fullWidth disabled>
                                メールでログイン（準備中）
                            </Button>
                        </form>
                    )}

                    <p className={styles.note}>
                        ゲストの進捗はこの端末・ブラウザに保存されます。
                        端末を変えると引き継げないため、必要になったら本登録に切り替えてください。
                    </p>
                </section>
            </main>
        </div>
    );
}

export default LoginPage;
