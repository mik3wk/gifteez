const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  PLACEHOLDER_SHA256,
  parseEnv,
  renderAasa,
  renderAssetLinks,
  renderJoinPage,
  rewriteAndroidHost,
  rewriteEntitlements,
  storeUrls,
} = require('../../scripts/generate-firebase-config.js');

const root = path.join(__dirname, '..', '..');

test('the join page keeps the fragment on the device', () => {
  const env = parseEnv(fs.readFileSync(path.join(root, '.env.example'), 'utf8'));
  const template = fs.readFileSync(path.join(root, 'hosting/join/index.template.html'), 'utf8');
  const page = renderJoinPage(template, env);
  const committed = fs.readFileSync(path.join(root, 'hosting/join/index.html'), 'utf8');
  assert.equal(page, committed);
  assert.equal(page.includes('fetch('), false);
  assert.equal(page.includes('sendBeacon'), false);
  assert.equal(page.includes('XMLHttpRequest'), false);
  assert.equal(page.includes('WebSocket'), false);
  assert.equal(page.includes('<script src'), false);
  assert.equal(page.includes('googletagmanager'), false);
  assert.equal(page.includes('google-analytics'), false);
  assert.equal(page.includes('connect-src \'none\''), true);
  assert.equal(page.includes('gifteez://'), true);
  assert.equal(page.includes('location.hash'), true);
  assert.equal(page.includes('location.href'), true);
  assert.equal(page.includes('__APP_STORE_URL__'), false);
  assert.equal(page.includes('id0000000000'), true);
  assert.equal(page.includes('play.google.com/store/apps/details?id=com.gifteez'), true);
  const httpsUrls = page.match(/https:\/\/[^\s"'<>]+/g) || [];
  assert.deepEqual(httpsUrls, [
    storeUrls(env).appStore,
    storeUrls(env).playStore,
  ]);
});

test('well-known files match the invite domain placeholders', () => {
  const env = parseEnv(fs.readFileSync(path.join(root, '.env.example'), 'utf8'));
  const aasa = JSON.parse(renderAasa(env));
  assert.equal(aasa.applinks.details[0].appID, 'TEAMID.com.gifteez');
  assert.deepEqual(aasa.applinks.details[0].paths, ['/join/*']);
  assert.deepEqual(aasa.applinks.details[1].components, [{ '/': '/join/*' }]);
  assert.equal(
    fs.readFileSync(path.join(root, 'hosting/.well-known/apple-app-site-association'), 'utf8'),
    renderAasa(env),
  );
  const links = JSON.parse(renderAssetLinks(env));
  assert.equal(links[0].target.package_name, 'com.gifteez');
  assert.deepEqual(links[0].target.sha256_cert_fingerprints, [PLACEHOLDER_SHA256]);
  assert.deepEqual(links[0].relation, ['delegate_permission/common.handle_all_urls']);
  assert.equal(
    fs.readFileSync(path.join(root, 'hosting/.well-known/assetlinks.json'), 'utf8'),
    renderAssetLinks(env),
  );
  const firebase = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8'));
  assert.equal(firebase.hosting.public, 'hosting');
  assert.equal(firebase.hosting.ignore.includes('**/.*'), false);
  const aasaHeader = firebase.hosting.headers.find(item => item.source === '/.well-known/apple-app-site-association');
  assert.equal(aasaHeader.headers.find(header => header.key === 'Content-Type').value, 'application/json');
  assert.equal(
    firebase.hosting.rewrites.some(item => item.source === '/join/**' && item.destination === '/join/index.html'),
    true,
  );
});

test('native invite hosts follow the domain and reject a bad store URL', () => {
  const manifest = '<data android:scheme="https" android:host="gifteez.app" android:pathPrefix="/join" />';
  assert.equal(
    rewriteAndroidHost(manifest, 'invites.example'),
    '<data android:scheme="https" android:host="invites.example" android:pathPrefix="/join" />',
  );
  assert.equal(
    rewriteEntitlements('<string>applinks:gifteez.app</string>', 'invites.example'),
    '<string>applinks:invites.example</string>',
  );
  assert.equal(
    rewriteAndroidHost(fs.readFileSync(path.join(root, 'android/app/src/main/AndroidManifest.xml'), 'utf8'), 'gifteez.app')
      .includes('android:host="gifteez.app"'),
    true,
  );
  assert.equal(
    fs.readFileSync(path.join(root, 'ios/Gifteez/Gifteez.entitlements'), 'utf8').includes('applinks:gifteez.app'),
    true,
  );
  const urls = storeUrls({ APP_STORE_URL: 'javascript:alert(1)', PLAY_STORE_URL: 'http://insecure.example' });
  assert.equal(urls.appStore, 'https://apps.apple.com/app/id0000000000');
  assert.equal(urls.playStore, 'https://play.google.com/store/apps/details?id=com.gifteez');
});
