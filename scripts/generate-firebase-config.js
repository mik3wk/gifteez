#!/usr/bin/env node
/**
 * Writes native Firebase config, .firebaserc, and nothing secret.
 * Missing .env falls back to .env.example so simulator builds still configure.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const envPath = fs.existsSync(path.join(root, '.env'))
  ? path.join(root, '.env')
  : path.join(root, '.env.example');

const env = parseEnv(fs.readFileSync(envPath, 'utf8'));
const projectId = env.FIREBASE_PROJECT_ID || 'your-project-id';
const sender = env.FIREBASE_MESSAGING_SENDER_ID || '000000000000';
const apiKey = env.FIREBASE_API_KEY || 'your-firebase-api-key';
const bucket = env.FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`;
const androidAppId = env.FIREBASE_ANDROID_APP_ID || '1:000000000000:android:0000000000000000';
const iosAppId = env.FIREBASE_IOS_APP_ID || '1:000000000000:ios:0000000000000000';
const bundleId = env.APP_BUNDLE_ID || 'com.gifteez';

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
        android_client_info: { package_name: bundleId },
      },
      oauth_client: [],
      api_key: [{ current_key: apiKey }],
      services: { appinvite_service: { other_platform_oauth_client: [] } },
    },
  ],
  configuration_version: '1',
};

fs.writeFileSync(
  path.join(root, 'android/app/google-services.json'),
  `${JSON.stringify(googleServices, null, 2)}\n`,
);

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
  <string>${escapeXml(bundleId)}</string>
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
fs.writeFileSync(path.join(root, 'ios/Gifteez/GoogleService-Info.plist'), plist);
fs.writeFileSync(
  path.join(root, '.firebaserc'),
  `${JSON.stringify({ projects: { default: projectId } }, null, 2)}\n`,
);
console.log(`Firebase config written from ${path.basename(envPath)} for project ${projectId}.`);

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
