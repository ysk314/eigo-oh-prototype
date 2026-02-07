// ================================
// Home Page
// ================================

import { useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useApp } from '@/context/AppContext';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { courses } from '@/data/questions';
import { auth, db } from '@/firebase';
import { loadMemberLoginEmail, saveMemberLoginMap } from '@/utils/memberLoginMap';
import styles from './HomePage.module.css';

type DashboardStats = {
    totalStudyTimeMs_7d?: number;
    totalStudyTimeMs_28d?: number;
    avgWpm_7d?: number;
    bestWpm_7d?: number;
    avgAccuracy_7d?: number;
};

type RecentSectionItem = {
    courseId: string;
    unitId: string;
    partId: string;
    sectionId: string;
    label: string;
    lastPlayedAt?: string;
    mode?: 'typing' | 'choice';
};

type RecentSessionItem = {
    sessionId: string;
    mode: 'typing' | 'choice';
    accuracy: number;
    wpm?: number;
    missCount: number;
    totalTimeMs: number;
    rank: string;
    level?: number;
    playedAt: string;
};

function formatDuration(ms?: number): string {
    if (!ms || ms <= 0) return '0分';
    const totalMinutes = Math.round(ms / 60000);
    if (totalMinutes < 60) return `${totalMinutes}分`;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes === 0 ? `${hours}時間` : `${hours}時間${minutes}分`;
}

