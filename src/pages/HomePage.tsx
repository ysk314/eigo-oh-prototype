// ================================
// Home Page
// ================================

import { useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useApp } from '@/context/AppContext';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { courseCatalog, preloadCourse } from '@/data/questions';
import { db } from '@/firebase';
import { logEvent } from '@/utils/analytics';
import styles from './HomePage.module.css';

type DashboardStats = {
    totalStudyTimeMs_7d?: number;
    totalStudyTimeMs_28d?: number;
    avgWpm_7d?: number;
    bestWpm_7d?: number;
    avgAccuracy_7d?: number;
    clearedSectionsCount?: number;
    totalSectionsCount?: number;
};

type RecentSectionItem = {
    courseId: string;
    unitId?: string;
    partId: string;
    sectionId: string;
    label: string;
    lastPlayedAt?: string;
    mode?: 'typing' | 'choice';
    level?: number;
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

function normalizeMode(value: unknown): 'typing' | 'choice' {
    if (typeof value !== 'string') return 'typing';
    const mode = value.trim().toLowerCase();
    if (
        mode === 'choice' ||
        mode === '4choice' ||
        mode === 'multiple-choice' ||
        mode === 'multiple_choice' ||
        mode === 'select' ||
        mode === '4択' ||
        mode === '選択'
    ) {
        return 'choice';
    }
    return 'typing';
}

function normalizeChoiceLevel(value: unknown): 1 | 2 | 3 | 4 {
    if (typeof value === 'number' && value >= 1 && value <= 4) {
        return value as 1 | 2 | 3 | 4;
    }
    return 1;
}

function normalizeRecentSections(value: unknown): RecentSectionItem[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const record = item as Record<string, unknown>;
            if (
                typeof record.courseId !== 'string' ||
                typeof record.partId !== 'string' ||
                typeof record.sectionId !== 'string' ||
                typeof record.label !== 'string'
            ) {
                return null;
            }
            return {
                courseId: record.courseId,
                unitId: typeof record.unitId === 'string' ? record.unitId : undefined,
                partId: record.partId,
                sectionId: record.sectionId,
                label: record.label,
                lastPlayedAt: typeof record.lastPlayedAt === 'string' ? record.lastPlayedAt : undefined,
                mode: normalizeMode(record.mode),
                level: typeof record.level === 'number' ? record.level : undefined,
            } as RecentSectionItem;
        })
        .filter((item): item is RecentSectionItem => item !== null)
        .sort((a, b) => {
            const aTime = a.lastPlayedAt ? Date.parse(a.lastPlayedAt) : 0;
            const bTime = b.lastPlayedAt ? Date.parse(b.lastPlayedAt) : 0;
            return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
        });
}

function normalizeRecentSessions(value: unknown): RecentSessionItem[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const record = item as Record<string, unknown>;
            if (
                typeof record.sessionId !== 'string' ||
                typeof record.accuracy !== 'number' ||
                typeof record.missCount !== 'number' ||
                typeof record.totalTimeMs !== 'number' ||
                typeof record.rank !== 'string' ||
                typeof record.playedAt !== 'string'
            ) {
                return null;
            }
            return {
                sessionId: record.sessionId,
                mode: normalizeMode(record.mode),
                accuracy: record.accuracy,
                wpm: typeof record.wpm === 'number' ? record.wpm : undefined,
                missCount: record.missCount,
                totalTimeMs: record.totalTimeMs,
                rank: record.rank,
                level: typeof record.level === 'number' ? record.level : undefined,
                playedAt: record.playedAt,
            } as RecentSessionItem;
        })
        .filter((item): item is RecentSessionItem => item !== null)
        .sort((a, b) => {
            const aTime = Date.parse(a.playedAt);
            const bTime = Date.parse(b.playedAt);
            return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
        });
}

