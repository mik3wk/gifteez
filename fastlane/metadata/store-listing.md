# Store listing draft

This file is the copy and the privacy answers for App Store Connect and Play Console. It sits outside `fastlane/metadata/ios` and `fastlane/metadata/android` so `fastlane deliver` and `fastlane supply` do not upload it as store metadata. Screenshots are still to be taken on a simulator.

## Name and categories

- App name: Gifteez
- Title: Gifteez: Gift Tracker & Ideas
- Subtitle: Remember gifts. Keep spending fair.
- Primary category: Lifestyle
- Secondary category: Shopping
- Keywords, without repeating the title: birthday, christmas, wedding, budget, wishlist, occasion, family

## Description

Gifteez helps you remember gifts for the people you love, and keep the spending fair.

Add someone, note a birthday or Christmas, and see a few ideas on their page. Save one, mark it purchased, and the price counts toward their budget. A fairness view shows what you have spent, and how many gifts, across everyone on the list.

There is no sign-up form. The list is encrypted on your phone before it is stored. Ideas on the free tier are chosen on your phone. Cloud ideas run only when you ask for them.

Share a private link with up to four other people. Import a birthday from your calendar or contacts only if you tap that button. Nothing in Gifteez is an ad, and nothing is sold to an ad network.

Unlock is a single $9.99 purchase. It is not a subscription. It raises the number of people you can track and the number of fresh cloud ideas you can request.

## Promotional text

A private gift list with on-phone ideas, budgets, and a fairness view. No account form.

## Privacy nutrition and Data safety

Answer these in App Store Connect and Play Console. Do not claim "data not collected" for the items below.

Collected, and linked to the user only after they save an email or phone number:

- Email address, optional, used to send a sign-in link and restore the list.
- Phone number, optional, US text-code sign-in only.
- User content: names, occasions, budgets, gift prices, and idea text. Stored as ciphertext, except the membership fields the security rules need.
- Purchases: the unlock receipt, checked on the server.
- Device or other ID: a hash of the device id, used to enforce idea and people caps. Not the advertising id. Not used for tracking.

Not collected:

- Precise location, contacts database, photos, health, financial info beyond the gift prices the user types.
- Calendar and contacts are read on the device only when the user taps the import button. The app does not upload the address book. A person they choose to import becomes part of the encrypted list.

Tracking: no. Ads: no. Data sold: no. Data shared with advertisers: no.

Third parties that receive data only when the user asks for cloud ideas: OpenAI, via a Cloud Function, receives the prompt for that request (name, occasion, tags, budget, and which ideas they liked). Firebase receives auth, encrypted documents, and the cap records.

Purpose labels: App functionality. Not analytics advertising, not third-party advertising.

## What the screenshots should show

1. First open: one sentence, Start, and Join. No account form.
2. People list sorted by the next occasion, with budget remaining.
3. A person page with text ideas.
4. Fairness view.
5. The group invite sheet, including the line that the link carries the key.
