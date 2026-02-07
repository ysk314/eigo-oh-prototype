// ================================
// Admin Page
// ================================

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    serverTimestamp,
    query,
    where,
    orderBy,
    Timestamp,
} from 'firebase/firestore';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { auth, db } from '@/firebase';
import { logEvent } from '@/utils/analytics';
import { saveMemberProfileTemplate, type MemberProfile } from '@/utils/memberProfiles';
import styles from './AdminPage.module.css';

type AdminUser = {
    uid: string;
    displayName: string;
    memberNo?: string;
    createdAt?: string;
    stats?: AdminUserStats;
    accountType?: 'guest' | 'consumer' | 'b2b2c';
    orgId?: string;
    classroomId?: string;
    status?: 'active' | 'inactive' | 'archived' | 'pending';
    billing?: {
        plan: 'free' | 'paid';
        status: 'active' | 'past_due' | 'canceled' | 'trial';
    };
    entitlements?: {
        typing: boolean;
        flashMentalMath: boolean;
        reading: boolean;
    };
    name?: {
        family?: string;
        given?: string;
    };
    birthDate?: string;
    gender?: 'male' | 'female' | 'other' | 'undisclosed';
    schoolType?: 'elementary' | 'junior' | 'high' | 'other';
    grade?: number | null;
    timezone?: string;
    enrollmentDate?: string;
    notes?: string;
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

function getProgressRatio(stats?: AdminUserStats): number | null {
    if (!stats?.totalSectionsCount || stats.totalSectionsCount <= 0) return null;
    const cleared = stats.clearedSectionsCount ?? 0;
    return cleared / stats.totalSectionsCount;
}

function getDaysSince(value?: string): number | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const todayStart = startOfDayLocal(new Date());
    const targetStart = startOfDayLocal(date);
    const diffMs = todayStart.getTime() - targetStart.getTime();
    return Math.floor(diffMs / 86400000);
}

