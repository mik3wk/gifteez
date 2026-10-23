const fs = require('fs');
const os = require('os');
const path = require('path');
const { writeFirebaseFiles } = require('../scripts/generate-firebase-config');

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
