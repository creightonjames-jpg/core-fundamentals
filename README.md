# Century Golf Partners — Membership Core Fundamentals

Ten club self-assessments on one site. A club picks itself once, works through
the fundamentals in any order, and their answers save as they go — so a team can
stop mid-assessment and pick up days later from a different computer.

Roughly 233 questions across the ten, about two and a half hours of answering in
total. That is why saving matters.

```
index.html          Hub — your Club's progress across all ten
assessment.html     The assessment engine — ?cf=1 … ?cf=10
admin.html          Results dashboard (membership team sign-in)
summary.html        Club Summary — all ten on one page, printable
auth.js             Sign-in: per-Club PIN, verified by Firebase
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
per fundamental, at a predictable id (`toledo-country-club--cf7`). Anyone at that
club resumes by signing in with the Club PIN — from any computer, in any browser.

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
The Club Summary pools the same ranking across all ten — see below.

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

**Filing is the membership team's, not the Club's.** Both flags require an admin,
so a Club cannot quietly archive away a result it does not like, and a passer-by
cannot flip anyone's flags.

**Why there is still no permanent delete.** An erased assessment is gone; a
flipped flag is one click to undo. If a record truly must be removed, do it in
the Firebase console, where it is deliberate.

The rules keep even an admin narrow. An update is accepted only if the set of
keys it changes falls inside `['archived', 'deleted', 'statusAt']`, so no
request, however crafted, can rewrite an answer, a score, a club or a date.

---

## The Club Summary

`summary.html?club=Toledo%20Country%20Club` puts a club's whole programme on
one sheet. It prints to two pages and carries:

- club, date range of the ten, and everyone who took part (unioned across all
  ten submissions, each person once)
- the ten as a single picture — CF, headline, level, % of range
- strongest two and widest-gap two, named
- **the pooled priority list** — every No from every fundamental they submitted,
  re-ranked by the same leverage formula, top 10

That last list is the point of the page. Ten separate reports leave a club with
ten to-do lists and no idea what comes first; this answers "where do we start"
once. Their per-fundamental reports still list every item.

**There is deliberately no single overall score.** A club at 401 on Ambassador
Committee and 101 on Enrollment averages to something in the 300s, which
describes no club and hides the only thing worth acting on. The ten-row table
carries the picture instead.

**Where the links are.** The hub shows a "View your Club Summary" invitation
only when a club has submitted all ten — an overall summary built on four of ten
would mislead them. The membership team can open it at any stage from the link
inside any submission on the Results page; the page then states "Based on 6 of
10" and names what is still outstanding, with a warning that the missing ones
may hold higher-leverage gaps than anything listed.

Change `TOP_N` at the top of the script in `summary.html` to lengthen or shorten
the pooled list.

---

## Access — one Club cannot see another

Every Club has a **real Firebase Auth account whose password is its PIN**:

```
toledo-country-club@clubs.centurygolf.com    ·    six digits
```

The Club only ever types six digits; the page builds the address from the Club
they picked. Firebase verifies the PIN on its own servers, with its own
brute-force protection, and returns a token. The security rules read the email
out of that token and compare it to the `clubSlug` stored on each document.

The membership team has a PIN of its own, on a shared account
(`admin@team.centurygolf.com`), which opens every Club. It is **ten digits, not
six**, deliberately: a Club PIN unlocks one Club, this one unlocks all
twenty-six plus the filing controls, so it is worth four more keystrokes.

**The database decides, not the page.** Editing the JavaScript, or calling the
Firestore API directly, gets a visitor nothing but their own Club's records.
That is the difference from the PIN this replaced, which was checked in the
browser and therefore not a lock at all.

| | Their own drafts | Their own results | Anyone else's | The dashboard |
|---|---|---|---|---|
| A Club | read / write | read | **no** | no |
| Team (Admin PIN, or a named account) | read | read | read | yes |
| Anyone else | no | no | no | no |

There is no open read left anywhere, and no anonymous sign-in.

Signing in **as** a Club also removed a quieter hazard: the old Club dropdown let
someone file Toledo's answers under Balcones and never notice. A Club now sees
its own name, fixed.

### The addresses

`clubs.centurygolf.com` is a subdomain with **no mailboxes**, on purpose. Nothing
is ever emailed to those addresses — a forgotten PIN is reset in the Firebase
console, which does not touch the Club's saved answers.

Firebase requires a password of at least six characters, which is why the PINs
are six digits rather than four.

### Setting up the accounts

`provision/` holds the roster and a script. Either:

- **Script:** `node provision/create-accounts.mjs` with a service-account key —
  creates all 26 Club accounts in one pass and is idempotent, so re-running it
  only fills gaps.
- **By hand:** Authentication → Users → Add user, 26 times, from the roster.

The roster includes the team account, so one run covers everything. Then go to
`admin.html`, choose **Membership team**, and enter the Admin PIN — there is no
UID to look up, because the rules recognise that address itself.

**Named individual accounts** are the alternative when you want to know who
looked at what: add the person in Authentication, have them sign in via "Use a
named account instead" (which shows them their UID), then create
`admins/{that UID}` in Firestore. Nothing in the app can grant itself admin
either way.

### Changing a PIN

Authentication → Users → the row → Reset password. Saved answers and submitted
results are untouched; they just need the new digits. The sign-in box accepts any
length, so the Admin PIN can be a full passphrase if you would rather — nothing
in the code assumes digits.

If someone who knew the shared Admin PIN leaves, change it. That is the cost of
a shared credential, and the reason named accounts exist.

### Adding a Club

Add it to `CLUBS` in `data/manifest.js`, then create the matching account. The
slug must be the Club name lowercased with every run of non-alphanumerics turned
into a single hyphen — `slugify()` in `shared.js` is the one definition, and the
provisioning script uses the same rule.

## Firebase setup

Already done for `cgp-core-fundamentals`. If it ever needs recreating:

1. Firestore Database → Create → **production mode**, `nam5 (United States)`.
2. Authentication → Sign-in method → enable **Email/Password**. Anonymous is no
   longer used and can be switched off.
3. Project settings → Your apps → web app → copy the config into
   `firebase-config.js` and set `FIREBASE_ENABLED = true`.
4. Firestore → Rules → paste `firestore.rules` → **Publish**. Do not skip this.

Costs nothing. The free Spark plan covers 20,000 writes a day; a full round of
ten assessments across 26 clubs is a small fraction of one day's allowance.

---

## Publishing

GitHub Pages, `main` branch, `/ (root)`. Keep the folder structure — `data/`
and `assets/` matter.

Send clubs the plain site link and their own six digits. The dashboard is
reachable by anyone but opens for nobody without an admin account.

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

**A Club is told its PIN is wrong when it is not.** Check the account exists at
Authentication → Users under exactly `<slug>@clubs.centurygolf.com`. A mismatch
between the slug and the Club name in `manifest.js` produces this.

**"The database refused the read" on the dashboard.** You are signed in but not
on the admin list. The page shows your UID beside your email — create
`admins/{that UID}` in Firestore.

**A Club signs in but sees nothing it worked on.** Its documents are missing
`clubSlug`, or carry the wrong one. Everything written by the current code sets
it automatically; anything from before the change was backfilled once.

**Too many wrong PINs.** Firebase pauses sign-in for that account for a few
minutes. It clears itself.

**Print output has dark green backgrounds.** Turn off "Background graphics" in
the browser's print dialog.
