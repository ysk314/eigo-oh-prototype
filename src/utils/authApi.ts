// ================================
// Auth API (Firebase Functions)
// ================================

import { httpsCallable } from 'firebase/functions';
import { signInWithCustomToken } from 'firebase/auth';
import { auth, functions } from '@/firebase';

export interface LoginResult {
    uid: string;
    customToken: string;
    forcePasswordChange?: boolean;
}

export async function createGuest(): Promise<LoginResult & { expiresAt: string }> {
    const callable = httpsCallable(functions, 'createGuest');
    const result = await callable();
    return result.data as LoginResult & { expiresAt: string };
}

export async function loginWithMember(memberNo: string, password: string): Promise<LoginResult> {
    const callable = httpsCallable(functions, 'loginWithMember');
    const result = await callable({ memberNo, password });
    return result.data as LoginResult;
}

export async function changePassword(memberNo: string, currentPassword: string, newPassword: string): Promise<void> {
    const callable = httpsCallable(functions, 'changePassword');
    await callable({ memberNo, currentPassword, newPassword });
}

export async function signInWithToken(token: string): Promise<void> {
    await signInWithCustomToken(auth, token);
}
