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
} from 'firebase/firestore';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { auth, db } from '@/firebase';
import { logEvent } from '@/utils/analytics';
import { saveMemberProfileTemplate, type MemberProfile } from '@/utils/memberProfiles';
import { calculateGradeFromBirthDate } from '@/utils/grade';
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

type OrganizationType = 'school' | 'cram_school' | 'company' | 'other';

type OrganizationItem = {
    id: string;
    name: string;
    type: OrganizationType;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
};

type ClassroomItem = {
    id: string;
    orgId: string;
    name: string;
    grade?: number;
};

type SortKey = 'name' | 'memberNo' | 'lastActive' | 'progress' | 'createdAt';
type ColumnKey = 'memberNo' | 'uid' | 'progress' | 'lastActive' | 'lastSection' | 'createdAt';
type AccountTypeFilter = 'guest' | 'consumer' | 'b2b2c';

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

const accountTypeLabels: Record<AccountTypeFilter, string> = {
    guest: 'ゲスト',
    consumer: '一般',
    b2b2c: '法人',
};

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
    const [accountTypeFilter, setAccountTypeFilter] = useState<Record<AccountTypeFilter, boolean>>({
        guest: true,
        consumer: true,
        b2b2c: true,
    });
    const [sortKey, setSortKey] = useState<SortKey>('lastActive');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>({
        memberNo: true,
        uid: false,
        progress: true,
        lastActive: true,
        lastSection: false,
        createdAt: false,
    });
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

    const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
    const [orgLoading, setOrgLoading] = useState(false);
    const [orgError, setOrgError] = useState<string | null>(null);
    const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
    const [orgName, setOrgName] = useState('');
    const [orgType, setOrgType] = useState<OrganizationType>('school');
    const [orgContactName, setOrgContactName] = useState('');
    const [orgContactEmail, setOrgContactEmail] = useState('');
    const [orgContactPhone, setOrgContactPhone] = useState('');
    const [orgSaving, setOrgSaving] = useState(false);
    const [orgFormError, setOrgFormError] = useState<string | null>(null);

    const [classrooms, setClassrooms] = useState<ClassroomItem[]>([]);
    const [classroomLoading, setClassroomLoading] = useState(false);
    const [classroomError, setClassroomError] = useState<string | null>(null);
    const [selectedClassroomId, setSelectedClassroomId] = useState<string | null>(null);
    const [classroomName, setClassroomName] = useState('');
    const [classroomOrgId, setClassroomOrgId] = useState('');
    const [classroomGrade, setClassroomGrade] = useState('');
    const [classroomSaving, setClassroomSaving] = useState(false);
    const [classroomFormError, setClassroomFormError] = useState<string | null>(null);

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

    const loadOrganizations = useCallback(async () => {
        setOrgLoading(true);
        setOrgError(null);
        try {
            const snap = await getDocs(collection(db, 'organizations'));
            const items: OrganizationItem[] = snap.docs.map((docSnap) => {
                const data = docSnap.data() as {
                    name?: string;
                    type?: OrganizationType;
                    contact?: { name?: string; email?: string; phone?: string };
                };
                return {
                    id: docSnap.id,
                    name: data.name ?? '未設定',
                    type: data.type ?? 'other',
                    contactName: data.contact?.name ?? undefined,
                    contactEmail: data.contact?.email ?? undefined,
                    contactPhone: data.contact?.phone ?? undefined,
                };
            });
            items.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
            setOrganizations(items);
            if (!selectedOrgId && items.length > 0) {
                setSelectedOrgId(items[0].id);
            }
        } catch {
            setOrgError('法人情報の取得に失敗しました。');
        } finally {
            setOrgLoading(false);
        }
    }, [selectedOrgId]);

    const loadClassrooms = useCallback(async () => {
        setClassroomLoading(true);
        setClassroomError(null);
        try {
            const snap = await getDocs(collection(db, 'classrooms'));
            const items: ClassroomItem[] = snap.docs.map((docSnap) => {
                const data = docSnap.data() as {
                    orgId?: string;
                    name?: string;
                    grade?: number | null;
                };
                return {
                    id: docSnap.id,
                    orgId: data.orgId ?? '',
                    name: data.name ?? '未設定',
                    grade: data.grade ?? undefined,
                };
            });
            items.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
            setClassrooms(items);
            if (!selectedClassroomId && items.length > 0) {
                setSelectedClassroomId(items[0].id);
            }
        } catch {
            setClassroomError('教室情報の取得に失敗しました。');
        } finally {
            setClassroomLoading(false);
        }
    }, [selectedClassroomId]);

    const loadUsageSummary = useCallback(async () => {
        setUsageLoading(true);
        setUsageError(null);
        try {
            const now = new Date();
            const usageQuery = query(
                collection(db, 'analytics_events'),
                where('eventType', '==', 'admin_users_loaded')
            );
            const snap = await getDocs(usageQuery);

            let todayCount = 0;
            let yesterdayCount = 0;
            let count7d = 0;
            let count30d = 0;

            snap.forEach((docSnap) => {
                const data = docSnap.data() as { createdAt?: { toDate?: () => Date } | null; eventType?: string };
                if (data.eventType !== 'admin_users_loaded') return;
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

    useEffect(() => {
        if (!isAdmin) return;
        void loadOrganizations();
    }, [isAdmin, loadOrganizations]);

    useEffect(() => {
        if (!isAdmin) return;
        void loadClassrooms();
    }, [isAdmin, loadClassrooms]);

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
            const normalizedAccountType = user.accountType ?? 'consumer';
            if (!accountTypeFilter[normalizedAccountType]) return false;

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
    }, [users, searchTerm, activityFilter, progressFilter, accountTypeFilter]);

    const sortedUsers = useMemo(() => {
        const getSortValue = (user: AdminUser) => {
            switch (sortKey) {
                case 'name':
                    return normalize(user.displayName ?? '');
                case 'memberNo':
                    return normalize(user.memberNo ?? '');
                case 'lastActive':
                    return user.stats?.lastActiveAt ? new Date(user.stats.lastActiveAt).getTime() : null;
                case 'progress':
                    return getProgressRatio(user.stats);
                case 'createdAt':
                    return user.createdAt ? new Date(user.createdAt).getTime() : null;
                default:
                    return null;
            }
        };

        const compareValues = (a: AdminUser, b: AdminUser) => {
            const aVal = getSortValue(a);
            const bVal = getSortValue(b);
            if (aVal === null || aVal === undefined) return 1;
            if (bVal === null || bVal === undefined) return -1;
            if (typeof aVal === 'string' && typeof bVal === 'string') {
                const result = aVal.localeCompare(bVal, 'ja');
                return sortDir === 'asc' ? result : -result;
            }
            const result = Number(aVal) - Number(bVal);
            return sortDir === 'asc' ? result : -result;
        };

        return [...filteredUsers].sort(compareValues);
    }, [filteredUsers, sortKey, sortDir]);

    const dashboardStats = useMemo(() => {
        let active7 = 0;
        let inactive30 = 0;
        let zeroProgress = 0;
        let complete = 0;
        let progressSum = 0;
        let progressCount = 0;
        const riskItems: Array<{ user: AdminUser; daysSince: number | null; ratio: number | null }> = [];
        const recentItems: Array<{ user: AdminUser; daysSince: number | null; ratio: number | null }> = [];

        users.forEach((user) => {
            const daysSince = getDaysSince(user.stats?.lastActiveAt);
            const ratio = getProgressRatio(user.stats);

            if (daysSince !== null) {
                if (daysSince <= 7) active7 += 1;
                if (daysSince > 30) inactive30 += 1;
                recentItems.push({ user, daysSince, ratio });
            }

            if (ratio !== null) {
                if (ratio === 0) zeroProgress += 1;
                if (ratio >= 1) complete += 1;
                progressSum += Math.min(ratio, 1);
                progressCount += 1;
            }

            if ((daysSince !== null && daysSince > 30) || ratio === 0) {
                riskItems.push({ user, daysSince, ratio });
            }
        });

        const avgProgress = progressCount ? Math.round((progressSum / progressCount) * 100) : null;
        const atRiskUsers = riskItems
            .sort((a, b) => {
                const aScore = (a.ratio === 0 ? 1000 : 0) + (a.daysSince ?? 0);
                const bScore = (b.ratio === 0 ? 1000 : 0) + (b.daysSince ?? 0);
                return bScore - aScore;
            })
            .slice(0, 5);
        const recentActiveUsers = recentItems
            .sort((a, b) => (a.daysSince ?? 9999) - (b.daysSince ?? 9999))
            .slice(0, 5);

        return {
            total: users.length,
            active7,
            inactive30,
            zeroProgress,
            complete,
            avgProgress,
            atRiskUsers,
            recentActiveUsers,
        };
    }, [users]);

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

    useEffect(() => {
        if (!selectedOrgId) {
            setOrgName('');
            setOrgType('school');
            setOrgContactName('');
            setOrgContactEmail('');
            setOrgContactPhone('');
            setOrgFormError(null);
            return;
        }
        const org = organizations.find((item) => item.id === selectedOrgId);
        setOrgName(org?.name ?? '');
        setOrgType(org?.type ?? 'other');
        setOrgContactName(org?.contactName ?? '');
        setOrgContactEmail(org?.contactEmail ?? '');
        setOrgContactPhone(org?.contactPhone ?? '');
        setOrgFormError(null);
    }, [selectedOrgId, organizations]);

    useEffect(() => {
        if (!selectedClassroomId) {
            setClassroomName('');
            setClassroomOrgId('');
            setClassroomGrade('');
            setClassroomFormError(null);
            return;
        }
        const classroom = classrooms.find((item) => item.id === selectedClassroomId);
        setClassroomName(classroom?.name ?? '');
        setClassroomOrgId(classroom?.orgId ?? '');
        setClassroomGrade(classroom?.grade !== undefined ? String(classroom.grade) : '');
        setClassroomFormError(null);
    }, [selectedClassroomId, classrooms]);

    const handleBack = () => {
        navigate('/');
    };

    const handleResetFilters = () => {
        setSearchTerm('');
        setActivityFilter('all');
        setProgressFilter('all');
        setAccountTypeFilter({
            guest: true,
            consumer: true,
            b2b2c: true,
        });
    };

    const handleSort = (key: SortKey) => {
        setSortKey((prev) => {
            if (prev === key) {
                setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
                return prev;
            }
            setSortDir('desc');
            return key;
        });
    };

    const toggleColumn = (key: ColumnKey) => {
        setVisibleColumns((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
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

    const handleOrgNew = () => {
        setSelectedOrgId(null);
        setOrgName('');
        setOrgType('school');
        setOrgContactName('');
        setOrgContactEmail('');
        setOrgContactPhone('');
        setOrgFormError(null);
    };

    const handleOrgSave = async () => {
        const name = orgName.trim();
        if (!name) {
            setOrgFormError('法人名を入力してください。');
            return;
        }
        setOrgSaving(true);
        setOrgFormError(null);
        try {
            const id = selectedOrgId ?? doc(collection(db, 'organizations')).id;
            await setDoc(
                doc(db, 'organizations', id),
                {
                    name,
                    type: orgType,
                    contact: {
                        name: orgContactName.trim() || null,
                        email: orgContactEmail.trim() || null,
                        phone: orgContactPhone.trim() || null,
                    },
                    updatedAt: serverTimestamp(),
                },
                { merge: true }
            );
            await loadOrganizations();
            setSelectedOrgId(id);
        } catch {
            setOrgFormError('法人情報の保存に失敗しました。');
        } finally {
            setOrgSaving(false);
        }
    };

    const handleClassroomNew = () => {
        setSelectedClassroomId(null);
        setClassroomName('');
        setClassroomOrgId('');
        setClassroomGrade('');
        setClassroomFormError(null);
    };

    const handleClassroomSave = async () => {
        const name = classroomName.trim();
        const orgId = classroomOrgId.trim();
        if (!name) {
            setClassroomFormError('教室名を入力してください。');
            return;
        }
        if (!orgId) {
            setClassroomFormError('法人IDを入力してください。');
            return;
        }
        setClassroomSaving(true);
        setClassroomFormError(null);
        try {
            const id = selectedClassroomId ?? doc(collection(db, 'classrooms')).id;
            await setDoc(
                doc(db, 'classrooms', id),
                {
                    orgId,
                    name,
                    grade: classroomGrade.trim() ? Number(classroomGrade) : null,
                    updatedAt: serverTimestamp(),
                },
                { merge: true }
            );
            await loadClassrooms();
            setSelectedClassroomId(id);
        } catch {
            setClassroomFormError('教室情報の保存に失敗しました。');
        } finally {
            setClassroomSaving(false);
        }
    };

    const handleAutoGrade = () => {
        if (!adminBirthDate) return;
        const result = calculateGradeFromBirthDate(adminBirthDate);
        if (!result) return;
        setAdminGrade(result.grade ? String(result.grade) : '');
        setAdminSchoolType(result.schoolType);
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
                    </div>
                </header>

                <section className={styles.dashboard}>
                    <div className={styles.sectionHeader}>
                        <div>
                            <h2 className={styles.sectionTitle}>運用サマリ</h2>
                            <p className={styles.sectionSub}>KPIと学習リスクを素早く把握</p>
                        </div>
                        <div className={styles.sectionActions}>
                            <Button variant="secondary" size="sm" onClick={loadUsageSummary} isLoading={usageLoading}>
                                指標更新
                            </Button>
                            <Button variant="primary" size="sm" onClick={loadUsers} isLoading={loading}>
                                ユーザー更新
                            </Button>
                        </div>
                    </div>
                    <div className={styles.kpiGrid}>
                        <Card className={styles.kpiCard} variant="outlined">
                            <div className={styles.kpiLabel}>総ユーザー</div>
                            <div className={styles.kpiValue}>{formatNumber(dashboardStats.total)}</div>
                            <div className={styles.kpiMeta}>アクティブ7日以内 {formatNumber(dashboardStats.active7)}</div>
                        </Card>
                        <Card className={styles.kpiCard} variant="outlined">
                            <div className={styles.kpiLabel}>学習停滞</div>
                            <div className={styles.kpiValue}>{formatNumber(dashboardStats.inactive30)}</div>
                            <div className={styles.kpiMeta}>30日以上未学習</div>
                        </Card>
                        <Card className={styles.kpiCard} variant="outlined">
                            <div className={styles.kpiLabel}>進捗0%</div>
                            <div className={styles.kpiValue}>{formatNumber(dashboardStats.zeroProgress)}</div>
                            <div className={styles.kpiMeta}>未着手ユーザー</div>
                        </Card>
                        <Card className={styles.kpiCard} variant="outlined">
                            <div className={styles.kpiLabel}>完了率</div>
                            <div className={styles.kpiValue}>{dashboardStats.avgProgress === null ? '—' : `${dashboardStats.avgProgress}%`}</div>
                            <div className={styles.kpiMeta}>進捗あり {formatNumber(dashboardStats.complete)} 名が100%</div>
                        </Card>
                        <Card className={styles.kpiCard} variant="outlined">
                            <div className={styles.kpiLabel}>組織</div>
                            <div className={styles.kpiValue}>{orgLoading ? '—' : formatNumber(organizations.length)}</div>
                            <div className={styles.kpiMeta}>クラス {classroomLoading ? '—' : formatNumber(classrooms.length)}</div>
                        </Card>
                        <Card className={styles.kpiCard} variant="outlined">
                            <div className={styles.kpiLabel}>運用ログ</div>
                            <div className={styles.kpiValue}>{usageLoading ? '…' : formatNumber(usage7d)}</div>
                            <div className={styles.kpiMeta}>直近30日 {usageLoading ? '…' : formatNumber(usage30d)}</div>
                        </Card>
                    </div>
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
                            </>
                        )}
                    </Card>
                    <div className={styles.alertGrid}>
                        <Card className={styles.alertCard} variant="outlined">
                            <div className={styles.alertHeader}>要フォロー</div>
                            <div className={styles.alertList}>
                                {dashboardStats.atRiskUsers.length === 0 && (
                                    <div className={styles.empty}>要フォローユーザーは見つかりませんでした。</div>
                                )}
                                {dashboardStats.atRiskUsers.map((item) => {
                                    const reasons: string[] = [];
                                    if (item.daysSince !== null && item.daysSince > 30) reasons.push('30日以上未学習');
                                    if (item.ratio === 0) reasons.push('進捗0%');
                                    return (
                                        <button
                                            key={item.user.uid}
                                            type="button"
                                            className={styles.alertItem}
                                            onClick={() => setSelectedUserId(item.user.uid)}
                                        >
                                            <div>
                                                <div className={styles.alertName}>{item.user.displayName}</div>
                                                <div className={styles.alertMeta}>
                                                    最終学習: {formatDateTime(item.user.stats?.lastActiveAt)}
                                                </div>
                                            </div>
                                            <span className={styles.alertBadge}>{reasons.join(' / ') || '要確認'}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </Card>
                        <Card className={styles.alertCard} variant="outlined">
                            <div className={styles.alertHeader}>最近の学習</div>
                            <div className={styles.alertList}>
                                {dashboardStats.recentActiveUsers.length === 0 && (
                                    <div className={styles.empty}>最近の学習が見つかりませんでした。</div>
                                )}
                                {dashboardStats.recentActiveUsers.map((item) => (
                                    <button
                                        key={item.user.uid}
                                        type="button"
                                        className={styles.alertItem}
                                        onClick={() => setSelectedUserId(item.user.uid)}
                                    >
                                        <div>
                                            <div className={styles.alertName}>{item.user.displayName}</div>
                                            <div className={styles.alertMeta}>
                                                最終学習: {formatDateTime(item.user.stats?.lastActiveAt)}
                                            </div>
                                        </div>
                                        <span className={styles.alertBadge}>
                                            進捗 {formatProgress(item.user.stats?.clearedSectionsCount, item.user.stats?.totalSectionsCount)}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </Card>
                    </div>
                </section>

                <section className={styles.toolbar}>
                    <div className={styles.sectionHeader}>
                        <div>
                            <h2 className={styles.sectionTitle}>ユーザー管理</h2>
                            <p className={styles.sectionSub}>検索・フィルタで対象ユーザーを絞り込み</p>
                        </div>
                        <div className={styles.sectionActions}>
                            <Button variant="secondary" size="sm" onClick={handleResetFilters}>
                                フィルタ解除
                            </Button>
                        </div>
                    </div>
                    <div className={styles.toolbarControls}>
                        <div className={styles.searchSection}>
                            <input
                                className={styles.searchInput}
                                type="text"
                                placeholder="表示名 / 会員番号 / UID で検索"
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                            />
                            <span className={styles.count}>表示 {filteredUsers.length} / 全 {users.length}</span>
                        </div>
                        <div className={styles.filterSection}>
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
                            <div className={styles.filterGroup}>
                                <span className={styles.filterLabel}>種別</span>
                                {(Object.keys(accountTypeLabels) as AccountTypeFilter[]).map((type) => (
                                    <label key={type} className={styles.columnToggle}>
                                        <input
                                            type="checkbox"
                                            checked={accountTypeFilter[type]}
                                            onChange={() =>
                                                setAccountTypeFilter((prev) => ({
                                                    ...prev,
                                                    [type]: !prev[type],
                                                }))
                                            }
                                        />
                                        {accountTypeLabels[type]}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className={styles.filterSection}>
                            <div className={styles.filterGroup}>
                                <span className={styles.filterLabel}>表示列</span>
                                <label className={styles.columnToggle}>
                                    <input
                                        type="checkbox"
                                        checked={visibleColumns.memberNo}
                                        onChange={() => toggleColumn('memberNo')}
                                    />
                                    会員番号
                                </label>
                                <label className={styles.columnToggle}>
                                    <input
                                        type="checkbox"
                                        checked={visibleColumns.progress}
                                        onChange={() => toggleColumn('progress')}
                                    />
                                    進捗
                                </label>
                                <label className={styles.columnToggle}>
                                    <input
                                        type="checkbox"
                                        checked={visibleColumns.lastActive}
                                        onChange={() => toggleColumn('lastActive')}
                                    />
                                    最終学習
                                </label>
                                <label className={styles.columnToggle}>
                                    <input
                                        type="checkbox"
                                        checked={visibleColumns.lastSection}
                                        onChange={() => toggleColumn('lastSection')}
                                    />
                                    直近セクション
                                </label>
                                <label className={styles.columnToggle}>
                                    <input
                                        type="checkbox"
                                        checked={visibleColumns.createdAt}
                                        onChange={() => toggleColumn('createdAt')}
                                    />
                                    作成日
                                </label>
                                <label className={styles.columnToggle}>
                                    <input
                                        type="checkbox"
                                        checked={visibleColumns.uid}
                                        onChange={() => toggleColumn('uid')}
                                    />
                                    UID
                                </label>
                            </div>
                        </div>
                        <div className={styles.toolbarActions}>
                            <Button variant="primary" onClick={loadUsers} isLoading={loading}>
                                再読み込み
                            </Button>
                        </div>
                    </div>
                </section>

                <section className={styles.grid}>
                    <Card className={styles.listCard} variant="outlined" padding="none">
                        <div className={styles.listHeader}>ユーザー一覧</div>
                        <div className={styles.tableWrap}>
                            {filteredUsers.length === 0 && (
                                <div className={styles.empty}>該当ユーザーがいません。</div>
                            )}
                            {filteredUsers.length > 0 && (
                                <>
                                    <div className={styles.tableDesktop}>
                                        <table className={styles.table}>
                                            <caption className={styles.srOnly}>ユーザー一覧テーブル</caption>
                                            <thead>
                                                <tr>
                                                    <th
                                                        className={`${styles.th} ${styles.colName} ${styles.stickyCol}`}
                                                        aria-sort={sortKey === 'name' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                                                    >
                                                        <button
                                                            type="button"
                                                            className={styles.sortButton}
                                                            onClick={() => handleSort('name')}
                                                        >
                                                            表示名
                                                            {sortKey === 'name' && (
                                                                <span className={styles.sortIndicator}>{sortDir === 'asc' ? '▲' : '▼'}</span>
                                                            )}
                                                        </button>
                                                    </th>
                                                    {visibleColumns.memberNo && (
                                                        <th
                                                            className={`${styles.th} ${styles.colMemberNo} ${styles.stickyColSecondary}`}
                                                            aria-sort={sortKey === 'memberNo' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                                                        >
                                                            <button
                                                                type="button"
                                                                className={styles.sortButton}
                                                                onClick={() => handleSort('memberNo')}
                                                            >
                                                                会員番号
                                                                {sortKey === 'memberNo' && (
                                                                    <span className={styles.sortIndicator}>{sortDir === 'asc' ? '▲' : '▼'}</span>
                                                                )}
                                                            </button>
                                                        </th>
                                                    )}
                                                    {visibleColumns.progress && (
                                                        <th
                                                            className={`${styles.th} ${styles.colProgress}`}
                                                            aria-sort={sortKey === 'progress' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                                                        >
                                                            <button
                                                                type="button"
                                                                className={styles.sortButton}
                                                                onClick={() => handleSort('progress')}
                                                            >
                                                                進捗
                                                                {sortKey === 'progress' && (
                                                                    <span className={styles.sortIndicator}>{sortDir === 'asc' ? '▲' : '▼'}</span>
                                                                )}
                                                            </button>
                                                        </th>
                                                    )}
                                                    {visibleColumns.lastActive && (
                                                        <th
                                                            className={`${styles.th} ${styles.colLastActive}`}
                                                            aria-sort={sortKey === 'lastActive' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                                                        >
                                                            <button
                                                                type="button"
                                                                className={styles.sortButton}
                                                                onClick={() => handleSort('lastActive')}
                                                            >
                                                                最終学習
                                                                {sortKey === 'lastActive' && (
                                                                    <span className={styles.sortIndicator}>{sortDir === 'asc' ? '▲' : '▼'}</span>
                                                                )}
                                                            </button>
                                                        </th>
                                                    )}
                                                    {visibleColumns.lastSection && <th className={`${styles.th} ${styles.colLastSection}`}>直近セクション</th>}
                                                    {visibleColumns.createdAt && (
                                                        <th
                                                            className={`${styles.th} ${styles.colCreatedAt}`}
                                                            aria-sort={sortKey === 'createdAt' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                                                        >
                                                            <button
                                                                type="button"
                                                                className={styles.sortButton}
                                                                onClick={() => handleSort('createdAt')}
                                                            >
                                                                作成日
                                                                {sortKey === 'createdAt' && (
                                                                    <span className={styles.sortIndicator}>{sortDir === 'asc' ? '▲' : '▼'}</span>
                                                                )}
                                                            </button>
                                                        </th>
                                                    )}
                                                    {visibleColumns.uid && <th className={`${styles.th} ${styles.colUid}`}>UID</th>}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sortedUsers.map((user) => {
                                                    const active = user.uid === selectedUserId;
                                                    const progressText = formatProgress(
                                                        user.stats?.clearedSectionsCount,
                                                        user.stats?.totalSectionsCount
                                                    );
                                                    const lastSection = user.stats?.lastSectionLabel || user.stats?.lastSectionId || '—';
                                                    return (
                                                        <tr
                                                            key={user.uid}
                                                            className={`${styles.tr} ${active ? styles.activeRow : ''}`}
                                                            onClick={() => setSelectedUserId(user.uid)}
                                                            role="button"
                                                            tabIndex={0}
                                                            onKeyDown={(event) => {
                                                                if (event.key === 'Enter' || event.key === ' ') {
                                                                    event.preventDefault();
                                                                    setSelectedUserId(user.uid);
                                                                }
                                                            }}
                                                        >
                                                            <td className={`${styles.tdPrimary} ${styles.colName} ${styles.stickyCol}`}>{user.displayName}</td>
                                                            {visibleColumns.memberNo && (
                                                                <td className={`${styles.td} ${styles.colMemberNo} ${styles.stickyColSecondary}`}>
                                                                    {user.memberNo ?? '—'}
                                                                </td>
                                                            )}
                                                            {visibleColumns.progress && (
                                                                <td className={`${styles.td} ${styles.colProgress}`}>
                                                                    <span className={styles.progressBadge}>進捗 {progressText}</span>
                                                                </td>
                                                            )}
                                                            {visibleColumns.lastActive && (
                                                                <td className={`${styles.td} ${styles.colLastActive}`}>{formatDateTime(user.stats?.lastActiveAt)}</td>
                                                            )}
                                                            {visibleColumns.lastSection && <td className={`${styles.td} ${styles.colLastSection}`}>{lastSection}</td>}
                                                            {visibleColumns.createdAt && <td className={`${styles.td} ${styles.colCreatedAt}`}>{formatDate(user.createdAt)}</td>}
                                                            {visibleColumns.uid && <td className={`${styles.tdMono} ${styles.colUid}`}>{user.uid}</td>}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className={styles.mobileTableList}>
                                        {sortedUsers.map((user) => {
                                            const active = user.uid === selectedUserId;
                                            const progressText = formatProgress(
                                                user.stats?.clearedSectionsCount,
                                                user.stats?.totalSectionsCount
                                            );
                                            const lastSection = user.stats?.lastSectionLabel || user.stats?.lastSectionId || '—';
                                            return (
                                                <button
                                                    key={`${user.uid}-mobile`}
                                                    type="button"
                                                    className={`${styles.mobileUserCard} ${active ? styles.mobileUserCardActive : ''}`}
                                                    onClick={() => setSelectedUserId(user.uid)}
                                                >
                                                    <div className={styles.mobileUserHeader}>
                                                        <span className={styles.mobileUserName}>{user.displayName}</span>
                                                        {visibleColumns.progress && (
                                                            <span className={styles.progressBadge}>進捗 {progressText}</span>
                                                        )}
                                                    </div>
                                                    <div className={styles.mobileUserMeta}>
                                                        {visibleColumns.memberNo && <span>会員番号: {user.memberNo ?? '—'}</span>}
                                                        {visibleColumns.lastActive && <span>最終学習: {formatDateTime(user.stats?.lastActiveAt)}</span>}
                                                        {visibleColumns.lastSection && <span>直近セクション: {lastSection}</span>}
                                                        {visibleColumns.createdAt && <span>作成日: {formatDate(user.createdAt)}</span>}
                                                        {visibleColumns.uid && <span className={styles.mono}>UID: {user.uid}</span>}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
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
                                <details className={styles.detailSection} open>
                                    <summary className={styles.detailSummary}>
                                        <span>ユーザー情報の編集</span>
                                        {!isEditingUser && (
                                            <Button variant="secondary" type="button" onClick={() => setIsEditingUser(true)}>
                                                編集
                                            </Button>
                                        )}
                                    </summary>
                                    <div className={styles.editSection}>
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
                                </details>
                                <div className={styles.sectionDivider} />
                                <details className={styles.detailSection}>
                                    <summary className={styles.detailSummary}>
                                        <span>管理者設定</span>
                                    </summary>
                                    <div className={styles.editSection}>
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
                                    <div className={styles.editActions}>
                                        <Button variant="secondary" type="button" onClick={handleAutoGrade}>
                                            学年を自動計算
                                        </Button>
                                    </div>
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
                                </details>
                            </div>
                        )}
                    </Card>
                </section>

                <section className={styles.templateSection}>
                    <header className={styles.templateHeader}>
                        <div>
                            <h2 className={styles.templateTitle}>法人・教室マスタ</h2>
                            <p className={styles.subtitle}>法人と教室の基本情報を管理します。</p>
                        </div>
                        <div className={styles.actions}>
                            <Button variant="secondary" type="button" onClick={handleOrgNew}>
                                法人新規
                            </Button>
                            <Button variant="secondary" type="button" onClick={handleClassroomNew}>
                                教室新規
                            </Button>
                            <Button variant="secondary" type="button" onClick={loadOrganizations} isLoading={orgLoading}>
                                法人更新
                            </Button>
                            <Button variant="secondary" type="button" onClick={loadClassrooms} isLoading={classroomLoading}>
                                教室更新
                            </Button>
                        </div>
                    </header>

                    <div className={styles.templateGrid}>
                        <Card className={styles.listCard} variant="outlined" padding="none">
                            <div className={styles.listHeader}>法人一覧</div>
                            <div className={styles.list}>
                                {orgError && <div className={styles.error}>{orgError}</div>}
                                {!orgError && organizations.length === 0 && (
                                    <div className={styles.empty}>法人がありません。</div>
                                )}
                                {organizations.map((org) => {
                                    const active = org.id === selectedOrgId;
                                    return (
                                        <button
                                            key={org.id}
                                            type="button"
                                            className={`${styles.listItem} ${active ? styles.activeItem : ''}`}
                                            onClick={() => setSelectedOrgId(org.id)}
                                        >
                                            <div className={styles.listItemHeader}>
                                                <div className={styles.userName}>{org.name}</div>
                                            </div>
                                            <div className={styles.userMeta}>種別: {org.type}</div>
                                            <div className={styles.userMeta}>ID: {org.id}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        </Card>

                        <Card className={styles.detailCard} variant="outlined">
                            <div className={styles.listHeader}>法人編集</div>
                            <div className={styles.detailBody}>
                                <label className={styles.editField}>
                                    <span>法人名</span>
                                    <input
                                        className={styles.editInput}
                                        type="text"
                                        value={orgName}
                                        onChange={(event) => setOrgName(event.target.value)}
                                    />
                                </label>
                                <label className={styles.editField}>
                                    <span>種別</span>
                                    <select
                                        className={styles.editInput}
                                        value={orgType}
                                        onChange={(event) => setOrgType(event.target.value as OrganizationType)}
                                    >
                                        <option value="school">school</option>
                                        <option value="cram_school">cram_school</option>
                                        <option value="company">company</option>
                                        <option value="other">other</option>
                                    </select>
                                </label>
                                <label className={styles.editField}>
                                    <span>担当者名</span>
                                    <input
                                        className={styles.editInput}
                                        type="text"
                                        value={orgContactName}
                                        onChange={(event) => setOrgContactName(event.target.value)}
                                    />
                                </label>
                                <label className={styles.editField}>
                                    <span>連絡先メール</span>
                                    <input
                                        className={styles.editInput}
                                        type="email"
                                        value={orgContactEmail}
                                        onChange={(event) => setOrgContactEmail(event.target.value)}
                                    />
                                </label>
                                <label className={styles.editField}>
                                    <span>連絡先電話</span>
                                    <input
                                        className={styles.editInput}
                                        type="text"
                                        value={orgContactPhone}
                                        onChange={(event) => setOrgContactPhone(event.target.value)}
                                    />
                                </label>
                                {orgFormError && <div className={styles.error}>{orgFormError}</div>}
                                <div className={styles.editActions}>
                                    <Button variant="primary" type="button" onClick={handleOrgSave} isLoading={orgSaving}>
                                        保存
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    </div>

                    <div className={styles.templateGrid}>
                        <Card className={styles.listCard} variant="outlined" padding="none">
                            <div className={styles.listHeader}>教室一覧</div>
                            <div className={styles.list}>
                                {classroomError && <div className={styles.error}>{classroomError}</div>}
                                {!classroomError && classrooms.length === 0 && (
                                    <div className={styles.empty}>教室がありません。</div>
                                )}
                                {classrooms.map((room) => {
                                    const active = room.id === selectedClassroomId;
                                    return (
                                        <button
                                            key={room.id}
                                            type="button"
                                            className={`${styles.listItem} ${active ? styles.activeItem : ''}`}
                                            onClick={() => setSelectedClassroomId(room.id)}
                                        >
                                            <div className={styles.listItemHeader}>
                                                <div className={styles.userName}>{room.name}</div>
                                            </div>
                                            <div className={styles.userMeta}>法人ID: {room.orgId}</div>
                                            <div className={styles.userMeta}>ID: {room.id}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        </Card>

                        <Card className={styles.detailCard} variant="outlined">
                            <div className={styles.listHeader}>教室編集</div>
                            <div className={styles.detailBody}>
                                <label className={styles.editField}>
                                    <span>教室名</span>
                                    <input
                                        className={styles.editInput}
                                        type="text"
                                        value={classroomName}
                                        onChange={(event) => setClassroomName(event.target.value)}
                                    />
                                </label>
                                <label className={styles.editField}>
                                    <span>法人ID</span>
                                    <input
                                        className={styles.editInput}
                                        type="text"
                                        value={classroomOrgId}
                                        onChange={(event) => setClassroomOrgId(event.target.value)}
                                    />
                                </label>
                                <label className={styles.editField}>
                                    <span>学年</span>
                                    <input
                                        className={styles.editInput}
                                        type="number"
                                        min={1}
                                        max={12}
                                        value={classroomGrade}
                                        onChange={(event) => setClassroomGrade(event.target.value)}
                                    />
                                </label>
                                {classroomFormError && <div className={styles.error}>{classroomFormError}</div>}
                                <div className={styles.editActions}>
                                    <Button variant="primary" type="button" onClick={handleClassroomSave} isLoading={classroomSaving}>
                                        保存
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    </div>
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