export function HomePage() {
    const navigate = useNavigate();
    const { state, setCourse, setUnit, setPart, setSection, setMode, setStudyMode, setChoiceLevel } = useApp();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [recentSections, setRecentSections] = useState<RecentSectionItem[]>([]);
    const [recentSessions, setRecentSessions] = useState<RecentSessionItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [recentOpen, setRecentOpen] = useState(false);
    const [coursesOpen, setCoursesOpen] = useState(false);
    const viewedUidRef = useRef<string | null>(null);

    const handleCourseSelect = (courseId: string) => {
        setCourse(courseId);
        navigate('/course');
    };

    const handleBackToLogin = () => {
        navigate('/');
    };

    const resolveSectionInfo = (item: RecentSectionItem) => {
        const courseName = courseCatalog.find((course) => course.id === item.courseId)?.name;
        return {
            courseName: courseName ?? item.courseId,
            unitName: item.unitId ?? '—',
            partLabel: item.partId,
            sectionLabel: item.label,
        };
    };

    const fallbackClearedSections = useMemo(() => {
        const currentUserId = state.currentUser?.id;
        const entries = currentUserId
            ? Object.entries(state.sectionProgress).filter(([key]) => key.startsWith(`${currentUserId}-`))
            : Object.entries(state.sectionProgress);
        return entries.filter(([, progress]) =>
            progress.mode1Cleared ||
            progress.mode2Cleared ||
            progress.mode3Cleared ||
            progress.choice1Rank ||
            progress.choice2Rank ||
            progress.choice3Rank ||
            progress.choice4Rank
        ).length;
    }, [state.sectionProgress, state.currentUser?.id]);

    const clearedSections = stats?.clearedSectionsCount ?? fallbackClearedSections;
    const totalSections = stats?.totalSectionsCount ?? 0;

    const progressRate = totalSections > 0
        ? Math.round((clearedSections / totalSections) * 100)
        : 0;

    useEffect(() => {
        const isDesktop = window.matchMedia('(min-width: 769px)').matches;
        setRecentOpen(isDesktop);
        setCoursesOpen(isDesktop);
    }, []);

    useEffect(() => {
        const uid = state.currentUser?.id;
        if (!uid) return;
        let isMounted = true;

        if (viewedUidRef.current !== uid) {
            viewedUidRef.current = uid;
            logEvent({
                eventType: 'dashboard_viewed',
                userId: uid,
                payload: {
                    source: 'home',
                },
            }).catch(() => {});
        }

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
                setRecentSections(normalizeRecentSections(sectionsData.items));
                setRecentSessions(normalizeRecentSessions(sessionsData.items));
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
    const latestRecentModeLabel = latestRecentSection?.mode === 'choice' ? '4択' : 'タイピング';
    const nextCourseId = latestRecentSection?.courseId ?? courseCatalog[0]?.id;
    const missionTitle = latestRecentSection
        ? '前回の続きから再開'
        : '最初のセクションを始める';
    const missionMeta = latestRecentInfo
        ? `${latestRecentInfo.courseName} / ${latestRecentInfo.partLabel} / ${latestRecentInfo.sectionLabel} ・ ${latestRecentModeLabel}`
        : 'まずは好きなコースを選んで、1セクション完了を目標にしましょう。';

    const handleOpenRecentSection = (item: RecentSectionItem) => {
        const recentMode = normalizeMode(item.mode);
        const choiceLevel = normalizeChoiceLevel(item.level);

        setCourse(item.courseId);
        setUnit(item.unitId ?? null);
        setPart(item.partId);
        setSection(item.sectionId);

        if (recentMode === 'choice') {
            setStudyMode('choice');
            setChoiceLevel(choiceLevel);
            navigate('/choice', {
                state: {
                    courseId: item.courseId,
                    unitId: item.unitId,
                    partId: item.partId,
                    sectionId: item.sectionId,
                    level: choiceLevel,
                },
            });
            return;
        }

        setStudyMode('typing');
        setMode(1);
        navigate('/play', {
            state: {
                courseId: item.courseId,
                unitId: item.unitId,
                partId: item.partId,
                sectionId: item.sectionId,
                mode: 1,
            },
        });
    };

    return (
        <div className={styles.page}>
            <main className={styles.main}>
                <div className={styles.hero}>
                    <div className={styles.heroTopRow}>
                        <h1 className={styles.title}>Welcome to Tap! Type! English!</h1>
                        <div className={styles.versionBadge}>v2</div>
                    </div>
                    <p className={styles.subtitle}>楽しく英語タイピングをマスターしよう</p>
                    {state.currentUser?.memberNo && (
                        <p className={styles.memberNo}>会員番号: {state.currentUser.memberNo}</p>
                    )}
                    <div className={styles.heroActions}>
                        <Button
                            variant="secondary"
                            size="sm"
                            className={`${styles.profileButton} ${styles.heroActionButton}`}
                            onClick={() => navigate('/account')}
                        >
                            会員情報を変更
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className={`${styles.backButton} ${styles.heroActionButton}`}
                            onClick={handleBackToLogin}
                        >
                            ログイン画面に戻る
                        </Button>
                    </div>
                </div>

                <Card className={styles.missionCard} padding="lg">
                    <div className={styles.missionHeader}>
                        <span className={styles.missionBadge}>Today</span>
                        <span className={styles.sectionNote}>{loading ? '更新中…' : '学習ガイド'}</span>
                    </div>
                    <h2 className={styles.missionTitle}>{missionTitle}</h2>
                    <p className={styles.missionMeta}>{missionMeta}</p>
                    <div className={styles.missionActions}>
                        <Button
                            variant="primary"
                            onClick={() => {
                                if (latestRecentSection) {
                                    handleOpenRecentSection(latestRecentSection);
                                } else if (nextCourseId) {
                                    handleCourseSelect(nextCourseId);
                                }
                            }}
                        >
                            {latestRecentSection ? 'この続きへ' : 'コースを開く'}
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => {
                                setCoursesOpen(true);
                                if (window.matchMedia('(max-width: 768px)').matches) {
                                    window.scrollTo({ top: 520, behavior: 'smooth' });
                                }
                            }}
                        >
                            コース一覧を見る
                        </Button>
                    </div>
                </Card>

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
                            <details
                                className={styles.accordion}
                                open={recentOpen}
                                onToggle={(event) => setRecentOpen((event.currentTarget as HTMLDetailsElement).open)}
                            >
                                <summary className={styles.accordionSummary}>
                                    <span>最近の挑戦</span>
                                    <span className={styles.sectionNote}>
                                        {latestSession ? formatDateTime(latestSession.playedAt) : '—'}
                                    </span>
                                </summary>
                                <div className={styles.accordionBody}>
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
                                                <span className={styles.sessionValue}>{latestSession.mode === 'typing' ? 'タイピング' : '4択'}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className={styles.emptyText}>まだセッションがありません。</p>
                                    )}
                                    {recentSections.length > 0 ? (
                                        <div className={styles.recentList}>
                                            {recentSections.map((item) => {
                                                const info = resolveSectionInfo(item);
                                                const modeLabel = item.mode === 'choice' ? '4択' : 'タイピング';
                                                return (
                                                    <button
                                                        key={`${item.courseId}:${item.unitId}:${item.partId}:${item.sectionId}:${item.mode ?? 'typing'}:${item.level ?? 0}:${item.lastPlayedAt ?? ''}`}
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
                                </div>
                            </details>
                        </Card>
                    </div>

                    <div className={styles.sideColumn}>
                        <Card className={styles.courseCard} padding="lg">
                            <details
                                className={styles.accordion}
                                open={coursesOpen}
                                onToggle={(event) => setCoursesOpen((event.currentTarget as HTMLDetailsElement).open)}
                            >
                                <summary className={styles.accordionSummary}>
                                    <span>コースを選択</span>
                                    <span className={styles.sectionNote}>学習を開始</span>
                                </summary>
                                <div className={styles.accordionBody}>
                                    <div className={styles.courseList}>
                                        {courseCatalog.map((course) => (
                                            <button
                                                key={course.id}
                                                type="button"
                                                className={styles.courseItem}
                                                onClick={() => handleCourseSelect(course.id)}
                                                onMouseEnter={() => {
                                                    void preloadCourse(course.id);
                                                }}
                                                onFocus={() => {
                                                    void preloadCourse(course.id);
                                                }}
                                            >
                                                <div className={styles.courseIcon}>📚</div>
                                                <div className={styles.courseInfo}>
                                                    <h3 className={styles.courseName}>{course.name}</h3>
                                                </div>
                                                <div className={styles.arrow}>→</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </details>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default HomePage;
