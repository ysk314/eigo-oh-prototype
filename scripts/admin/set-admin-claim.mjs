import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function printUsage() {
    console.log(`\nUsage:\n  node scripts/admin/set-admin-claim.mjs --service-account=/path/to/serviceAccount.json --uid=UID [--admin=true|false]\n\nExamples:\n  node scripts/admin/set-admin-claim.mjs --service-account=./serviceAccount.json --uid=abc123 --admin=true\n`);
}

const args = process.argv.slice(2);
const argMap = new Map();
for (const arg of args) {
    if (!arg.startsWith('--')) continue;
    const [key, value] = arg.replace(/^--/, '').split('=');
    argMap.set(key, value ?? '');
}

const serviceAccountPath = argMap.get('service-account') || process.env.SERVICE_ACCOUNT_PATH;
const uid = argMap.get('uid');
const adminFlag = argMap.get('admin');

if (!serviceAccountPath || !uid) {
    printUsage();
    process.exit(1);
}

const resolvedPath = path.resolve(serviceAccountPath);
if (!fs.existsSync(resolvedPath)) {
    console.error(`Service account file not found: ${resolvedPath}`);
    process.exit(1);
}

let adminValue = true;
if (typeof adminFlag === 'string' && adminFlag.length > 0) {
    adminValue = adminFlag === 'true' || adminFlag === '1';
}

const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));

initializeApp({
    credential: cert(serviceAccount),
});

try {
    await getAuth().setCustomUserClaims(uid, { admin: adminValue });
    console.log(`Custom claims updated for ${uid}: admin=${adminValue}`);
    console.log('Note: The user must re-login or refresh the ID token to apply changes.');
} catch (error) {
    console.error('Failed to set custom claims:', error);
    process.exit(1);
}
