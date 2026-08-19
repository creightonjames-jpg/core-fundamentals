/* ===========================================================================
   Century Golf Partners — Membership Core Fundamentals
   Sign-in: per-Club PIN, verified by Firebase.

   WHY THIS SHAPE
   A PIN checked in the browser is theatre — anyone can read the page source or
   talk to the database directly. So each Club has a real Firebase Auth account
   whose PASSWORD is its PIN:

       toledo-country-club@clubs.centurygolf.com   /   <six digits>

   The Club only ever types six digits; the page builds the address from the
   Club they picked. Firebase verifies the PIN on its own servers, with its own
   brute-force protection, and hands back a token. The security rules then read
   the email out of that token and compare it to the `clubSlug` stored on each
   document — so a Club can reach its own drafts and results and nothing else,
   enforced by the database rather than by the page.

   The addresses are deliberately at a subdomain with no mailboxes. Nothing is
   ever emailed to them: PIN changes happen in the Firebase console.

   The membership team signs in with an ordinary email and password, and is
   recognised as admin by a document at /admins/{uid}.
   =========================================================================== */

import { firebase, slugify } from './shared.js';
import { CLUBS } from './data/manifest.js';

export const CLUB_EMAIL_DOMAIN = 'clubs.centurygolf.com';

/* The shared membership-team account. The rules recognise this address itself,
   so a team PIN works as soon as the account exists — no UID to look up. Named
   individual accounts still work through /admins/{uid}; use those when you want
   to know who looked at what. */
export const TEAM_EMAIL = 'admin@team.centurygolf.com';

export { slugify };

export function clubEmail(club) {
  return slugify(club) + '@' + CLUB_EMAIL_DOMAIN;
}

const SLUG_TO_CLUB = new Map(CLUBS.map(function (c) { return [slugify(c), c]; }));
export function clubFromSlug(slug) { return SLUG_TO_CLUB.get(String(slug || '')) || null; }

/* --------------------------------------------------------------- session -- */
let _session = null;

/* Who is signed in, and what they are allowed to be shown.

   `isAdmin` is settled by trying to read /admins/{uid}. The rules only permit
   that read to an actual admin, so a refusal is the answer, not an error —
   which means the client cannot promote itself by lying about this. */
export async function session(force) {
  if (_session && !force) return _session;
  const fb = await firebase();
  if (!fb) return null;

  const user = fb.auth.currentUser;
  if (!user) { _session = null; return null; }

  const email = String(user.email || '').toLowerCase();

  // Two ways to be the team. The shared account is known by its address; a named
  // account by a document at /admins/{uid}. Only ask the database when needed.
  //
  // This flag decides what the PAGE shows. It is not what protects anything —
  // the rules make the same decision independently on every read and write, so a
  // client that lied here would simply be refused.
  let isAdmin = (email === TEAM_EMAIL);
  if (!isAdmin) {
    try {
      const snap = await fb.fs.getDoc(fb.fs.doc(fb.db, 'admins', user.uid));
      isAdmin = snap.exists();
    } catch (e) { isAdmin = false; }   // permission-denied === not an admin
  }

  let slug = null;
  if (email.endsWith('@' + CLUB_EMAIL_DOMAIN)) {
    const candidate = email.slice(0, -('@' + CLUB_EMAIL_DOMAIN).length);
    if (SLUG_TO_CLUB.has(candidate)) slug = candidate;
  }

  _session = {
    uid: user.uid,
    email: email,
    isAdmin: isAdmin,
    clubSlug: slug,
    club: slug ? SLUG_TO_CLUB.get(slug) : null
  };
  return _session;
}

export async function waitForAuth() {
  const fb = await firebase();
  if (!fb) return null;
  const authMod = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
  await new Promise(function (resolve) {
    const stop = authMod.onAuthStateChanged(fb.auth, function () { stop(); resolve(); });
  });
  return session(true);
}

export async function signInClub(club, pin) {
  const fb = await firebase();
  const authMod = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
  await authMod.signInWithEmailAndPassword(fb.auth, clubEmail(club), String(pin));
  return session(true);
}

/* The team's own PIN, on the shared account. Same mechanism as a Club: Firebase
   checks it, not this page. */
export async function signInTeamPin(pin) {
  return signInTeam(TEAM_EMAIL, pin);
}

export async function signInTeam(email, password) {
  const fb = await firebase();
  const authMod = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
  await authMod.signInWithEmailAndPassword(fb.auth, String(email).trim(), String(password));
  return session(true);
}

export async function signOutNow() {
  const fb = await firebase();
  const authMod = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
  _session = null;
  await authMod.signOut(fb.auth);
}

