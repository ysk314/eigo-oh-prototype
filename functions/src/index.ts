import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { HttpsError } from 'firebase-functions/v2/https';
import bcrypt from 'bcryptjs';

initializeApp();

const db = getFirestore();
const auth = getAuth();

const MEMBER_COUNTERS_COLLECTION = 'member_counters';
const USERS_COLLECTION = 'users';
const AUTH_STUDENTS_COLLECTION = 'auth_students';
const ANALYTICS_COLLECTION = 'analytics_events';

const GUEST_EXPIRES_DAYS = 14;

function getYearPrefix(): string {
  const year = new Date().getFullYear() % 100;
  return String(year).padStart(2, '0');
}

async function generateMemberNo(): Promise<string> {
  const yearPrefix = getYearPrefix();
  const counterRef = db.collection(MEMBER_COUNTERS_COLLECTION).doc(yearPrefix);

  const nextNumber = await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists ? (snap.data()?.lastNumber as number) || 0 : 0;
    const updated = current + 1;
    tx.set(counterRef, { lastNumber: updated, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return updated;
  });

  return `${yearPrefix}${String(nextNumber).padStart(6, '0')}`;
}

function generateTempPassword(): string {
  let password = '';
  for (let i = 0; i < 8; i += 1) {
    password += Math.floor(Math.random() * 10).toString();
  }
  return password;
}

async function ensureAuthUser(uid: string, displayName: string) {
  try {
    await auth.getUser(uid);
  } catch (error) {
    await auth.createUser({ uid, displayName });
  }
}

async function logEvent(
  eventType: string,
  payload: Record<string, unknown>,
  accountType: string,
  plan: string,
  userId: string | null
) {
  await db.collection(ANALYTICS_COLLECTION).add({
    eventType,
    payload,
    accountType,
    plan,
    userId,
    createdAt: FieldValue.serverTimestamp(),
  });
}

export const createGuest = onCall(async (request) => {
  const memberNo = await generateMemberNo();
  const tempPassword = generateTempPassword();
  const expiresAt = Timestamp.fromDate(new Date(Date.now() + GUEST_EXPIRES_DAYS * 24 * 60 * 60 * 1000));

  const tempPasswordHash = await bcrypt.hash(tempPassword, 10);

  const displayName = 'ゲスト';

  await ensureAuthUser(memberNo, displayName);

  const userRef = db.collection(USERS_COLLECTION).doc(memberNo);
  const authRef = db.collection(AUTH_STUDENTS_COLLECTION).doc(memberNo);

  await db.runTransaction(async (tx) => {
    tx.set(userRef, {
      uid: memberNo,
      memberNo,
      displayName,
      accountType: 'guest',
      plan: 'none',
      status: 'active',
      createdAt: FieldValue.serverTimestamp(),
      lastLoginAt: FieldValue.serverTimestamp(),
      expiresAt,
    }, { merge: true });

    tx.set(authRef, {
      memberNo,
      displayName,
      accountType: 'guest',
      plan: 'none',
      tempPasswordHash,
      passwordHash: null,
      status: 'active',
      issuedAt: FieldValue.serverTimestamp(),
      lastLoginAt: FieldValue.serverTimestamp(),
      forcePasswordChange: false,
      expiresAt,
    }, { merge: true });
  });

  const customToken = await auth.createCustomToken(memberNo);

  await logEvent('guest_created', { expiresAt: expiresAt.toDate().toISOString() }, 'guest', 'none', memberNo);

  return {
    uid: memberNo,
    customToken,
    expiresAt: expiresAt.toDate().toISOString(),
  };
});

