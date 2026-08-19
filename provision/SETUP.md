# Turning on per-Club sign-in

Four steps. About twenty minutes, most of it waiting on the script.

> **`club-accounts.csv` and `club-notes.txt` are not in this repository, and must
> never be.** This repo is public; those two files hold every Club's PIN and the
> Admin PIN. They
> were sent to you directly — put them beside this file to run the script, and
> keep them wherever you keep door codes. `.gitignore` here blocks them, and
> `club-accounts.EXAMPLE.csv` shows the format without real PINs.

The site is **locked to everyone** until step 1 is done — that is the safe
state, not a fault. Nothing real is in the database yet, so there is no rush and
nothing to lose if you stop halfway.

---

## 1. Create the accounts — 26 Clubs plus your own

Each Club gets a Firebase account whose **password is its PIN**. That is what
makes the PIN real: Firebase checks it, not the web page.

The roster also contains **the membership team account** —
`admin@team.centurygolf.com` — whose PIN opens every Club's results, any Club's
Summary, and the archive/delete controls. It is **ten digits rather than six on
purpose**: a Club PIN unlocks one Club, this one unlocks all twenty-six.

### The quick way

```bash
cd provision
npm install firebase-admin
GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json \
  node create-accounts.mjs
```

The key comes from **Project settings → Service accounts → Generate new private
key**. It downloads a `.json` file.

The script checks the roster before it touches anything, prints a line per Club,
and is safe to run twice — it skips accounts that already exist. If it stops
halfway, run it again.

**Delete the key file afterwards.** It is full access to the project.

### The manual way

**Authentication → Users → Add user**, 27 times, copying the email and PIN
columns out of `club-accounts.csv`. Tedious but needs no tooling. Do not skip the
last row — that is the one that opens the results page.

---

## 2. Send each Club its PIN

`club-notes.txt` has a ready note per Club — the link, their PIN, and the four
things they need to know. **Send each Club only its own note.**

The PINs are in `club-accounts.csv` — the copy sent to you, not in the repo.

---

## 3. Check you can get in

Go to `admin.html`, choose **Membership team**, and enter the Admin PIN from the
roster. That is it — there is no UID to look up, because the rules recognise the
team address itself.

### If you would rather have named accounts

Useful when several people need results and you want to know who looked at what.
For each person:

1. **Authentication → Users → Add user** — their real email, a password they
   choose.
2. They sign in at `admin.html` via **"Use a named account instead"**. It will
   tell them they are not on the list yet, **and show their UID**.
3. **Firestore → Data →** collection `admins` → new document, that UID as the
   **document ID**. Any field will do — `note: "Lisa"`.

Named accounts and the shared PIN can coexist. Nothing in the app can add an
admin either way; it happens here, by hand, on purpose.

## 4. Clear the test rows

Ten submissions and four drafts from testing are still in there. On the
dashboard, tick them and hit **Delete** — reversible, so nothing is lost if you
change your mind. The four drafts have to go from **Firestore → Data → drafts**,
which is a real delete, so do that only when you are sure.

---

## Afterwards

**A Club forgot its PIN.** Authentication → Users → their row → Reset password.
Their saved answers are untouched.

**Changing the Admin PIN.** Same place, the `admin@team.centurygolf.com` row.
The sign-in box accepts any length, so a full passphrase works if you would
rather have one — nothing in the code assumes digits.

**Someone leaves the team.** If they knew the shared Admin PIN, change it. That
is the cost of a shared credential, and the reason named accounts exist.

**A Club says the PIN does not work.** Check the address at Authentication →
Users matches `<slug>@clubs.centurygolf.com` exactly. Too many wrong tries also
makes Firebase pause that account for a few minutes; it clears itself.

**A new Club joins.** Add it to `CLUBS` in `data/manifest.js`, add a row to the
CSV, and re-run the script — it will create just the new one.

**Those `@clubs.centurygolf.com` addresses.** A subdomain with no mailboxes, on
purpose. Nothing is ever sent to them; PIN resets happen here in the console.

**Why six digits and not four.** Firebase will not accept a password shorter
than six characters.
