# Mumu: Firebase and GitHub setup

Mumu uses the **same Firebase project** as Journall OS, Kit Runs and Family
Tree, so Google sign-in, Firestore and the `VITE_FIREBASE_*` GitHub secrets are
already in place. These are the extra steps, in order.

The Firebase console's left menu has been reorganised over time. Where a
step says "Hosting", look under **Build**, or under **Hosting & Serverless**
in the newer layout. "Authentication" may sit under **Security**.

---

## Phase 1

### 1. Turn on Firebase Hosting (2 minutes)

1. Go to <https://console.firebase.google.com> and open the project Journall
   uses. It's the one whose project ID matches the `VITE_FIREBASE_PROJECT_ID`
   GitHub secret, also shown under ⚙️ **Project settings → General**. Note
   the **Project ID**; you need it below.
2. Left menu → **Hosting** → **Get started**.
3. The wizard shows CLI instructions. You don't need to run them: click
   **Next**, **Next**, then **Continue to console**.
4. You now have a site at `https://<project-id>.web.app` (it's empty until
   the first deploy).
5. Left menu → **Authentication** → **Settings** tab → **Authorized
   domains**. Check that both `<project-id>.web.app` and
   `<project-id>.firebaseapp.com` are listed. They normally are by default.
   If either is missing, click **Add domain** and add it.
6. Still in Authentication → **Sign-in method**: check **Google** is
   **Enabled**. It already is, because Journall uses it.

### 2. Create a deploy key for GitHub (5 minutes)

GitHub needs a service account that's only allowed to deploy Hosting.

1. Go to <https://console.cloud.google.com/iam-admin/serviceaccounts> and
   pick the **same project** in the project picker at the top.
2. **+ Create service account**.
   - Name: `github-mumu-deploy` → **Create and continue**.
   - Add these roles, one at a time (type the name in the role box). They
     match what Firebase's own GitHub setup command grants:
     - **Firebase Hosting Admin**
     - **API Keys Viewer**
     - **Firebase Authentication Admin**
     - **Cloud Run Viewer**
   - **Continue** → **Done**.
3. Click the new service account → **Keys** tab → **Add key** → **Create
   new key** → **JSON** → **Create**. A `.json` file downloads.
4. Don't email this file or put it anywhere else. After step 3 below,
   delete it from your Downloads folder.

### 3. Add GitHub secrets

Go to <https://github.com/markd20344/journall-app/settings/secrets/actions>
→ **New repository secret**:

| Name | Value |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT` | The **entire contents** of the downloaded JSON file. Open it in Notepad, select all, copy and paste. |

The `VITE_FIREBASE_*` secrets already exist (the Journall deploy uses them).

### 4. First deploy

Either:
- merge the Mumu branch into `main` (via a pull request), and the
  **"Mumu — test and deploy to Firebase Hosting"** workflow runs by itself,
  **or**
- GitHub → **Actions** → that workflow → **Run workflow** → choose the
  branch → **Run workflow**.

It takes about 5 minutes (it runs all the tests first). When it's green,
open `https://<project-id>.web.app`.

### 5. Sign in once, then lock Mumu to your account

1. Open `https://<project-id>.web.app` and **Sign in with Google** as
   `marka.byrne203@gmail.com`.
2. Firebase console → **Authentication** → **Users**. Find that email and
   copy its **User UID** (hover over the row and click the copy icon). It
   looks like `Xy12AbC...` (28 characters).
3. **Send the UID to Claude.** It goes into `firestore.rules` and
   `storage.rules` (a UID is safe to have in a public repo; an email address
   isn't).
4. Add one more GitHub secret: `MUMU_OWNER_UID` = the UID. This makes the
   app sign out any other Google account straight away.

### 6. Publish the security rules (after Claude has committed your UID)

1. Firebase console → **Firestore Database** → **Rules** tab. Replace
   everything with the contents of `firestore.rules` from the repo →
   **Publish**.
2. **Storage** → **Rules** tab. Replace everything with `storage.rules` →
   **Publish**.

Kit Runs and Journall OS keep working because they're your account too.
Family Tree relatives are unaffected.

### 7. Install on your phone and PC

- **iPhone**: open `https://<project-id>.web.app` in **Safari** → **Share**
  button → **Add to Home Screen** → **Add**. Open it from the icon and sign
  in once.
- **PC** (Chrome or Edge): open the same address → the install icon at the
  right-hand end of the address bar → **Install**.

When a new version is deployed, the app shows "A new version of Mumu is
ready". Tap **Refresh now** when you're not mid-edit.

---

## Phase 4 (later): daily email digest

These steps will be filled in when Phase 4 starts: upgrade to the Blaze plan
with a £1 budget alert, create a Gmail app password, and store it in Secret
Manager.