/* Firebase's error codes are precise but unreadable. A Club that fat-fingers a
   digit should be told that, not shown "auth/invalid-credential". */
export function friendlyAuthError(err) {
  const code = (err && err.code) ? err.code : '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/invalid-login-credentials':
      return 'That PIN is not right. Check the digits and try again.';
    case 'auth/user-not-found':
      return 'That account has not been set up yet. If you are a Club, let the ' +
             'membership team know; if you are the team, create the account first ' +
             '(see provision/SETUP.md).';
    case 'auth/too-many-requests':
      return 'Too many attempts. Firebase has paused sign-in for this Club for a ' +
             'few minutes — wait, then try again.';
    case 'auth/network-request-failed':
      return 'No connection to the sign-in service. Check the network and try again.';
    case 'auth/user-disabled':
      return 'This Club’s access has been switched off. Contact the membership team.';
    case 'auth/invalid-email':
      return 'That email address is not valid.';
    default:
      return (err && err.message) ? err.message : 'Sign-in failed.';
  }
}

/* ------------------------------------------------------------------ gate -- */
const GATE_CSS = `
.gate-back{ position:fixed; inset:0; z-index:80; background:#122019; overflow-y:auto;
  font-family:'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif; }
.gate-mid{ max-width:430px; margin:8vh auto 40px; padding:0 22px; }
.gate-card{ background:#fbf9f3; border:1px solid #d9d0b8; border-top:3px solid #b8922f;
  border-radius:3px; padding:30px 28px 26px; }
.gate-eyebrow{ font-size:10px; letter-spacing:0.28em; text-transform:uppercase;
  color:#b8922f; font-weight:700; text-align:center; margin-bottom:9px; }
.gate-card h2{ margin:0 0 7px; font-size:21px; font-weight:400; color:#1f3a2e; text-align:center; }
.gate-card .gate-sub{ font-size:13.5px; color:#6a6552; line-height:1.55; text-align:center; margin:0 0 20px; }
.gate-tabs{ display:flex; margin:0 0 20px; }
.gate-tabs button{ flex:1 1 0; font-family:inherit; font-size:11px; letter-spacing:0.09em;
  text-transform:uppercase; padding:8px 6px; cursor:pointer; background:transparent;
  border:1px solid #d9d0b8; color:#8a8267; margin-left:-1px; }
.gate-tabs button:first-child{ margin-left:0; border-radius:2px 0 0 2px; }
.gate-tabs button:last-child{ border-radius:0 2px 2px 0; }
.gate-tabs button.on{ background:#1f3a2e; border-color:#1f3a2e; color:#f4efe2; font-weight:700; }
.gate-f{ margin-bottom:15px; }
.gate-f label{ display:block; font-size:10px; letter-spacing:0.14em; text-transform:uppercase;
  color:#8a8267; margin-bottom:5px; font-weight:600; }
.gate-f select, .gate-f input{ width:100%; font-family:inherit; font-size:15px; padding:11px 12px;
  background:#fff; border:1px solid #d9d0b8; border-radius:2px; color:#1b241d; box-sizing:border-box; }
.gate-f input#gate-pin, .gate-f input#gate-teampin{
  font-size:26px; letter-spacing:0.42em; text-align:center; padding-left:24px; }
.gate-f input#gate-teampin{ font-size:21px; letter-spacing:0.26em; }
.gate-f select:focus, .gate-f input:focus{ outline:2px solid #b8922f; outline-offset:1px; }
.gate-go{ width:100%; font-family:inherit; font-size:13px; letter-spacing:0.06em;
  text-transform:uppercase; font-weight:700; padding:12px; margin-top:5px; cursor:pointer;
  background:#b8922f; color:#122019; border:1px solid #b8922f; border-radius:2px; }
.gate-go:hover:not(:disabled){ background:#d8b968; }
.gate-go:disabled{ opacity:0.5; cursor:not-allowed; }
.gate-msg{ font-size:13px; line-height:1.5; margin:13px 0 0; min-height:18px; color:#9c3a2c; }
.gate-note{ font-size:12px; color:#8a8267; line-height:1.6; margin:18px 0 0; text-align:center; }
.gate-who{ display:flex; align-items:center; justify-content:center; gap:10px; flex-wrap:wrap;
  padding:9px 18px; background:#0c1610; color:#c9c4b3; font-size:12px; letter-spacing:0.04em;
  border-bottom:1px solid rgba(216,185,104,0.22); }
.gate-who b{ color:#d8b968; font-weight:600; }
.gate-who button{ font-family:inherit; font-size:10.5px; letter-spacing:0.08em;
  text-transform:uppercase; background:transparent; border:1px solid rgba(216,185,104,0.45);
  color:#c9c4b3; padding:4px 11px; border-radius:2px; cursor:pointer; }
.gate-who button:hover{ color:#d8b968; border-color:#d8b968; }
@media print{ .gate-who, .gate-back{ display:none !important; } }
`;

