// ================================
// MemberNo -> Login Email Map
// ================================

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase';

export type MemberLoginMap = {
    memberNo: string;
    uid: string;
    email: string;
    updatedAt?: unknown;
};

export async function loadMemberLoginEmail(memberNo: string): Promise<string | null> {
    if (!memberNo) return null;
    const ref = doc(db, 'member_login_map', memberNo);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data() as MemberLoginMap;
    return data.email || null;
}

export async function saveMemberLoginMap(memberNo: string, uid: string, email: string): Promise<void> {
    if (!memberNo || !uid || !email) return;
    const ref = doc(db, 'member_login_map', memberNo);
    await setDoc(ref, {
        memberNo,
        uid,
        email,
        updatedAt: serverTimestamp(),
    }, { merge: true });
}
