// ================================
// LocalStorage Utilities
// ================================

import { AppState, User, UserProgress, SectionProgress } from '@/types';

const STORAGE_KEY = 'eigo-typing-app';
const SCHEMA_VERSION = 1;

interface StorageData {
    version: number;
    users: User[];
    currentUserId: string | null;
    userProgress: Record<string, UserProgress>;
    sectionProgress: Record<string, SectionProgress>;
    settings: {
        shuffleMode: boolean;
        autoPlayAudio: boolean;
    };
}

// デフォルトストレージデータ
function getDefaultStorageData(): StorageData {
    return {
        version: SCHEMA_VERSION,
        users: [
            {
                id: 'user-1',
                name: '田中太郎さん',
                createdAt: new Date().toISOString(),
            },
        ],
        currentUserId: 'user-1',
        userProgress: {},
        sectionProgress: {},
        settings: {
            shuffleMode: false,
            autoPlayAudio: true,
        },
    };
}

// ストレージから読み込み
export function loadFromStorage(): StorageData {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return getDefaultStorageData();
        }

        const data = JSON.parse(raw) as StorageData;

        // バージョンチェックとマイグレーション
        if (data.version !== SCHEMA_VERSION) {
            return migrateData(data);
        }

        return data;
    } catch (error) {
        console.error('Failed to load from storage:', error);
        return getDefaultStorageData();
    }
}

// ストレージに保存
export function saveToStorage(data: Partial<StorageData>): void {
    try {
        const current = loadFromStorage();
        const merged = { ...current, ...data, version: SCHEMA_VERSION };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch (error) {
        console.error('Failed to save to storage:', error);
    }
}

// ユーザー保存
export function saveUsers(users: User[], currentUserId: string | null): void {
    saveToStorage({ users, currentUserId });
}

// 進捗保存
export function saveProgress(
    userProgress: Record<string, UserProgress>,
    sectionProgress: Record<string, SectionProgress>
): void {
    saveToStorage({ userProgress, sectionProgress });
}

// 設定保存
export function saveSettings(settings: { shuffleMode?: boolean; autoPlayAudio?: boolean }): void {
    const current = loadFromStorage();
    saveToStorage({
        settings: { ...current.settings, ...settings },
    });
}

// データマイグレーション
function migrateData(oldData: StorageData): StorageData {
    // 将来のバージョンアップ時にここでマイグレーション処理
    console.log('Migrating data from version', oldData.version, 'to', SCHEMA_VERSION);

    // 現時点ではデフォルトにリセット
    return getDefaultStorageData();
}

// AppStateに変換
export function storageToAppState(storage: StorageData): Partial<AppState> {
    const currentUser = storage.users.find(u => u.id === storage.currentUserId) || storage.users[0] || null;

    return {
        currentUser,
        users: storage.users,
        userProgress: storage.userProgress,
        sectionProgress: storage.sectionProgress,
        shuffleMode: storage.settings.shuffleMode,
        autoPlayAudio: storage.settings.autoPlayAudio,
    };
}

// 進捗キー生成
export function getProgressKey(userId: string, questionId: string): string {
    return `${userId}-${questionId}`;
}

export function getSectionProgressKey(userId: string, sectionId: string): string {
    return `${userId}-${sectionId}`;
}

// ストレージクリア（デバッグ用）
export function clearStorage(): void {
    localStorage.removeItem(STORAGE_KEY);
}
