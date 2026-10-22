# Gifteez Roadmap

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
- Text messages for phone auth are the main cost driver, at about $0.01 per US SMS.
- Auth is free up to 50K monthly active users.
- Firestore's free quota is 50K reads and 20K writes a day.
- Cloud Functions include 2M free invocations a month.
- Calls to outside APIs are allowed and billed only as outbound data.
- LLM cost is extra. At Gemini Flash Lite rates it would be roughly $7/month at 1,000 users and $70/month at 10,000; OpenAI pricing is still to confirm.

### Unlimited AI use
- AI use will be capped rather than left open. Free users get on-device AI. Cloud AI is used only on explicit request, cached per person, with a counter enforced on the server.
- **AI caps (decided Oct 22, 2026):** 5 free refreshes per person, and 20 refreshes per person per month for paying users. The paid cap is a starting point, monitored for abuse and per-refresh API cost.

## 1. Foundation
- [x] React Native 0.88 TypeScript scaffold for iOS and Android (`~/Documents/Projects/Gifteez`)
- [ ] Initialize git and push to the repo host
- [ ] Run `bundle install && bundle exec pod install` in `ios/`; confirm the first iOS and Android builds
- [ ] Choose a navigation library and set up the app shell
- [ ] Create a Firebase project on the Blaze plan; register the iOS and Android apps
- [ ] Add React Native Firebase (app, auth, firestore, functions, app-check, remote-config, storage)
- [ ] Set a billing budget alert in Google Cloud
- [ ] Write Firestore security rules: only group members can read or write their group
- [ ] Enable App Check (App Attest on iOS, Play Integrity on Android)
- [ ] Build the local storage layer for on-device data: people, occasions, feedback log, idea cache
- [ ] Decide what syncs to Firestore (group data) versus what stays only on the device

## 2. First open and onboarding
- [ ] Build the first-open screen: one sentence explaining the app, plus "Start" and "Join" buttons
- [ ] "Start" creates the invisible account, then a group, then goes to the people list
- [ ] "Join" accepts an invite link and joins that group
- [ ] Reopening the app lands directly on the people list
- [ ] No signup form anywhere
- [ ] Don't generate recommendations at app open

## 3. Accounts (anonymous, invisible)
- [ ] Create the anonymous account invisibly through phone sign-in, with no signup form
- [ ] Keep users signed in long-term to minimize SMS sends (the main cost)
- [ ] Generate a silly auto-name for each user
- [ ] Allow overwriting the auto-name only at group creation
- [ ] Recover the account after a reinstall or on a new device
- [ ] Limit SMS to the launch regions (US first)

## 4. Groups
- [ ] Create a group of 2–5 people, with an optional name override at creation
- [ ] Invite through a shareable link that opens the app (or the store) and joins
- [ ] Enforce the 2–5 member limit
- [ ] Sync group records through Firestore
- [ ] Handle leaving a group and removing a member

## 5. People list
- [ ] Add a person manually with a name and an optional budget
- [ ] After adding a person, show tappable interest tags
- [ ] Optional "Sweep calendar for birthdays" button, never forced
- [ ] Optional "Import from contacts" button, never forced
- [ ] Imported people stay inert (no AI calls) until opened
- [ ] Sort the people list by the next upcoming occasion
- [ ] Show budget used versus remaining on each row

## 6. Person detail screen
- [ ] Show the person's name, budget, interest tags and occasions
- [ ] Generate recommendations on this screen, not at app open and not on a dashboard
- [ ] Show recommendations as text
- [ ] Show the gift history for this person across occasions and years
- [ ] Let the user edit the person's tags and budget

## 7. Occasions and the gift-giving loop
- [ ] Support per-person occasions: birthday, Christmas and wedding
- [ ] Give each occasion a status: not started, idea saved or purchased
- [ ] Reset the status for each new occurrence of an occasion
- [ ] Gift-giving loop: get ideas, save an idea, mark it purchased, log the date and price, give feedback
- [ ] Logging a purchase counts it toward the person's budget
- [ ] Build a fairness view comparing spend (and gift counts) across people

## 8. Recommendations: on-device AI (free baseline)
- [ ] Generate suggestions on the device from name, occasion, interest tags and feedback
- [ ] Add thumbs up and down per recipient, stored in a local log
- [ ] Make no server calls on the free tier
- [ ] Cache ideas per person; reopening the screen doesn't regenerate them
- [ ] Choose the on-device model approach for iOS and Android

## 9. Recommendations: cloud AI (on request only)
- [ ] Build a Firebase Cloud Function that proxies requests to OpenAI; the API key lives on the server and never on the phone
- [ ] Protect the proxy with App Check
- [ ] Call cloud AI only when the user explicitly asks
- [ ] Cache cloud ideas per person; only fresh generations count toward the cap
- [ ] Enforce a per-user, per-person refresh counter on the server (free: 5 per person; paid: 20 per person per month, resetting monthly)
- [ ] Confirm OpenAI model pricing and set a monthly spend alert

## 10. Monetization
- [ ] Free tier: 5 people, 5 refreshes each
- [ ] $9.99 one-time in-app purchase removes the people cap and raises refreshes
- [ ] No AI subscription
- [x] Set the paid refresh limit: 20 per person per month (free tier stays at 5 per person)
- [ ] Monitor refresh usage for abuse and per-refresh API cost; adjust the paid cap if needed
- [ ] Restore purchases on reinstall or a new device
- [ ] Verify server-side that a user has paid before raising their limits

## 11. Localization
- [ ] Launch in US English only
- [ ] From day one, keep every string in resource files (no hardcoded text)
- [ ] Use layouts that tolerate longer translated text
- [ ] Format currency and dates by locale
- [ ] guft machine-translates the strings, then a human reviews them for natural phrasing
- [ ] Phase 2: Spanish for the US Hispanic market
- [ ] Phase 3: Canada, UK and Australia, with currency and date tweaks
- [ ] Skip Japanese and German until the US version is proven

## 12. Seasonal and event skins
- [ ] Ship the base theme in the app bundle
- [ ] Ship the first season or two of skins in the bundle so they work offline and load instantly
- [ ] Download later skins from Firebase (Storage) when their dates arrive
- [ ] Turn skins on by date through Remote Config, with no app update
- [ ] Keep the layout identical across skins so text and buttons don't break
- [ ] Fall back to the base theme if a skin download fails

## 13. Store listing and launch
- [ ] App name Gifteez, with a keyword title or subtitle (e.g. "Gifteez: Gift Tracker & Ideas")
- [ ] Privacy-focused description
- [ ] Screenshots showing that no account is needed
- [ ] Categories: Lifestyle (primary) and Shopping
- [ ] No keyword stuffing
- [ ] Fill out Apple's privacy label and Google Play's Data safety form
- [ ] Run a USPTO trademark search on "Gifteez" before launch
- [ ] Register a domain (check gifteez.com and gifteez.app)
- [ ] Offer import from Santa's Bag and Christmas Gift List Tracker exports to win users who are switching
