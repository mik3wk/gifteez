# Gifteez Roadmap

> **End state:** an agent can be told to build everything in Phases 1–13. When it's done, the only manual step before testing on a simulator is filling in the environment variables from `.env.example`. If testing looks good, Phase 15 covers store submission (TestFlight and the Google Play internal testing track) using the Fastlane lanes.

Gifteez is a private, year-round gift tracker with gift ideas. It's one React Native codebase for iOS and Android, running on Firebase (Blaze plan).

## 0. Context and decisions (reference)

### Positioning: the three gaps
- **Fairness:** compare equal spend across recipients (kids, siblings, in-laws, grandkids).
- **Privacy:** no account form, local-first data, nothing shared with ad networks.
- **On-device AI:** free gift suggestions generated on the phone.
- Tiny new apps already pitch these but have no traction, and most are iOS-only: Giftbook (TestFlight beta), GiftSnitch, Primo, Giftmas, Holiday Gift Tracker and The Gift Journal.
- Big incumbents are account-based and run on affiliate links or ads: Elfster, DrawNames, Giftster, Giftful and GiftList.
- Closest trackers are Christmas Gift List Tracker (iOS), Santa's Bag (iOS) and Christmas Gift List (Android).
- Christmas Gift List Tracker users are unhappy with its new ads, paywall, broken sync and lack of data export, which makes them a switching opportunity.

### Name research
- Final name: **Gifteez**.
- These names were checked on Oct 22, 2026 against the US App Store and Google Play with no exact or close matches: Giftwell, Giftfair/Fairgift, Gift Coach, GiftKit, Giftroster, Giftpath and Evengift.
- These names are already taken by gift or lifestyle apps: Giftwise, GiftKeeper, GiftLedger, GiftLog, GiftNote, Gift Planner, Giftly, GiftCircle, GiftPal, Giftfolio and others.

### Firebase cost model (Blaze)
- The Spark plan won't work: it allows only 5 magic-link emails a day, and has no phone auth and no Cloud Functions.
- Estimated Firebase cost: about $0/month at 100 users, about $3/month at 1,000 and about $65–80/month at 10,000.
- Text messages are the main cost driver, at about $0.01 per US SMS. They're only sent for the optional text-code upgrade. Anonymous auth and magic links send no texts, so the real SMS cost should come in below the earlier estimate.
- Auth is free up to 50K monthly active users.
- Firestore's free quota is 50K reads and 20K writes a day.
- Cloud Functions include 2M free invocations a month.
- Calls to outside APIs are allowed and billed only as outbound data.
- LLM cost is extra. At Gemini Flash Lite rates it would be roughly $7/month at 1,000 users and $70/month at 10,000; OpenAI pricing is still to confirm.

### Unlimited AI use
- AI use will be capped rather than left open. Free users get on-device AI. Cloud AI is used only on explicit request, cached per person, with a counter enforced on the server.
- **AI caps (decided Oct 22, 2026):** 5 free refreshes per person, and 20 refreshes per person per month for paying users. The paid cap is a starting point, monitored for abuse and per-refresh API cost.

### Sign-in and data model (decided Oct 22, 2026)
- **Default sign-in:** Firebase anonymous auth, created invisibly on first open. There is no sign-in wall.
- **Source of truth:** the cloud (Firestore). Local storage is only an encrypted cache, not a separate data model.
- **Privacy:** end-to-end encryption is the intended approach, so even the server can't read user data.
- **Offline-first:** while offline, the app reads and writes the encrypted local copy. Changes merge to the cloud when the connection returns.
- **Account linking:** the app prompts the user to upgrade from anonymous to a permanent sign-in only when recovery matters:
  - starting a group
  - exporting or sharing a list
  - first opening the app on a second device

  Email magic link is the default upgrade path and a text code is optional. Firebase links the anonymous account to the permanent one in place, so the UID and data stay the same.