function startOfDayLocal(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function diffDaysFromToday(date: Date, today: Date): number {
    const todayStart = startOfDayLocal(today);
    const targetStart = startOfDayLocal(date);
    const diffMs = todayStart.getTime() - targetStart.getTime();
    return Math.floor(diffMs / 86400000);
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
    const [activityFilter, setActivityFilter] = useState<'all' | 'active7' | 'inactive30'>('all');
    const [progressFilter, setProgressFilter] = useState<'all' | 'zero' | 'low' | 'mid' | 'complete'>('all');
    const [isEditingUser, setIsEditingUser] = useState(false);
    const [editDisplayName, setEditDisplayName] = useState('');
    const [editMemberNo, setEditMemberNo] = useState('');
    const [userSaving, setUserSaving] = useState(false);
    const [userEditError, setUserEditError] = useState<string | null>(null);
    const [adminSaving, setAdminSaving] = useState(false);
    const [adminEditError, setAdminEditError] = useState<string | null>(null);
    const [adminAccountType, setAdminAccountType] = useState<'guest' | 'consumer' | 'b2b2c'>('consumer');
    const [adminOrgId, setAdminOrgId] = useState('');
    const [adminClassroomId, setAdminClassroomId] = useState('');
    const [adminStatus, setAdminStatus] = useState<'active' | 'inactive' | 'archived' | 'pending'>('active');
    const [adminBillingPlan, setAdminBillingPlan] = useState<'free' | 'paid'>('free');
    const [adminBillingStatus, setAdminBillingStatus] = useState<'active' | 'past_due' | 'canceled' | 'trial'>('active');
    const [adminEntTyping, setAdminEntTyping] = useState(true);
    const [adminEntFlash, setAdminEntFlash] = useState(false);
    const [adminEntReading, setAdminEntReading] = useState(false);
    const [adminFamilyName, setAdminFamilyName] = useState('');
    const [adminGivenName, setAdminGivenName] = useState('');
    const [adminBirthDate, setAdminBirthDate] = useState('');
    const [adminGender, setAdminGender] = useState<'male' | 'female' | 'other' | 'undisclosed'>('undisclosed');
    const [adminSchoolType, setAdminSchoolType] = useState<'elementary' | 'junior' | 'high' | 'other'>('other');
    const [adminGrade, setAdminGrade] = useState('');
    const [adminTimezone, setAdminTimezone] = useState('');
    const [adminEnrollmentDate, setAdminEnrollmentDate] = useState('');
    const [adminNotes, setAdminNotes] = useState('');

    const [memberProfiles, setMemberProfiles] = useState<MemberProfile[]>([]);
    const [memberProfilesLoading, setMemberProfilesLoading] = useState(false);
    const [memberProfilesError, setMemberProfilesError] = useState<string | null>(null);
    const [selectedMemberNo, setSelectedMemberNo] = useState<string | null>(null);
    const [profileMemberNo, setProfileMemberNo] = useState('');
    const [profileDisplayName, setProfileDisplayName] = useState('');
    const [profileNote, setProfileNote] = useState('');
    const [profileSaving, setProfileSaving] = useState(false);
    const [profileFormError, setProfileFormError] = useState<string | null>(null);

    const [usageLoading, setUsageLoading] = useState(false);
    const [usageError, setUsageError] = useState<string | null>(null);
    const [usageHidden, setUsageHidden] = useState(false);
    const [usageToday, setUsageToday] = useState(0);
    const [usageYesterday, setUsageYesterday] = useState(0);
    const [usage7d, setUsage7d] = useState(0);
    const [usage30d, setUsage30d] = useState(0);

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
            const items: AdminUser[] = usersSnap.docs.map((docSnap) => {
                const data = docSnap.data() as {
                    uid?: string;
                    displayName?: string;
                    memberNo?: string | null;
                    createdAt?: unknown;
                    accountType?: 'guest' | 'consumer' | 'b2b2c';
                    orgId?: string | null;
                    classroomId?: string | null;
                    status?: 'active' | 'inactive' | 'archived' | 'pending';
                    billing?: {
                        plan?: 'free' | 'paid';
                        status?: 'active' | 'past_due' | 'canceled' | 'trial';
                    } | null;
                    entitlements?: {
                        typing?: boolean;
                        flashMentalMath?: boolean;
                        reading?: boolean;
                    } | null;
                    name?: {
                        family?: string | null;
                        given?: string | null;
                    };
                    birthDate?: string | null;
                    gender?: 'male' | 'female' | 'other' | 'undisclosed' | null;
                    schoolType?: 'elementary' | 'junior' | 'high' | 'other' | null;
                    grade?: number | null;
                    timezone?: string | null;
                    enrollmentDate?: string | null;
                    notes?: string | null;
                };
                const uid = data.uid ?? docSnap.id;
                return {
                    uid,
                    displayName: data.displayName ?? '未設定',
                    memberNo: data.memberNo ?? undefined,
                    createdAt: parseTimestamp(data.createdAt),
                    accountType: data.accountType ?? undefined,
                    orgId: data.orgId ?? undefined,
                    classroomId: data.classroomId ?? undefined,
                    status: data.status ?? undefined,
                    billing: data.billing?.plan && data.billing?.status
                        ? { plan: data.billing.plan, status: data.billing.status }
                        : undefined,
                    entitlements: {
                        typing: data.entitlements?.typing ?? false,
                        flashMentalMath: data.entitlements?.flashMentalMath ?? false,
                        reading: data.entitlements?.reading ?? false,
                    },
                    name: data.name ? { family: data.name.family ?? undefined, given: data.name.given ?? undefined } : undefined,
                    birthDate: data.birthDate ?? undefined,
                    gender: data.gender ?? undefined,
                    schoolType: data.schoolType ?? undefined,
                    grade: data.grade ?? undefined,
                    timezone: data.timezone ?? undefined,
                    enrollmentDate: data.enrollmentDate ?? undefined,
                    notes: data.notes ?? undefined,
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
            logEvent({
                eventType: 'admin_users_loaded',
                userId: currentUser?.uid ?? null,
                payload: {
                    usersCount: usersSnap.size,
                    statsCount: statsSnap.size,
                },
            }).catch(() => {});
            if (!selectedUserId && items.length > 0) {
                setSelectedUserId(items[0].uid);
            }
        } catch {
            setError('ユーザー一覧の取得に失敗しました。');
        } finally {
            setLoading(false);
        }
    }, [selectedUserId, currentUser?.uid]);

    const loadMemberProfiles = useCallback(async () => {
        setMemberProfilesLoading(true);
        setMemberProfilesError(null);
        try {
            const snap = await getDocs(collection(db, 'member_profiles'));
            const items: MemberProfile[] = snap.docs.map((docSnap) => {
                const data = docSnap.data() as MemberProfile;
                return {
                    memberNo: docSnap.id,
                    displayName: data.displayName ?? undefined,
                    note: data.note ?? undefined,
                    createdAt: data.createdAt,
                    updatedAt: data.updatedAt,
                };
            });
            items.sort((a, b) => a.memberNo.localeCompare(b.memberNo));
            setMemberProfiles(items);
            if (!selectedMemberNo && items.length > 0) {
                setSelectedMemberNo(items[0].memberNo);
            }
        } catch {
            setMemberProfilesError('会員番号テンプレートの取得に失敗しました。');
        } finally {
            setMemberProfilesLoading(false);
        }
    }, [selectedMemberNo]);

    const loadUsageSummary = useCallback(async () => {
        setUsageLoading(true);
        setUsageError(null);
        try {
            const now = new Date();
            const todayStart = startOfDayLocal(now);
            const start30 = new Date(todayStart.getTime() - 29 * 86400000);
            const usageQuery = query(
                collection(db, 'analytics_events'),
                where('eventType', '==', 'admin_users_loaded'),
                where('createdAt', '>=', Timestamp.fromDate(start30)),
                orderBy('createdAt', 'asc')
            );
            const snap = await getDocs(usageQuery);

            let todayCount = 0;
            let yesterdayCount = 0;
            let count7d = 0;
            let count30d = 0;

            snap.forEach((docSnap) => {
                const data = docSnap.data() as { createdAt?: { toDate?: () => Date } | null };
                const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : null;
                if (!createdAt) return;
                const diff = diffDaysFromToday(createdAt, now);
                if (diff < 0 || diff > 29) return;
                count30d += 1;
                if (diff < 7) count7d += 1;
                if (diff === 0) todayCount += 1;
                if (diff === 1) yesterdayCount += 1;
            });

            setUsageToday(todayCount);
            setUsageYesterday(yesterdayCount);
            setUsage7d(count7d);
            setUsage30d(count30d);
        } catch {
            setUsageError('運用指標の取得に失敗しました。拡張機能の影響でブロックされている可能性があります。');
        } finally {
            setUsageLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isAdmin) return;
        void loadUsers();
    }, [isAdmin, loadUsers]);

    useEffect(() => {
        if (!isAdmin) return;
        void loadMemberProfiles();
    }, [isAdmin, loadMemberProfiles]);

    useEffect(() => {
        if (!isAdmin) return;
        void loadUsageSummary();
    }, [isAdmin, loadUsageSummary]);

    const filteredUsers = useMemo(() => {
        const keyword = normalize(searchTerm);
        const base = keyword
            ? users.filter((user) => {
                const name = normalize(user.displayName);
                const memberNo = normalize(user.memberNo ?? '');
                const uid = normalize(user.uid);
                return name.includes(keyword) || memberNo.includes(keyword) || uid.includes(keyword);
            })
            : users;

        return base.filter((user) => {
            const ratio = getProgressRatio(user.stats);
            const daysSince = getDaysSince(user.stats?.lastActiveAt);

            if (activityFilter === 'active7') {
                if (daysSince === null || daysSince > 7) return false;
            }
            if (activityFilter === 'inactive30') {
                if (daysSince === null || daysSince <= 30) return false;
            }

            if (progressFilter !== 'all') {
                if (ratio === null) return false;
                if (progressFilter === 'zero' && ratio !== 0) return false;
                if (progressFilter === 'low' && !(ratio > 0 && ratio < 0.5)) return false;
                if (progressFilter === 'mid' && !(ratio >= 0.5 && ratio < 1)) return false;
                if (progressFilter === 'complete' && ratio < 1) return false;
            }

            return true;
        });
    }, [users, searchTerm, activityFilter, progressFilter]);

    const selectedUser = useMemo(() => {
        return filteredUsers.find((user) => user.uid === selectedUserId) ?? null;
    }, [filteredUsers, selectedUserId]);

    useEffect(() => {
        if (!selectedUser) {
            setEditDisplayName('');
            setEditMemberNo('');
            setIsEditingUser(false);
            setUserEditError(null);
            setAdminEditError(null);
            return;
        }
        setEditDisplayName(selectedUser.displayName ?? '');
        setEditMemberNo(selectedUser.memberNo ?? '');
        setIsEditingUser(false);
        setUserEditError(null);
        setAdminEditError(null);
        setAdminAccountType(selectedUser.accountType ?? 'consumer');
        setAdminOrgId(selectedUser.orgId ?? '');
        setAdminClassroomId(selectedUser.classroomId ?? '');
        setAdminStatus(selectedUser.status ?? 'active');
        setAdminBillingPlan(selectedUser.billing?.plan ?? 'free');
        setAdminBillingStatus(selectedUser.billing?.status ?? 'active');
        setAdminEntTyping(selectedUser.entitlements?.typing ?? true);
        setAdminEntFlash(selectedUser.entitlements?.flashMentalMath ?? false);
        setAdminEntReading(selectedUser.entitlements?.reading ?? false);
        setAdminFamilyName(selectedUser.name?.family ?? '');
        setAdminGivenName(selectedUser.name?.given ?? '');
        setAdminBirthDate(selectedUser.birthDate ?? '');
        setAdminGender(selectedUser.gender ?? 'undisclosed');
        setAdminSchoolType(selectedUser.schoolType ?? 'other');
        setAdminGrade(selectedUser.grade !== undefined && selectedUser.grade !== null ? String(selectedUser.grade) : '');
        setAdminTimezone(selectedUser.timezone ?? '');
        setAdminEnrollmentDate(selectedUser.enrollmentDate ?? '');
        setAdminNotes(selectedUser.notes ?? '');
    }, [selectedUser]);

    useEffect(() => {
        if (!selectedMemberNo) {
            setProfileMemberNo('');
            setProfileDisplayName('');
            setProfileNote('');
            setProfileFormError(null);
            return;
        }
        const profile = memberProfiles.find((item) => item.memberNo === selectedMemberNo);
        setProfileMemberNo(profile?.memberNo ?? selectedMemberNo);
        setProfileDisplayName(profile?.displayName ?? '');
        setProfileNote(profile?.note ?? '');
        setProfileFormError(null);
    }, [selectedMemberNo, memberProfiles]);

    const handleBack = () => {
        navigate('/');
    };

    const handleLogout = async () => {
        await signOut(auth);
        setLoginPassword('');
        setLoginError(null);
    };

    const handleUserSave = async () => {
        if (!selectedUser) return;
        setUserSaving(true);
        setUserEditError(null);
        const nextDisplayName = editDisplayName.trim() || null;
        const nextMemberNo = editMemberNo.trim() || null;
        try {
            await setDoc(
                doc(db, 'users', selectedUser.uid),
                {
                    displayName: nextDisplayName,
                    memberNo: nextMemberNo,
                    updatedAt: serverTimestamp(),
                },
                { merge: true }
            );
            setUsers((prev) =>
                prev.map((item) =>
                    item.uid === selectedUser.uid
                        ? {
                            ...item,
                            displayName: nextDisplayName ?? '未設定',
                            memberNo: nextMemberNo ?? undefined,
                        }
                        : item
                )
            );
            setIsEditingUser(false);
        } catch {
            setUserEditError('ユーザー情報の更新に失敗しました。');
        } finally {
            setUserSaving(false);
        }
    };

    const handleUserEditCancel = () => {
        if (!selectedUser) return;
        setEditDisplayName(selectedUser.displayName ?? '');
        setEditMemberNo(selectedUser.memberNo ?? '');
        setIsEditingUser(false);
        setUserEditError(null);
    };

    const handleAdminSave = async () => {
        if (!selectedUser) return;
        setAdminSaving(true);
        setAdminEditError(null);
        try {
            await setDoc(
                doc(db, 'users', selectedUser.uid),
                {
                    accountType: adminAccountType,
                    orgId: adminOrgId.trim() || null,
                    classroomId: adminClassroomId.trim() || null,
                    status: adminStatus,
                    billing: {
                        plan: adminBillingPlan,
                        status: adminBillingStatus,
                    },
                    entitlements: {
                        typing: adminEntTyping,
                        flashMentalMath: adminEntFlash,
                        reading: adminEntReading,
                    },
                    name: {
                        family: adminFamilyName.trim() || null,
                        given: adminGivenName.trim() || null,
                    },
                    birthDate: adminBirthDate.trim() || null,
                    gender: adminGender,
                    schoolType: adminSchoolType,
                    grade: adminGrade.trim() ? Number(adminGrade) : null,
                    timezone: adminTimezone.trim() || null,
                    enrollmentDate: adminEnrollmentDate.trim() || null,
                    notes: adminNotes.trim() || null,
                    updatedAt: serverTimestamp(),
                },
                { merge: true }
            );
            setUsers((prev) =>
                prev.map((item) =>
                    item.uid === selectedUser.uid
                        ? {
                            ...item,
                            accountType: adminAccountType,
                            orgId: adminOrgId.trim() || undefined,
                            classroomId: adminClassroomId.trim() || undefined,
                            status: adminStatus,
                            billing: {
                                plan: adminBillingPlan,
                                status: adminBillingStatus,
                            },
                            entitlements: {
                                typing: adminEntTyping,
                                flashMentalMath: adminEntFlash,
                                reading: adminEntReading,
                            },
                            name: {
                                family: adminFamilyName.trim() || undefined,
                                given: adminGivenName.trim() || undefined,
                            },
                            birthDate: adminBirthDate.trim() || undefined,
                            gender: adminGender,
                            schoolType: adminSchoolType,
                            grade: adminGrade.trim() ? Number(adminGrade) : undefined,
                            timezone: adminTimezone.trim() || undefined,
                            enrollmentDate: adminEnrollmentDate.trim() || undefined,
                            notes: adminNotes.trim() || undefined,
                        }
                        : item
                )
            );
        } catch {
            setAdminEditError('管理者設定の保存に失敗しました。');
        } finally {
            setAdminSaving(false);
        }
    };

    const handleProfileNew = () => {
        setSelectedMemberNo(null);
        setProfileMemberNo('');
        setProfileDisplayName('');
        setProfileNote('');
        setProfileFormError(null);
    };

    const handleProfileSave = async () => {
        const memberNo = profileMemberNo.trim();
        if (!memberNo) {
            setProfileFormError('会員番号を入力してください。');
            return;
        }
        setProfileSaving(true);
        setProfileFormError(null);
        const isNew = !memberProfiles.some((item) => item.memberNo === memberNo);
        try {
            await saveMemberProfileTemplate(
                memberNo,
                profileDisplayName.trim(),
                profileNote.trim() || undefined,
                isNew
            );
            await loadMemberProfiles();
            setSelectedMemberNo(memberNo);
        } catch {
            setProfileFormError('テンプレートの保存に失敗しました。');
        } finally {
            setProfileSaving(false);
        }
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

                <section className={styles.metricsSection}>
                    <Card className={styles.metricsCard} variant="outlined">
                        <div className={styles.listHeader}>運用指標（Admin 利用回数）</div>
                        {usageHidden ? (
                            <div className={styles.metricsNotice}>
                                <span>運用指標は現在非表示です。</span>
                                <Button variant="secondary" size="sm" onClick={() => setUsageHidden(false)}>
                                    表示する
                                </Button>
                            </div>
                        ) : (
                            <>
                                {usageError && (
                                    <div className={styles.metricsNotice}>
                                        <span>{usageError}</span>
                                        <Button variant="secondary" size="sm" onClick={() => setUsageHidden(true)}>
                                            非表示にする
                                        </Button>
                                    </div>
                                )}
                                {!usageError && (
                                    <div className={styles.metricsGrid}>
                                        <div className={styles.metricItem}>
                                            <span>当日</span>
                                            <strong>{usageLoading ? '…' : formatNumber(usageToday)}</strong>
                                        </div>
                                        <div className={styles.metricItem}>
                                            <span>前日</span>
                                            <strong>{usageLoading ? '…' : formatNumber(usageYesterday)}</strong>
                                        </div>
                                        <div className={styles.metricItem}>
                                            <span>直近7日</span>
                                            <strong>{usageLoading ? '…' : formatNumber(usage7d)}</strong>
                                        </div>
                                        <div className={styles.metricItem}>
                                            <span>直近30日</span>
                                            <strong>{usageLoading ? '…' : formatNumber(usage30d)}</strong>
                                        </div>
                                    </div>
                                )}
                                <div className={styles.metricsActions}>
                                    <Button variant="secondary" onClick={loadUsageSummary} isLoading={usageLoading}>
                                        指標更新
                                    </Button>
                                </div>
                            </>
                        )}
                    </Card>
                </section>

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

                <section className={styles.filterSection}>
                    <div className={styles.filterGroup}>
                        <span className={styles.filterLabel}>アクティブ</span>
                        <button
                            type="button"
                            className={`${styles.filterButton} ${activityFilter === 'all' ? styles.filterButtonActive : ''}`}
                            aria-pressed={activityFilter === 'all'}
                            onClick={() => setActivityFilter('all')}
                        >
                            すべて
                        </button>
                        <button
                            type="button"
                            className={`${styles.filterButton} ${activityFilter === 'active7' ? styles.filterButtonActive : ''}`}
                            aria-pressed={activityFilter === 'active7'}
                            onClick={() => setActivityFilter('active7')}
                        >
                            7日以内
                        </button>
                        <button
                            type="button"
                            className={`${styles.filterButton} ${activityFilter === 'inactive30' ? styles.filterButtonActive : ''}`}
                            aria-pressed={activityFilter === 'inactive30'}
                            onClick={() => setActivityFilter('inactive30')}
                        >
                            30日以上未学習
                        </button>
                    </div>
                    <div className={styles.filterGroup}>
                        <span className={styles.filterLabel}>進捗</span>
                        <button
                            type="button"
                            className={`${styles.filterButton} ${progressFilter === 'all' ? styles.filterButtonActive : ''}`}
                            aria-pressed={progressFilter === 'all'}
                            onClick={() => setProgressFilter('all')}
                        >
                            すべて
                        </button>
                        <button
                            type="button"
                            className={`${styles.filterButton} ${progressFilter === 'zero' ? styles.filterButtonActive : ''}`}
                            aria-pressed={progressFilter === 'zero'}
                            onClick={() => setProgressFilter('zero')}
                        >
                            0%
                        </button>
                        <button
                            type="button"
                            className={`${styles.filterButton} ${progressFilter === 'low' ? styles.filterButtonActive : ''}`}
                            aria-pressed={progressFilter === 'low'}
                            onClick={() => setProgressFilter('low')}
                        >
                            1-49%
                        </button>
                        <button
                            type="button"
                            className={`${styles.filterButton} ${progressFilter === 'mid' ? styles.filterButtonActive : ''}`}
                            aria-pressed={progressFilter === 'mid'}
                            onClick={() => setProgressFilter('mid')}
                        >
                            50-99%
                        </button>
                        <button
                            type="button"
                            className={`${styles.filterButton} ${progressFilter === 'complete' ? styles.filterButtonActive : ''}`}
                            aria-pressed={progressFilter === 'complete'}
                            onClick={() => setProgressFilter('complete')}
                        >
                            100%
                        </button>
                    </div>
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
                                <div className={styles.sectionDivider} />
                                <div className={styles.editSection}>
                                    <div className={styles.editHeader}>
                                        <span>ユーザー情報の編集</span>
                                        {!isEditingUser && (
                                            <Button variant="secondary" type="button" onClick={() => setIsEditingUser(true)}>
                                                編集
                                            </Button>
                                        )}
                                    </div>
                                    <label className={styles.editField}>
                                        <span>表示名</span>
                                        <input
                                            className={styles.editInput}
                                            type="text"
                                            value={editDisplayName}
                                            onChange={(event) => setEditDisplayName(event.target.value)}
                                            disabled={!isEditingUser}
                                        />
                                    </label>
                                    <label className={styles.editField}>
                                        <span>会員番号</span>
                                        <input
                                            className={styles.editInput}
                                            type="text"
                                            value={editMemberNo}
                                            onChange={(event) => setEditMemberNo(event.target.value)}
                                            disabled={!isEditingUser}
                                        />
                                    </label>
                                    {userEditError && <div className={styles.error}>{userEditError}</div>}
                                    {isEditingUser && (
                                        <div className={styles.editActions}>
                                            <Button variant="primary" type="button" onClick={handleUserSave} isLoading={userSaving}>
                                                保存
                                            </Button>
                                            <Button variant="secondary" type="button" onClick={handleUserEditCancel}>
                                                キャンセル
                                            </Button>
                                        </div>
                                    )}
                                </div>
                                <div className={styles.sectionDivider} />
                                <div className={styles.editSection}>
                                    <div className={styles.editHeader}>
                                        <span>管理者設定</span>
                                    </div>
                                    <label className={styles.editField}>
                                        <span>アカウント種別</span>
                                        <select
                                            className={styles.editInput}
                                            value={adminAccountType}
                                            onChange={(event) => setAdminAccountType(event.target.value as 'guest' | 'consumer' | 'b2b2c')}
                                        >
                                            <option value="guest">guest</option>
                                            <option value="consumer">consumer</option>
                                            <option value="b2b2c">b2b2c</option>
                                        </select>
                                    </label>
                                    <label className={styles.editField}>
                                        <span>姓</span>
                                        <input
                                            className={styles.editInput}
                                            type="text"
                                            value={adminFamilyName}
                                            onChange={(event) => setAdminFamilyName(event.target.value)}
                                        />
                                    </label>
                                    <label className={styles.editField}>
                                        <span>名</span>
                                        <input
                                            className={styles.editInput}
                                            type="text"
                                            value={adminGivenName}
                                            onChange={(event) => setAdminGivenName(event.target.value)}
                                        />
                                    </label>
                                    <label className={styles.editField}>
                                        <span>生年月日</span>
                                        <input
                                            className={styles.editInput}
                                            type="date"
                                            value={adminBirthDate}
                                            onChange={(event) => setAdminBirthDate(event.target.value)}
                                        />
                                    </label>
                                    <label className={styles.editField}>
                                        <span>性別</span>
                                        <select
                                            className={styles.editInput}
                                            value={adminGender}
                                            onChange={(event) => setAdminGender(event.target.value as 'male' | 'female' | 'other' | 'undisclosed')}
                                        >
                                            <option value="undisclosed">undisclosed</option>
                                            <option value="male">male</option>
                                            <option value="female">female</option>
                                            <option value="other">other</option>
                                        </select>
                                    </label>
                                    <label className={styles.editField}>
                                        <span>学校種別</span>
                                        <select
                                            className={styles.editInput}
                                            value={adminSchoolType}
                                            onChange={(event) => setAdminSchoolType(event.target.value as 'elementary' | 'junior' | 'high' | 'other')}
                                        >
                                            <option value="elementary">elementary</option>
                                            <option value="junior">junior</option>
                                            <option value="high">high</option>
                                            <option value="other">other</option>
                                        </select>
                                    </label>
                                    <label className={styles.editField}>
                                        <span>学年</span>
                                        <input
                                            className={styles.editInput}
                                            type="number"
                                            min={1}
                                            max={12}
                                            value={adminGrade}
                                            onChange={(event) => setAdminGrade(event.target.value)}
                                            placeholder="例: 3"
                                        />
                                    </label>
                                    <label className={styles.editField}>
                                        <span>タイムゾーン</span>
                                        <input
                                            className={styles.editInput}
                                            type="text"
                                            value={adminTimezone}
                                            onChange={(event) => setAdminTimezone(event.target.value)}
                                            placeholder="例: Asia/Tokyo"
                                        />
                                    </label>
                                    <label className={styles.editField}>
                                        <span>在籍開始日</span>
                                        <input
                                            className={styles.editInput}
                                            type="date"
                                            value={adminEnrollmentDate}
                                            onChange={(event) => setAdminEnrollmentDate(event.target.value)}
                                        />
                                    </label>
                                    <label className={styles.editField}>
                                        <span>メモ</span>
                                        <textarea
                                            className={styles.editTextarea}
                                            value={adminNotes}
                                            onChange={(event) => setAdminNotes(event.target.value)}
                                            rows={3}
                                        />
                                    </label>
                                    <label className={styles.editField}>
                                        <span>法人ID</span>
                                        <input
                                            className={styles.editInput}
                                            type="text"
                                            value={adminOrgId}
                                            onChange={(event) => setAdminOrgId(event.target.value)}
                                        />
                                    </label>
                                    <label className={styles.editField}>
                                        <span>教室ID</span>
                                        <input
                                            className={styles.editInput}
                                            type="text"
                                            value={adminClassroomId}
                                            onChange={(event) => setAdminClassroomId(event.target.value)}
                                        />
                                    </label>
                                    <label className={styles.editField}>
                                        <span>在籍ステータス</span>
                                        <select
                                            className={styles.editInput}
                                            value={adminStatus}
                                            onChange={(event) => setAdminStatus(event.target.value as 'active' | 'inactive' | 'archived' | 'pending')}
                                        >
                                            <option value="active">active</option>
                                            <option value="inactive">inactive</option>
                                            <option value="archived">archived</option>
                                            <option value="pending">pending</option>
                                        </select>
                                    </label>
                                    <label className={styles.editField}>
                                        <span>課金プラン</span>
                                        <select
                                            className={styles.editInput}
                                            value={adminBillingPlan}
                                            onChange={(event) => setAdminBillingPlan(event.target.value as 'free' | 'paid')}
                                        >
                                            <option value="free">free</option>
                                            <option value="paid">paid</option>
                                        </select>
                                    </label>
                                    <label className={styles.editField}>
                                        <span>課金状態</span>
                                        <select
                                            className={styles.editInput}
                                            value={adminBillingStatus}
                                            onChange={(event) => setAdminBillingStatus(event.target.value as 'active' | 'past_due' | 'canceled' | 'trial')}
                                        >
                                            <option value="active">active</option>
                                            <option value="past_due">past_due</option>
                                            <option value="canceled">canceled</option>
                                            <option value="trial">trial</option>
                                        </select>
                                    </label>
                                    <div className={styles.editField}>
                                        <span>利用可能サービス</span>
                                        <label className={styles.toggleField}>
                                            <input
                                                type="checkbox"
                                                checked={adminEntTyping}
                                                onChange={(event) => setAdminEntTyping(event.target.checked)}
                                            />
                                            <span>タイピング</span>
                                        </label>
                                        <label className={styles.toggleField}>
                                            <input
                                                type="checkbox"
                                                checked={adminEntFlash}
                                                onChange={(event) => setAdminEntFlash(event.target.checked)}
                                            />
                                            <span>暗算</span>
                                        </label>
                                        <label className={styles.toggleField}>
                                            <input
                                                type="checkbox"
                                                checked={adminEntReading}
                                                onChange={(event) => setAdminEntReading(event.target.checked)}
                                            />
                                            <span>読書</span>
                                        </label>
                                    </div>
                                    {adminEditError && <div className={styles.error}>{adminEditError}</div>}
                                    <div className={styles.editActions}>
                                        <Button variant="primary" type="button" onClick={handleAdminSave} isLoading={adminSaving}>
                                            管理者設定を保存
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </Card>
                </section>

                <section className={styles.templateSection}>
                    <header className={styles.templateHeader}>
                        <div>
                            <h2 className={styles.templateTitle}>会員番号テンプレート</h2>
                            <p className={styles.subtitle}>自己登録時の表示名を事前に用意します。</p>
                        </div>
                        <div className={styles.actions}>
                            <Button variant="secondary" type="button" onClick={handleProfileNew}>
                                新規作成
                            </Button>
                            <Button variant="secondary" type="button" onClick={loadMemberProfiles} isLoading={memberProfilesLoading}>
                                一覧更新
                            </Button>
                        </div>
                    </header>

                    <div className={styles.templateGrid}>
                        <Card className={styles.listCard} variant="outlined" padding="none">
                            <div className={styles.listHeader}>テンプレート一覧</div>
                            <div className={styles.list}>
                                {memberProfilesError && <div className={styles.error}>{memberProfilesError}</div>}
                                {!memberProfilesError && memberProfiles.length === 0 && (
                                    <div className={styles.empty}>テンプレートがありません。</div>
                                )}
                                {memberProfiles.map((profile) => {
                                    const active = profile.memberNo === selectedMemberNo;
                                    return (
                                        <button
                                            key={profile.memberNo}
                                            type="button"
                                            className={`${styles.listItem} ${active ? styles.activeItem : ''}`}
                                            onClick={() => setSelectedMemberNo(profile.memberNo)}
                                        >
                                            <div className={styles.listItemHeader}>
                                                <div className={styles.userName}>会員番号: {profile.memberNo}</div>
                                            </div>
                                            <div className={styles.userMeta}>表示名: {profile.displayName ?? '—'}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        </Card>

                        <Card className={styles.detailCard} variant="outlined">
                            <div className={styles.listHeader}>テンプレート編集</div>
                            <div className={styles.detailBody}>
                                <label className={styles.editField}>
                                    <span>会員番号</span>
                                    <input
                                        className={styles.editInput}
                                        type="text"
                                        value={profileMemberNo}
                                        onChange={(event) => setProfileMemberNo(event.target.value)}
                                    />
                                </label>
                                <label className={styles.editField}>
                                    <span>表示名</span>
                                    <input
                                        className={styles.editInput}
                                        type="text"
                                        value={profileDisplayName}
                                        onChange={(event) => setProfileDisplayName(event.target.value)}
                                        placeholder="例: さくら"
                                    />
                                </label>
                                <label className={styles.editField}>
                                    <span>メモ（任意）</span>
                                    <textarea
                                        className={styles.editTextarea}
                                        value={profileNote}
                                        onChange={(event) => setProfileNote(event.target.value)}
                                        rows={3}
                                    />
                                </label>
                                {profileFormError && <div className={styles.error}>{profileFormError}</div>}
                                <div className={styles.editActions}>
                                    <Button variant="primary" type="button" onClick={handleProfileSave} isLoading={profileSaving}>
                                        保存
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    </div>
                </section>
            </main>
        </div>
    );
}

export default AdminPage;
