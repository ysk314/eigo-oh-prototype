// ================================
// Login Page
// ================================

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    onAuthStateChanged,
    signInAnonymously,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    type User,
} from 'firebase/auth';
import { Button } from '@/components/Button';
import { useApp } from '@/context/AppContext';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/firebase';
import { saveRemoteProfile } from '@/utils/remoteStorage';
import { generateMemberNo, normalizeLoginId } from '@/utils/memberId';
import { loadMemberLoginEmail, saveMemberLoginMap } from '@/utils/memberLoginMap';
import { logEvent } from '@/utils/analytics';
import { clearStorage } from '@/utils/storage';
import styles from './LoginPage.module.css';

type LoginMode = 'login' | 'signup';

export function LoginPage() {
    const navigate = useNavigate();
    const { state, dispatch } = useApp();

    const [mode, setMode] = useState<LoginMode>('login');
    const [loginId, setLoginId] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [familyName, setFamilyName] = useState('');
    const [givenName, setGivenName] = useState('');
    const [trialNickname, setTrialNickname] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [authUser, setAuthUser] = useState<User | null>(null);

    const welcomeMessage = useMemo(() => {
        const name = state.currentUser?.name?.trim();
        if (name && name !== 'ゲスト') {
            return `おかえりなさい、${name}さん`;
        }
        return 'ようこそ！';
    }, [state.currentUser]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setAuthUser(user);
        });
        return () => unsubscribe();
    }, []);

    const hasActiveSession = Boolean(authUser);
    const sessionLabel = state.currentUser?.name?.trim() || authUser?.displayName?.trim() || 'ゲスト';

    const handleContinue = () => {
        navigate('/dashboard');
    };

    const handleLogout = async () => {
        await signOut(auth).catch(() => {});
        dispatch({ type: 'RESET_STATE' });
        clearStorage();
        setLoginId('');
        setPassword('');
        setDisplayName('');
        setFamilyName('');
        setGivenName('');
        setErrorMessage('');
    };

    const containsBannedWords = (value: string): boolean => {
        const blacklist = [
            'ばか',
            'バカ',
            '馬鹿',
            'あほ',
            'アホ',
            'くそ',
            'クソ',
            'fuck',
            'shit',
            'bitch',
            'asshole',
        ];
        const lowered = value.toLowerCase();
        return blacklist.some((word) => lowered.includes(word.toLowerCase()));
    };

    const handleGuestStart = async (nickname?: string) => {
        setErrorMessage('');
        setIsLoading(true);
        try {
            const guestName = (nickname || '').trim() || 'ゲスト';
            const result = await signInAnonymously(auth);
            await saveRemoteProfile(result.user.uid, guestName, undefined, {
                accountType: 'guest',
                status: 'active',
                billing: { plan: 'free', status: 'active' },
                entitlements: { typing: true, flashMentalMath: false, reading: false },
            });
            logEvent({
                eventType: 'guest_started',
                userId: result.user.uid,
                payload: {
                    source: 'login',
                },
            }).catch(() => {});
            navigate('/dashboard');
        } catch (error) {
            console.error(error);
            setErrorMessage('ゲストでの開始に失敗しました。時間を置いて再度お試しください。');
        } finally {
            setIsLoading(false);
        }
    };

    const handleTrialStart = async () => {
        const nickname = trialNickname.trim();
        if (nickname && containsBannedWords(nickname)) {
            setErrorMessage('ニックネームに不適切な表現が含まれています。');
            return;
        }
        logEvent({
            eventType: 'trial_cta_clicked',
            userId: auth.currentUser?.uid ?? null,
            payload: {
                source: 'login_trial_panel',
                hasNickname: Boolean(nickname),
            },
        }).catch(() => {});
        await handleGuestStart(nickname);
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
            const input = loginId.trim();
            const isMemberNo = !input.includes('@');
            if (isMemberNo) {
                if (!auth.currentUser) {
                    await signInAnonymously(auth);
                }
                const email = await loadMemberLoginEmail(input);
                if (!email) {
                    if (auth.currentUser?.isAnonymous) {
                        await signOut(auth);
                    }
                    setErrorMessage('会員番号でログインできません。メールアドレスでログインしてください。');
                    return;
                }
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                const normalized = normalizeLoginId(input);
                await signInWithEmailAndPassword(auth, normalized, password);
                const current = auth.currentUser;
                if (current?.uid && current.email) {
                    const profileSnap = await getDoc(doc(db, 'users', current.uid));
                    const profile = profileSnap.exists() ? (profileSnap.data() as { memberNo?: string | null }) : null;
                    const memberNo = profile?.memberNo ?? null;
                    if (memberNo) {
                        await saveMemberLoginMap(memberNo, current.uid, current.email);
                    }
                }
            }
            logEvent({
                eventType: 'login_success',
                userId: auth.currentUser?.uid ?? null,
                payload: {
                    method: isMemberNo ? 'member_no' : 'email',
                },
            }).catch(() => {});
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

            if (!loginId.trim()) {
                setErrorMessage('メールアドレスを入力してください。');
                return;
            }

        if (displayName.trim() && containsBannedWords(displayName.trim())) {
            setErrorMessage('表示名に不適切な表現が含まれています。');
            return;
        }
        if (!familyName.trim() || !givenName.trim()) {
            setErrorMessage('姓と名を入力してください。');
            return;
        }

        if (!password.trim()) {
            setErrorMessage('パスワードを入力してください。');
            return;
        }

        setIsLoading(true);
        try {
            const email = loginId.trim();
            const result = await createUserWithEmailAndPassword(auth, email, password);
            const memberNo = await generateMemberNo();
            const fallbackName = `${familyName.trim()} ${givenName.trim()}`.trim();
            const name = displayName.trim() || fallbackName || email.split('@')[0] || 'ユーザー';
            await saveRemoteProfile(result.user.uid, name, memberNo, {
                name: { family: familyName.trim(), given: givenName.trim() },
                accountType: 'consumer',
                status: 'active',
                billing: { plan: 'free', status: 'active' },
                entitlements: { typing: true, flashMentalMath: false, reading: false },
            });
            if (result.user.email) {
                await saveMemberLoginMap(memberNo, result.user.uid, result.user.email);
            }
            logEvent({
                eventType: 'signup_success',
                userId: result.user.uid,
                payload: {
                    accountType: 'consumer',
                },
            }).catch(() => {});

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
                            <h2 className={styles.cardTitle}>{welcomeMessage}</h2>
                        </div>
                    </div>

                    {!hasActiveSession && (
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
                    )}

                    {hasActiveSession ? (
                        <div className={styles.actions}>
                            <div className={styles.inputHelp}>現在のログイン: {sessionLabel}</div>
                            <Button size="lg" fullWidth type="button" onClick={handleContinue}>
                                {sessionLabel}として続ける
                            </Button>
                            <Button size="lg" variant="secondary" fullWidth type="button" onClick={handleLogout}>
                                ログアウト
                            </Button>
                        </div>
                    ) : mode === 'login' ? (
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
                                required
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
                                required
                            />

                            {errorMessage && (
                                <div className={styles.errorBox} role="alert" aria-live="polite">
                                    <p className={styles.error}>{errorMessage}</p>
                                </div>
                            )}

                            <Button size="lg" fullWidth type="submit" isLoading={isLoading}>
                                ログイン
                            </Button>
                        </form>
                    ) : (
                        <form className={styles.actions} onSubmit={handleSignupSubmit}>
                            <label className={styles.inputLabel} htmlFor="signup-id">
                                メールアドレス
                            </label>
                            <input
                                id="signup-id"
                                className={styles.input}
                                type="text"
                                value={loginId}
                                onChange={(event) => setLoginId(event.target.value)}
                                placeholder="例: user@example.com"
                                autoComplete="username"
                                required
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
                            <label className={styles.inputLabel} htmlFor="signup-family-name">
                                姓
                            </label>
                            <input
                                id="signup-family-name"
                                className={styles.input}
                                type="text"
                                value={familyName}
                                onChange={(event) => setFamilyName(event.target.value)}
                                placeholder="例: 山田"
                                required
                            />
                            <label className={styles.inputLabel} htmlFor="signup-given-name">
                                名
                            </label>
                            <input
                                id="signup-given-name"
                                className={styles.input}
                                type="text"
                                value={givenName}
                                onChange={(event) => setGivenName(event.target.value)}
                                placeholder="例: 花子"
                                required
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
                                required
                            />

                            {errorMessage && (
                                <div className={styles.errorBox} role="alert" aria-live="polite">
                                    <p className={styles.error}>{errorMessage}</p>
                                </div>
                            )}
                            <Button size="lg" fullWidth type="submit" isLoading={isLoading}>
                                登録する
                            </Button>
                        </form>
                    )}

                    <div className={styles.trialPanel}>
                        <h3 className={styles.trialTitle}>ゲストとしてはじめる</h3>
                        <label className={styles.trialInputLabel} htmlFor="trial-nickname">
                            ニックネーム（任意）
                        </label>
                        <input
                            id="trial-nickname"
                            className={styles.trialInput}
                            type="text"
                            value={trialNickname}
                            onChange={(event) => setTrialNickname(event.target.value)}
                            placeholder="例: さくら"
                            maxLength={24}
                        />
                        <ul className={styles.trialList}>
                            <li>ゲストの進捗記録は一定期間保管されます。</li>
                            <li>体験後に無料会員登録を行うことで記録を引き継ぎます。</li>
                        </ul>
                        <Button size="md" variant="primary" fullWidth type="button" onClick={handleTrialStart}>
                            今すぐ無料体験を始める
                        </Button>
                    </div>
                    <div className={styles.adminLink}>
                        <Link to="/admin">管理者ページはこちら</Link>
                    </div>
                </section>
            </main>
        </div>
    );
}

export default LoginPage;
