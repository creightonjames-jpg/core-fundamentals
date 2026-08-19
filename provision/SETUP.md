# Turning on per-Club sign-in

Four steps. About twenty minutes, most of it waiting on the script.

> **`club-accounts.csv` and `club-notes.txt` are not in this repository, and must
> never be.** This repo is public; those two files hold every Club's PIN. They
> were sent to you directly — put them beside this file to run the script, and
> keep them wherever you keep door codes. `.gitignore` here blocks them, and
> `club-accounts.EXAMPLE.csv` shows the format without real PINs.

The site is **locked to everyone** until step 1 and 3 are done — that is the safe
state, not a fault. Nothing real is in the database yet, so there is no rush and
nothing to lose if you stop halfway.

---

## 1. Create the 26 Club accounts

Each Club gets a Firebase account whose **password is its PIN**. That is what
makes the PIN real: Firebase checks it, not the web page.

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

**Authentication → Users → Add user**, 26 times, copying the email and PIN
columns out of `club-accounts.csv`. Tedious but needs no tooling.

---

## 2. Send each Club its PIN

`club-notes.txt` has a ready note per Club — the link, their PIN, and the four
things they need to know. **Send each Club only its own note.**

The PINs are in `club-accounts.csv` — the copy sent to you, not in the repo.

---

## 3. Make yourself the admin

The results dashboard opens for nobody until this is done, including you.

1. **Authentication → Users → Add user.** Use a real email and a password you
   choose. (Not a `@clubs.centurygolf.com` address — those are the Clubs.)
2. Go to `admin.html` and sign in with it. It will tell you it is not on the
   admin list yet, **and show you your UID.**
3. **Firestore → Data → Start collection `admins`** → new document, and paste
   that UID as the **document ID**. Any field will do — `note: "Jim"`.
4. Reload `admin.html`. You are in.

Nothing in the app can add an admin. It has to be done here, by hand, on
purpose. Repeat for anyone else on the membership team who needs results.

---

## 4. Clear the test rows

Ten submissions and four drafts from testing are still in there. On the
dashboard, tick them and hit **Delete** — reversible, so nothing is lost if you
change your mind. The four drafts have to go from **Firestore → Data → drafts**,
which is a real delete, so do that only when you are sure.

---

## Afterwards

**A Club forgot its PIN.** Authentication → Users → their row → Reset password.
Their saved answers are untouched.

**A Club says the PIN does not work.** Check the address at Authentication →
Users matches `<slug>@clubs.centurygolf.com` exactly. Too many wrong tries also
makes Firebase pause that account for a few minutes; it clears itself.

**A new Club joins.** Add it to `CLUBS` in `data/manifest.js`, add a row to the
CSV, and re-run the script — it will create just the new one.

**Those `@clubs.centurygolf.com` addresses.** A subdomain with no mailboxes, on
purpose. Nothing is ever sent to them; PIN resets happen here in the console.

**Why six digits and not four.** Firebase will not accept a password shorter
than six characters.