function injectCss() {
  if (document.getElementById('gate-css')) return;
  const st = document.createElement('style');
  st.id = 'gate-css';
  st.textContent = GATE_CSS;
  document.head.appendChild(st);
}

/* A bar naming who is signed in, with the way out. Shown on every gated page so
   a Club is never confused about which Club it is answering as — the old
   dropdown let someone file Toledo's answers under Balcones by accident. */
function showWhoBar(sess) {
  injectCss();
  const old = document.getElementById('gate-who');
  if (old) old.remove();
  const bar = document.createElement('div');
  bar.className = 'gate-who';
  bar.id = 'gate-who';
  bar.innerHTML = '<span>Signed in as <b>' +
    (sess.club ? sess.club : (sess.isAdmin ? 'Century Golf membership team' : sess.email)) +
    '</b></span><button type="button" id="gate-out">Sign out</button>';
  document.body.insertBefore(bar, document.body.firstChild);
  document.getElementById('gate-out').addEventListener('click', async function () {
    await signOutNow();
    location.reload();
  });
}

/* Gate a page.
     need: 'club'  — a Club account, or an admin (admins may look at any page)
           'admin' — the membership team only
   Resolves with the session once the visitor is entitled to be here. */
export async function gate(need) {
  injectCss();
  const sess = await waitForAuth();

  if (sess && (need === 'club' ? (sess.clubSlug || sess.isAdmin) : sess.isAdmin)) {
    showWhoBar(sess);
    return sess;
  }
  if (sess) {
    // Signed in, but not for this page. Say so rather than looping the form.
    //
    // The first admin is a special case worth handling properly: nobody can be
    // on the /admins list until someone adds them, and to add yourself you need
    // your own Auth UID, which is otherwise buried in the console. So show it.
    let note;
    if (need === 'admin' && !sess.clubSlug) {
      note = 'Signed in as ' + sess.email + ', which is neither the team account nor ' +
             'on the admin list. Either use the shared Admin PIN, or add this account ' +
             'by creating a document in Firestore at  admins/' + sess.uid +
             '  — then reload.';
    } else {
      note = 'You are signed in as ' + (sess.club || sess.email) +
             ', which does not have access to this page.';
    }
    await signOutNow();
    return await renderGate(need, note);
  }
  return await renderGate(need, '');
}

