# Gifteez

Gifteez is a private gift tracker. The list lives on this phone. There is no sign-up form and no shared list. The phone keeps an encrypted copy, and that copy is the list. Settings can export it as a versioned JSON backup and restore it after a confirm. Firebase anonymous auth still runs in the background, with no UI, so cloud gift ideas and purchase checks have a user id. The OpenAI key stays in Cloud Functions.

## Run it

The only manual step before a simulator or emulator build is copying `.env.example` to `.env` and filling in the Firebase values. Cloud ideas also need the OpenAI key stored as a Functions secret, which is not required to open the app.

1. Install the [React Native environment](https://reactnative.dev/docs/set-up-your-environment) for iOS and Android (Xcode, CocoaPods, Android Studio, a JDK). This repo targets Node 22.
2. From the repo root:

```sh
cp .env.example .env
```

3. In the [Firebase console](https://console.firebase.google.com), create a project (Blaze, so Functions are available). Register an iOS app and an Android app with the id `com.gifteez`. Copy these fields into `.env`:

   - `FIREBASE_API_KEY`
   - `FIREBASE_AUTH_DOMAIN`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_STORAGE_BUCKET`
   - `FIREBASE_MESSAGING_SENDER_ID`
   - `FIREBASE_IOS_APP_ID`
   - `FIREBASE_ANDROID_APP_ID`

   Leave `OPENAI_API_KEY` as the placeholder `sk-your-openai-key-server-only`. `react-native-config` compiles every `.env` value into the app binary. The real key is set only as a Cloud Functions secret (below).

4. In Firebase Authentication, enable Anonymous. The app signs in that way with no screen. Email link and phone sign-in are not used.

5. Install and run:

```sh
npm install
npm run ios
npm run android
```

`npm run ios` runs `npm run pods`, then `react-native run-ios`. `npm run pods` is `bundle install`, then `RCT_NEW_ARCH_ENABLED=1 bundle exec pod install` in `ios/`. Run `npm run pods` by itself when you only want to refresh pods. Automatic CocoaPods installation from the CLI is off (`react-native.config.js`), because CLI 20 has no `--no-install` flag and otherwise runs `pod install` with `RCT_NEW_ARCH_ENABLED=0` whenever `ios/Pods/Pods.xcodeproj` is missing. The Podfile also sets that variable to `1` before any podspec loads, so `cd ios && bundle exec pod install` still works if the shell variable is unset or `0`.

`npm run ios` and `npm run android` create `ios/Gifteez/GoogleService-Info.plist`, `android/app/google-services.json`, and `.firebaserc` from `.env` (or from `.env.example` if `.env` is missing) only when those files are absent. An existing file is left alone, including a plist or `.firebaserc` you downloaded from the Firebase console. Delete a file if you want it regenerated. The native config files are gitignored. Do not commit them after you put in a real project. Changing `.env` requires a native rebuild; restarting Metro is not enough.

If the Firebase values are still the placeholders, the app opens on a screen that names the missing keys. It does not try to sign in. On iOS, `FirebaseApp.configure()` runs only when `GoogleService-Info.plist` is in the app and its values are not placeholders, so a missing plist does not crash before JavaScript. `npm run ios` writes that plist when it is missing, then installs pods. It does not overwrite a plist or `.firebaserc` that is already on disk. The first pod install after this change links `FirebaseCore` into the app target. A Metro restart does not pick up a new plist or that native link.

### iOS pods

React Native Firebase 27 pulls the Firebase Apple SDK through Swift Package Manager, and that requires `use_frameworks! :linkage => :dynamic` in `ios/Podfile`. That line is already there, and `post_integrate` asks the React Native Firebase hook to add the `FirebaseCore` product to the Gifteez target so `AppDelegate.swift` can import it. `ios/Podfile.lock` in git is still the scaffold lock from before these native modules were added. `npm run pods` on a Mac refreshes it and writes the package link into the Xcode project. The Gemfile already requires CocoaPods `>= 1.13` excluding `1.15.0` and `1.15.1`.

### What to tap tonight

- Start by adding one person. Skip the relationship if you want. The list is on this phone either way.
- Open the person to see on-device ideas. Save one, log a purchase with a price, and open Fairness.
- In Settings, Export backup shares `gifteez-backup.json` through the phone's share sheet. Restore from backup asks before it replaces the list.

## Deploy the backend

On-device ideas, the people list, and the encrypted backup do not need this. Cloud ideas and purchase verification do. There is no join site to host.

```sh
npm install -g firebase-tools
firebase login
cp functions/.env.example functions/.env
firebase functions:secrets:set OPENAI_API_KEY
firebase functions:secrets:set FINGERPRINT_PEPPER
npm run deploy
```

`npm run deploy` writes the native Firebase files from `.env`, then runs `firebase deploy` (Functions, Firestore rules and indexes, and Storage rules). `firebase deploy --only functions` works after `npm run prepare-config`.

Functions secrets must exist before the first deploy of `generateGiftIdeas`, `getEntitlement`, and `verifyUnlock`. `FINGERPRINT_PEPPER` is a random string you choose; it salts the device-id hash that keys the AI cap and the paid entitlement. It is not an app `.env` value. The dev project for a later rules deploy is `gifteez-dev-d1512`. Do not deploy it until you mean to.

App Check is initialized in the app (debug provider in dev, App Attest / Play Integrity in release) and `enforceAppCheck` is on for every callable. In the Firebase console, turn App Check on for the app, then register the debug token the client prints and set `APP_CHECK_DEBUG_TOKEN` in `.env`. Rebuild after that. Until the token is registered, cloud calls fail and the on-device ideas still show. Gifteez reports that as a permission problem (register the debug token), not as being offline.

Purchase verification reads optional Apple and Play credentials from `functions/.env` (`APPLE_IAP_*`, `GOOGLE_PLAY_SERVICE_ACCOUNT`). Leave them blank until the store products exist. The function then returns `{ verified: false, reason: "not_configured" }` and does not grant the unlock. The app should still launch when the store has no `gifteez_unlock` product. Completing a sandbox purchase on the iOS simulator needs a StoreKit configuration file in Xcode, which is not in this repo.

Upload `skins/spring.json` and `skins/summer.json` to Cloud Storage as `skins/spring.json` and `skins/summer.json`. Create a Remote Config parameter named `active_skin` (string, default `auto`). Fall and winter ship in the app. Spring and summer download when Remote Config selects them, and a failed download uses the base theme.

Set a Google Cloud billing budget alert on the Firebase project before real traffic. Confirm the current OpenAI price for `OPENAI_MODEL` (default `gpt-4o-mini`) on OpenAI's pricing page and cap that spend too. A five-idea reply is a short request; the server cap (5 fresh generations per person on the free tier, 20 per person per UTC month when paid) is the abuse backstop. Only a refresh that misses the server cache counts.

## Backup

Settings exports every local list as `gifteez-backup.json` through the share sheet: people (including budgets and relationship labels), occasions, ideas, gifts, and purchases. The app unlock is not in the file. Restore pastes that JSON, checks the version and the shape, and asks before it replaces the list on this phone. `npm run prepare-config` strips leftover join links. It does not put associated domains or `/join` intent filters back.

If the Apple App ID still has Associated Domains turned on for `applinks:gifteez.app`, turn that capability off. The entitlements file no longer asks for it. The Xcode `CODE_SIGN_ENTITLEMENTS` build setting is unchanged.

## Assets

Icons, the launch screen, empty-state art, seasonal motifs, and the store graphics are generated from `assets/src/*.svg`. `npm run assets` writes the PNGs (iOS app icon set, Android adaptive icon, splash, `src/assets`, and `assets/store`). Both the SVGs and the PNGs are committed. You do not replace them before a simulator run. The store frames are composed pictures of the UI, not captures from a booted simulator.

## Encryption

User content is encrypted on the device with AES-256-GCM (`@noble/ciphers`) before it is written to the local cache. The device cache key lives in the iOS Keychain or Android Keystore. Firestore does not hold the list.

An explicit cloud-idea request sends the prompt (name, tags, occasion, budget, thumbs) to the Cloud Function, which calls OpenAI. The key is a Functions secret. Prompts are not written to logs.

## Limits that are intentional

- A free phone holds 5 people. `gifteez_unlock`, bought with react-native-iap on the App Store or Google Play, removes that cap. `verifyUnlock` and `getEntitlement` record the purchase on `entitlements/{fingerprint}` and `accounts/{uid}`. Clients cannot write those documents. `recheckEntitlements` clears the unlock when the store says the purchase was revoked.
- Reinstalling creates new person ids, so the per-person AI counters start over. The same device id and the same person ids keep their counts. The cap is not the anonymous uid. Export is how the list moves to another phone.
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
