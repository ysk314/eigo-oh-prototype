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
    DocumentData,
    serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/firebase';
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

export async function loadRemoteProfile(uid: string): Promise<User | null> {
    const userSnap = await getDoc(userDocRef(uid));
    if (!userSnap.exists()) return null;
    const data = userSnap.data() as {
        uid: string;
        displayName?: string;
        createdAt?: unknown;
    };

    const createdAt = typeof data.createdAt === 'string'
        ? data.createdAt
        : data.createdAt && typeof (data.createdAt as { toDate: () => Date }).toDate === 'function'
            ? (data.createdAt as { toDate: () => Date }).toDate().toISOString()
            : new Date().toISOString();

    return {
        id: data.uid || uid,
        name: data.displayName ?? 'ゲスト',
        createdAt,
    };
}

export async function saveRemoteProfile(uid: string, displayName: string): Promise<void> {
    await setDoc(userDocRef(uid), {
        uid,
        displayName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    }, { merge: true });
}

export async function loadRemoteProgress(uid: string): Promise<{
    userProgress: Record<string, UserProgress>;
    sectionProgress: Record<string, SectionProgress>;
}> {
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

    return { userProgress, sectionProgress };
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

export async function seedRemoteProgress(uid: string, storage: {
    userProgress: Record<string, UserProgress>;
    sectionProgress: Record<string, SectionProgress>;
}): Promise<void> {
    const progressEntries = Object.entries(storage.userProgress);
    const sectionEntries = Object.entries(storage.sectionProgress);

    const batchWrite = async <T>(
        entries: Array<[string, T]>,
        collectionRef: ReturnType<typeof userProgressCollection> | ReturnType<typeof sectionProgressCollection>
    ) => {
        const batchSize = 400;
        for (let i = 0; i < entries.length; i += batchSize) {
            const batch = writeBatch(db);
            const chunk = entries.slice(i, i + batchSize);
            chunk.forEach(([key, value]) => {
                batch.set(doc(collectionRef, key), value as DocumentData, { merge: true });
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
