// ================================
// Login Page
// ================================

import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInAnonymously, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { Button } from '@/components/Button';
import { useApp } from '@/context/AppContext';
import { auth } from '@/firebase';
import { saveRemoteProfile } from '@/utils/remoteStorage';
import styles from './LoginPage.module.css';

type LoginMode = 'login' | 'signup';

export function LoginPage() {
    const navigate = useNavigate();
    const { state } = useApp();

    const [mode, setMode] = useState<LoginMode>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const welcomeMessage = useMemo(() => {
        const name = state.currentUser?.name?.trim();
        if (name && name !== 'ゲスト') {
            return `おかえりなさい、${name}さん`;
        }
        return 'ようこそ！';
    }, [state.currentUser]);

    const handleGuestStart = async () => {
        setErrorMessage('');
        setIsLoading(true);
        try {
            const result = await signInAnonymously(auth);
            await saveRemoteProfile(result.user.uid, 'ゲスト');
            navigate('/dashboard');
        } catch (error) {
            console.error(error);
            setErrorMessage('ゲストでの開始に失敗しました。時間を置いて再度お試しください。');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLoginSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setErrorMessage('');

        if (!email.trim() || !password.trim()) {
            setErrorMessage('メールアドレスとパスワードを入力してください。');
            return;
        }

        setIsLoading(true);
        try {
            if (mode === 'login') {
                await signInWithEmailAndPassword(auth, email.trim(), password);
                navigate('/dashboard');
                return;
            }

            const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
            const name = displayName.trim() || email.split('@')[0] || 'ユーザー';
            await saveRemoteProfile(result.user.uid, name);
            navigate('/dashboard');
        } catch (error) {
            console.error(error);
            if (mode === 'login') {
                setErrorMessage('ログインに失敗しました。メールアドレスとパスワードを確認してください。');
            } else {
                setErrorMessage('登録に失敗しました。入力内容を確認してください。');
            }
        } finally {
            setIsLoading(false);
        }
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
                        <span className={styles.status}>メールログイン</span>
                    </div>

                    <div className={styles.modeTabs}>
                        <button
                            type="button"
                            className={`${styles.modeTab} ${mode === 'login' ? styles.activeTab : ''}`}
                            onClick={() => setMode('login')}
                        >
                            ログイン
                        </button>
                        <button
                            type="button"
                            className={`${styles.modeTab} ${mode === 'signup' ? styles.activeTab : ''}`}
                            onClick={() => setMode('signup')}
                        >
                            新規登録
                        </button>
                    </div>

                    <form className={styles.actions} onSubmit={handleLoginSubmit}>
                        {mode === 'signup' && (
                            <>
                                <label className={styles.inputLabel} htmlFor="display-name">
                                    表示名（任意）
                                </label>
                                <input
                                    id="display-name"
                                    className={styles.input}
                                    type="text"
                                    value={displayName}
                                    onChange={(event) => setDisplayName(event.target.value)}
                                    placeholder="例: さくら"
                                />
                            </>
                        )}

                        <label className={styles.inputLabel} htmlFor="login-email">
                            メールアドレス
                        </label>
                        <input
                            id="login-email"
                            className={styles.input}
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder="example@email.com"
                            autoComplete="username"
                        />

                        <label className={styles.inputLabel} htmlFor="login-password">
                            パスワード
                        </label>
                        <input
                            id="login-password"
                            className={styles.input}
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder="8文字以上"
                            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                        />

                        {errorMessage && <p className={styles.error}>{errorMessage}</p>}

                        <Button size="lg" fullWidth type="submit" isLoading={isLoading}>
                            {mode === 'login' ? 'ログイン' : '登録する'}
                        </Button>
                        <Button size="lg" variant="secondary" fullWidth type="button" onClick={handleGuestStart}>
                            ゲストで練習
                        </Button>
                    </form>

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
