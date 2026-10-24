const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripAndroidJoin, stripEntitlements, storeUrls } = require('../../scripts/generate-firebase-config.js');

const root = path.join(__dirname, '..', '..');

test('join hosting and native join links are gone', () => {
  const firebase = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8'));
  assert.equal(firebase.hosting, undefined);
  const entitlements = fs.readFileSync(path.join(root, 'ios/Gifteez/Gifteez.entitlements'), 'utf8');
  assert.equal(entitlements.includes('applinks:'), false);
  assert.equal(entitlements.includes('associated-domains'), false);
  const manifest = fs.readFileSync(path.join(root, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
  assert.equal(manifest.includes('/join'), false);
  assert.equal(manifest.includes('android:host="join"'), false);
  const plist = fs.readFileSync(path.join(root, 'ios/Gifteez/Info.plist'), 'utf8');
  assert.equal(plist.includes('CFBundleURLTypes'), false);
  assert.equal(plist.includes('gifteez://'), false);
});

test('prepare-config strips a leftover join filter and associated domain', () => {
  const manifest = [
    '<intent-filter>',
    '            <action android:name="android.intent.action.VIEW" />',
    '            <category android:name="android.intent.category.DEFAULT" />',
    '            <category android:name="android.intent.category.BROWSABLE" />',
    '            <data android:scheme="gifteez" android:host="join" />',
    '        </intent-filter>',
    '        <intent-filter android:autoVerify="true">',
    '            <action android:name="android.intent.action.VIEW" />',
    '            <category android:name="android.intent.category.DEFAULT" />',
    '            <category android:name="android.intent.category.BROWSABLE" />',
    '            <data android:scheme="https" android:host="gifteez.app" android:pathPrefix="/join" />',
    '        </intent-filter>',
  ].join('\n');
  const stripped = stripAndroidJoin(manifest);
  assert.equal(stripped.includes('/join'), false);
  assert.equal(stripped.includes('host="join"'), false);
  const entitlements = '<dict>\n\t<key>com.apple.developer.associated-domains</key>\n\t<array>\n\t\t<string>applinks:gifteez.app</string>\n\t</array>\n</dict>\n';
  const next = stripEntitlements(entitlements);
  assert.equal(next.includes('applinks:'), false);
  const urls = storeUrls({ APP_STORE_URL: 'javascript:alert(1)', PLAY_STORE_URL: 'http://insecure.example' });
  assert.equal(urls.appStore, 'https://apps.apple.com/app/id0000000000');
  assert.equal(urls.playStore, 'https://play.google.com/store/apps/details?id=com.gifteez');
});
