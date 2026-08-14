# Century Golf Partners — Core Fundamentals Self-Assessment

A two-page static site. Clubs take the CF#1 "Friends Inviting Friends"
self-assessment, see their score immediately, print or save a PDF of their
results, and submit them to a Firebase back end. Results are reviewed on a
PIN-gated dashboard.

```
index.html          the assessment (public)
admin.html          results dashboard (login required)
firebase-config.js  your Firebase keys — the one file you must edit
firestore.rules     security rules to paste into the Firebase console
```

No build step, no npm, no server. It is plain HTML that runs anywhere.

---

## Part 1 — Firebase setup (about 15 minutes, once)

### 1. Create the project

1. Go to <https://console.firebase.google.com> and click **Add project**.
2. Name it something like `century-golf-core-fundamentals`.
3. Google Analytics is optional — you don't need it. Skip it.

### 2. Create the database

1. Left sidebar → **Build → Firestore Database** → **Create database**.
2. Choose **Start in production mode**. (Test mode leaves your data wide open
   for 30 days. You're pasting real rules in step 5, so you don't need it.)
3. Pick the location closest to your clubs — `nam5 (United States)` is fine.

### 3. Turn on the two sign-in methods

Left sidebar → **Build → Authentication** → **Get started**, then on the
**Sign-in method** tab enable both:

| Provider | Why |
|---|---|
| **Anonymous** | Lets a club submit without creating an account. Zero friction — they never see a login screen. This is the only provider the site needs today. |
| **Email/Password** | Not used by the current PIN-based dashboard. Leave it enabled — you'll want it if you ever follow "Making results private again". |

### 4. Register the web app and copy your config

1. Click the **gear icon → Project settings**.
2. Scroll to **Your apps** → click the web icon **`</>`**.
3. Nickname it `core-fundamentals-site`. **Do not** check Firebase Hosting —
   you're using GitHub Pages.
4. Firebase shows you a `firebaseConfig` object. Copy those values into
   **`firebase-config.js`**, replacing every `PASTE_...` placeholder.
5. In that same file, change the last line to:

   ```js
   export const FIREBASE_ENABLED = true;
   ```

> **On the API key being public:** it will be visible to anyone who views
> source, and that is normal and expected for every Firebase web app on the
> internet. It is an identifier, not a password. Your data is protected by the
> rules in step 5 — which is exactly why you should not skip step 5.

### 5. Publish the security rules

1. **Firestore Database → Rules** tab.
2. Delete what is there, paste the entire contents of **`firestore.rules`**.
3. Click **Publish**.

These rules say: anyone may submit once, nobody may read anything unless their
UID is in the `admins` collection.

### 6. Viewing results — the PIN

There is no admin account to create. The results page at `admin.html` asks for
a **PIN**, set at the top of that file:

```js
const ACCESS_PIN = '2026';
```

Change it by editing that one line and committing.

> **Please read this once so nobody is surprised later.** The PIN is checked in
> the browser, not by the database. That means two things are true:
>
> 1. Anyone who views the page source can read the PIN.
> 2. The Firestore rules allow **any visitor to read submissions**, PIN or no
>    PIN, because a browser-side PIN cannot gate a database.
>
> In practice, treat every submission as public information. This was a
> deliberate trade for convenience. If that ever stops being the right trade,
> see "Making results private again" below — it is a 10-minute change.

Submissions are still **immutable**: nobody, including you, can edit or delete
one through the web app. Corrections are made in the Firebase console on purpose.

---

## Making results private again

If you later want results genuinely restricted:

1. In `firestore.rules`, change the submissions read rule from
   `allow read: if true;` to `allow read: if isAdmin();` and publish.
2. In Firebase → **Authentication → Users → Add user**, create an account for
   each person who should see results.
3. In Firestore → **Data**, create a collection `admins` with one document per
   viewer, the **document ID being that person's Auth UID**.
4. Swap the PIN gate in `admin.html` for a Firebase email/password sign-in
   (or Google sign-in, which needs no passwords at all).

The `isAdmin()` function and the `/admins` rules are already in place for this —
nothing needs to be rebuilt.

---

## Part 2 — Publish on GitHub Pages (about 5 minutes)

1. Create a new repository on GitHub — e.g. `core-fundamentals`.
   Public is fine; there are no secrets in these files.
2. Upload every file, keeping the structure intact.
   (Web UI: **Add file → Upload files**, then drag the whole folder in.)
3. In the repo, go to **Settings → Pages**.
4. Under *Source* choose **Deploy from a branch**; branch `main`, folder
   `/ (root)`. **Save.**
5. Wait a minute or two, then your site is live at:

   ```
   https://<your-username>.github.io/core-fundamentals/
   ```

Send clubs the plain link. Keep `.../admin.html` and the PIN to yourselves.

---

