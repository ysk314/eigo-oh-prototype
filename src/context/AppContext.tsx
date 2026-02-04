// ================================
// App Context
// ================================

import {
    createContext,
    useContext,
    useReducer,
    useEffect,
    useCallback,
    useRef,
    useState,
    type ReactNode,
    type Dispatch,
} from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
    AppState,
    AppAction,
    User,
    LearningMode,
    ChoiceLevel,
    StudyMode,
    UserProgress,
    SectionProgress,
    Rank,
} from '@/types';
import { auth } from '@/firebase';
import { appReducer, initialState } from './AppReducer';
import {
    loadFromStorage,
    saveToStorage,
    storageToAppState,
    getProgressKey,
    getSectionProgressKey,
    type StorageData,
} from '@/utils/storage';
import {
    loadRemoteProfile,
    loadRemoteProgress,
    saveRemoteUserProgress,
    saveRemoteSectionProgress,
    seedRemoteProgress,
} from '@/utils/remoteStorage';

interface AppContextValue {
    state: AppState;
    dispatch: Dispatch<AppAction>;

    // Convenience methods
    setUser: (user: User) => void;
    addUser: (name: string) => void;
    setCourse: (courseId: string | null) => void;
    setUnit: (unitId: string | null) => void;
    setPart: (partId: string | null) => void;
    setSection: (sectionId: string | null) => void;
    setMode: (mode: LearningMode) => void;
    setStudyMode: (mode: StudyMode) => void;
    setChoiceLevel: (level: ChoiceLevel) => void;
    setChoiceRank: (sectionId: string, level: ChoiceLevel, rank: Rank) => void;
    setQuestionIndex: (index: number) => void;
    toggleShuffle: () => void;
    setShuffledIds: (ids: string[]) => void;
    updateProgress: (questionId: string, data: Partial<UserProgress>) => void;
    markSectionCleared: (sectionId: string, mode: LearningMode) => void;
    setSectionRank: (sectionId: string, mode: LearningMode, rank: Rank) => void;
    getProgressForQuestion: (questionId: string) => UserProgress | undefined;
    getSectionProgressData: (sectionId: string) => SectionProgress | undefined;
    isModeUnlocked: (sectionId: string, mode: LearningMode) => boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

interface AppProviderProps {
    children: ReactNode;
}

const diffRecords = <T,>(prev: Record<string, T>, next: Record<string, T>): Array<[string, T]> => {
    const changed: Array<[string, T]> = [];
    Object.entries(next).forEach(([key, value]) => {
        if (prev[key] !== value) {
            changed.push([key, value]);
        }
    });
    return changed;
};

export function AppProvider({ children }: AppProviderProps) {
    const [state, dispatch] = useReducer(appReducer, initialState);
    const [remoteUid, setRemoteUid] = useState<string | null>(null);
    const [remoteSyncEnabled, setRemoteSyncEnabled] = useState(false);

    const initialStorageRef = useRef<StorageData | null>(null);
    const prevUserProgressRef = useRef<Record<string, UserProgress>>({});
    const prevSectionProgressRef = useRef<Record<string, SectionProgress>>({});

    // Load from storage on mount
    useEffect(() => {
        const storageData = loadFromStorage();
        initialStorageRef.current = storageData;
        const appState = storageToAppState(storageData);
        dispatch({ type: 'LOAD_STATE', payload: appState });
    }, []);

    // Firebase auth + remote load
    useEffect(() => {
        let isMounted = true;
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!isMounted) return;

            if (!user) {
                setRemoteUid(null);
                setRemoteSyncEnabled(false);
                return;
            }

            setRemoteUid(user.uid);

            try {
                const [profile, progress] = await Promise.all([
                    loadRemoteProfile(user.uid),
                    loadRemoteProgress(user.uid),
                ]);

                if (profile) {
                    dispatch({
                        type: 'LOAD_STATE',
                        payload: {
                            currentUser: profile,
                            users: [profile],
                        },
                    });
                }

                if (progress) {
                    dispatch({
                        type: 'LOAD_STATE',
                        payload: {
                            userProgress: progress.userProgress,
                            sectionProgress: progress.sectionProgress,
                        },
                    });

                    prevUserProgressRef.current = progress.userProgress;
                    prevSectionProgressRef.current = progress.sectionProgress;
                } else if (initialStorageRef.current) {
                    await seedRemoteProgress(user.uid, initialStorageRef.current);
                }
            } catch (error) {
                console.error('Failed to load remote storage:', error);
            } finally {
                setRemoteSyncEnabled(true);
            }
        });