function formatDateTime(value?: string): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function HomePage() {
    const navigate = useNavigate();
    const { state, setCourse, setUnit, setPart, setSection } = useApp();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [recentSections, setRecentSections] = useState<RecentSectionItem[]>([]);
    const [recentSessions, setRecentSessions] = useState<RecentSessionItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [loginMapStatus, setLoginMapStatus] = useState<'idle' | 'enabled' | 'missing' | 'error'>('idle');
    const [loginMapSaving, setLoginMapSaving] = useState(false);
    const [loginMapMessage, setLoginMapMessage] = useState('');

    const handleCourseSelect = (courseId: string) => {
        setCourse(courseId);
        navigate('/course');
    };

    const handleBackToLogin = () => {
        navigate('/');
    };

    const sectionIndex = useMemo(() => {
        const map = new Map();
        courses.forEach((course) => {
            course.units.forEach((unit) => {
                unit.parts.forEach((part) => {
                    part.sections.forEach((section) => {
                        map.set(section.id, {
                            courseName: course.name,
                            unitName: unit.name,
                            partLabel: part.label,
                            sectionLabel: section.label,
                        });
                    });
                });
            });
        });
        return map;
    }, []);

    const resolveSectionInfo = (item: RecentSectionItem) => {
        const info = sectionIndex.get(item.sectionId);
        return {
            courseName: info?.courseName ?? item.courseId,
            unitName: info?.unitName ?? item.unitId,
            partLabel: info?.partLabel ?? item.partId,
            sectionLabel: info?.sectionLabel ?? item.label,
        };
    };

    const totalSections = useMemo(() => {
        return courses.reduce((acc, course) => {
            const count = course.units.flatMap((unit) => unit.parts).flatMap((part) => part.sections).length;
            return acc + count;
        }, 0);
    }, []);

    const clearedSections = useMemo(() => {
        return Object.values(state.sectionProgress).filter((progress) =>
            progress.mode1Cleared ||
            progress.mode2Cleared ||
            progress.mode3Cleared ||
            progress.choice1Rank ||
            progress.choice2Rank ||
            progress.choice3Rank ||
            progress.choice4Rank
        ).length;
    }, [state.sectionProgress]);

    const progressRate = totalSections > 0
        ? Math.round((clearedSections / totalSections) * 100)
        : 0;

    useEffect(() => {
        const memberNo = state.currentUser?.memberNo;
        const email = auth.currentUser?.email ?? null;
        if (!memberNo || !email) {
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
    }, [state.currentUser?.memberNo]);

    useEffect(() => {
        const uid = state.currentUser?.id;
        if (!uid) return;
        let isMounted = true;
        setLoading(true);

        Promise.all([
            getDoc(doc(db, 'user_stats', uid)),
            getDoc(doc(db, 'user_recent_sections', uid)),
            getDoc(doc(db, 'user_recent_sessions', uid)),
        ])
            .then(([statsSnap, sectionsSnap, sessionsSnap]) => {
                if (!isMounted) return;
                setStats(statsSnap.exists() ? (statsSnap.data() as DashboardStats) : null);
                const sectionsData = sectionsSnap.exists() ? (sectionsSnap.data() as { items?: RecentSectionItem[] }) : {};
                const sessionsData = sessionsSnap.exists() ? (sessionsSnap.data() as { items?: RecentSessionItem[] }) : {};
                setRecentSections(sectionsData.items ?? []);
                setRecentSessions(sessionsData.items ?? []);
            })
            .catch((error) => {
                console.error('Failed to load dashboard data:', error);
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [state.currentUser?.id]);

    const latestSession = recentSessions[0];
    const latestRecentSection = recentSections[0];
    const latestRecentInfo = latestRecentSection ? resolveSectionInfo(latestRecentSection) : null;
    const latestModeLabel = latestRecentSection?.mode === 'choice' ? '選択' : 'タイピング';

    const handleOpenRecentSection = (item: RecentSectionItem) => {
        setCourse(item.courseId);
        setUnit(item.unitId);
        setPart(item.partId);
        setSection(item.sectionId);
        navigate('/course');
    };

    const handleEnableMemberLogin = async () => {
        const memberNo = state.currentUser?.memberNo;
        const current = auth.currentUser;
        const email = current?.email ?? null;
        if (!memberNo || !current || !email) {
            setLoginMapMessage('会員番号またはメールアドレスが未設定のため有効化できません。');
            return;
        }
        setLoginMapSaving(true);
        setLoginMapMessage('');
        try {
            await saveMemberLoginMap(memberNo, current.uid, email);
            setLoginMapStatus('enabled');
            setLoginMapMessage('会員番号ログインを有効にしました。');
        } catch {
            setLoginMapStatus('error');
            setLoginMapMessage('有効化に失敗しました。時間を置いて再度お試しください。');
        } finally {
            setLoginMapSaving(false);
        }
    };

    return (
        <div className={styles.page}>
            <main className={styles.main}>
                <div className={styles.hero}>
                    <h1 className={styles.title}>Welcome to Tap! Type! English!</h1>
                    <div className={styles.versionBadge}>v2</div>
                    <p className={styles.subtitle}>楽しく英語タイピングをマスターしよう</p>
                    {state.currentUser?.memberNo && (
                        <p className={styles.memberNo}>会員番号: {state.currentUser.memberNo}</p>
                    )}
                    {!state.currentUser?.memberNo && (
                        <p className={styles.memberNo}>会員番号: 未設定</p>
                    )}
                    <div className={styles.loginMapRow}>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleEnableMemberLogin}
                            isLoading={loginMapSaving}
                            disabled={loginMapStatus === 'enabled'}
                        >
                            会員番号ログインを有効にする
                        </Button>
                        {loginMapStatus === 'enabled' && (
                            <span className={styles.loginMapStatus}>有効</span>
                        )}
                    </div>
                    {loginMapMessage && (
                        <p className={styles.loginMapNote}>{loginMapMessage}</p>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        className={styles.backButton}
                        onClick={handleBackToLogin}
                    >
                        ログイン画面に戻る
                    </Button>
                </div>

                <div className={styles.container}>
                    <div className={styles.dashboardColumn}>
                        <Card className={styles.dashboardCard} padding="lg">
                            <div className={styles.sectionHeader}>
                                <h2 className={styles.sectionTitle}>学習サマリー</h2>
                                <span className={styles.sectionNote}>{loading ? '読み込み中…' : '直近7日'}</span>
                            </div>
                            <div className={styles.statsGrid}>
                                <div className={styles.statItem}>
                                    <span className={styles.statLabel}>学習時間</span>
                                    <span className={styles.statValue}>{formatDuration(stats?.totalStudyTimeMs_7d)}</span>
                                    <span className={styles.statSub}>{formatDuration(stats?.totalStudyTimeMs_28d)} / 28日</span>
                                </div>
                                <div className={styles.statItem}>
                                    <span className={styles.statLabel}>WPM 平均</span>
                                    <span className={styles.statValue}>{stats?.avgWpm_7d ?? 0}</span>
                                    <span className={styles.statSub}>ベスト {stats?.bestWpm_7d ?? 0}</span>
                                </div>
                                <div className={styles.statItem}>
                                    <span className={styles.statLabel}>正答率</span>
                                    <span className={styles.statValue}>{stats?.avgAccuracy_7d ?? 0}%</span>
                                </div>
                                <div className={styles.statItem}>
                                    <span className={styles.statLabel}>セクション進捗</span>
                                    <span className={styles.statValue}>{clearedSections} / {totalSections}</span>
                                    <span className={styles.statSub}>達成率 {progressRate}%</span>
                                </div>
                            </div>
                        </Card>

                        <Card className={styles.dashboardCard} padding="lg">
                            <div className={styles.sectionHeader}>
                                <h2 className={styles.sectionTitle}>クイックスタート</h2>
                                <span className={styles.sectionNote}>次の学習にすぐ移動</span>
                            </div>
                            <div className={styles.quickActions}>
                                <Button
                                    variant="primary"
                                    onClick={() => {
                                        if (recentSections[0]) {
                                            handleOpenRecentSection(recentSections[0]);
                                        } else if (courses[0]) {
                                            handleCourseSelect(courses[0].id);
                                        }
                                    }}
                                >
                                    {recentSections[0] ? '前回のセクションへ' : '最初のコースへ'}
                                </Button>
                                <Button variant="secondary" onClick={() => handleCourseSelect(courses[0].id)}>
                                    コース一覧へ
                                </Button>
                            </div>
                        </Card>

                        <Card className={styles.dashboardCard} padding="lg">
                            <div className={styles.sectionHeader}>
                                <h2 className={styles.sectionTitle}>最近の挑戦</h2>
                                <span className={styles.sectionNote}>{latestSession ? formatDateTime(latestSession.playedAt) : '—'}</span>
                            </div>
                            {latestSession ? (
                                <div className={styles.sessionSummary}>
                                    <div>
                                        <span className={styles.sessionLabel}>ランク</span>
                                        <span className={styles.sessionValue}>{latestSession.rank}</span>
                                    </div>
                                    <div>
                                        <span className={styles.sessionLabel}>正答率</span>
                                        <span className={styles.sessionValue}>{latestSession.accuracy}%</span>
                                    </div>
                                    <div>
                                        <span className={styles.sessionLabel}>WPM</span>
                                        <span className={styles.sessionValue}>{latestSession.wpm ?? '-'}</span>
                                    </div>
                                    <div>
                                        <span className={styles.sessionLabel}>ミス</span>
                                        <span className={styles.sessionValue}>{latestSession.missCount}回</span>
                                    </div>
                                    <div>
                                        <span className={styles.sessionLabel}>時間</span>
                                        <span className={styles.sessionValue}>{formatDuration(latestSession.totalTimeMs)}</span>
                                    </div>
                                    <div>
                                        <span className={styles.sessionLabel}>モード</span>
                                        <span className={styles.sessionValue}>{latestSession.mode === 'typing' ? 'タイピング' : '選択'}</span>
                                    </div>
                                </div>
                            ) : (
                                <p className={styles.emptyText}>まだセッションがありません。</p>
                            )}
                            {recentSections.length > 0 ? (
                                <div className={styles.recentList}>
                                    {recentSections.map((item) => {
                                        const info = resolveSectionInfo(item);
                                        const modeLabel = item.mode === 'choice' ? '選択' : 'タイピング';
                                        return (
                                            <button
                                                key={item.sectionId}
                                                className={styles.recentItem}
                                                onClick={() => handleOpenRecentSection(item)}
                                            >
                                                <div>
                                                    <div className={styles.recentContext}>
                                                        <span className={styles.recentCourse}>{info.courseName}</span>
                                                        <span className={styles.recentDivider}>/</span>
                                                        <span className={styles.recentUnit}>{info.unitName}</span>
                                                    </div>
                                                    <div className={styles.recentLabel}>
                                                        {info.partLabel} / {info.sectionLabel}
                                                    </div>
                                                    <div className={styles.recentMeta}>
                                                        {formatDateTime(item.lastPlayedAt)} · {modeLabel}
                                                    </div>
                                                </div>
                                                <span className={styles.recentArrow}>→</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className={styles.emptyText}>まだ挑戦履歴がありません。</p>
                            )}
                        </Card>
                    </div>

                    <div className={styles.sideColumn}>
                        <Card className={styles.dashboardCard} padding="lg">
                            <div className={styles.sectionHeader}>
                                <h2 className={styles.sectionTitle}>クイックスタート</h2>
                                <span className={styles.sectionNote}>前回から再開</span>
                            </div>
                            <div className={styles.quickActions}>
                                <Button
                                    variant="primary"
                                    onClick={() => {
                                        if (latestRecentSection) {
                                            handleOpenRecentSection(latestRecentSection);
                                        } else if (courses[0]) {
                                            handleCourseSelect(courses[0].id);
                                        }
                                    }}
                                >
                                    {latestRecentSection ? '前回のセクションへ' : '最初のコースへ'}
                                </Button>
                            </div>
                            {latestRecentSection && latestRecentInfo && (
                                <div className={styles.quickMeta}>
                                    {latestRecentInfo.partLabel} / {latestRecentInfo.sectionLabel} · {latestModeLabel}
                                </div>
                            )}
                        </Card>

                        <Card className={styles.courseCard} padding="lg">
                            <h2 className={styles.sectionTitle}>コースを選択</h2>

                            <div className={styles.courseList}>
                                {courses.map((course) => (
                                    <div
                                        key={course.id}
                                        className={styles.courseItem}
                                        onClick={() => handleCourseSelect(course.id)}
                                    >
                                        <div className={styles.courseIcon}>📚</div>
                                        <div className={styles.courseInfo}>
                                            <h3 className={styles.courseName}>{course.name}</h3>
                                        </div>
                                        <div className={styles.arrow}>→</div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default HomePage;
