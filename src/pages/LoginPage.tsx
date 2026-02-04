// ================================
// Login Page
// ================================

import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/Button';
import { useApp } from '@/context/AppContext';
import { changePassword, createGuest, loginWithMember, signInWithToken } from '@/utils/authApi';
import styles from './LoginPage.module.css';

export function LoginPage() {
    const navigate = useNavigate();
    const { state } = useApp();

    const [loginId, setLoginId] = useState('');
    const [password, setPassword] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [pendingMemberNo, setPendingMemberNo] = useState('');
    const [pendingPassword, setPendingPassword] = useState('');

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
            const result = await createGuest();
            await signInWithToken(result.customToken);
            navigate('/dashboard');
        } catch (error) {
            console.error(error);
            setErrorMessage('ゲスト作成に失敗しました。時間を置いて再度お試しください。');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLoginSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setErrorMessage('');

        const trimmedId = loginId.trim();
        if (!trimmedId || !password.trim()) {
            setErrorMessage('会員番号とパスワードを入力してください。');
            return;
        }

        if (!/^\d+$/.test(trimmedId)) {
            setErrorMessage('現在は会員番号ログインのみ対応しています。');
            return;
        }

        setIsLoading(true);
        try {
            const result = await loginWithMember(trimmedId, password);
            await signInWithToken(result.customToken);

            if (result.forcePasswordChange) {
                setPendingMemberNo(trimmedId);
                setPendingPassword(password);
                setShowPasswordPrompt(true);
                return;
            }

            navigate('/dashboard');
        } catch (error) {
            console.error(error);
            setErrorMessage('ログインに失敗しました。会員番号とパスワードを確認してください。');
        } finally {
            setIsLoading(false);
        }
    };

    const handlePasswordChange = async (event: FormEvent) => {
        event.preventDefault();
        if (!pendingMemberNo || !pendingPassword) {
            setShowPasswordPrompt(false);
            navigate('/dashboard');
            return;
        }

        if (!/^\d{8,}$/.test(newPassword.trim())) {
            setErrorMessage('パスワードは8桁以上の数字で入力してください。');
            return;
        }

        setIsLoading(true);
        try {
            await changePassword(pendingMemberNo, pendingPassword, newPassword.trim());
            setShowPasswordPrompt(false);
            navigate('/dashboard');
        } catch (error) {
            console.error(error);
            setErrorMessage('パスワード変更に失敗しました。');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSkipPasswordChange = () => {
        setShowPasswordPrompt(false);
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
                        <span className={styles.status}>会員番号ログイン</span>
                    </div>

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
                            placeholder="8桁以上の数字"
                            autoComplete="current-password"
                        />

                        {errorMessage && <p className={styles.error}>{errorMessage}</p>}

                        <Button size="lg" fullWidth type="submit" isLoading={isLoading}>
                            ログイン
                        </Button>
                        <Button size="lg" variant="secondary" fullWidth type="button" onClick={handleGuestStart}>
                            ゲストで遊ぶ
                        </Button>
                    </form>

                    <p className={styles.note}>
                        ゲストの進捗はこの端末・ブラウザに保存されます。
                        端末を変えると引き継げないため、必要になったら本登録に切り替えてください。
                    </p>
                </section>

                {showPasswordPrompt && (
                    <div className={styles.modalOverlay}>
                        <div className={styles.modal}>
                            <h3 className={styles.modalTitle}>パスワードの変更をおすすめします</h3>
                            <p className={styles.modalText}>
                                仮パスワードのままでも利用できます。後から「会員情報」でも変更できます。
                            </p>
                            <form className={styles.modalForm} onSubmit={handlePasswordChange}>
                                <label className={styles.inputLabel} htmlFor="new-password">
                                    新しいパスワード（8桁以上の数字）
                                </label>
                                <input
                                    id="new-password"
                                    className={styles.input}
                                    type="password"
                                    value={newPassword}
                                    onChange={(event) => setNewPassword(event.target.value)}
                                    placeholder="例: 48271639"
                                    autoComplete="new-password"
                                />
                                <div className={styles.modalActions}>
                                    <Button size="md" type="submit" isLoading={isLoading}>
                                        今変更する
                                    </Button>
                                    <Button size="md" variant="ghost" type="button" onClick={handleSkipPasswordChange}>
                                        後で
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

export default LoginPage;
