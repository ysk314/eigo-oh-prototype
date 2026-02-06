// ================================
// Analytics Events (Firestore)
// ================================

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase';

export type AnalyticsEventType =
    | 'session_started'
    | 'session_ended'
    | 'question_answered'
    | 'admin_users_loaded';

export interface AnalyticsEvent {
    eventType: AnalyticsEventType;
    userId: string | null;
    accountType?: 'guest' | 'student' | 'general';
    plan?: 'none' | 'free' | 'paid';
    payload: Record<string, unknown>;
    createdAt?: unknown;
}

const analyticsCollection = collection(db, 'analytics_events');

export async function logEvent(event: AnalyticsEvent): Promise<void> {
    await addDoc(analyticsCollection, {
        ...event,
        createdAt: serverTimestamp(),
    });
}
