// ================================
// Login Page
// ================================

import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInAnonymously, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { Button } from '@/components/Button';
import { useApp } from '@/context/AppContext';
import { auth } from '@/firebase';
import { saveRemoteProfile } from '@/utils/remoteStorage';
import { generateMemberNo, normalizeLoginId, isNumericId } from '@/utils/memberId';
import styles from './LoginPage.module.css';

type LoginMode = 'login' | 'signup';

export function LoginPage() {
    const navigate = useNavigate();
    const { state } = useApp();

    const [mode, setMode] = useState<LoginMode>('login');
    const [loginId, setLoginId] = useState('');
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
        if (!loginId.trim() || !password.trim()) {
            setErrorMessage('会員番号またはメールアドレスとパスワードを入力してください。');
            return;
        }

        setIsLoading(true);
        try {
            const normalized = normalizeLoginId(loginId);
            await signInWithEmailAndPassword(auth, normalized, password);
            navigate('/dashboard');
        } catch (error) {
            console.error(error);
            setErrorMessage('ログインに失敗しました。入力内容を確認してください。');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignupSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setErrorMessage('');

        if (!password.trim()) {
            setErrorMessage('パスワードを入力してください。');
            return;
        }

        setIsLoading(true);
        try {
            let email = loginId.trim();
            let memberNo = '';
            if (!email) {
                memberNo = await generateMemberNo();
                email = normalizeLoginId(memberNo);
            } else if (isNumericId(email)) {
                memberNo = email;
                email = normalizeLoginId(email);
            }

            const result = await createUserWithEmailAndPassword(auth, email, password);
            const name = displayName.trim() || (memberNo ? `会員${memberNo}` : email.split('@')[0]) || 'ユーザー';
            await saveRemoteProfile(result.user.uid, name, memberNo || undefined);

            navigate('/dashboard');
        } catch (error) {
            console.error(error);
            setErrorMessage('登録に失敗しました。入力内容を確認してください。');
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
                        <span className={styles.status}>会員番号 or メール</span>
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

                    {mode === 'login' ? (
                        <form className={styles.actions} onSubmit={handleLoginSubmit}>
                            <label className={styles.inputLabel} htmlFor="login-id">
                                会員番号またはメールアドレス
                            </label>
                            <input
                                id="login-id"
                                className={styles.input}
                                type="text"
                                value={loginId}
                                onChange={(event) => setLoginId(event.target.value)}
                                placeholder="例: 25000001"
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
                                autoComplete="current-password"
                            />

                            {errorMessage && <p className={styles.error}>{errorMessage}</p>}

                            <Button size="lg" fullWidth type="submit" isLoading={isLoading}>
                                ログイン
                            </Button>
                            <Button size="lg" variant="secondary" fullWidth type="button" onClick={handleGuestStart}>
                                ゲストで練習
                            </Button>
                        </form>
                    ) : (
                        <form className={styles.actions} onSubmit={handleSignupSubmit}>
                            <label className={styles.inputLabel} htmlFor="signup-id">
                                会員番号（空欄なら自動採番）またはメールアドレス
                            </label>
                            <input
                                id="signup-id"
                                className={styles.input}
                                type="text"
                                value={loginId}
                                onChange={(event) => setLoginId(event.target.value)}
                                placeholder="空欄で自動採番"
                                autoComplete="username"
                            />

                            <label className={styles.inputLabel} htmlFor="signup-name">
                                表示名（任意）
                            </label>
                            <input
                                id="signup-name"
                                className={styles.input}
                                type="text"
                                value={displayName}
                                onChange={(event) => setDisplayName(event.target.value)}
                                placeholder="例: さくら"
                            />

                            <label className={styles.inputLabel} htmlFor="signup-password">
                                パスワード
                            </label>
                            <input
                                id="signup-password"
                                className={styles.input}
                                type="password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                placeholder="8文字以上"
                                autoComplete="new-password"
                            />

                            {errorMessage && <p className={styles.error}>{errorMessage}</p>}
                            <Button size="lg" fullWidth type="submit" isLoading={isLoading}>
                                登録する
                            </Button>
                            <Button size="lg" variant="secondary" fullWidth type="button" onClick={handleGuestStart}>
                                ゲストで練習
                            </Button>
                        </form>
                    )}

                    <p className={styles.note}>
                        ゲストの進捗はこの端末・ブラウザに保存されます。
                        端末を変えると引き継げないため、必要になったら本登録に切り替えてください。
                    </p>
                    <div className={styles.adminLink}>
                        <Link to="/admin">管理者ページはこちら</Link>
                    </div>
                </section>
            </main>
        </div>
    );
}

export default LoginPage;