- **Lost phone:** the risk is accepted. After 30 days of use, show one subtle, dismissible banner suggesting the upgrade. It never blocks.
- **Offline conflicts:** last write wins, with a small "updated on another device" toast.
- **AI cap identity:** the refresh cap is not tied to the anonymous UID, because a reinstall would reset it. It's tied to a device ID plus a fingerprint hash stored on the server.
- **Cost:** anonymous auth sends no texts, so it has no SMS cost. Email magic link is the default upgrade path because texts are the main Firebase cost driver.
- **App assets (decided with the build):** the builder generates every app icon (including the Android adaptive icon), the launch screen, empty-state art, bundled seasonal motifs, and the store graphics from SVG sources in `assets/src`. The rasters are committed. Michael does not swap in replacement art before a simulator run.
- **Several groups (decided with the build):** one person can belong to more than one group. Each group has an optional name, set at creation and editable later in group settings. The name is user content and is stored only inside the group ciphertext, same as other user content. If no name is set, the label is the members' names joined (`Mike, Sam & Jo`), shortened with `+N` when it would run long. At 10 members that label stays short (`Mike, Sam & Jo +7`). A stable emoji and color, derived from the group id, mark the group in the switcher, headers, and invite preview. The invite preview ciphertext is on the invite document so the server still cannot read the name; the key stays in the link fragment.
- **Group size (decided with the build):** a group holds up to 10 members. These are families buying gifts together, and they are unlikely to go past about 10. A list can still start with one person. The same group key in the invite-link fragment is shared with every member, up to that cap. The paid gift-recipient list is intentionally uncapped for now. Membership is separate from the free-tier limit below.
- **Monetization (one list on the free tier):** a free account can start one list and keep up to 5 gift recipients on it. They can join any number of lists other people start. Joining is never limited by the joiner's tier. The $9.99 one-time unlock is per account, not per list. The purchase stays on `entitlements/{fingerprint}` (the device id hashed with the pepper; only Functions can write it) and is copied onto `accounts/{uid}`, which only Functions can write. Unlocking lets that account start more lists and removes the recipient cap on every list they own. Recipient limits follow the list owner: a paid member does not raise the cap on someone else's free list, and a free member can add past 5 people on a list whose owner has unlocked. Deleting the only list you started frees that slot. This closes the hole where a free user could start multiple lists. The rules cannot count owned groups, so direct creates are denied and `createOwnedGroup` is the only writer.
- **Claims, buyers, and private gifts:** "I'll get this" stores `claimedBy` and `claimedAt` on that year's occasion state. A logged purchase stores `boughtBy` on the gift. Both live inside the group ciphertext, so the rules still only see ciphertext. A gift left unchecked when two copies of a person are merged is stored at `users/{uid}/privateGifts/{id}`, sealed with the device key (not the group key), and shown only to that user on the group recipient. Merging never runs by itself. Deleting the source copy frees that list's recipient slot. The merge does not add a recipient on the target list, and it refuses if it would push a free list past 5.

