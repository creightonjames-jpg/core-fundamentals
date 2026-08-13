# Century Golf Partners — Core Fundamentals Self-Assessment

A three-page static site. Clubs take the CF#1 "Friends Inviting Friends"
self-assessment, see their score immediately, print or save a PDF of their
results, and submit them to a Firebase back end that only you can read.

```
index.html          the assessment (public)
band.html           The Band — leadership roster
admin.html          results dashboard (login required)
firebase-config.js  your Firebase keys — the one file you must edit
firestore.rules     security rules to paste into the Firebase console
images/             headshots for The Band
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
| **Anonymous** | Lets a club submit without creating an account. Zero friction — they never see a login screen. |
| **Email/Password** | This is *your* admin login for the dashboard. |

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

### 6. Create your admin account

1. **Authentication → Users** tab → **Add user**.
2. Enter your email (`jcreighton@centurygolf.com`) and a strong password.
3. When it appears in the list, **copy the User UID** — the long string in the
   right-hand column.

### 7. Put your UID on the admin allow-list

1. **Firestore Database → Data** tab → **Start collection**.
2. Collection ID: `admins` — exactly that, lowercase.
3. Document ID: **paste your UID from step 6.**
4. Add one field so the document isn't empty:
   - Field `email`, type `string`, value `jcreighton@centurygolf.com`
5. **Save.**

That's it. Repeat steps 6–7 for anyone else who should see results.

---

## Part 2 — Publish on GitHub Pages (about 5 minutes)

1. Create a new repository on GitHub — e.g. `core-fundamentals`.
   Public is fine; there are no secrets in these files.
2. Upload every file and the `images/` folder, keeping the structure intact.
   (Web UI: **Add file → Upload files**, then drag the whole folder in.)
3. In the repo, go to **Settings → Pages**.
4. Under *Source* choose **Deploy from a branch**; branch `main`, folder
   `/ (root)`. **Save.**
5. Wait a minute or two, then your site is live at:

   ```
   https://<your-username>.github.io/core-fundamentals/
   ```

Send clubs the plain link. Keep `.../admin.html` to yourself — though the rules
mean it shows nothing useful even if someone finds it.

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
The same math runs again inside each section to produce the section breakdown.

This is the identical logic from the original scorecard — nothing changed.

---

## Day-to-day use

**A club takes the assessment.** They enter Club and name, answer all 25,
press *Calculate Our Score*. Their level, percentage, distribution, and
section-by-section breakdown appear on screen. Then they can:

- **Submit to Century Golf** — writes one record to Firestore. Enabled only
  once Club, name, and all 25 answers are complete.
- **Print / Save as PDF** — opens the browser print dialog against a clean
  report layout: header, score, distribution, section breakdown, and all 25
  answers. In the print dialog choose *Save as PDF* as the destination. Works
  on phones too. This works whether or not they submit.

**You review results.** Open `admin.html`, sign in, and you get:

- Four summary tiles — submissions, clubs reporting, average % of range, most
  common level
- A sortable table (click any column header) with a filter box
- Click any row for the full detail drawer — every answer, section rollup, and
  a *Print* button for that single submission
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

**Someone joined The Band.** Drop a square headshot into `images/` and add one
entry to the `people` list at the top of `band.html`'s script block. Titles
marked `todo: true` render in brass italic so unconfirmed ones stay visible.

**You want a second Core Fundamental.** Copy `index.html` to `cf2.html`,
replace the `statements` array and the masthead text, and change
`coreFundamental` in the submit payload from `'CF1 — Friends Inviting Friends'`
to CF2. The admin dashboard picks it up with no changes.

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

**"Missing or insufficient permissions" in the dashboard.** You are signed in
but your UID is not on the allow-list. Re-check step 7 — the document ID must
be the UID exactly, and the collection must be named `admins`.

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
