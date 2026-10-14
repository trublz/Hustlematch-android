# HustleMatch — Android app (Capacitor)

This folder turns the HustleMatch web app into a native Android app and builds
a signed `.aab` ready for Google Play — all in the cloud, free.

**The web app in `../hustlematch` is the single source of truth.**
Never edit `www/` directly — it's rebuilt from `../hustlematch` on every build
(`bash scripts/build-www.sh`, also run automatically by the workflow).

## What's already done ✅

- Capacitor config (`capacitor.config.json`, app id `com.hustlematch.app`)
- GitHub Actions workflow (`.github/workflows/android-build.yml`) — builds **and signs**
  the release `.aab` on GitHub's servers. No Android SDK needed on your machine.
- App icon (`assets/icon.png`) — converted to all launcher sizes automatically.
- Firebase job-board sync (`../hustlematch/js/firebase-sync.js`) — completely inert
  until you paste a config; then employer posts sync across all users.

## What you do (all free)

### 1. Push this folder to GitHub (~10 min)
- Free account at https://github.com if you don't have one.
- New repository (e.g. `hustlematch-android`), upload/push this folder's contents.

### 2. Create your signing key (~5 min)
You need Java's `keytool` once. On a computer with Java, or **on your phone via
Termux** (`pkg install openjdk-17`):

```bash
keytool -genkeypair -v -keystore hustlematch.keystore -alias hustlematch \
  -keyalg RSA -keysize 2048 -validity 10000
```

It asks for a keystore password and your name/details — answer honestly.
Then base64-encode it:

```bash
base64 -w0 hustlematch.keystore
```

⚠️ **Back up `hustlematch.keystore` + both passwords somewhere safe**
(cloud drive, password manager). Lose the keystore = you can never update the
app again. Google can't recover it for you.

### 3. Add 4 secrets to the GitHub repo
Repo → Settings → Secrets and variables → Actions → **New repository secret**:

| Secret               | Value                                  |
| -------------------- | -------------------------------------- |
| `KEYSTORE_BASE64`    | the base64 output from step 2          |
| `KEY_ALIAS`          | `hustlematch`                          |
| `KEYSTORE_PASSWORD`  | the keystore password you chose        |
| `KEY_PASSWORD`       | the key password (often the same)      |

### 4. (Optional, free) Firebase — makes the job board live for everyone
Without this, employer posts stay on each user's own device (works fine).
With it, every post syncs to every user:

1. https://console.firebase.google.com → **Add project** (free Spark plan is fine)
2. Project settings → **Add app → Web** → copy the `firebaseConfig` object
3. Paste it into `../hustlematch/js/firebase-config.js` as `window.FIREBASE_CONFIG = {...}`
4. Build → Firestore Database → **Create database** → start in **test mode**
   (tighten the security rules before public launch — ask for help with this)
5. Commit + push — the next Actions run picks it up automatically

### 5. Build the .aab
Repo → **Actions** tab → **Build Android AAB** → **Run workflow** → enter a
version like `6.0.0` → wait ~5–10 min → download the signed `.aab` artifact.
That file is what gets uploaded to Play Console.

## Still waiting on the Play developer account ($25, whenever you're ready)
- Uploading the `.aab` to Play Console
- Store listing (screenshots, description — drafts can be written anytime)
- Real Google Sign-In (needs the SHA-1 fingerprint Play generates after your
  first upload; local profiles keep working until then)

## Useful commands (for a computer with Node)
```bash
bash scripts/build-www.sh   # refresh www/ from ../hustlematch
npx cap sync android        # push www/ into the Android project (CI does this too)
```
