// ================================
// Type Definitions
// ================================

// Learning Mode Types
export type LearningMode = 1 | 2 | 3;
// 1: 音あり・スペルあり
// 2: 音あり・スペルなし
// 3: 音なし・スペルなし

export type SectionType =
    | 'elementary_words'   // 小学校の単語
    | 'new_words'          // New Words
    | 'key_sentences'      // キーセンテンス
    | 'summary';           // まとめ

// Question Data
export interface Question {
    id: string;
    course: string;           // "New Horizon 1"
    unit: string;             // "Unit 6"
    pageRange: string;        // "p30-31"
    section: SectionType;
    sectionLabel: string;     // 日本語表示用 "小学校の単語"
    promptJp: string;         // "セブ" or "私は試合に勝ちたいです。"
    answerEn: string;         // "Cebu" or "I want to win the game."
    highlightTokens?: string[]; // ["win"] - キーセンテンス用
    audioUrl?: string;        // 音声ファイルURL（オプション）
    orderIndex: number;
}

// Course Structure
export interface Course {
    id: string;
    name: string;           // "New Horizon 1"
    units: Unit[];
}

export interface Unit {
    id: string;
    name: string;           // "Unit 6"
    pages: PageRange[];
}

export interface PageRange {
    id: string;
    range: string;          // "p30-31"
    totalQuestions: number;
    sections: Section[];
}

export interface Section {
    id: string;
    type: SectionType;
    label: string;          // "小学校の単語"
    questionIds: string[];
}

// User Progress
export interface UserProgress {
    questionId: string;
    attemptsCount: number;
    correctCount: number;
    missCount: number;
    clearedMode: 0 | 1 | 2 | 3;  // 0 = 未クリア
    lastPlayedAt?: string;
}

export interface SectionProgress {
    sectionId: string;
    mode1Cleared: boolean;
    mode2Cleared: boolean;
    mode3Cleared: boolean;
    totalAttempts: number;
    totalCorrect: number;
    totalMiss: number;
}

// User Data
export interface User {
    id: string;
    name: string;
    createdAt: string;
}

// App State
export interface AppState {
    // Current user
    currentUser: User | null;
    users: User[];

    // Navigation state
    selectedCourse: string | null;
    selectedPageRange: string | null;
    selectedSection: string | null;
    selectedMode: LearningMode;

    // Play state
    currentQuestionIndex: number;
    shuffleMode: boolean;
    shuffledQuestionIds: string[];

    // Progress data
    userProgress: Record<string, UserProgress>;  // key: `${userId}-${questionId}`
    sectionProgress: Record<string, SectionProgress>;  // key: `${userId}-${sectionId}`

    // Settings
    autoPlayAudio: boolean;
}

// Action Types
export type AppAction =
    | { type: 'SET_USER'; payload: User }
    | { type: 'ADD_USER'; payload: User }
    | { type: 'SET_COURSE'; payload: string | null }
    | { type: 'SET_PAGE_RANGE'; payload: string | null }
    | { type: 'SET_SECTION'; payload: string | null }
    | { type: 'SET_MODE'; payload: LearningMode }
    | { type: 'SET_QUESTION_INDEX'; payload: number }
    | { type: 'TOGGLE_SHUFFLE'; payload?: boolean }
    | { type: 'SET_SHUFFLED_IDS'; payload: string[] }
    | { type: 'UPDATE_PROGRESS'; payload: Partial<UserProgress> & { questionId: string } }
    | { type: 'MARK_SECTION_CLEARED'; payload: { sectionId: string; mode: LearningMode } }
    | { type: 'TOGGLE_AUTO_PLAY_AUDIO' }
    | { type: 'LOAD_STATE'; payload: Partial<AppState> }
    | { type: 'RESET_STATE' };

// Typing Result
export interface TypingResult {
    questionId: string;
    totalChars: number;
    correctChars: number;
    missCount: number;
    timeMs: number;
    accuracy: number;
    isComplete: boolean;
}