export const loginWithMember = onCall(async (request) => {
  const { memberNo, password } = request.data as { memberNo?: string; password?: string };

  if (!memberNo || !password) {
    throw new HttpsError('invalid-argument', 'memberNo and password are required');
  }

  const authRef = db.collection(AUTH_STUDENTS_COLLECTION).doc(memberNo);
  const authSnap = await authRef.get();
  if (!authSnap.exists) {
    throw new HttpsError('not-found', 'member not found');
  }

  const authData = authSnap.data() as {
    tempPasswordHash: string | null;
    passwordHash: string | null;
    status: string;
    forcePasswordChange?: boolean;
    expiresAt?: Timestamp | null;
    accountType: string;
    plan: string;
    displayName: string;
  };

  if (authData.status !== 'active') {
    throw new HttpsError('permission-denied', 'account suspended');
  }

  if (authData.expiresAt && authData.expiresAt.toMillis() < Date.now()) {
    throw new HttpsError('failed-precondition', 'guest expired');
  }

  const hashToCheck = authData.passwordHash ?? authData.tempPasswordHash;
  if (!hashToCheck) {
    throw new HttpsError('failed-precondition', 'password not set');
  }

  const ok = await bcrypt.compare(password, hashToCheck);
  if (!ok) {
    await logEvent('login_failed', { memberNo }, authData.accountType, authData.plan, null);
    throw new HttpsError('unauthenticated', 'invalid password');
  }

  await ensureAuthUser(memberNo, authData.displayName);

  const userRef = db.collection(USERS_COLLECTION).doc(memberNo);
  await userRef.set({
    uid: memberNo,
    memberNo,
    displayName: authData.displayName,
    accountType: authData.accountType,
    plan: authData.plan,
    status: 'active',
    lastLoginAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await authRef.set({
    lastLoginAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  const customToken = await auth.createCustomToken(memberNo);
  const forcePasswordChange = authData.passwordHash === null;

  await logEvent('login_success', { memberNo }, authData.accountType, authData.plan, memberNo);

  return { uid: memberNo, customToken, forcePasswordChange };
});

export const changePassword = onCall(async (request) => {
  const { memberNo, currentPassword, newPassword } = request.data as {
    memberNo?: string;
    currentPassword?: string;
    newPassword?: string;
  };

  if (!memberNo || !currentPassword || !newPassword) {
    throw new HttpsError('invalid-argument', 'missing fields');
  }

  if (!/^\d{8,}$/.test(newPassword)) {
    throw new HttpsError('invalid-argument', 'password must be numeric and >= 8 digits');
  }

  const authRef = db.collection(AUTH_STUDENTS_COLLECTION).doc(memberNo);
  const authSnap = await authRef.get();
  if (!authSnap.exists) {
    throw new HttpsError('not-found', 'member not found');
  }

  const authData = authSnap.data() as {
    tempPasswordHash: string | null;
    passwordHash: string | null;
    accountType: string;
    plan: string;
  };

  const hashToCheck = authData.passwordHash ?? authData.tempPasswordHash;
  if (!hashToCheck) {
    throw new HttpsError('failed-precondition', 'password not set');
  }

  const ok = await bcrypt.compare(currentPassword, hashToCheck);
  if (!ok) {
    throw new HttpsError('unauthenticated', 'invalid password');
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await authRef.set({
    passwordHash: newHash,
    tempPasswordHash: null,
    forcePasswordChange: false,
    passwordUpdatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await logEvent('password_changed', { memberNo }, authData.accountType, authData.plan, memberNo);

  return { ok: true };
});

export const cleanupExpiredGuests = onSchedule('every day 01:00', async () => {
  const now = Timestamp.now();
  const querySnap = await db.collection(USERS_COLLECTION)
    .where('accountType', '==', 'guest')
    .where('expiresAt', '<', now)
    .get();

  const deletions: Promise<void>[] = [];

  for (const docSnap of querySnap.docs) {
    const uid = docSnap.id;
    const memberNo = uid;

    deletions.push(db.recursiveDelete(db.collection('progress').doc(uid)));
    deletions.push(db.collection(USERS_COLLECTION).doc(uid).delete());
    deletions.push(db.collection(AUTH_STUDENTS_COLLECTION).doc(memberNo).delete());

    deletions.push(logEvent('guest_expired', { memberNo }, 'guest', 'none', null));
  }

  await Promise.all(deletions);
});
