// ================================
// Firestore Remote Storage Utilities
// ================================

import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    writeBatch,
} from 'firebase/firestore';
import { db } from '@/firebase';
import { StorageData, SCHEMA_VERSION } from '@/utils/storage';
import { SectionProgress, UserProgress, User } from '@/types';

const USERS_COLLECTION = 'users';
const USER_PROGRESS_COLLECTION = 'userProgress';
const SECTION_PROGRESS_COLLECTION = 'sectionProgress';

function userDocRef(uid: string) {
    return doc(db, USERS_COLLECTION, uid);
}

function userProgressCollection(uid: string) {
    return collection(db, USERS_COLLECTION, uid, USER_PROGRESS_COLLECTION);
}

function sectionProgressCollection(uid: string) {
    return collection(db, USERS_COLLECTION, uid, SECTION_PROGRESS_COLLECTION);
}

export async function loadRemoteStorage(uid: string): Promise<StorageData | null> {
    const userSnap = await getDoc(userDocRef(uid));
    if (!userSnap.exists()) return null;

    const userData = userSnap.data() as Partial<StorageData> & {
        users?: User[];
        currentUserId?: string | null;
        settings?: { shuffleMode: boolean; autoPlayAudio: boolean };
    };

    const users = userData.users ?? [];
    const currentUserId = userData.currentUserId ?? (users[0]?.id ?? null);
    const settings = userData.settings ?? { shuffleMode: false, autoPlayAudio: true };

    const userProgress: Record<string, UserProgress> = {};
    const userProgressSnap = await getDocs(userProgressCollection(uid));
    userProgressSnap.forEach((docSnap) => {
        userProgress[docSnap.id] = docSnap.data() as UserProgress;
    });

    const sectionProgress: Record<string, SectionProgress> = {};
    const sectionProgressSnap = await getDocs(sectionProgressCollection(uid));
    sectionProgressSnap.forEach((docSnap) => {
        sectionProgress[docSnap.id] = docSnap.data() as SectionProgress;
    });

    return {
        version: SCHEMA_VERSION,
        users,
        currentUserId,
        userProgress,
        sectionProgress,
        settings,
    };
}

export async function saveRemoteUserState(
    uid: string,
    data: { users: User[]; currentUserId: string | null; settings: { shuffleMode: boolean; autoPlayAudio: boolean } }
): Promise<void> {
    await setDoc(
        userDocRef(uid),
        {
            ...data,
            version: SCHEMA_VERSION,
            updatedAt: new Date().toISOString(),
        },
        { merge: true }
    );
}

export async function saveRemoteUserProgress(
    uid: string,
    key: string,
    progress: UserProgress
): Promise<void> {
    await setDoc(doc(userProgressCollection(uid), key), progress, { merge: true });
}

export async function saveRemoteSectionProgress(
    uid: string,
    key: string,
    progress: SectionProgress
): Promise<void> {
    await setDoc(doc(sectionProgressCollection(uid), key), progress, { merge: true });
}

export async function seedRemoteStorage(uid: string, storage: StorageData): Promise<void> {
    await saveRemoteUserState(uid, {
        users: storage.users,
        currentUserId: storage.currentUserId,
        settings: storage.settings,
    });

    const progressEntries = Object.entries(storage.userProgress);
    const sectionEntries = Object.entries(storage.sectionProgress);

    const batchWrite = async <T extends Record<string, unknown>>(
        entries: Array<[string, T]>,
        collectionRef: ReturnType<typeof userProgressCollection> | ReturnType<typeof sectionProgressCollection>
    ) => {
        const batchSize = 400;
        for (let i = 0; i < entries.length; i += batchSize) {
            const batch = writeBatch(db);
            const chunk = entries.slice(i, i + batchSize);
            chunk.forEach(([key, value]) => {
                batch.set(doc(collectionRef, key), value as Record<string, unknown>, { merge: true });
            });
            await batch.commit();
        }
    };

    if (progressEntries.length > 0) {
        await batchWrite<UserProgress>(progressEntries, userProgressCollection(uid));
    }

    if (sectionEntries.length > 0) {
        await batchWrite<SectionProgress>(sectionEntries, sectionProgressCollection(uid));
    }
}
