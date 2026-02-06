// ================================
// Admin Page
// ================================

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { auth, db } from '@/firebase';
import styles from './AdminPage.module.css';

type AdminUser = {
    uid: string;
    displayName: string;
    memberNo?: string;
    createdAt?: string;
    stats?: AdminUserStats;
};

type AdminUserStats = {
    totalAttempts?: number;
    totalCorrect?: number;
    totalMiss?: number;
    clearedSectionsCount?: number;
    totalSectionsCount?: number;
    lastActiveAt?: string;
    lastMode?: string;
    lastSectionId?: string;
    lastSectionLabel?: string;
};

function normalize(value: string) {
    return value.trim().toLowerCase();
}

function parseTimestamp(value: unknown): string | undefined {
    if (!value) return undefined;
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value && 'toDate' in value) {
        const date = (value as { toDate: () => Date }).toDate();
        return date.toISOString();
    }
    return undefined;
}

function formatDate(value?: string): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

function formatDateTime(value?: string): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatProgress(cleared?: number, total?: number): string {
    if (!total) return '—';
    const safeCleared = cleared ?? 0;
    const percent = Math.round((safeCleared / total) * 100);
    return `${safeCleared}/${total} (${percent}%)`;
}

function formatNumber(value?: number): string {
    if (value === undefined || value === null) return '—';
    return value.toLocaleString('ja-JP');
}

const rolePriority: Record<string, number> = {
    owner: 3,
    admin: 2,
    staff: 1,
};

function getRoleRank(role?: string | null) {
    if (!role) return 0;
    return rolePriority[role] ?? 0;
}

function normalizeAdminId(value: string) {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return '';
    if (trimmed.includes('@')) return trimmed;
    return `${trimmed}@admin.tap-type.invalid`;
}