## 1. Foundation
- [x] React Native 0.88 TypeScript scaffold for iOS and Android (`~/Documents/Projects/Gifteez`)
- [x] Initialize git and push to GitHub ([mik3wk/gifteez](https://github.com/mik3wk/gifteez), branch `master`)
- [ ] Run `npm run pods` (Podfile forces `RCT_NEW_ARCH_ENABLED=1` before podspecs load), then confirm the first iOS and Android builds
- [x] Choose a navigation library and set up the app shell
- [ ] Create a Firebase project on the Blaze plan; register the iOS and Android apps
- [x] Add React Native Firebase (app, auth, firestore, functions, app-check, remote-config, storage)
- [ ] Set a billing budget alert in Google Cloud
- [x] Write Firestore security rules: only group members can read or write their group
- [x] Private gifts sit at `users/{uid}/privateGifts` and only that user can read or write them. Claim and buyer fields stay inside group ciphertext
- [ ] Enable App Check (App Attest on iOS, Play Integrity on Android)
- [x] Make Firestore the source of truth for all user data
- [x] Build an encrypted local cache that mirrors Firestore, not a separate data model
- [x] Add end-to-end encryption: generate and store keys on the device, encrypt before upload, and make sure the server can't read user data. Interim: AES-GCM on device; membership fields stay plaintext for the security rules; an explicit cloud-idea request sends that prompt to the function. See README.
- [x] Design key sharing for group members under end-to-end encryption. Interim: the group key is in the invite-link fragment, with a recovery-code wrap for a second device. The same key is shared with every member, up to 10. Not a pairwise ratchet.
- [x] Offline-first: read and write the encrypted local copy offline, and merge to the cloud when the connection returns
- [x] Resolve merge conflicts with last write wins, and show a small "updated on another device" toast
- [x] Generate the app icon at every iOS size (iPhone and iPad) and the Android adaptive icon, plus the launch screen, from the SVG sources

## 2. First open and onboarding
- [x] Build the first-open screen: one sentence explaining the app, plus "Start" and "Join" buttons
- [x] "Start" creates the invisible anonymous account and goes to the people list. Creating a group triggers the upgrade prompt.
- [x] "Join" accepts an invite link and joins that group
- [x] Reopening the app lands directly on the people list
- [x] No signup form anywhere
- [x] Don't generate recommendations at app open

## 3. Accounts (anonymous, invisible)
- [x] Create the Firebase anonymous account invisibly on first open, with no sign-in wall and no signup form
- [x] Prompt the upgrade to a permanent sign-in only when the user starts a group, exports or shares a list, or first opens the app on a second device
- [x] Make email magic link the default upgrade method, with a text code as an option
- [x] Link the anonymous account to the permanent one in place, keeping the same UID and data
- [x] After 30 days of use, show one subtle, dismissible banner suggesting the upgrade, never blocking
- [x] Generate a silly auto-name for each user
- [x] Allow overwriting the auto-name only at group creation
- [x] Recover the account after a reinstall or on a new device through the linked permanent sign-in. The lost-phone risk is accepted for anonymous-only users.
- [x] Limit text codes to the launch regions (US first)

## 4. Groups
- [x] Create a group of up to 10 members, with an optional name override at creation. This prompts the upgrade from anonymous to a permanent sign-in.
- [x] Invite through a shareable link that opens the app (or the store) and joins
- [x] Enforce the member limit of 10. A list can exist with one person before anyone joins. The paid gift-recipient list is intentionally uncapped for now.
- [x] Sync group records through Firestore
- [x] Handle leaving a group and removing a member
- [x] Let a person belong to several groups, with a switcher
- [x] Optional group name at creation and in group settings; blank name displays the members' names (`Mike, Sam & Jo`, truncated with `+N`)
- [x] Show that label, with a stable emoji and color marker, on the switcher, invite preview, share text, and screen headers
- [x] Keep the group name inside the encrypted payload (and the encrypted invite preview), not in plaintext Firestore fields

## 5. People list
- [x] Add a person manually with a name and an optional budget
- [x] After adding a person, show tappable interest tags
- [x] Optional "Sweep calendar for birthdays" button, never forced
- [x] Optional "Import from contacts" button, never forced
- [x] Imported people stay inert (no AI calls) until opened
- [x] Sort the people list by the next upcoming occasion
- [x] Show budget used versus remaining on each row
- [x] Empty-state art for the people list and the fairness view, generated from SVG

## 6. Person detail screen
- [x] Show the person's name, budget, interest tags and occasions
- [x] Generate recommendations on this screen, not at app open and not on a dashboard
- [x] Show recommendations as text
- [x] Show the gift history for this person across occasions and years
- [x] Let the user edit the person's tags and budget
- [x] Gift history can filter to "My purchases". Each recipient shows who spent what this year and all time, next to the totals and budget
- [x] On a group recipient, "Same person as…" merges a copy from another list. Occasions with the same type, month, and day combine. The source copy is removed and that list's recipient slot frees. Unchecked gifts stay private to the person who merged them
- [x] After joining a list, offer a merge when a recipient matches one on your other lists by name or birthday. The offer can be dismissed. Nothing merges automatically

## 7. Occasions and the gift-giving loop
- [x] Support per-person occasions: birthday, Christmas and wedding
- [x] Give each occasion a status: not started, idea saved or purchased
- [x] Reset the status for each new occurrence of an occasion
- [x] Gift-giving loop: get ideas, save an idea, mark it purchased, log the date and price, give feedback
- [x] Logging a purchase counts it toward the person's budget
- [x] "I'll get this" claims this year's occasion. Every member sees who claimed it. The claimer or the list owner can unclaim
- [x] Logging a purchase records who bought it. History says "Bought by" that name, or "You". Older gifts with no buyer still show
- [x] A gentle warning shows if you log a purchase on an occasion another member claimed. The purchase still saves
- [x] Build a fairness view comparing spend (and gift counts) across people

## 8. Recommendations: on-device AI (free baseline)
- [x] Generate suggestions on the device from name, occasion, interest tags and feedback
- [x] Add thumbs up and down per recipient, stored in a local log
- [x] Make no server calls on the free tier
- [x] Cache ideas per person; reopening the screen doesn't regenerate them
- [x] Choose the on-device model approach for iOS and Android. Bundled catalog scored on the phone from name, occasion, tags, and thumbs. Not an on-device language model.

## 9. Recommendations: cloud AI (on request only)
- [x] Build a Firebase Cloud Function that proxies requests to OpenAI; the API key lives on the server and never on the phone
- [x] Protect the proxy with App Check
- [x] Call cloud AI only when the user explicitly asks
- [x] Cache cloud ideas per person; only fresh generations count toward the cap
- [x] Enforce a per-person refresh counter on the server (free: 5 per person; paid: 20 per person per month, resetting monthly)
- [x] Tie the refresh cap to a device ID plus a fingerprint hash stored on the server, not to the anonymous UID, so a reinstall doesn't reset it
- [ ] Confirm OpenAI model pricing and set a monthly spend alert

## 10. Monetization
- [x] Free tier: one list you start, 5 gift recipients on it, 5 refreshes each. Joining lists other people start is not limited
- [x] $9.99 one-time in-app purchase removes both limits (more lists you start, and the recipient cap on lists you own) and raises refreshes
- [x] No AI subscription
- [x] Set the paid refresh limit: 20 per person per month (free tier stays at 5 per person)
- [ ] Monitor refresh usage for abuse and per-refresh API cost; adjust the paid cap if needed
- [x] Restore purchases on reinstall or a new device. The device fingerprint still records the purchase, and `getEntitlement` / `verifyUnlock` copy it onto the signed-in account
- [x] Verify server-side that a user has paid before raising their limits. A free user cannot start a second list: `createOwnedGroup` checks `accounts/{uid}`, and the rules deny direct group creates. This closes the hole where a free user could start multiple lists. Recipient caps follow the list owner's entitlement

## 11. Localization
- [x] Launch in US English only
- [x] From day one, keep every string in resource files (no hardcoded text)
- [x] Use layouts that tolerate longer translated text
- [x] Format currency and dates by locale
- [ ] guft machine-translates the strings, then a human reviews them for natural phrasing
- [ ] Phase 2: Spanish for the US Hispanic market
- [ ] Phase 3: Canada, UK and Australia, with currency and date tweaks
- [x] Skip Japanese and German until the US version is proven

## 12. Seasonal and event skins
- [x] Ship the base theme in the app bundle
- [x] Ship the first season or two of skins in the bundle so they work offline and load instantly
- [x] Download later skins from Firebase (Storage) when their dates arrive
- [x] Turn skins on by date through Remote Config, with no app update
- [x] Keep the layout identical across skins so text and buttons don't break
- [x] Fall back to the base theme if a skin download fails
- [x] Bundle seasonal motif art for base, fall, winter, spring, and summer (same slot on every skin; colors for spring and summer can still download)

## 13. Store listing and launch
- [x] App name Gifteez, with a keyword title or subtitle (e.g. "Gifteez: Gift Tracker & Ideas")
- [x] Privacy-focused description
- [x] Screenshots showing that no account is needed, plus the Play feature graphic, generated from SVG into `assets/store` (composed frames of the product UI; a later simulator capture can replace them if review asks, and Michael does not have to draw them)
- [x] Categories: Lifestyle (primary) and Shopping
- [x] No keyword stuffing
- [ ] Fill out Apple's privacy label and Google Play's Data safety form
- [ ] Run a USPTO trademark search on "Gifteez" before launch
- [ ] Register a domain (check gifteez.com and gifteez.app)
- [x] Offer import from Santa's Bag and Christmas Gift List Tracker exports to win users who are switching

## 14. Build complete: ready for the simulator (definition of done)
- [x] All Phases 1–13 build tasks are implemented by the agent, with no manual coding steps left
- [x] Every config value the app needs is read from `.env` (keys listed in `.env.example`); nothing is hardcoded
- [x] The Cloud Function code for the AI proxy is in the repo and deploys with one command (`firebase deploy --only functions`)
- [x] Firestore security rules and indexes are in the repo and deploy with one command
- [x] A README "Run it" section lists the only manual step: copy `.env.example` to `.env` and fill in the values (plus the OpenAI key set as a Functions secret)
- [ ] `npm install`, then `npm run ios` (it runs `npm run pods`, then `react-native run-ios`) boots on the iOS simulator
- [ ] `npx react-native run-android` boots on the Android emulator
- [ ] Smoke test on both simulators: first open, invisible sign-in, add a person, an occasion, on-device ideas, a purchase, budget, and a group invite link
- [x] Lint, type check and unit tests pass

## 15. Store submission (after simulator testing looks good)
Fastlane is already in the repo: `fastlane/Fastfile`, `fastlane/Appfile`, `fastlane/metadata/` and `.github/workflows/release.yml`.
- [ ] Enroll in the Apple Developer Program and create a Google Play Console account
- [ ] Create the app record in App Store Connect (bundle ID) and in Play Console (`com.gifteez`)
- [ ] Create an App Store Connect API key (`.p8`) and save it to `~/.gifteez-secrets/AuthKey.p8`
- [ ] Create a Google Play service account with Release Manager access, and save its JSON to `~/.gifteez-secrets/play.json`
- [ ] Set up iOS signing with `fastlane match` (a private certs repo plus `MATCH_PASSWORD`)
- [ ] Create the Android upload keystore at `~/.gifteez-secrets/upload.jks` and turn on Play App Signing
- [ ] Add the GitHub secrets: `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_B64`, `MATCH_PASSWORD`, `MATCH_GIT_URL`, `PLAY_JSON_B64`, `ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`
- [ ] Set the version in `package.json` (`npm version ...`) and write the release notes in `fastlane/metadata/release_notes.txt`
- [ ] Upload the first Android build to the internal track by hand once in Play Console (Play requires it before API uploads work)
- [ ] iOS beta: run `bundle exec fastlane ios beta`, or push a `v*` tag, to upload to TestFlight
- [ ] Android beta: run `bundle exec fastlane android beta`, or push a `v*` tag, to upload to the Google Play internal testing track
- [ ] Add internal testers in TestFlight and in the Play internal track; test on real devices
- [ ] Fill in the store listing assets from Phase 13: screenshots, description, privacy label and Data safety
- [ ] Production: `fastlane ios release` (submit for review), then `fastlane android release` (20% staged rollout) or `fastlane android promote`
