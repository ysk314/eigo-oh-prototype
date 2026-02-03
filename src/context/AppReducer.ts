// ================================
// App Reducer
// ================================

import { AppState, AppAction, LearningMode, Rank } from '@/types';

export const initialState: AppState = {
    currentUser: null,
    users: [],
    selectedCourse: null,
    selectedUnit: null,
    selectedPart: null,
    selectedSection: null,
    selectedMode: 1,
    studyMode: 'typing',
    selectedChoiceLevel: 1,
    currentQuestionIndex: 0,
    shuffleMode: false,
    shuffledQuestionIds: [],
    userProgress: {},
    sectionProgress: {},
    autoPlayAudio: true,
};

export function appReducer(state: AppState, action: AppAction): AppState {
    switch (action.type) {
        case 'SET_USER':
            return {
                ...state,
                currentUser: action.payload,
            };

        case 'ADD_USER':
            return {
                ...state,
                users: [...state.users, action.payload],
                currentUser: action.payload,
            };

        case 'SET_COURSE':
            return {
                ...state,
                selectedCourse: action.payload,
                selectedUnit: null,
                selectedPart: null,
                selectedSection: null,
                currentQuestionIndex: 0,
            };

        case 'SET_UNIT':
            return {
                ...state,
                selectedUnit: action.payload,
                selectedPart: null,
                selectedSection: null,
                currentQuestionIndex: 0,
            };

        case 'SET_PART':
            return {
                ...state,
                selectedPart: action.payload,
                selectedSection: null,
                currentQuestionIndex: 0,
            };

        case 'SET_SECTION':
            return {
                ...state,
                selectedSection: action.payload,
                currentQuestionIndex: 0,
            };

        case 'SET_MODE':
            return {
                ...state,
                selectedMode: action.payload,
                currentQuestionIndex: 0,
            };
        case 'SET_STUDY_MODE':
            return {
                ...state,
                studyMode: action.payload,
            };
        case 'SET_CHOICE_LEVEL':
            return {
                ...state,
                selectedChoiceLevel: action.payload,
            };

        case 'SET_QUESTION_INDEX':
            return {
                ...state,
                currentQuestionIndex: action.payload,
            };

        case 'TOGGLE_SHUFFLE':
            return {
                ...state,
                shuffleMode: action.payload !== undefined ? action.payload : !state.shuffleMode,
            };

        case 'SET_SHUFFLED_IDS':
            return {
                ...state,
                shuffledQuestionIds: action.payload,
            };

        case 'UPDATE_PROGRESS': {
            const { questionId, ...progressData } = action.payload;
            const key = state.currentUser
                ? `${state.currentUser.id}-${questionId}`
                : questionId;

            const currentProgress = state.userProgress[key] || {
                questionId,
                attemptsCount: 0,
                correctCount: 0,
                missCount: 0,
                clearedMode: 0 as const,
            };

            return {
                ...state,
                userProgress: {
                    ...state.userProgress,
                    [key]: {
                        ...currentProgress,
                        ...progressData,
                        lastPlayedAt: new Date().toISOString(),
                    },
                },
            };
        }

        case 'MARK_SECTION_CLEARED': {
            const { sectionId, mode } = action.payload;
            const key = state.currentUser
                ? `${state.currentUser.id}-${sectionId}`
                : sectionId;

            const currentProgress = state.sectionProgress[key] || {
                sectionId,
                mode1Cleared: false,
                mode2Cleared: false,
                mode3Cleared: false,
                mode1Rank: null,
                mode2Rank: null,
                mode3Rank: null,
                choice1Rank: null,
                choice2Rank: null,
                choice3Rank: null,
                choice4Rank: null,
                totalAttempts: 0,
                totalCorrect: 0,
                totalMiss: 0,
            };

            const modeKey = `mode${mode}Cleared` as keyof typeof currentProgress;

            return {
                ...state,
                sectionProgress: {
                    ...state.sectionProgress,
                    [key]: {
                        ...currentProgress,
                        [modeKey]: true,
                    },
                },
            };
        }

        case 'SET_SECTION_RANK': {
            const { sectionId, mode, rank } = action.payload;
            const key = state.currentUser
                ? `${state.currentUser.id}-${sectionId}`
                : sectionId;

            const currentProgress = state.sectionProgress[key] || {
                sectionId,
                mode1Cleared: false,
                mode2Cleared: false,
                mode3Cleared: false,
                mode1Rank: null,
                mode2Rank: null,
                mode3Rank: null,
                choice1Rank: null,
                choice2Rank: null,
                choice3Rank: null,
                choice4Rank: null,
                totalAttempts: 0,
                totalCorrect: 0,
                totalMiss: 0,
            };

            const rankKey = `mode${mode}Rank` as keyof typeof currentProgress;
            const clearedKey = `mode${mode}Cleared` as keyof typeof currentProgress;

            const rankOrder: Rank[] = ['S', 'A', 'B', 'C'];
            const currentRank = currentProgress[rankKey] as Rank | null;
            const isBetter =
                !currentRank || rankOrder.indexOf(rank) < rankOrder.indexOf(currentRank);

            return {
                ...state,
                sectionProgress: {
                    ...state.sectionProgress,
                    [key]: {
                        ...currentProgress,
                        [rankKey]: isBetter ? rank : currentRank,
                        [clearedKey]: rank === 'S' ? true : currentProgress[clearedKey],
                    },
                },
            };
        }

        case 'SET_CHOICE_RANK': {
            const { sectionId, level, rank } = action.payload;
            const key = state.currentUser
                ? `${state.currentUser.id}-${sectionId}`
                : sectionId;

            const currentProgress = state.sectionProgress[key] || {
                sectionId,
                mode1Cleared: false,
                mode2Cleared: false,
                mode3Cleared: false,
                mode1Rank: null,
                mode2Rank: null,
                mode3Rank: null,
                choice1Rank: null,
                choice2Rank: null,
                choice3Rank: null,
                choice4Rank: null,
                totalAttempts: 0,
                totalCorrect: 0,
                totalMiss: 0,
            };

            const rankKey = `choice${level}Rank` as keyof typeof currentProgress;
            const rankOrder: Rank[] = ['S', 'A', 'B', 'C'];
            const currentRank = currentProgress[rankKey] as Rank | null;
            const isBetter =
                !currentRank || rankOrder.indexOf(rank) < rankOrder.indexOf(currentRank);

            return {
                ...state,
                sectionProgress: {
                    ...state.sectionProgress,
                    [key]: {
                        ...currentProgress,
                        [rankKey]: isBetter ? rank : currentRank,
                    },
                },
            };
        }

        case 'TOGGLE_AUTO_PLAY_AUDIO':
            return {
                ...state,
                autoPlayAudio: !state.autoPlayAudio,
            };

        case 'LOAD_STATE':
            return {
                ...state,
                ...action.payload,
            };

        case 'RESET_STATE':
            return initialState;

        default:
            return state;
    }
}

// Helper to check if a mode is available for a section
export function isModeAvailable(
    state: AppState,
    sectionId: string,
    mode: LearningMode
): boolean {
    const key = state.currentUser
        ? `${state.currentUser.id}-${sectionId}`
        : sectionId;

    const progress = state.sectionProgress[key];

    switch (mode) {
        case 1:
            return true;
        case 2:
            return progress?.mode1Cleared ?? false;
        case 3:
            return progress?.mode2Cleared ?? false;
        default:
            return false;
    }
}
