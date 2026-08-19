/* ===========================================================================
   Century Golf Partners — Membership Core Fundamentals
   Shared logic: scoring, priorities, Firebase access, draft save/resume.

   Everything here is used by more than one page. The assessment engine and the
   results dashboard both score the same way because they both call this file.
   =========================================================================== */

import { firebaseConfig, SUBMISSIONS_COLLECTION, DRAFTS_COLLECTION, FIREBASE_ENABLED }
  from './firebase-config.js';

export const LEVELS = ['101', '201', '301', '401'];
export const LEVEL_VALUE = { '101': 1, '201': 2, '301': 3, '401': 4 };
export const LEVEL_NAMES = {
  '101': 'Awareness', '201': 'Implementation', '301': 'Excellence', '401': 'Culture'
};
export const LEVEL_DESC = {
  '101': 'Awareness — you know it exists, you have introduced it, and you understand why it matters.',
  '201': 'Implementation — you are doing it consistently and it is visible to members, team, and Board.',
  '301': 'Excellence — it is trained, it is tracked, and every layer of the organization owns their piece of it.',
  '401': 'Culture — this is who you are. Members feel it, the team lives it, the Board leads it, unasked.'
};

/* ---------------------------------------------------------------------------
   SCORING — range-scaled, unchanged from the original scorecard.

   A plain average would reward a club for answering questions where Yes and No
   sit close together. So the raw points are mapped onto the band between the
   worst and best possible outcome for the exact questions answered.
--------------------------------------------------------------------------- */
export function scoreAssessment(statements, answers) {
  let earned = 0, min = 0, max = 0, answered = 0;
  const counts = { '101': 0, '201': 0, '301': 0, '401': 0 };
  const detail = [];

  statements.forEach(function (item, i) {
    const choice = answers[i];
    if (choice !== 'Yes' && choice !== 'No') return;
    const level = choice === 'Yes' ? item.yes : item.no;
    const yv = LEVEL_VALUE[item.yes], nv = LEVEL_VALUE[item.no];
    earned += LEVEL_VALUE[level];
    min += Math.min(yv, nv);
    max += Math.max(yv, nv);
    counts[level]++;
    answered++;
    detail.push({
      index: i + 1, section: item.section, text: item.text,
      choice: choice, level: level, points: LEVEL_VALUE[level]
    });
  });

  if (answered === 0) return null;

  const range = max - min;
  const ratio = range > 0 ? (earned - min) / range : 1;
  const scaled = 1 + ratio * 3;
  const level = LEVELS[Math.min(Math.max(Math.round(scaled) - 1, 0), 3)];

  // per-section rollup, same maths inside each section
  const secMap = new Map();
  detail.forEach(function (a) {
    if (!secMap.has(a.section)) secMap.set(a.section, { earned: 0, min: 0, max: 0, n: 0 });
    const s = secMap.get(a.section);
    const item = statements[a.index - 1];
    s.earned += a.points;
    s.min += Math.min(LEVEL_VALUE[item.yes], LEVEL_VALUE[item.no]);
    s.max += Math.max(LEVEL_VALUE[item.yes], LEVEL_VALUE[item.no]);
    s.n++;
  });
  const sections = [];
  secMap.forEach(function (s, name) {
    const r = (s.max - s.min) > 0 ? (s.earned - s.min) / (s.max - s.min) : 1;
    sections.push({
      name: name,
      pct: Math.round(r * 100),
      level: LEVELS[Math.min(Math.max(Math.round(1 + r * 3) - 1, 0), 3)],
      answered: s.n
    });
  });

  return {
    level: level,
    levelName: LEVEL_NAMES[level],
    pctOfRange: Math.round(ratio * 100),
    scaledValue: Math.round(scaled * 100) / 100,
    earnedPoints: earned,
    minPoints: min,
    maxPoints: max,
    answered: answered,
    totalQuestions: statements.length,
    counts: counts,
    sections: sections,
    answers: detail,
    priorities: buildPriorities(statements, detail)
  };
}

