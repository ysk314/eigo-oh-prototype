// ================================
// Type Definitions
// ================================

// Learning Mode Types
export type LearningMode = 1 | 2 | 3;
// 1: 音あり・スペルあり
// 2: 音あり・スペルなし
// 3: 音なし・スペルなし

export type StudyMode = 'typing' | 'choice';
export type ChoiceLevel = 1 | 2 | 3 | 4;

// Rank Types
export type Rank = 'S' | 'A' | 'B' | 'C';

// CSV由来の自由形式に対応
export type SectionType = string;

// Question Data
export interface Question {
    id: string;
    course: string;           // "New Horizon 1"
    unit: string;             // "Unit 6"
    partId: string;           // Part.id
    section: SectionType;
    sectionLabel: string;     // 日本語表示用 "小学校の単語"
    promptJp: string;         // "セブ" or "私は試合に勝ちたいです。"
    answerEn: string;         // "Cebu" or "I want to win the game."
    pos: string[];         // parts of speech (e.g. ['noun', 'verb'])
    category?: string[];   // e.g. ['idiom']
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
    parts: Part[];
}

export interface Part {
    id: string;
    label: string;          // "p30-31"
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
    mode1Rank: Rank | null;
    mode2Rank: Rank | null;
    mode3Rank: Rank | null;
    choice1Rank: Rank | null;
    choice2Rank: Rank | null;
    choice3Rank: Rank | null;
    choice4Rank: Rank | null;
    totalAttempts: number;
    totalCorrect: number;
    totalMiss: number;
}

// User Data
export interface User {
    id: string;
    name: string;
    createdAt: string;
    memberNo?: string;
    familyName?: string;
    givenName?: string;
    accountType?: 'guest' | 'consumer' | 'b2b2c';
}

// App State
export interface AppState {
    // Current user
    currentUser: User | null;
    users: User[];

    // Navigation state
    selectedCourse: string | null;
    selectedUnit: string | null;
    selectedPart: string | null;
    selectedSection: string | null;
    selectedMode: LearningMode;
    studyMode: StudyMode;
    selectedChoiceLevel: ChoiceLevel;

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
    | { type: 'SET_UNIT'; payload: string | null }
    | { type: 'SET_PART'; payload: string | null }
    | { type: 'SET_SECTION'; payload: string | null }
    | { type: 'SET_MODE'; payload: LearningMode }
    | { type: 'SET_STUDY_MODE'; payload: StudyMode }
    | { type: 'SET_CHOICE_LEVEL'; payload: ChoiceLevel }
    | { type: 'SET_CHOICE_RANK'; payload: { sectionId: string; level: ChoiceLevel; rank: Rank } }
    | { type: 'SET_QUESTION_INDEX'; payload: number }
    | { type: 'TOGGLE_SHUFFLE'; payload?: boolean }
    | { type: 'SET_SHUFFLED_IDS'; payload: string[] }
    | { type: 'UPDATE_PROGRESS'; payload: Partial<UserProgress> & { questionId: string } }
    | { type: 'MARK_SECTION_CLEARED'; payload: { sectionId: string; mode: LearningMode } }
    | { type: 'SET_SECTION_RANK'; payload: { sectionId: string; mode: LearningMode; rank: Rank } }
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