export function AdminPage() {
    const navigate = useNavigate();
    const [authLoading, setAuthLoading] = useState(true);
    const [roleLoading, setRoleLoading] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const [loginId, setLoginId] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginError, setLoginError] = useState<string | null>(null);
    const [loginLoading, setLoginLoading] = useState(false);
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!currentUser) {
            setRole(null);
            setRoleLoading(false);
            return;
        }
        let cancelled = false;
        setRoleLoading(true);
        getDoc(doc(db, 'admin_roles', currentUser.uid))
            .then((snapshot) => {
                if (cancelled) return;
                const data = snapshot.data() as { role?: string } | undefined;
                setRole(data?.role ?? null);
            })
            .catch(() => {
                if (cancelled) return;
                setRole(null);
            })
            .finally(() => {
                if (cancelled) return;
                setRoleLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [currentUser]);

    const isAdmin = getRoleRank(role) >= 1;

    const loadUsers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [usersSnap, statsSnap] = await Promise.all([
                getDocs(collection(db, 'users')),
                getDocs(collection(db, 'user_stats')),
            ]);
            const statsMap = new Map<string, AdminUserStats>();
            statsSnap.forEach((docSnap) => {
                const data = docSnap.data() as {
                    totalAttempts?: number;
                    totalCorrect?: number;
                    totalMiss?: number;
                    clearedSectionsCount?: number;
                    totalSectionsCount?: number;
                    lastActiveAt?: unknown;
                    lastActiveAtIso?: string | null;
                    lastMode?: string;
                    lastSectionId?: string | null;
                    lastSectionLabel?: string | null;
                };
                const lastActiveAt = parseTimestamp(data.lastActiveAt) ?? data.lastActiveAtIso ?? undefined;
                statsMap.set(docSnap.id, {
                    totalAttempts: data.totalAttempts,
                    totalCorrect: data.totalCorrect,
                    totalMiss: data.totalMiss,
                    clearedSectionsCount: data.clearedSectionsCount,
                    totalSectionsCount: data.totalSectionsCount,
                    lastActiveAt,
                    lastMode: data.lastMode,
                    lastSectionId: data.lastSectionId ?? undefined,
                    lastSectionLabel: data.lastSectionLabel ?? undefined,
                });
            });
            const items: AdminUser[] = snap.docs.map((docSnap) => {
                const data = docSnap.data() as {
                    uid?: string;
                    displayName?: string;
                    memberNo?: string | null;
                    createdAt?: unknown;
                };
                const uid = data.uid ?? docSnap.id;
                return {
                    uid,
                    displayName: data.displayName ?? '未設定',
                    memberNo: data.memberNo ?? undefined,
                    createdAt: parseTimestamp(data.createdAt),
                    stats: statsMap.get(uid),
                };
            });
            items.sort((a, b) => {
                const aActive = a.stats?.lastActiveAt ? new Date(a.stats.lastActiveAt).getTime() : 0;
                const bActive = b.stats?.lastActiveAt ? new Date(b.stats.lastActiveAt).getTime() : 0;
                if (aActive !== bActive) return bActive - aActive;
                return a.displayName.localeCompare(b.displayName, 'ja');
            });
            setUsers(items);
            if (!selectedUserId && items.length > 0) {
                setSelectedUserId(items[0].uid);
            }
        } catch {
            setError('ユーザー一覧の取得に失敗しました。');
        } finally {
            setLoading(false);
        }
    }, [selectedUserId]);

    useEffect(() => {
        if (!isAdmin) return;
        void loadUsers();
    }, [isAdmin, loadUsers]);

    const filteredUsers = useMemo(() => {
        const keyword = normalize(searchTerm);
        if (!keyword) return users;
        return users.filter((user) => {
            const name = normalize(user.displayName);
            const memberNo = normalize(user.memberNo ?? '');
            const uid = normalize(user.uid);
            return name.includes(keyword) || memberNo.includes(keyword) || uid.includes(keyword);
        });
    }, [users, searchTerm]);

    const selectedUser = useMemo(() => {
        return filteredUsers.find((user) => user.uid === selectedUserId) ?? null;
    }, [filteredUsers, selectedUserId]);

    const handleBack = () => {
        navigate('/');
    };

    const handleLogout = async () => {
        await signOut(auth);
        setLoginPassword('');
        setLoginError(null);
    };

    const handleAdminLogin = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setLoginError(null);
        const email = normalizeAdminId(loginId);
        if (!email || !loginPassword) {
            setLoginError('ID とパスワードを入力してください。');
            return;
        }
        setLoginLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, loginPassword);
        } catch {
            setLoginError('ログインに失敗しました。ID/PASSを確認してください。');
        } finally {
            setLoginLoading(false);
        }
    };

    if (authLoading || (currentUser && roleLoading)) {
        return (
            <div className={styles.page}>
                <main className={styles.main}>
                    <Card className={styles.stateCard} variant="outlined">
                        権限を確認しています...
                    </Card>
                </main>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className={styles.page}>
                <main className={styles.main}>
                    <Card className={styles.loginCard} variant="outlined">
                        <h1 className={styles.title}>管理者ログイン</h1>
                        <p className={styles.subtitle}>ID とパスワードを入力してください。</p>
                        {currentUser && !roleLoading && (
                            <p className={styles.loginNotice}>
                                このアカウントには管理者権限がありません。別のアカウントでログインしてください。
                            </p>
                        )}
                        <form className={styles.loginForm} onSubmit={handleAdminLogin}>
                            <label className={styles.loginField}>
                                <span>ID</span>
                                <input
                                    className={styles.loginInput}
                                    type="text"
                                    value={loginId}
                                    onChange={(event) => setLoginId(event.target.value)}
                                    placeholder="admin"
                                    autoComplete="username"
                                />
                            </label>
                            <label className={styles.loginField}>
                                <span>パスワード</span>
                                <input
                                    className={styles.loginInput}
                                    type="password"
                                    value={loginPassword}
                                    onChange={(event) => setLoginPassword(event.target.value)}
                                    autoComplete="current-password"
                                />
                            </label>
                            {loginError && <div className={styles.error}>{loginError}</div>}
                            <div className={styles.loginActions}>
                                <Button variant="primary" type="submit" isLoading={loginLoading}>
                                    ログイン
                                </Button>
                                {currentUser && (
                                    <Button variant="secondary" type="button" onClick={handleLogout}>
                                        ログアウト
                                    </Button>
                                )}
                                <Button variant="secondary" type="button" onClick={handleBack}>
                                    ログインへ戻る
                                </Button>
                            </div>
                        </form>
                    </Card>
                </main>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <main className={styles.main}>
                <header className={styles.header}>
                    <div>
                        <h1 className={styles.title}>管理画面</h1>
                        <p className={styles.subtitle}>ユーザー一覧</p>
                    </div>
                    <div className={styles.actions}>
                        <Button variant="secondary" onClick={handleBack}>
                            ログインへ戻る
                        </Button>
                        <Button variant="primary" onClick={loadUsers} isLoading={loading}>
                            再読み込み
                        </Button>
                    </div>
                </header>

                <section className={styles.searchSection}>
                    <input
                        className={styles.searchInput}
                        type="text"
                        placeholder="表示名 / 会員番号 / UID で検索"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                    />
                    <span className={styles.count}>表示 {filteredUsers.length} / 全 {users.length}</span>
                </section>

                <section className={styles.grid}>
                    <Card className={styles.listCard} variant="outlined" padding="none">
                        <div className={styles.listHeader}>ユーザー一覧</div>
                        <div className={styles.list}>
                            {filteredUsers.length === 0 && (
                                <div className={styles.empty}>該当ユーザーがいません。</div>
                            )}
                            {filteredUsers.map((user) => {
                                const active = user.uid === selectedUserId;
                                const progressText = formatProgress(
                                    user.stats?.clearedSectionsCount,
                                    user.stats?.totalSectionsCount
                                );
                                const lastSection = user.stats?.lastSectionLabel || user.stats?.lastSectionId || '—';
                                return (
                                    <button
                                        key={user.uid}
                                        type="button"
                                        className={`${styles.listItem} ${active ? styles.activeItem : ''}`}
                                        onClick={() => setSelectedUserId(user.uid)}
                                    >
                                        <div className={styles.listItemHeader}>
                                            <div className={styles.userName}>{user.displayName}</div>
                                            <span className={styles.progressBadge}>進捗 {progressText}</span>
                                        </div>
                                        <div className={styles.userMetaRow}>
                                            <span>最終学習: {formatDateTime(user.stats?.lastActiveAt)}</span>
                                            <span>直近セクション: {lastSection}</span>
                                        </div>
                                        <div className={styles.userMeta}>UID: {user.uid}</div>
                                        <div className={styles.userMeta}>会員番号: {user.memberNo ?? '—'}</div>
                                    </button>
                                );
                            })}
                        </div>
                    </Card>

                    <Card className={styles.detailCard} variant="outlined">
                        <div className={styles.listHeader}>詳細</div>
                        {error && <div className={styles.error}>{error}</div>}
                        {!error && !selectedUser && (
                            <div className={styles.empty}>ユーザーを選択してください。</div>
                        )}
                        {selectedUser && (
                            <div className={styles.detailBody}>
                                <div className={styles.detailRow}>
                                    <span>表示名</span>
                                    <strong>{selectedUser.displayName}</strong>
                                </div>
                                <div className={styles.detailRow}>
                                    <span>会員番号</span>
                                    <strong>{selectedUser.memberNo ?? '—'}</strong>
                                </div>
                                <div className={styles.detailRow}>
                                    <span>UID</span>
                                    <strong className={styles.mono}>{selectedUser.uid}</strong>
                                </div>
                                <div className={styles.detailRow}>
                                    <span>作成日</span>
                                    <strong>{formatDate(selectedUser.createdAt)}</strong>
                                </div>
                                <div className={styles.detailRow}>
                                    <span>最終学習</span>
                                    <strong>{formatDateTime(selectedUser.stats?.lastActiveAt)}</strong>
                                </div>
                                <div className={styles.detailRow}>
                                    <span>進捗</span>
                                    <strong>
                                        {formatProgress(
                                            selectedUser.stats?.clearedSectionsCount,
                                            selectedUser.stats?.totalSectionsCount
                                        )}
                                    </strong>
                                </div>
                                <div className={styles.detailRow}>
                                    <span>直近セクション</span>
                                    <strong>{selectedUser.stats?.lastSectionLabel || selectedUser.stats?.lastSectionId || '—'}</strong>
                                </div>
                                <div className={styles.detailRow}>
                                    <span>総回答数</span>
                                    <strong>{formatNumber(selectedUser.stats?.totalAttempts)}</strong>
                                </div>
                                <div className={styles.detailRow}>
                                    <span>正解数</span>
                                    <strong>{formatNumber(selectedUser.stats?.totalCorrect)}</strong>
                                </div>
                                <div className={styles.detailRow}>
                                    <span>ミス数</span>
                                    <strong>{formatNumber(selectedUser.stats?.totalMiss)}</strong>
                                </div>
                            </div>
                        )}
                    </Card>
                </section>
            </main>
        </div>
    );
}

export default AdminPage;