/* ---------------------------------------------------------------------------
   PRIORITIES — what to work on next.

   Built from the statements answered "No", ranked by leverage.

   Each Core Fundamental is a ladder: 101 Awareness -> 201 Implementation ->
   301 Excellence -> 401 Culture. In a staged model the highest-leverage gap is
   the LOWEST unmet rung, because it gates everything above it.

     foundation = 4 - LEVEL_VALUE[yes]   a 101 item scores 3, a 401 item scores 0
     gain       = LEVEL_VALUE[yes] - LEVEL_VALUE[no]
     score      = foundation * 2 + gain

   Foundation leads. Within a rung, the item that moves the score furthest comes
   first. Ties break to the earlier question, preserving the A-G sequence.

   Why not rank on point gain alone: many statements score the same either way
   (Yes = 101, No = 101) and so earn nothing — yet they are prerequisites.
   Ranking on points put "walk the Club daily checking collateral" above
   "design your Club invitation", which is backwards.

   `action` is the plain-language instruction a club reads. Where a data file
   has not been given actions yet, the question text is shown instead — so all
   ten fundamentals work whether or not their actions have been written.
--------------------------------------------------------------------------- */
export function buildPriorities(statements, detail) {
  return detail
    .filter(function (a) { return a.choice === 'No'; })
    .map(function (a) {
      const item = statements[a.index - 1];
      const gain = LEVEL_VALUE[item.yes] - LEVEL_VALUE[item.no];
      const foundation = 4 - LEVEL_VALUE[item.yes];
      return {
        index: a.index,
        section: a.section,
        action: item.action || item.text,
        hasCustomAction: !!item.action,
        statement: item.text,
        liftsTo: item.yes,
        gain: gain,
        score: foundation * 2 + gain
      };
    })
    .sort(function (x, y) {
      if (y.score !== x.score) return y.score - x.score;
      return x.index - y.index;
    });
}

/* ---------------------------------------------------------------------------
   POOLED PRIORITIES — the payload of the club summary.

   A club that finishes all ten walks away with ten separate to-do lists and no
   sense of what comes first across the whole programme. This pools every "No"
   from every fundamental they submitted and re-ranks it with the SAME leverage
   formula, so the answer to "where do we start" is one list, not ten.

   Ranking: score descending, then the earlier fundamental, then the earlier
   question — deterministic, and it keeps the intended A-G sequence inside a tie.

   Identical action text is collapsed. Where the same instruction surfaced under
   more than one fundamental that is worth knowing, so the surviving entry
   records every CF it came from — an item the club met twice is more urgent,
   not less.
--------------------------------------------------------------------------- */
export function poolPriorities(submissions, limit) {
  const flat = [];

  submissions.forEach(function (sub) {
    const cfId = Number(sub.cfId || 1);
    (sub.priorities || []).forEach(function (p) {
      // Submissions made before `score` was stored can still be ranked: the
      // formula is recoverable from liftsTo and gain, which were always saved.
      let score = p.score;
      if (typeof score !== 'number') {
        const lift = LEVEL_VALUE[p.liftsTo];
        score = (typeof lift === 'number' && typeof p.gain === 'number')
          ? (4 - lift) * 2 + p.gain
          : 0;
      }
      flat.push({
        cfId: cfId,
        index: Number(p.index || 0),
        section: p.section || '',
        action: p.action || p.statement || '',
        score: score,
        cfIds: [cfId]
      });
    });
  });

  flat.sort(function (x, y) {
    if (y.score !== x.score) return y.score - x.score;
    if (x.cfId !== y.cfId) return x.cfId - y.cfId;
    return x.index - y.index;
  });

  const seen = new Map();
  const out = [];
  flat.forEach(function (item) {
    if (!item.action) return;
    const key = item.action.trim().toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(key)) {
      const kept = seen.get(key);
      if (kept.cfIds.indexOf(item.cfId) < 0) kept.cfIds.push(item.cfId);
      return;
    }
    seen.set(key, item);
    out.push(item);
  });

  return (limit && limit > 0) ? out.slice(0, limit) : out;
}

/* Split a "Participating Team Members" field into individual people.

   Newlines when the field has them, and NOTHING otherwise — deliberately not
   commas. Real entries look like "Jim Creighton, Director of People
   Development", one per line, so splitting on commas would turn every person
   into two people, half of them job titles. When there are no newlines we
   cannot tell "Jim, Director" from "Jim, Lisa", so the safe reading is one
   entry: a slightly long line beats inventing colleagues.

   Internal whitespace is collapsed so "Lisa  Henrichsen" and "Lisa Henrichsen"
   are recognised as the same person. */
export function participantsFrom(text) {
  const t = String(text || '').trim();
  if (!t) return [];
  const parts = /\r?\n/.test(t) ? t.split(/\r?\n/) : [t];
  return parts
    .map(function (x) { return x.trim().replace(/\s+/g, ' '); })
    .filter(Boolean);
}

