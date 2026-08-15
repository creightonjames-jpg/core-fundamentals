# Century Golf Partners — Membership Core Fundamentals

Ten club self-assessments on one site. A club picks itself once, works through
the fundamentals in any order, and their answers save as they go — so a team can
stop mid-assessment and pick up days later from a different computer.

Roughly 233 questions across the ten, about two and a half hours of answering in
total. That is why saving matters.

```
index.html          Hub — pick your Club, see progress across all ten
assessment.html     The assessment engine — ?cf=1 … ?cf=10
admin.html          Results dashboard (PIN)
shared.js           Scoring, priorities, Firebase, draft save/resume
firebase-config.js  Your Firebase keys — the one file with settings in it
firestore.rules     Security rules, pasted into the Firebase console
assets/site.css     All styling, one file
data/manifest.js    The ten fundamentals + the club list
data/cf1.js … cf10.js   The questions
```

No build step, no npm, no server. Plain HTML that runs anywhere.

---

## The shape of it

There is **one engine and ten data files**. `assessment.html?cf=7` loads
`data/cf7.js` and renders it. Scoring, the priorities list, the printable
report, saving and submitting are identical for every fundamental because
they are literally the same code.

This is why it is one site rather than ten. A change to the print layout, the
club list, or the scoring lands everywhere at once instead of needing ten
edits that inevitably drift apart.

**Adding an eleventh fundamental:** drop in `data/cf11.js` copying the shape of
any existing one, then add a line to `FUNDAMENTALS` in `data/manifest.js`.
Nothing else changes.

---

## The ten

| CF | Questions | Sections |
|---:|---:|---:|
| 1 | 25 | 7 |
| 2 | 39 | 8 |
| 3 | 23 | 3 |
| 4 | 20 | 6 |
| 5 | 22 | 6 |
| 6 | 19 | 4 |
| 7 | 38 | 10 |
| 8 | 5 | 1 |
| 9 | 24 | 7 |
| 10 | 18 | 4 |
| | **233** | |

CF#8 is deliberately short. A five-question score is coarser than the others —
one answer moves it further — so read it with that in mind.

---

## Saving and resuming

Progress is stored in Firestore in a `drafts` collection, one document per Club
per fundamental, at a predictable id (`toledo-country-club--cf7`). Anyone at
that club resumes simply by choosing the club — there is no login, no code, and
no dependence on the browser they started in.

Saves are **debounced**: one write a second and a half after the last answer,
not one per tap. Across 26 clubs and ten fundamentals that stays comfortably
inside Firebase's free tier.

The bar at the bottom of every assessment shows the save state — *Saving…*,
*All work saved*, or a clear failure message. If the network drops, answers stay
on screen and the next successful save catches up.

**One thing to know.** If two people at the same club have the same fundamental
open at once, the last answer saved wins. There is no locking. The hub warns
about this. In practice a quick word between the GM and the Enrollment Director
avoids it; if it ever becomes a real problem the fix is a per-session resume
code rather than keying on the club.

On submit the draft is **flagged, not deleted**, so a club can reopen a finished
assessment and re-run it next quarter without losing what they said last time.

---

## Scoring

Each statement maps Yes and No onto the 101 / 201 / 301 / 401 ladder. Some
statements are worth the same either way (Yes = 101, No = 101); others carry a
real gap (Yes = 401, No = 201).

A plain average would reward a club for answering questions where Yes and No sit
close together. So the score is **range-scaled**:

```
ratio = (points earned − worst possible) ÷ (best possible − worst possible)
level = round(1 + ratio × 3)      1 = 101, 4 = 401
```

Worst and best possible are computed from *only the questions actually
answered*, so a partly finished assessment still scores fairly.

---

## "What to work on next"

Every club gets a ranked list built from the questions they answered **No**.

```
foundation = 4 − levelValue[yes]      a 101 item scores 3, a 401 item scores 0
gain       = levelValue[yes] − levelValue[no]
score      = foundation × 2 + gain    ties break to the earlier question
```

**Foundation deliberately leads.** Each fundamental is a ladder, so the
highest-leverage gap is the lowest unmet rung — it gates everything above it.
Ranking on point movement alone produced nonsense: it put *"walk the Club daily
confirming collateral is in place"* above *"design your Club invitation."* You
cannot audit collateral that was never designed.

To shift the emphasis, change the two multipliers in `buildPriorities()` in
`shared.js`. The screen shows the top six; the printed report lists every No.

### Action statements

Each statement may carry an `action` — the plain-language instruction a club
reads instead of a restated question. **CF#1 has all 25 written. CF#2–10 do
not yet**, and where an action is missing the engine shows the question itself.
That works and reads acceptably, it is just stiffer than a hand-written line.

