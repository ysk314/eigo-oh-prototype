// ================================
// Member Profile Templates (Admin-created)
// ================================

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase';

export type MemberProfile = {
    memberNo: string;
    displayName?: string;
    note?: string;
    createdAt?: unknown;
    updatedAt?: unknown;
};

export async function loadMemberProfile(memberNo: string): Promise<MemberProfile | null> {
    if (!memberNo) return null;
    const ref = doc(db, 'member_profiles', memberNo);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data() as MemberProfile;
}

export async function saveMemberProfileTemplate(
    memberNo: string,
    displayName: string,
    note?: string,
    isNew?: boolean
): Promise<void> {
    const ref = doc(db, 'member_profiles', memberNo);
    const payload: Record<string, unknown> = {
        memberNo,
        displayName: displayName || null,
        note: note || null,
        updatedAt: serverTimestamp(),
    };
    if (isNew) {
        payload.createdAt = serverTimestamp();
    }
    await setDoc(ref, payload, { merge: true });
}