/* ---------------------------------------------------------------------------
   CLUB SUMMARY — one row per fundamental, newest submission wins.

   Deliberately returns a row for all ten even when a club has only done six,
   so the summary can show what is missing rather than silently omitting it.
--------------------------------------------------------------------------- */
export function summariseClub(submissions, fundamentals) {
  const newest = new Map();
  submissions.forEach(function (s) {
    if (s.deleted === true) return;
    const id = Number(s.cfId || 1);
    const cur = newest.get(id);
    const d = s.__date ? s.__date.getTime() : 0;
    const cd = cur && cur.__date ? cur.__date.getTime() : -1;
    if (!cur || d > cd) newest.set(id, s);
  });

  const rows = fundamentals.map(function (cf) {
    const s = newest.get(cf.id) || null;
    return {
      cfId: cf.id,
      headline: cf.headline,
      questions: cf.count,
      done: !!s,
      level: s ? s.level : null,
      levelName: s ? (s.levelName || LEVEL_NAMES[s.level] || '') : null,
      pctOfRange: s ? Number(s.pctOfRange || 0) : null,
      answered: s ? Number(s.answered || 0) : 0,
      date: s ? (s.__date || null) : null,
      submission: s
    };
  });

  const done = rows.filter(function (r) { return r.done; });

  // Strongest and weakest by % of range. Ties break to the higher level, then
  // to the earlier fundamental, so the same club always reads the same way.
  const ranked = done.slice().sort(function (a, b) {
    if (b.pctOfRange !== a.pctOfRange) return b.pctOfRange - a.pctOfRange;
    const lv = (LEVEL_VALUE[b.level] || 0) - (LEVEL_VALUE[a.level] || 0);
    if (lv !== 0) return lv;
    return a.cfId - b.cfId;
  });

  const dates = done.map(function (r) { return r.date; }).filter(Boolean)
                    .sort(function (a, b) { return a - b; });

  // Everyone who took part, across every fundamental, each person once.
  const people = new Map();
  done.forEach(function (r) {
    participantsFrom(r.submission.takerName).forEach(function (name) {
      const key = name.toLowerCase();
      if (!people.has(key)) people.set(key, name);
    });
  });

  return {
    rows: rows,
    completed: done.length,
    total: fundamentals.length,
    complete: done.length === fundamentals.length,
    answered: done.reduce(function (n, r) { return n + r.answered; }, 0),
    strongest: ranked.slice(0, 2),
    weakest: ranked.slice(-2).reverse().filter(function (r) {
      return ranked.slice(0, 2).indexOf(r) < 0;   // never name the same CF twice
    }),
    firstDate: dates.length ? dates[0] : null,
    lastDate: dates.length ? dates[dates.length - 1] : null,
    participants: Array.from(people.values()),
    submissions: done.map(function (r) { return r.submission; })
  };
}

/* --------------------------------------------------------------- helpers -- */
export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* Collapse a team-member list onto one line. Split on line breaks when the
   person used them, otherwise on commas — never both, or
   "Jim Creighton, Enrollment Director" would be torn into two people. */
export function oneLine(v) {
  const t = String(v || '').trim();
  if (!t) return '';
  const parts = /\r?\n/.test(t) ? t.split(/\r?\n/) : t.split(',');
  return parts.map(function (x) { return x.trim(); }).filter(Boolean).join(' · ');
}

export function prettyDate(d) {
  return (d || new Date()).toLocaleDateString('en-US',
    { year: 'numeric', month: 'long', day: 'numeric' });
}

export function relativeTime(date) {
  if (!date) return '';
  const secs = Math.round((Date.now() - date.getTime()) / 1000);
  if (secs < 10) return 'just now';
  if (secs < 60) return secs + ' seconds ago';
  const mins = Math.round(secs / 60);
  if (mins < 60) return mins + (mins === 1 ? ' minute ago' : ' minutes ago');
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + (hrs === 1 ? ' hour ago' : ' hours ago');
  const days = Math.round(hrs / 24);
  return days + (days === 1 ? ' day ago' : ' days ago');
}

/* The one true slug. Draft ids, Club sign-in addresses, the `clubSlug` field on
   every document and the security rules all depend on this producing the same
   string, so it lives here and everything else imports it. */
export function slugify(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/* Deterministic draft id, so resuming needs no query. */
export function draftId(club, cfId) {
  return slugify(club) + '--cf' + cfId;
}

/* --------------------------------------------------------------- firebase -- */
let _fb = null;

export async function firebase() {
  if (!FIREBASE_ENABLED) return null;
  if (_fb) return _fb;
  const [{ initializeApp, getApps }, authMod, fsMod] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js')
  ]);
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  const auth = authMod.getAuth(app);
  // Deliberately no anonymous sign-in. Every page is behind a Club or team
  // account now (see auth.js), and silently minting an anonymous session would
  // leave a caller signed in as nobody — which the rules refuse anyway, so all
  // it would produce is confusing failures instead of a sign-in prompt.
  _fb = { app: app, auth: auth, fs: fsMod, db: fsMod.getFirestore(app) };
  return _fb;
}

