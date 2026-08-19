#!/usr/bin/env node
/* ===========================================================================
   Create one Firebase Auth account per Club, from club-accounts.csv.

   Run this yourself — it needs a service-account key, which is the master key to
   the project and should not leave your hands.

   SETUP (once)
     1. Firebase console -> Project settings -> Service accounts
        -> "Generate new private key". A .json file downloads.
     2. In this folder:
            npm install firebase-admin
     3. Run it:
            GOOGLE_APPLICATION_CREDENTIALS=/path/to/that-key.json \
              node create-accounts.mjs

   It is safe to run more than once. Accounts that already exist are left alone,
   so if it stops halfway, just run it again.

   Add --reset-pins to force every PIN back to what the CSV says. Only useful if
   you have re-generated the CSV; it will change PINs Clubs may already be using.

   WHEN YOU ARE DONE, DELETE THE KEY FILE. It grants full access to the project.
   =========================================================================== */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import admin from 'firebase-admin';

const here = dirname(fileURLToPath(import.meta.url));
const RESET = process.argv.includes('--reset-pins');

/* --- read the roster ---------------------------------------------------- */
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).slice(1);          // drop the header
  return lines.map(function (line) {
    // club names contain commas ("Eagle's Landing"), so honour simple quoting
    const cells = [];
    let cur = '', inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { cells.push(cur); cur = ''; continue; }
      cur += ch;
    }
    cells.push(cur);
    return { club: cells[0].trim(), email: cells[1].trim(), pin: cells[2].trim() };
  }).filter(function (r) { return r.email; });
}

const roster = parseCsv(readFileSync(join(here, 'club-accounts.csv'), 'utf8'));

/* --- sanity-check the roster before touching anything ------------------- */
const problems = [];
const seenEmail = new Set(), seenPin = new Set();
roster.forEach(function (r) {
  if (!/^[a-z0-9-]+@clubs\.centurygolf\.com$/.test(r.email)) problems.push('odd address: ' + r.email);
  if (r.pin.length < 6) problems.push(r.email + ': PIN shorter than 6 — Firebase will refuse it');
  if (seenEmail.has(r.email)) problems.push('duplicate address: ' + r.email);
  if (seenPin.has(r.pin)) problems.push('two Clubs share a PIN: ' + r.pin);
  seenEmail.add(r.email); seenPin.add(r.pin);
});
if (problems.length) {
  console.error('The roster has problems, so nothing was created:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log(`Roster looks sound: ${roster.length} Clubs, all distinct.\n`);

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS to your service-account key file first.');
  console.error('See the comment at the top of this file.');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.applicationDefault() });
const auth = admin.auth();

let created = 0, already = 0, reset = 0, failed = 0;

for (const r of roster) {
  const label = r.club.padEnd(32);
  try {
    const existing = await auth.getUserByEmail(r.email).catch(function () { return null; });

    if (existing) {
      if (RESET) {
        await auth.updateUser(existing.uid, { password: r.pin });
        console.log(`  reset    ${label} ${r.email}`);
        reset++;
      } else {
        console.log(`  exists   ${label} ${r.email}`);
        already++;
      }
      continue;
    }

    await auth.createUser({
      email: r.email,
      password: r.pin,
      displayName: r.club,
      emailVerified: false
    });
    console.log(`  created  ${label} ${r.email}`);
    created++;
  } catch (err) {
    console.log(`  FAILED   ${label} ${r.email}  ->  ${err.code || err.message}`);
    failed++;
  }
}

console.log(`\ncreated ${created}   already there ${already}` +
            (RESET ? `   PIN reset ${reset}` : '') + `   failed ${failed}`);

if (failed) {
  console.log('\nRe-running is safe — it will skip the ones that worked.');
  process.exit(1);
}
console.log('\nNext: create your own account (Authentication -> Users -> Add user),');
console.log('sign in at admin.html, and it will show you the UID to put at');
console.log('/admins/{uid} in Firestore. Then delete the service-account key file.');
