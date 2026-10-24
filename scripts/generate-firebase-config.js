#!/usr/bin/env node
/**
 * Writes native Firebase config, .firebaserc, the invite-domain native files,
 * and the Hosting join page. Nothing secret. Missing .env falls back to
 * .env.example so simulator builds still configure.
 */
const fs = require('fs');
const path = require('path');

const PLACEHOLDER_SHA256 = [
  '00', '00', '00', '00', '00', '00', '00', '00',
  '00', '00', '00', '00', '00', '00', '00', '00',
  '00', '00', '00', '00', '00', '00', '00', '00',
  '00', '00', '00', '00', '00', '00', '00', '00',
].join(':');

function parseEnv(text) {
  const values = {};
  text.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }
    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      return;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  });
  return values;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inviteDomain(env) {
  const raw = String(env.INVITE_LINK_DOMAIN || 'gifteez.app')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');
  return /^[A-Za-z0-9.-]+$/.test(raw) ? raw : 'gifteez.app';
}

function bundleId(env) {
  const raw = String(env.APP_BUNDLE_ID || 'com.gifteez').trim();
  return /^[A-Za-z0-9.]+$/.test(raw) ? raw : 'com.gifteez';
}

function appleTeamId(env) {
  const raw = String(env.APPLE_TEAM_ID || 'TEAMID').trim();
  return /^[A-Za-z0-9]+$/.test(raw) ? raw : 'TEAMID';
}

function sha256Fingerprint(env) {
  const raw = String(env.ANDROID_SHA256_CERT_FINGERPRINT || '').trim().toUpperCase();
  return /^[0-9A-F]{2}(:[0-9A-F]{2}){31}$/.test(raw) ? raw : PLACEHOLDER_SHA256;
}

function httpsUrl(value, fallback) {
  const raw = String(value || '').trim();
  if (/^https:\/\/[^\s"'<>]+$/.test(raw)) {
    return raw;
  }
  return fallback;
}

function storeUrls(env) {
  const id = bundleId(env);
  return {
    appStore: httpsUrl(env.APP_STORE_URL, 'https://apps.apple.com/app/id0000000000'),
    playStore: httpsUrl(env.PLAY_STORE_URL, `https://play.google.com/store/apps/details?id=${id}`),
  };
}

function renderAasa(env) {
  const appId = `${appleTeamId(env)}.${bundleId(env)}`;
  return `${JSON.stringify({
    applinks: {
      apps: [],
      details: [
        { appID: appId, paths: ['/join/*'] },
        { appIDs: [appId], components: [{ '/': '/join/*' }] },
      ],
    },
  }, null, 2)}\n`;
}

function renderAssetLinks(env) {
  return `${JSON.stringify([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: bundleId(env),
        sha256_cert_fingerprints: [sha256Fingerprint(env)],
      },
    },
  ], null, 2)}\n`;
}

function renderJoinPage(template, env) {
  const urls = storeUrls(env);
  return template
    .replaceAll('__APP_STORE_URL__', escapeHtml(urls.appStore))
    .replaceAll('__PLAY_STORE_URL__', escapeHtml(urls.playStore));
}

function stripAndroidJoin(xml) {
  return xml
    .replace(/\s*<intent-filter>\s*<action android:name="android\.intent\.action\.VIEW" \/>\s*<category android:name="android\.intent\.category\.DEFAULT" \/>\s*<category android:name="android\.intent\.category\.BROWSABLE" \/>\s*<data android:scheme="gifteez" android:host="join" \/>\s*<\/intent-filter>/g, '')
    .replace(/\s*<intent-filter android:autoVerify="true">\s*<action android:name="android\.intent\.action\.VIEW" \/>\s*<category android:name="android\.intent\.category\.DEFAULT" \/>\s*<category android:name="android\.intent\.category\.BROWSABLE" \/>\s*<data android:scheme="https" android:host="[^"]*" android:pathPrefix="\/join" \/>\s*<\/intent-filter>/g, '');
}

function stripEntitlements(xml) {
  return xml.replace(/\s*<key>com\.apple\.developer\.associated-domains<\/key>\s*<array>\s*(?:<string>applinks:[^<]*<\/string>\s*)*<\/array>/g, '');
}

function keepExisting(file) {
  return fs.existsSync(file);
}

function writeIfChanged(file, contents) {
  const next = String(contents);
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === next) {
    return false;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, next);
  return true;
}