export async function loadDraft(club, cfId) {
  const fb = await firebase();
  if (!fb) return null;
  const snap = await fb.fs.getDoc(
    fb.fs.doc(fb.db, DRAFTS_COLLECTION, draftId(club, cfId)));
  if (!snap.exists()) return null;
  const d = snap.data();
  d.__updated = d.updatedAt && d.updatedAt.toDate ? d.updatedAt.toDate() : null;
  return d;
}

export async function saveDraft(club, cfId, payload) {
  const fb = await firebase();
  if (!fb) throw new Error('Firebase is not connected');
  await fb.fs.setDoc(
    fb.fs.doc(fb.db, DRAFTS_COLLECTION, draftId(club, cfId)),
    Object.assign({
      club: club,
      clubSlug: slugify(club),      // what the security rules match against
      cfId: cfId,
      updatedAt: fb.fs.serverTimestamp()
    }, payload),
    { merge: true }
  );
}

export async function submitAssessment(doc) {
  const fb = await firebase();
  if (!fb) throw new Error('Firebase is not connected');
  const ref = await fb.fs.addDoc(
    fb.fs.collection(fb.db, SUBMISSIONS_COLLECTION),
    Object.assign({}, doc, {
      clubSlug: slugify(doc.club),  // what the security rules match against
      submittedAt: fb.fs.serverTimestamp(),
      uid: fb.auth.currentUser ? fb.auth.currentUser.uid : null,
      userAgent: navigator.userAgent
    })
  );
  // Mark the draft submitted rather than deleting it, so a club can reopen and
  // re-run an assessment later without losing what they answered.
  try {
    await saveDraft(doc.club, doc.cfId, { submitted: true });
  } catch (e) { /* non-fatal */ }
  return ref.id;
}

/* ---------------------------------------------------------------------------
   FILING STATUS — archive and soft delete.

   A submission's content is permanent. What can change is where it is filed:

     archived   the membership team has dealt with it. Hidden from the default
                results view, but it still counts as a completed assessment on
                the Club's own hub page — the Club did the work.
     deleted    it should not have existed: a test run, a duplicate, a false
                start. Hidden from the results view AND from the Club's
                progress, so their hub correctly shows it as not yet done.

   Neither erases anything. Both are reversible, and the security rules permit
   these fields to change and nothing else.
--------------------------------------------------------------------------- */
export async function setSubmissionStatus(id, patch) {
  const fb = await firebase();
  if (!fb) throw new Error('Firebase is not connected');
  const clean = { statusAt: fb.fs.serverTimestamp() };
  if ('archived' in patch) clean.archived = !!patch.archived;
  if ('deleted' in patch) clean.deleted = !!patch.deleted;
  await fb.fs.updateDoc(fb.fs.doc(fb.db, SUBMISSIONS_COLLECTION, id), clean);
}

/* All submissions and drafts for one club, for the hub's progress view.
   Soft-deleted submissions are left out: a club whose only submission was a
   test row should still see that fundamental as not started. */
export async function clubProgress(club) {
  const fb = await firebase();
  if (!fb) return { submissions: [], drafts: [] };
  // Queried on clubSlug, not club: the rules authorise a read by comparing
  // clubSlug to the signed-in Club's address, and Firestore only allows a query
  // whose filter guarantees every match is readable. Filtering on the display
  // name would be rejected outright.
  const slug = slugify(club);
  const [subSnap, draftSnap] = await Promise.all([
    fb.fs.getDocs(fb.fs.query(
      fb.fs.collection(fb.db, SUBMISSIONS_COLLECTION), fb.fs.where('clubSlug', '==', slug))),
    fb.fs.getDocs(fb.fs.query(
      fb.fs.collection(fb.db, DRAFTS_COLLECTION), fb.fs.where('clubSlug', '==', slug)))
  ]);
  const submissions = [], drafts = [];
  subSnap.forEach(function (d) {
    const v = d.data(); v.__id = d.id;
    if (v.deleted === true) return;          // soft-deleted: treat as never submitted
    v.__date = v.submittedAt && v.submittedAt.toDate ? v.submittedAt.toDate() : null;
    submissions.push(v);
  });
  draftSnap.forEach(function (d) {
    const v = d.data(); v.__id = d.id;
    v.__date = v.updatedAt && v.updatedAt.toDate ? v.updatedAt.toDate() : null;
    drafts.push(v);
  });
  return { submissions: submissions, drafts: drafts };
}
