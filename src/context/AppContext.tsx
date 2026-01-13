// ================================
// App Context
// ================================

import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { AppState, AppAction, User, LearningMode, UserProgress, SectionProgress } from '@/types';
import { appReducer, initialState } from './AppReducer';
import { loadFromStorage, saveToStorage, storageToAppState, getProgressKey, getSectionProgressKey } from '@/utils/storage';

interface AppContextValue {
    state: AppState;
    dispatch: React.Dispatch<AppAction>;

    // Convenience methods
    setUser: (user: User) => void;
    addUser: (name: string) => void;
    setCourse: (courseId: string | null) => void;
    setPageRange: (pageRangeId: string | null) => void;
    setSection: (sectionId: string | null) => void;
    setMode: (mode: LearningMode) => void;
    setQuestionIndex: (index: number) => void;
    toggleShuffle: () => void;
    setShuffledIds: (ids: string[]) => void;
    updateProgress: (questionId: string, data: Partial<UserProgress>) => void;
    markSectionCleared: (sectionId: string, mode: LearningMode) => void;
    getProgressForQuestion: (questionId: string) => UserProgress | undefined;
    getSectionProgressData: (sectionId: string) => SectionProgress | undefined;
    isModeUnlocked: (sectionId: string, mode: LearningMode) => boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

interface AppProviderProps {
    children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
    const [state, dispatch] = useReducer(appReducer, initialState);

    // Load from storage on mount
    useEffect(() => {
        const storageData = loadFromStorage();
        const appState = storageToAppState(storageData);
        dispatch({ type: 'LOAD_STATE', payload: appState });
    }, []);

    // Save to storage on state change
    useEffect(() => {
        if (state.currentUser) {
            saveToStorage({
                users: state.users,
                currentUserId: state.currentUser.id,
                userProgress: state.userProgress,
                sectionProgress: state.sectionProgress,
                settings: {
                    shuffleMode: state.shuffleMode,
                    autoPlayAudio: state.autoPlayAudio,
                },
            });
        }
    }, [state.users, state.currentUser, state.userProgress, state.sectionProgress, state.shuffleMode, state.autoPlayAudio]);

    // Convenience methods
    const setUser = (user: User) => {
        dispatch({ type: 'SET_USER', payload: user });
    };

    const addUser = (name: string) => {
        const newUser: User = {
            id: `user-${Date.now()}`,
            name,
            createdAt: new Date().toISOString(),
        };
        dispatch({ type: 'ADD_USER', payload: newUser });
    };

    const setCourse = (courseId: string | null) => {
        dispatch({ type: 'SET_COURSE', payload: courseId });
    };

    const setPageRange = (pageRangeId: string | null) => {
        dispatch({ type: 'SET_PAGE_RANGE', payload: pageRangeId });
    };

    const setSection = (sectionId: string | null) => {
        dispatch({ type: 'SET_SECTION', payload: sectionId });
    };

    const setMode = (mode: LearningMode) => {
        dispatch({ type: 'SET_MODE', payload: mode });
    };

    const setQuestionIndex = (index: number) => {
        dispatch({ type: 'SET_QUESTION_INDEX', payload: index });
    };

    const toggleShuffle = () => {
        dispatch({ type: 'TOGGLE_SHUFFLE' });
    };

    const setShuffledIds = (ids: string[]) => {
        dispatch({ type: 'SET_SHUFFLED_IDS', payload: ids });
    };

    const updateProgress = (questionId: string, data: Partial<UserProgress>) => {
        dispatch({ type: 'UPDATE_PROGRESS', payload: { questionId, ...data } });
    };

    const markSectionCleared = (sectionId: string, mode: LearningMode) => {
        dispatch({ type: 'MARK_SECTION_CLEARED', payload: { sectionId, mode } });
    };

    const getProgressForQuestion = (questionId: string): UserProgress | undefined => {
        if (!state.currentUser) return undefined;
        const key = getProgressKey(state.currentUser.id, questionId);
        return state.userProgress[key];
    };

    const getSectionProgressData = (sectionId: string): SectionProgress | undefined => {
        if (!state.currentUser) return undefined;
        const key = getSectionProgressKey(state.currentUser.id, sectionId);
        return state.sectionProgress[key];
    };

    const isModeUnlocked = (sectionId: string, mode: LearningMode): boolean => {
        if (mode === 1) return true;

        const progress = getSectionProgressData(sectionId);
        if (!progress) return false;

        switch (mode) {
            case 2:
                return progress.mode1Cleared;
            case 3:
                return progress.mode2Cleared;
            default:
                return false;
        }
    };

    const value: AppContextValue = {
        state,
        dispatch,
        setUser,
        addUser,
        setCourse,
        setPageRange,
        setSection,
        setMode,
        setQuestionIndex,
        toggleShuffle,
        setShuffledIds,
        updateProgress,
        markSectionCleared,
        getProgressForQuestion,
        getSectionProgressData,
        isModeUnlocked,
    };

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
}

export function useApp(): AppContextValue {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
}

export default AppContext;
