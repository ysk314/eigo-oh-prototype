// ================================
// Home Page
// ================================

import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { courses } from '@/data/questions';
import styles from './HomePage.module.css';

export function HomePage() {
    const navigate = useNavigate();
    const { state, setCourse } = useApp();

    const handleCourseSelect = (courseId: string) => {
        setCourse(courseId);
        navigate('/course');
    };

    const handleBackToLogin = () => {
        navigate('/');
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
                    {/* コース選択カード */}
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
                                        <p className={styles.courseDesc}>コースを選択して学習を開始</p>
                                    </div>
                                    <div className={styles.arrow}>→</div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </main>
        </div>
    );
}

export default HomePage;