        return () => {
            isMounted = false;
            unsubscribe();
        };
    }, []);

    // Save to local storage on state change
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

    // Sync user progress diffs to Firestore
    useEffect(() => {
        if (!remoteSyncEnabled || !remoteUid) {
            prevUserProgressRef.current = state.userProgress;
            return;
        }

        const changed = diffRecords(prevUserProgressRef.current, state.userProgress);
        changed.forEach(([key, progress]) => {
            saveRemoteUserProgress(remoteUid, key, progress).catch((error) => {
                console.error('Failed to save remote user progress:', error);
            });
        });

        prevUserProgressRef.current = state.userProgress;
    }, [remoteSyncEnabled, remoteUid, state.userProgress]);

    // Sync section progress diffs to Firestore
    useEffect(() => {
        if (!remoteSyncEnabled || !remoteUid) {
            prevSectionProgressRef.current = state.sectionProgress;
            return;
        }

        const changed = diffRecords(prevSectionProgressRef.current, state.sectionProgress);
        changed.forEach(([key, progress]) => {
            saveRemoteSectionProgress(remoteUid, key, progress).catch((error) => {
                console.error('Failed to save remote section progress:', error);
            });
        });

        prevSectionProgressRef.current = state.sectionProgress;
    }, [remoteSyncEnabled, remoteUid, state.sectionProgress]);

    useEffect(() => {
        const theme = state.studyMode === 'choice' ? 'choice' : 'typing';
        document.documentElement.dataset.theme = theme;
    }, [state.studyMode]);

    // Convenience methods
    const setUser = useCallback((user: User) => {
        dispatch({ type: 'SET_USER', payload: user });
    }, []);

    const addUser = useCallback((name: string) => {
        const newUser: User = {
            id: `user-${Date.now()}`,
            name,
            createdAt: new Date().toISOString(),
        };
        dispatch({ type: 'ADD_USER', payload: newUser });
    }, []);

    const setCourse = useCallback((courseId: string | null) => {
        dispatch({ type: 'SET_COURSE', payload: courseId });
    }, []);

    const setUnit = useCallback((unitId: string | null) => {
        dispatch({ type: 'SET_UNIT', payload: unitId });
    }, []);

    const setPart = useCallback((partId: string | null) => {
        dispatch({ type: 'SET_PART', payload: partId });
    }, []);

    const setSection = useCallback((sectionId: string | null) => {
        dispatch({ type: 'SET_SECTION', payload: sectionId });
    }, []);

    const setMode = useCallback((mode: LearningMode) => {
        dispatch({ type: 'SET_MODE', payload: mode });
    }, []);

    const setStudyMode = useCallback((mode: StudyMode) => {
        dispatch({ type: 'SET_STUDY_MODE', payload: mode });
    }, []);

    const setChoiceLevel = useCallback((level: ChoiceLevel) => {
        dispatch({ type: 'SET_CHOICE_LEVEL', payload: level });
    }, []);

    const setChoiceRank = useCallback((sectionId: string, level: ChoiceLevel, rank: Rank) => {
        dispatch({ type: 'SET_CHOICE_RANK', payload: { sectionId, level, rank } });
    }, []);

    const setQuestionIndex = useCallback((index: number) => {
        dispatch({ type: 'SET_QUESTION_INDEX', payload: index });
    }, []);

    const toggleShuffle = useCallback(() => {
        dispatch({ type: 'TOGGLE_SHUFFLE' });
    }, []);

    const setShuffledIds = useCallback((ids: string[]) => {
        dispatch({ type: 'SET_SHUFFLED_IDS', payload: ids });
    }, []);

    const updateProgress = useCallback((questionId: string, data: Partial<UserProgress>) => {
        dispatch({ type: 'UPDATE_PROGRESS', payload: { questionId, ...data } });
    }, []);

    const markSectionCleared = useCallback((sectionId: string, mode: LearningMode) => {
        dispatch({ type: 'MARK_SECTION_CLEARED', payload: { sectionId, mode } });
    }, []);

    const setSectionRank = useCallback((sectionId: string, mode: LearningMode, rank: Rank) => {
        dispatch({ type: 'SET_SECTION_RANK', payload: { sectionId, mode, rank } });
    }, []);

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
                return progress.mode1Rank === 'S' || progress.mode1Cleared;
            case 3:
                return progress.mode2Rank === 'S' || progress.mode2Cleared;
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
        setUnit,
        setPart,
        setSection,
        setMode,
        setStudyMode,
        setChoiceLevel,
        setChoiceRank,
        setQuestionIndex,
        toggleShuffle,
        setShuffledIds,
        updateProgress,
        markSectionCleared,
        setSectionRank,
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
