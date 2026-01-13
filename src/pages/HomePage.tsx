// ================================
// Home Page
// ================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { courseStructure } from '@/data/questions';
import styles from './HomePage.module.css';

export function HomePage() {
    const navigate = useNavigate();
    const { state, addUser, setUser, setCourse } = useApp();
    const [newUserName, setNewUserName] = useState('');
    const [isAddingUser, setIsAddingUser] = useState(false);

    const handleUserSelect = (userId: string) => {
        const user = state.users.find(u => u.id === userId);
        if (user) {
            setUser(user);
        }
    };

    const handleAddUser = (e: React.FormEvent) => {
        e.preventDefault();
        if (newUserName.trim()) {
            addUser(newUserName.trim());
            setNewUserName('');
            setIsAddingUser(false);
        }
    };

    const handleCourseSelect = (courseId: string) => {
        setCourse(courseId);
        navigate('/course');
    };

    return (
        <div className={styles.page}>
            <main className={styles.main}>
                <div className={styles.hero}>
                    <h1 className={styles.title}>Welcome to Eigo-Oh!</h1>
                    <p className={styles.subtitle}>楽しく英語タイピングをマスターしよう</p>
                </div>

                <div className={styles.container}>
                    {/* ユーザー選択カード */}
                    <Card className={styles.userCard} padding="lg">
                        <h2 className={styles.sectionTitle}>学習者を選んでください</h2>

                        <div className={styles.userList}>
                            {state.users.map(user => (
                                <button
                                    key={user.id}
                                    className={`${styles.userButton} ${state.currentUser?.id === user.id ? styles.activeUser : ''}`}
                                    onClick={() => handleUserSelect(user.id)}
                                >
                                    <span className={styles.avatar}>👤</span>
                                    <span className={styles.userName}>{user.name}</span>
                                </button>
                            ))}

                            {!isAddingUser ? (
                                <button
                                    className={styles.addUserButton}
                                    onClick={() => setIsAddingUser(true)}
                                >
                                    + 新しい学習者
                                </button>
                            ) : (
                                <form onSubmit={handleAddUser} className={styles.addUserForm}>
                                    <input
                                        type="text"
                                        value={newUserName}
                                        onChange={(e) => setNewUserName(e.target.value)}
                                        placeholder="名前を入力"
                                        className={styles.input}
                                        autoFocus
                                    />
                                    <div className={styles.formActions}>
                                        <Button type="submit" size="sm">追加</Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setIsAddingUser(false)}
                                        >
                                            キャンセル
                                        </Button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </Card>

                    {/* コース選択カード */}
                    <Card className={styles.courseCard} padding="lg">
                        <h2 className={styles.sectionTitle}>コースを選択</h2>

                        <div className={styles.courseList}>
                            <div
                                className={styles.courseItem}
                                onClick={() => handleCourseSelect(courseStructure.id)}
                            >
                                <div className={styles.courseIcon}>📚</div>
                                <div className={styles.courseInfo}>
                                    <h3 className={styles.courseName}>{courseStructure.name}</h3>
                                    <p className={styles.courseDesc}>中学1年生レベルの単語と文法</p>
                                </div>
                                <div className={styles.arrow}>→</div>
                            </div>

                            {/* Future courses */}
                            <div className={`${styles.courseItem} ${styles.disabled}`}>
                                <div className={styles.courseIcon}>📘</div>
                                <div className={styles.courseInfo}>
                                    <h3 className={styles.courseName}>New Horizon 2</h3>
                                    <p className={styles.courseDesc}>準備中...</p>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            </main>
        </div>
    );
}

export default HomePage;
