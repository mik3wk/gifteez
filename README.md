# Gifteez

Gifteez is a private gift tracker. The first screen is one sentence plus Start and Join. There is no sign-up form. Firebase anonymous auth is created in the background, and Firestore is the source of truth. The phone keeps an encrypted cache so the list still works offline.

## Run it

The only manual step before a simulator or emulator build is copying `.env.example` to `.env` and filling in the Firebase values. Cloud ideas also need the OpenAI key stored as a Functions secret, which is not required to open the app.

1. Install the [React Native environment](https://reactnative.dev/docs/set-up-your-environment) for iOS and Android (Xcode, CocoaPods, Android Studio, a JDK). This repo targets Node 22.
2. From the repo root:

```sh
cp .env.example .env
```

3. In the [Firebase console](https://console.firebase.google.com), create a project (Blaze, so Functions and phone auth are available). Register an iOS app and an Android app with the id `com.gifteez`. Copy these fields into `.env`:

   - `FIREBASE_API_KEY`
   - `FIREBASE_AUTH_DOMAIN`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_STORAGE_BUCKET`
   - `FIREBASE_MESSAGING_SENDER_ID`
   - `FIREBASE_IOS_APP_ID`
   - `FIREBASE_ANDROID_APP_ID`

   Leave `OPENAI_API_KEY` as the placeholder `sk-your-openai-key-server-only`. `react-native-config` compiles every `.env` value into the app binary. The real key is set only as a Cloud Functions secret (below).

4. In Firebase Authentication, enable Anonymous and Email link. Phone is optional and the app only sends US numbers (`+1` and 10 digits). The magic-link continue URL is `https://<FIREBASE_AUTH_DOMAIN>/email-link`, so you do not need `gifteez.app` authorized before email sign-in works.

5. Install and run:

```sh
npm install
cd ios && bundle install && bundle exec pod install && cd ..
npm run ios
npm run android
```

`npm run ios` and `npm run android` generate `ios/Gifteez/GoogleService-Info.plist` and `android/app/google-services.json` from `.env` (or from `.env.example` if `.env` is missing). Those files are gitignored. Do not commit them after you put in a real project. Changing `.env` requires a native rebuild; restarting Metro is not enough.

If the Firebase values are still the placeholders, the app opens on a screen that names the missing keys. It does not try to sign in.

### iOS pods

React Native Firebase 27 pulls the Firebase Apple SDK through Swift Package Manager, and that requires `use_frameworks! :linkage => :dynamic` in `ios/Podfile`. That line is already there. `ios/Podfile.lock` in git is still the scaffold lock from before these native modules were added. `bundle exec pod install` on a Mac refreshes it. This environment has no Ruby or CocoaPods, so the lockfile was not regenerated here.

### What to tap tonight

- Start, keep or edit the silly name, and skip email if you want. The group is created either way. A recovery code is shown once; it is also saved in the Keychain on that phone.
- Add a person, then tap interest tags. Open the person to see on-device ideas. Save one, log a purchase with a price, and open Fairness.
- Share the invite from the group screen. The message contains an `https://gifteez.app/...#k=...` link and a `gifteez://join/...#k=...` link. The key is the URL fragment and is not sent to Firestore.
- Paste the `gifteez://` link on a second simulator with `xcrun simctl openurl booted 'gifteez://join/...'` or, on Android, `adb shell am start -W -a android.intent.action.VIEW -d 'gifteez://join/...'`. That opens a confirm screen (emoji, color, and the list label, or "Shared list"). The list is joined only after Join. Cancel leaves it. A link that arrives before the app is ready, or before onboarding, waits and then opens the same screen.
- `https://gifteez.app` links open the app only after the join site is deployed and the domain points at Firebase Hosting. Until then, use the custom scheme. See "Invite link site" below.

## Deploy the backend

On-device ideas, the people list, purchases, and offline cache do not need this. Cloud ideas, the server people-slot check, joining a group from another phone, and purchase verification do.

```sh
npm install -g firebase-tools
firebase login
cp functions/.env.example functions/.env
firebase functions:secrets:set OPENAI_API_KEY
firebase functions:secrets:set FINGERPRINT_PEPPER
npm run deploy
```

`npm run deploy` writes the native Firebase files and the Hosting join page from `.env`, then runs `firebase deploy` (Functions, Firestore rules and indexes, Storage rules, and Hosting). `firebase deploy --only functions` and `firebase deploy --only hosting` also work after `npm run prepare-config`. Hosting is the join site in the next section. Deploy it only after the domain steps there, or the default Hosting URL will publish the page before `gifteez.app` points at it.

Functions secrets must exist before the first deploy of `generateGiftIdeas`, `claimPersonSlot`, `getEntitlement`, `verifyUnlock`, and `createOwnedGroup`. `joinGroup` and `releaseOwnedGroup` do not use those secrets. `FINGERPRINT_PEPPER` is a random string you choose; it salts the device-id hash that keys the AI cap and the paid entitlement. It is not an app `.env` value.

App Check is initialized in the app (debug provider in dev, App Attest / Play Integrity in release) and `enforceAppCheck` is on for every callable. In the Firebase console, turn App Check on for the app, then register the debug token the client prints and set `APP_CHECK_DEBUG_TOKEN` in `.env`. Rebuild after that. Until the token is registered, cloud calls fail and the on-device ideas still show.

Purchase verification reads optional Apple and Play credentials from `functions/.env` (`APPLE_IAP_*`, `GOOGLE_PLAY_SERVICE_ACCOUNT`). Leave them blank until the store products exist. The function then returns `{ verified: false, reason: "not_configured" }` and does not grant the unlock. The app should still launch when the store has no `gifteez_unlock` product. Completing a sandbox purchase on the iOS simulator needs a StoreKit configuration file in Xcode, which is not in this repo.

Upload `skins/spring.json` and `skins/summer.json` to Cloud Storage as `skins/spring.json` and `skins/summer.json`. Create a Remote Config parameter named `active_skin` (string, default `auto`). Fall and winter ship in the app. Spring and summer download when Remote Config selects them, and a failed download uses the base theme.

Set a Google Cloud billing budget alert on the Firebase project before real traffic. Confirm the current OpenAI price for `OPENAI_MODEL` (default `gpt-4o-mini`) on OpenAI's pricing page and cap that spend too. A five-idea reply is a short request; the server cap (5 fresh generations per person on the free tier, 20 per person per UTC month when paid) is the abuse backstop. Only a refresh that misses the server cache counts.

## Invite link site

Share text already includes `https://<INVITE_LINK_DOMAIN>/join/<group>?i=<invite>#k=<key>`. The key is the fragment after `#`. This repo hosts the page that URL opens when the app is not installed.

`hosting/` is the Firebase Hosting public directory. `npm run prepare-config` (also run by `npm run deploy`, `npm run ios`, and `npm run android`) fills it from `.env` or `.env.example`:

- `hosting/join/index.html` from `hosting/join/index.template.html`
- `hosting/.well-known/apple-app-site-association`
- `hosting/.well-known/assetlinks.json`

It also writes `INVITE_LINK_DOMAIN` into the Android `https` intent filter (`android/app/src/main/AndroidManifest.xml`, path `/join`) and the iOS associated domain (`ios/Gifteez/Gifteez.entitlements`, `applinks:<domain>`). The custom scheme stays `gifteez://join`. Changing the domain needs a native rebuild.

The join page has no analytics and no third-party scripts. Its content security policy blocks network calls from the page. The script reads `location.hash` only to build a `gifteez://` link and to copy `location.href`. The fragment is not sent to Firebase Hosting: browsers omit it from the request. Do not add a beacon, a rewrite that appends the fragment to a query string, or the Play Install Referrer. The referrer is stored by Google, so it cannot carry the key.

**Open in Gifteez** tries the custom scheme, which includes the key. The page does not jump to the store by itself. **Copy invite and open the App Store** or **Google Play** copies the full address, including `#k=`, and only then opens the store. The store URLs are `APP_STORE_URL` and `PLAY_STORE_URL`.

After install, the first screen has "Paste an invite". Focusing that field is what shows the iOS paste control. Gifteez does not read the clipboard on its own. Pasting opens the same confirm screen as a tapped link. Join still runs only from that screen. Android does not use Play Install Referrer.

Universal links can open the app from the `https` URL and drop the fragment. When that happens the app does not see the key and does not join. The copied invite is the path that still has the key. The custom scheme keeps the key when the app is already installed.

### What you do before `https://gifteez.app` works

These cannot be done from the repo:

1. In Apple Developer, note the 10-character Team ID. Put it in `.env` as `APPLE_TEAM_ID`. Leave it as `TEAMID` and the association file is a placeholder. Turn on the Associated Domains capability for `com.gifteez`. Signing fails until that capability is on the App ID and the Team ID is real. The entitlement is already `applinks:gifteez.app`.
2. Create the App Store listing and set `APP_STORE_URL` to `https://apps.apple.com/app/id<numeric id>`. The committed placeholder is `https://apps.apple.com/app/id0000000000`.
3. Create the Play listing for `com.gifteez`. Set `PLAY_STORE_URL` if it is not the default `https://play.google.com/store/apps/details?id=com.gifteez`.
4. Copy the SHA-256 of the Play app-signing certificate (Play Console, App integrity, App signing). Put it in `ANDROID_SHA256_CERT_FINGERPRINT` as 32 colon-separated hex bytes. The committed value is all zeros and will not verify. `keytool -list -v -keystore <release-keystore>` prints the same field for a keystore you hold.
5. `npm run prepare-config` then `firebase deploy --only hosting`. `firebase.json` serves `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` as `application/json` with no redirect. The ignore list does not skip dotfiles, so `.well-known` is uploaded. `/join/**` rewrites to the static page and does not redirect.
6. In Firebase Hosting, add the custom domain from `INVITE_LINK_DOMAIN` (default `gifteez.app`). At the DNS host, add the records the console shows (usually an `A` record to Firebase and a `TXT` record for ownership). Wait until the console says the domain is connected. Apple and Android fetch the well-known files from that domain, not from `*.web.app`.
7. Rebuild the iOS and Android apps after the domain, Team ID, and fingerprint are final so the entitlement and the intent filter match the live host.

Check `https://gifteez.app/.well-known/apple-app-site-association` returns JSON with `Content-Type: application/json` and no redirect, and `https://gifteez.app/.well-known/assetlinks.json` lists `com.gifteez` and the real fingerprint. Open `https://gifteez.app/join/example?i=example#k=secret` and confirm the address bar still ends in `#k=secret` and the network log has no request that contains `secret`.

## Several groups

A person can be in more than one list. A free account can start one of them and can join any number that other people start. The one-time unlock starts more. "Start another list" on the group screen opens the unlock when that free slot is already used. Deleting the only list you started frees the slot. Each list has an optional name. Leave the name blank and the label is the members' first names, such as `Mike, Sam & Jo`, with `+N` when the line would get long. An emoji and a color, chosen from the list id, show next to that label in the switcher, the screen headers, the share text, and the join preview.

The name is encrypted with the group key. Firestore does not store it in the clear. The invite document holds a ciphertext preview, and the key stays in the link fragment, so the join screen can show the name before you join.

## Assets

Icons, the launch screen, empty-state art, seasonal motifs, and the store graphics are generated from `assets/src/*.svg`. `npm run assets` writes the PNGs (iOS app icon set, Android adaptive icon, splash, `src/assets`, and `assets/store`). Both the SVGs and the PNGs are committed. You do not replace them before a simulator run. The store frames are composed pictures of the UI, not captures from a booted simulator.

## Encryption

User content is encrypted on the device with AES-256-GCM (`@noble/ciphers`) before it is written to Firestore or to the local cache. The device cache key lives in the iOS Keychain or Android Keystore. A group data key also lives there.

This is a working interim, not a full pairwise key agreement:

- The group key travels in the invite link fragment (`#k=`). Firebase and the app's own servers do not receive that fragment. The same key is shared with every member, up to 10.
- A 10-word recovery code wraps the group key with HKDF-SHA256. The wrapped key is stored at `users/{uid}/keys/{groupId}` and in the Keychain, so the same phone can show the code again. A second device signs in with the same email (the anonymous account is linked in place, so the UID stays) and unwraps with the code, or it opens the invite link again.
- Firestore stores ciphertext plus the fields the security rules need in plaintext: member ids, owner, people count, entitlement flag, and `updatedAt`. The server cannot read names, notes, prices, or ideas from those documents.
- An explicit cloud-idea request sends the decrypted prompt (name, tags, occasion, budget, thumbs) to the Cloud Function, which calls OpenAI. That path is not covered by the group encryption. Prompts and keys are not written to logs.
- There is no forward secrecy and no device-to-device ratchet. Anyone with the invite link can read the list. Treat the link like a password.

Offline edits are written to the encrypted cache and merged on reconnect. Last write wins per record. If a remote record is newer than the local one, the app shows "Updated on another device". Thumbs feedback stays on the phone and is not synced. Idea text is synced.

## Limits that are intentional

- A list can have one member so it is usable before anyone joins. The membership cap is 10 (`GROUP_MAX_MEMBERS`), enforced in the client, in `joinGroup`, and in the security rules. A full list says "This list already has 10 members, the most a list can have."
- A free account can start one list. `createOwnedGroup` is the only way to create a group: the rules deny direct creates, and the function keeps `accounts/{uid}.ownedGroupIds` where clients cannot write. A second list is refused for a free account and allowed after the unlock. Joining with `joinGroup` does not use that slot and is not limited by the joiner's tier. Deleting the only list you started (`releaseOwnedGroup`) frees it. The purchase record stays at `entitlements/{fingerprint}`; `verifyUnlock` and `getEntitlement` copy it onto the account and onto lists that account owns.
- The free gift-recipient cap is 5 on a list whose owner has not unlocked. The rules keep `peopleCount` at 5 unless that group's `entitled` flag is set, and only Functions set that flag, from the owner's account. `claimPersonSlot` follows the same owner flag, so a member's own purchase does not raise someone else's list, and adding people on an unlocked owner's list does not use up the free-device counter. The paid gift-recipient list is intentionally uncapped for now.
- Reinstalling creates new person ids, so the per-person AI counters start over. The same device id and the same person ids keep their counts. The cap is not the anonymous uid.
- The owner cannot leave while other members remain. The last member deletes the group. Another member can leave, and the owner can remove someone else.
- Imported people (contacts, calendar, or pasted CSV/JSON) do not get ideas until their screen is opened.
- On-device suggestions are a bundled catalog scored from the name, occasion, tags, and thumbs. They are not an on-device language model, and they do not call the network.

## Strings and skins

Every user-facing string is in `src/i18n/en-US.json`. Money and dates use `Intl` with the device locale. Layouts wrap instead of fixing a width to the English string. Skin files only change colors, so the layout stays the same. Winter is December 1 through January 15, spring March 20 through June 20, summer June 21 through August 31, fall September 1 through November 30, otherwise the base theme. `active_skin` can force an id or stay `auto`.

## Checks

```sh
npm run typecheck
npm test
npm run lint
npm --prefix functions test
```

Lint reports inline-style and bitwise warnings in the crypto helpers. It exits clean. `npm test` covers the crypto, invite links, sorting, budgets, import parser, caps, and the placeholder-config screen.
