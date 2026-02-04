// ================================
// Member ID Utilities (client-side)
// ================================

import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase';

const COUNTERS_COLLECTION = 'member_counters';

export function isNumericId(value: string): boolean {
    return /^\d+$/.test(value);
}

export function normalizeLoginId(value: string): string {
    if (value.includes('@')) return value.trim();
    const trimmed = value.trim();
    return `s${trimmed}@students.tap-type.invalid`;
}

export function getYearPrefix(date = new Date()): string {
    const year = date.getFullYear() % 100;
    return String(year).padStart(2, '0');
}

export async function generateMemberNo(): Promise<string> {
    const yearPrefix = getYearPrefix();
    const counterRef = doc(db, COUNTERS_COLLECTION, yearPrefix);

    const nextNumber = await runTransaction(db, async (tx) => {
        const snap = await tx.get(counterRef);
        const current = snap.exists() ? (snap.data()?.lastNumber as number) || 0 : 0;
        const updated = current + 1;
        tx.set(counterRef, { lastNumber: updated, updatedAt: serverTimestamp() }, { merge: true });
        return updated;
    });

    return `${yearPrefix}${String(nextNumber).padStart(6, '0')}`;
}
