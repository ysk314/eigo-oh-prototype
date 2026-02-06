// ================================
// Admin Page
// ================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { getIdTokenResult, onAuthStateChanged } from 'firebase/auth';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { auth, db } from '@/firebase';
import styles from './AdminPage.module.css';

type AdminUser = {
    uid: string;
    displayName: string;
    memberNo?: string;
    createdAt?: string;
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

export function AdminPage() {
    const navigate = useNavigate();
    const [authLoading, setAuthLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                setIsAdmin(false);
                setAuthLoading(false);
                return;
            }
            try {
                const tokenResult = await getIdTokenResult(user, true);
                setIsAdmin(Boolean(tokenResult.claims.admin));
            } catch {
                setIsAdmin(false);
            } finally {
                setAuthLoading(false);
            }
        });
        return () => unsubscribe();
    }, []);

    const loadUsers = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const snap = await getDocs(collection(db, 'users'));
            const items: AdminUser[] = snap.docs.map((docSnap) => {
                const data = docSnap.data() as {
                    uid?: string;
                    displayName?: string;
                    memberNo?: string | null;
                    createdAt?: unknown;
                };
                return {
                    uid: data.uid ?? docSnap.id,
                    displayName: data.displayName ?? '未設定',
                    memberNo: data.memberNo ?? undefined,
                    createdAt: parseTimestamp(data.createdAt),
                };
            });
            items.sort((a, b) => a.displayName.localeCompare(b.displayName, 'ja'));
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

    if (authLoading) {
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
                    <Card className={styles.stateCard} variant="outlined">
                        <h1 className={styles.title}>管理者権限が必要です</h1>
                        <p className={styles.subtitle}>このページを表示する権限がありません。</p>
                        <Button variant="secondary" onClick={handleBack} className={styles.backButton}>
                            ログインへ戻る
                        </Button>
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
                                return (
                                    <button
                                        key={user.uid}
                                        type="button"
                                        className={`${styles.listItem} ${active ? styles.activeItem : ''}`}
                                        onClick={() => setSelectedUserId(user.uid)}
                                    >
                                        <div className={styles.userName}>{user.displayName}</div>
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
                            </div>
                        )}
                    </Card>
                </section>
            </main>
        </div>
    );
}

export default AdminPage;