function writeFirebaseFiles(env, root) {
  const projectId = env.FIREBASE_PROJECT_ID || 'your-project-id';
  const sender = env.FIREBASE_MESSAGING_SENDER_ID || '000000000000';
  const apiKey = env.FIREBASE_API_KEY || 'your-firebase-api-key';
  const bucket = env.FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`;
  const androidAppId = env.FIREBASE_ANDROID_APP_ID || '1:000000000000:android:0000000000000000';
  const iosAppId = env.FIREBASE_IOS_APP_ID || '1:000000000000:ios:0000000000000000';
  const id = bundleId(env);

  const googleServices = {
    project_info: {
      project_number: sender,
      project_id: projectId,
      storage_bucket: bucket,
    },
    client: [
      {
        client_info: {
          mobilesdk_app_id: androidAppId,
          android_client_info: { package_name: id },
        },
        oauth_client: [],
        api_key: [{ current_key: apiKey }],
        services: { appinvite_service: { other_platform_oauth_client: [] } },
      },
    ],
    configuration_version: '1',
  };

  const androidPath = path.join(root, 'android/app/google-services.json');
  const iosPath = path.join(root, 'ios/Gifteez/GoogleService-Info.plist');
  const rcPath = path.join(root, '.firebaserc');
  const kept = [];
  if (keepExisting(androidPath)) {
    kept.push(androidPath);
  } else {
    fs.mkdirSync(path.dirname(androidPath), { recursive: true });
    writeIfChanged(androidPath, `${JSON.stringify(googleServices, null, 2)}\n`);
  }

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>API_KEY</key>
  <string>${escapeXml(apiKey)}</string>
  <key>GCM_SENDER_ID</key>
  <string>${escapeXml(sender)}</string>
  <key>PLIST_VERSION</key>
  <string>1</string>
  <key>BUNDLE_ID</key>
  <string>${escapeXml(id)}</string>
  <key>PROJECT_ID</key>
  <string>${escapeXml(projectId)}</string>
  <key>STORAGE_BUCKET</key>
  <string>${escapeXml(bucket)}</string>
  <key>IS_ADS_ENABLED</key>
  <false/>
  <key>IS_ANALYTICS_ENABLED</key>
  <false/>
  <key>IS_APPINVITE_ENABLED</key>
  <true/>
  <key>IS_GCM_ENABLED</key>
  <true/>
  <key>IS_SIGNIN_ENABLED</key>
  <true/>
  <key>GOOGLE_APP_ID</key>
  <string>${escapeXml(iosAppId)}</string>
</dict>
</plist>
`;
  if (keepExisting(iosPath)) {
    kept.push(iosPath);
  } else {
    fs.mkdirSync(path.dirname(iosPath), { recursive: true });
    writeIfChanged(iosPath, plist);
  }
  if (keepExisting(rcPath)) {
    kept.push(rcPath);
  } else {
    writeIfChanged(rcPath, `${JSON.stringify({ projects: { default: projectId } }, null, 2)}\n`);
  }
  return kept;
}

function writeInviteHosting(_env, root) {
  const written = [];
  const put = (file, contents) => {
    if (writeIfChanged(file, contents)) {
      written.push(file);
    }
  };
  const manifestPath = path.join(root, 'android/app/src/main/AndroidManifest.xml');
  if (fs.existsSync(manifestPath)) {
    put(manifestPath, stripAndroidJoin(fs.readFileSync(manifestPath, 'utf8')));
  }
  const entitlementsPath = path.join(root, 'ios/Gifteez/Gifteez.entitlements');
  if (fs.existsSync(entitlementsPath)) {
    put(entitlementsPath, stripEntitlements(fs.readFileSync(entitlementsPath, 'utf8')));
  }
  return { written };
}

function main() {
  const root = path.resolve(__dirname, '..');
  const envPath = fs.existsSync(path.join(root, '.env'))
    ? path.join(root, '.env')
    : path.join(root, '.env.example');
  const env = parseEnv(fs.readFileSync(envPath, 'utf8'));
  const kept = writeFirebaseFiles(env, root);
  const { written } = writeInviteHosting(env, root);
  if (kept.length > 0) {
    console.log(`Left existing Firebase config alone: ${kept.map(file => path.relative(root, file)).join(', ')}.`);
  } else {
    console.log(`Firebase config written from ${path.basename(envPath)} for project ${env.FIREBASE_PROJECT_ID || 'your-project-id'}.`);
  }
  if (written.length === 0) {
    console.log('Native join links are already gone.');
  } else {
    console.log(`Removed join links from ${written.map(file => path.relative(root, file)).join(', ')}.`);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  PLACEHOLDER_SHA256,
  parseEnv,
  inviteDomain,
  bundleId,
  appleTeamId,
  sha256Fingerprint,
  storeUrls,
  renderAasa,
  renderAssetLinks,
  renderJoinPage,
  stripAndroidJoin,
  stripEntitlements,
  writeIfChanged,
  writeFirebaseFiles,
  writeInviteHosting,
};