function renderGate(need, note) {
  return new Promise(function (resolve) {
    const back = document.createElement('div');
    back.className = 'gate-back';
    back.id = 'gate-back';

    const teamOnly = (need === 'admin');
    back.innerHTML =
      '<div class="gate-mid"><div class="gate-card">' +
        '<div class="gate-eyebrow">Century Golf Partners</div>' +
        '<h2>Membership Core Fundamentals</h2>' +
        '<p class="gate-sub">' + (teamOnly
          ? 'Results are for the membership team. Enter the Admin PIN to continue.'
          : 'Sign in with your Club’s PIN. You will only ever see your own Club’s work.') +
        '</p>' +
        (teamOnly ? '' :
        '<div class="gate-tabs">' +
          '<button type="button" data-tab="club" class="on">My Club</button>' +
          '<button type="button" data-tab="team">Membership team</button>' +
        '</div>') +
        '<form id="gate-club-form" style="' + (teamOnly ? 'display:none;' : '') + '">' +
          '<div class="gate-f"><label for="gate-club">Your Club</label>' +
            '<select id="gate-club"><option value="">Select your Club…</option></select></div>' +
          '<div class="gate-f"><label for="gate-pin">Club PIN</label>' +
            '<input type="password" id="gate-pin" inputmode="numeric" autocomplete="off" ' +
            'maxlength="24" aria-label="Club PIN"></div>' +
          '<button type="submit" class="gate-go" id="gate-club-go">Sign in</button>' +
        '</form>' +
        '<form id="gate-team-form" style="' + (teamOnly ? '' : 'display:none;') + '">' +
          '<div class="gate-f" id="gate-teampin-wrap">' +
            '<label for="gate-teampin">Admin PIN</label>' +
            '<input type="password" id="gate-teampin" inputmode="numeric" ' +
            'autocomplete="off" maxlength="40" aria-label="Admin PIN">' +
          '</div>' +
          '<div class="gate-f" id="gate-email-wrap" style="display:none;">' +
            '<label for="gate-email">Email</label>' +
            '<input type="email" id="gate-email" autocomplete="username"></div>' +
          '<div class="gate-f" id="gate-pw-wrap" style="display:none;">' +
            '<label for="gate-pw">Password</label>' +
            '<input type="password" id="gate-pw" autocomplete="current-password"></div>' +
          '<button type="submit" class="gate-go" id="gate-team-go">Sign in</button>' +
          '<p style="margin:13px 0 0;text-align:center;">' +
            '<a href="#" id="gate-named" style="font-size:12px;color:#7d6320;">' +
            'Use a named account instead</a></p>' +
        '</form>' +
        '<p class="gate-msg" id="gate-msg">' + (note || '') + '</p>' +
        '<p class="gate-note">Lost your PIN? Ask the Century Golf membership team — ' +
          'they can reset it. Your saved answers are never affected.</p>' +
      '</div></div>';

    document.body.appendChild(back);

    const sel = back.querySelector('#gate-club');
    CLUBS.forEach(function (c) {
      const o = document.createElement('option');
      o.value = c; o.textContent = c;
      sel.appendChild(o);
    });
    // Offer back the Club this browser used last — one less thing to get wrong.
    try {
      const last = window.localStorage.getItem('cgp-cf-club');
      if (last && CLUBS.indexOf(last) > -1) sel.value = last;
    } catch (e) { /* storage may be blocked */ }

    const msg = back.querySelector('#gate-msg');
    function say(t) { msg.textContent = t || ''; }
    if (note && note.length > 90) {
      // A long note is the first-admin instruction; let it read as guidance
      // rather than an error, and make the UID easy to copy.
      msg.style.color = '#5a5544';
      msg.style.userSelect = 'all';
    }

    back.querySelectorAll('.gate-tabs button').forEach(function (b) {
      b.addEventListener('click', function () {
        back.querySelectorAll('.gate-tabs button').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        const club = b.dataset.tab === 'club';
        back.querySelector('#gate-club-form').style.display = club ? '' : 'none';
        back.querySelector('#gate-team-form').style.display = club ? 'none' : '';
        say('');
      });
    });

    async function attempt(btn, fn) {
      btn.disabled = true;
      say('');
      try {
        const s = await fn();
        if (need === 'admin' && !s.isAdmin) {
          await signOutNow();
          say('That account is not on the membership team list.');
          btn.disabled = false;
          return;
        }
        if (need === 'club' && !s.clubSlug && !s.isAdmin) {
          await signOutNow();
          say('That account is not linked to a Club.');
          btn.disabled = false;
          return;
        }
        back.remove();
        showWhoBar(s);
        resolve(s);
      } catch (err) {
        console.error(err);
        say(friendlyAuthError(err));
        btn.disabled = false;
      }
    }

    back.querySelector('#gate-club-form').addEventListener('submit', function (e) {
      e.preventDefault();
      const club = sel.value, pin = back.querySelector('#gate-pin').value.trim();
      if (!club) { say('Choose your Club first.'); return; }
      if (!pin) { say('Enter your Club PIN.'); return; }
      try { window.localStorage.setItem('cgp-cf-club', club); } catch (e2) {}
      attempt(back.querySelector('#gate-club-go'), function () { return signInClub(club, pin); });
    });

    // The shared Admin PIN is the front door. A named email account is the same
    // privilege with a name attached — same form, one link away.
    let namedMode = false;
    back.querySelector('#gate-named').addEventListener('click', function (e) {
      e.preventDefault();
      namedMode = !namedMode;
      back.querySelector('#gate-teampin-wrap').style.display = namedMode ? 'none' : '';
      back.querySelector('#gate-email-wrap').style.display = namedMode ? '' : 'none';
      back.querySelector('#gate-pw-wrap').style.display = namedMode ? '' : 'none';
      e.target.textContent = namedMode ? 'Use the shared Admin PIN instead'
                                       : 'Use a named account instead';
      say('');
      back.querySelector(namedMode ? '#gate-email' : '#gate-teampin').focus();
    });

    back.querySelector('#gate-team-form').addEventListener('submit', function (e) {
      e.preventDefault();
      const go = back.querySelector('#gate-team-go');
      if (namedMode) {
        const email = back.querySelector('#gate-email').value.trim();
        const pw = back.querySelector('#gate-pw').value;
        if (!email || !pw) { say('Enter both an email and a password.'); return; }
        attempt(go, function () { return signInTeam(email, pw); });
        return;
      }
      const pin = back.querySelector('#gate-teampin').value.trim();
      if (!pin) { say('Enter the Admin PIN.'); return; }
      attempt(go, function () { return signInTeamPin(pin); });
    });

    const first = teamOnly ? back.querySelector('#gate-teampin')
                           : (sel.value ? back.querySelector('#gate-pin') : sel);
    if (first) first.focus();
  });
}