To upgrade a fundamental, add `action: "…"` to its statements in its data file.
Partial is fine — written actions and fallbacks can coexist in the same file.

---

## Filing results — archive and delete

The results dashboard has three views: **Active**, **Archived**, **Deleted**.
Every row carries an Archive/Delete pair, and ticking rows gives you the same
actions in bulk. Delete asks before it acts.

Both are **flags on the record, not removals**. Nothing on this page erases
anything, ever.

| | Hidden from the results list | Still counts on the Club's hub | Reversible |
|---|---|---|---|
| **Archived** | yes | **yes** — the Club did the work | one click |
| **Deleted** | yes | no — the fundamental reads as not started | one click |

That difference is the whole reason there are two. *Archived* means "we have
dealt with this"; the assessment still happened. *Deleted* means "this should
never have existed" — a test run, a duplicate, a false start — so it stops
counting toward that Club's progress.

CSV exports follow the view you are standing in and carry a **Filing** column,
so an Active export is exactly the live set.

**Why there is no permanent delete.** With no real sign-in, a `delete`
permission in the rules would be a delete permission for *anyone who finds the
site*, not just the membership team. The two flags are exposed to those same
strangers, but a flipped flag is one click to undo and an erased assessment is
gone for good. If a record ever truly must be removed, do it in the Firebase
console — or take the "Making results private again" path below first.

The rules keep this narrow. An update is accepted only if the set of keys it
changes falls inside `['archived', 'deleted', 'statusAt']`, so no request,
however crafted, can rewrite an answer, a score, a club or a date.

---

## Access and privacy — read once

The results dashboard is gated by a **PIN checked in the browser** (`ACCESS_PIN`
at the top of `admin.html`). Two things follow:

1. Anyone who views the page source can read the PIN.
2. The Firestore rules allow **any visitor to read submissions and drafts**, PIN
   or no PIN, because a browser-side PIN cannot gate a database.

**Treat submissions and drafts as public information.** This was a deliberate
trade for convenience. Note it now covers ten fundamentals of candid
self-assessment rather than one, which is worth revisiting.

What holds regardless: the *content* of a submitted assessment can never be
edited or erased through the web app, malformed writes are rejected by the
rules, and the only permitted change is the archived/deleted filing flag.

### Making results private again

1. In `firestore.rules`, change both `allow read: if true;` to
   `allow read: if isAdmin();` and publish.
2. Firebase → **Authentication → Users → Add user** for each viewer.
3. Firestore → **Data** → collection `admins`, one document per viewer, the
   **document ID being that person's Auth UID**.
4. Replace the PIN gate in `admin.html` with a Firebase sign-in. Google sign-in
   needs no passwords and would also make drafts private per person.

`isAdmin()` and the `/admins` rules are already in place — nothing is rebuilt.

---

## Firebase setup

Already done for `cgp-core-fundamentals`. If it ever needs recreating:

1. Firestore Database → Create → **production mode**, `nam5 (United States)`.
2. Authentication → Sign-in method → enable **Anonymous** (used by every visitor
   so the rules have something to check) and **Email/Password** (unused today,
   kept for the private-results path).
3. Project settings → Your apps → web app → copy the config into
   `firebase-config.js` and set `FIREBASE_ENABLED = true`.
4. Firestore → Rules → paste `firestore.rules` → **Publish**. Do not skip this.

Costs nothing. The free Spark plan covers 20,000 writes a day; a full round of
ten assessments across 26 clubs is a small fraction of one day's allowance.

---

## Publishing

GitHub Pages, `main` branch, `/ (root)`. Keep the folder structure — `data/`
and `assets/` matter.

Send clubs the plain site link. Keep `admin.html` and the PIN to yourselves.

---

## Editing things later

**A question changed.** Edit it in `data/cfN.js`. The assessment, the printable
report, the priorities and the CSV exports all read from that one array.

**The club list changed.** Edit `CLUBS` in `data/manifest.js`.

**Testing without Firebase.** Set `FIREBASE_ENABLED = false` in
`firebase-config.js`. Assessments still score and print; only saving and
submitting switch off, with a visible notice. To run locally you need a real web
server, because browsers block ES modules over `file://`:

```bash
python3 -m http.server 8000
```

---

## Troubleshooting

**"Could not save — check your connection."** The draft write failed. Answers
are still on screen; they save on the next successful attempt. If it persists,
check that Anonymous sign-in is still enabled.

**Progress not appearing on the hub.** The hub matches drafts and submissions on
the exact club string. If a club was renamed in `manifest.js` after work began,
old drafts sit under the old name.

**"The database is refusing to return results."** The rules were changed. Both
`submissions` and `drafts` need `allow read: if true;` for the PIN-gated
dashboard and the hub's progress view to work.

**Print output has dark green backgrounds.** Turn off "Background graphics" in
the browser's print dialog.
