// ================================
// Account Page
// ================================

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc } from 'firebase/firestore';
import { updateEmail } from 'firebase/auth';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useApp } from '@/context/AppContext';
import { auth, db } from '@/firebase';
import { loadMemberLoginEmail, saveMemberLoginMap, deleteMemberLoginMap } from '@/utils/memberLoginMap';
import styles from './AccountPage.module.css';

function containsBannedWords(value: string): boolean {
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
}

export function AccountPage() {
    const navigate = useNavigate();
    const { state, setUser } = useApp();
    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const [loginMapStatus, setLoginMapStatus] = useState<'idle' | 'enabled' | 'missing' | 'error'>('idle');
    const [loginMapSaving, setLoginMapSaving] = useState(false);
    const [loginMapMessage, setLoginMapMessage] = useState('');

    const memberNo = state.currentUser?.memberNo ?? null;
    const currentEmail = auth.currentUser?.email ?? '';

    useEffect(() => {
        setDisplayName(state.currentUser?.name ?? '');
        setEmail(currentEmail);
    }, [state.currentUser?.name, currentEmail]);

    useEffect(() => {
        if (!memberNo || !currentEmail) {
            setLoginMapStatus('missing');
            return;
        }
        let cancelled = false;
        loadMemberLoginEmail(memberNo)
            .then((mappedEmail) => {
                if (cancelled) return;
                if (mappedEmail) {
                    setLoginMapStatus('enabled');
                } else {
                    setLoginMapStatus('missing');
                }
            })
            .catch(() => {
                if (cancelled) return;
                setLoginMapStatus('error');
            });
        return () => {
            cancelled = true;
        };
    }, [memberNo, currentEmail]);

    const canEnableLoginMap = useMemo(() => {
        return !!memberNo && !!auth.currentUser?.email;
    }, [memberNo]);

    const handleSaveProfile = async () => {
        if (!state.currentUser) return;
        setSaving(true);
        setMessage('');
        setError('');
        const trimmedName = displayName.trim();
        const nextEmail = email.trim();
        if (trimmedName && containsBannedWords(trimmedName)) {
            setError('表示名に不適切な表現が含まれています。');
            setSaving(false);
            return;
        }
        try {
            if (auth.currentUser && nextEmail && nextEmail !== currentEmail) {
                await updateEmail(auth.currentUser, nextEmail);
            }
            await setDoc(
                doc(db, 'users', state.currentUser.id),
                {
                    displayName: trimmedName || null,
                    updatedAt: new Date().toISOString(),
                },
                { merge: true }
            );
            setUser({
                ...state.currentUser,
                name: trimmedName || state.currentUser.name,
            });
            setMessage('会員情報を更新しました。');
        } catch (err) {
            console.error(err);
            setError('更新に失敗しました。再ログイン後にお試しください。');
        } finally {
            setSaving(false);
        }
    };

    const handleEnableMemberLogin = async () => {
        if (!memberNo || !auth.currentUser?.email || !auth.currentUser) {
            setLoginMapMessage('会員番号またはメールアドレスが未設定のため有効化できません。');
            return;
        }
        setLoginMapSaving(true);
        setLoginMapMessage('');
        try {
            await saveMemberLoginMap(memberNo, auth.currentUser.uid, auth.currentUser.email);
            setLoginMapStatus('enabled');
            setLoginMapMessage('会員番号ログインを有効にしました。');
        } catch {
            setLoginMapStatus('error');
            setLoginMapMessage('有効化に失敗しました。時間を置いて再度お試しください。');
        } finally {
            setLoginMapSaving(false);
        }
    };

    const handleDisableMemberLogin = async () => {
        if (!memberNo) return;
        setLoginMapSaving(true);
        setLoginMapMessage('');
        try {
            await deleteMemberLoginMap(memberNo);
            setLoginMapStatus('missing');
            setLoginMapMessage('会員番号ログインを無効にしました。');
        } catch {
            setLoginMapStatus('error');
            setLoginMapMessage('無効化に失敗しました。');
        } finally {
            setLoginMapSaving(false);
        }
    };

    return (
        <div className={styles.page}>
            <main className={styles.main}>
                <header className={styles.header}>
                    <div>
                        <h1 className={styles.title}>会員情報の変更</h1>
                        <p className={styles.subtitle}>表示名やログイン方法を管理します。</p>
                    </div>
                    <Button variant="secondary" onClick={() => navigate('/dashboard')}>
                        ダッシュボードへ戻る
                    </Button>
                </header>

                <Card className={styles.card} padding="lg">
                    <h2 className={styles.sectionTitle}>基本情報</h2>
                    <div className={styles.field}>
                        <label className={styles.label} htmlFor="account-name">表示名</label>
                        <input
                            id="account-name"
                            className={styles.input}
                            type="text"
                            value={displayName}
                            onChange={(event) => setDisplayName(event.target.value)}
                        />
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label} htmlFor="account-email">メールアドレス</label>
                        <input
                            id="account-email"
                            className={styles.input}
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                        />
                    </div>
                    <div className={styles.field}>
                        <label className={styles.label}>会員番号</label>
                        <div className={styles.readonly}>{memberNo ?? '未設定'}</div>
                    </div>
                    {error && <div className={styles.error}>{error}</div>}
                    {message && <div className={styles.message}>{message}</div>}
                    <div className={styles.actions}>
                        <Button variant="primary" onClick={handleSaveProfile} isLoading={saving}>
                            保存
                        </Button>
                    </div>
                </Card>

                <Card className={styles.card} padding="lg">
                    <h2 className={styles.sectionTitle}>会員番号ログイン</h2>
                    <p className={styles.helpText}>メールに加えて会員番号でもログインできるようにします。</p>
                    <div className={styles.statusRow}>
                        <span className={styles.statusLabel}>状態</span>
                        <span className={styles.statusValue}>
                            {loginMapStatus === 'enabled' ? '有効' : '無効'}
                        </span>
                    </div>
                    {loginMapMessage && <div className={styles.message}>{loginMapMessage}</div>}
                    <div className={styles.actions}>
                        <Button
                            variant="primary"
                            onClick={handleEnableMemberLogin}
                            isLoading={loginMapSaving}
                            disabled={!canEnableLoginMap || loginMapStatus === 'enabled'}
                        >
                            有効にする
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={handleDisableMemberLogin}
                            isLoading={loginMapSaving}
                            disabled={loginMapStatus !== 'enabled'}
                        >
                            無効にする
                        </Button>
                    </div>
                </Card>
            </main>
        </div>
    );
}

export default AccountPage;