## How the scoring works

Each statement maps Yes and No onto the 101 / 201 / 301 / 401 ladder. Some
statements are worth the same either way (Yes = 101, No = 101); others carry a
real gap (Yes = 401, No = 201).

A plain average would reward a club for answering questions where Yes and No
are close together. So instead the score is **range-scaled**:

```
ratio  = (points earned − worst possible) ÷ (best possible − worst possible)
level  = round(1 + ratio × 3)   →   1 = 101, 4 = 401
```

Worst and best possible are computed from *only the questions that were
actually answered*, so a partly finished assessment is still scored fairly.
The same math runs again inside each section to produce the section rollup kept
in the results dashboard.

This is the identical logic from the original scorecard — nothing changed.

---

## Day-to-day use

**A club takes the assessment.** They pick their Club from the dropdown, list
the participating team members, answer all 25, and press *Calculate Our Score*.
Their level, percentage, answer distribution, and a ranked list of what to work
on next appear on screen. Then they can:

- **Submit to Century Golf** — writes one record to Firestore. Enabled only
  once the Club, the participating team members, and all 25 answers are complete.
- **Print / Save as PDF** — opens the browser print dialog against a clean
  report layout: header, participating team members, score, the full priority
  list, and all 25 answers. In the print dialog choose *Save as PDF* as the
  destination. Works on phones too, and works whether or not they submit.

**You review results.** Open `admin.html`, enter the PIN, and you get:

- Four summary tiles — submissions, clubs reporting, average % of range, most
  common level
- A sortable table (click any column header) with a filter box
- Click any row for the full detail drawer — the priorities that Club was given,
  every answer, section rollup, and a *Print* button for that single submission
- **Export CSV — summary**: one row per submission, for a quick pivot
- **Export CSV — every answer**: one row per answer, for question-level
  analysis across the portfolio ("which question does everyone fail?")

Both exports respect the current filter, so you can export a single club.

---

## Editing things later

**A question changed.** Open `index.html`, find the `statements` array near the
top of the `<script>` block, edit the text or the `yes:` / `no:` values. Nothing
else needs touching — the page, the print report, and the CSV all read from
that one array.

**You want a second Core Fundamental.** Copy `index.html` to `cf2.html`,
replace the `statements` array and the masthead text, and change
`coreFundamental` in the submit payload from `'CF1 — Friends Inviting Friends'`
to CF2. The admin dashboard picks it up with no changes.

---

## Editing the Club list and the priority ranking

**Club list.** `index.html` has a `CLUBS` array near the top of the script
block. Add, remove, or rename a Club there and the dropdown updates.

**Priority ranking.** Each statement carries an `action` — the plain-language
instruction a Club sees in "What to work on next". The order is computed as:

```
foundation = 4 - levelValue[yes]     a 101 item scores 3, a 401 item scores 0
gain       = levelValue[yes] - levelValue[no]
score      = foundation * 2 + gain
```

Foundation leads deliberately. CF#1 is a ladder, so the highest-leverage gap is
the lowest unmet rung — it gates everything above it. Several statements score
the same whether the answer is Yes or No, so they earn no points at all, yet
they are prerequisites: ranking purely on points would tell a Club to run daily
collateral walk-throughs before it has designed an invitation to walk past.

To shift the emphasis toward raw score movement, swap the two multipliers on
the `score` line. The on-screen list shows the top 6; the printed report shows
every item answered No.

---

## Testing before you go live

The site works fully without Firebase. Leave `FIREBASE_ENABLED = false` and the
assessment still scores and prints perfectly — only *Submit* is disabled, with
a note explaining why. Good for showing a GM the flow before the back end is
wired up.

To run it locally you need a real web server, because browsers block ES modules
loaded over `file://`:

```bash
cd core-fundamentals
python3 -m http.server 8000
# then open http://localhost:8000
```

---

## Troubleshooting

**"The database is refusing to return results."** The Firestore rules were
changed. The submissions read rule must be `allow read: if true;` for the
PIN-gated dashboard to work.

**Submit fails with a permission error.** Anonymous sign-in is probably off.
Authentication → Sign-in method → enable **Anonymous**.

**Dashboard is empty but submissions exist.** Firestore needs the
`submittedAt` field to sort. Records created by hand in the console without
that field won't appear. Submit through the real form instead.

**Print output has dark green backgrounds.** Turn off "Background graphics" in
your browser's print dialog. The report is designed to print clean without it.

**Nothing loads on GitHub Pages.** Check that `firebase-config.js` sits in the
same folder as `index.html`, and give Pages a couple of minutes after the first
push.

---

## Costs

Firebase's free Spark plan covers 20,000 document writes and 50,000 reads per
day. A portfolio-wide assessment round is a few dozen writes. You will not pay
anything, and you do not need to add a credit card.
