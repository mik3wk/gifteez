const fs = require('fs');
const os = require('os');
const path = require('path');
const { writeFirebaseFiles, writeInviteHosting } = require('../scripts/generate-firebase-config');

function tempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gifteez-firebase-'));
  fs.mkdirSync(path.join(root, 'android/app'), { recursive: true });
  fs.mkdirSync(path.join(root, 'ios/Gifteez'), { recursive: true });
  return root;
}

test('npm run ios leaves an existing Firebase config and .firebaserc alone', () => {
  const root = tempRoot();
  const plist = path.join(root, 'ios/Gifteez/GoogleService-Info.plist');
  const json = path.join(root, 'android/app/google-services.json');
  const rc = path.join(root, '.firebaserc');
  fs.writeFileSync(plist, 'LOCAL PLIST');
  fs.writeFileSync(json, 'LOCAL JSON');
  fs.writeFileSync(rc, 'LOCAL RC');
  const kept = writeFirebaseFiles({ FIREBASE_PROJECT_ID: 'other-project' }, root);
  expect(kept).toHaveLength(3);
  expect(fs.readFileSync(plist, 'utf8')).toBe('LOCAL PLIST');
  expect(fs.readFileSync(json, 'utf8')).toBe('LOCAL JSON');
  expect(fs.readFileSync(rc, 'utf8')).toBe('LOCAL RC');
});

test('missing Firebase config is created once', () => {
  const root = tempRoot();
  const kept = writeFirebaseFiles({ FIREBASE_PROJECT_ID: 'demo-project' }, root);
  expect(kept).toEqual([]);
  const rc = fs.readFileSync(path.join(root, '.firebaserc'), 'utf8');
  expect(rc).toContain('demo-project');
  expect(fs.readFileSync(path.join(root, 'ios/Gifteez/GoogleService-Info.plist'), 'utf8')).toContain('demo-project');
  expect(fs.readFileSync(path.join(root, 'android/app/google-services.json'), 'utf8')).toContain('demo-project');
});

test('prepare-config strips join links and leaves a clean file alone', () => {
  const root = tempRoot();
  fs.mkdirSync(path.join(root, 'android/app/src/main'), { recursive: true });
  const manifest = path.join(root, 'android/app/src/main/AndroidManifest.xml');
  const entitlements = path.join(root, 'ios/Gifteez/Gifteez.entitlements');
  fs.writeFileSync(manifest, [
    '<manifest>',
    '        <intent-filter>',
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
    '</manifest>',
    '',
  ].join('\n'));
  fs.writeFileSync(entitlements, '<plist><dict>\n\t<key>com.apple.developer.associated-domains</key>\n\t<array>\n\t\t<string>applinks:old.example</string>\n\t</array>\n</dict></plist>\n');
  const first = writeInviteHosting({}, root);
  expect(first.written.some(file => file.endsWith('Gifteez.entitlements'))).toBe(true);
  expect(fs.readFileSync(entitlements, 'utf8')).not.toContain('applinks:');
  expect(fs.readFileSync(manifest, 'utf8')).not.toContain('/join');
  expect(fs.readFileSync(manifest, 'utf8')).not.toContain('host="join"');
  const entitlementsStamp = fs.statSync(entitlements).mtimeMs;
  const manifestStamp = fs.statSync(manifest).mtimeMs;
  const second = writeInviteHosting({}, root);
  expect(second.written).toEqual([]);
  expect(fs.statSync(entitlements).mtimeMs).toBe(entitlementsStamp);
  expect(fs.statSync(manifest).mtimeMs).toBe(manifestStamp);
});
