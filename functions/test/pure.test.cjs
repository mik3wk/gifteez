const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { canRefresh, emptyUsage, nextUsage } = require('../lib/caps');
const { decidePersonWrite, lockedPersonIds } = require('../lib/peopleCap');
const { shouldRevokeEntitlement, configuredVerdict } = require('../lib/entitlement');
const { fingerprint } = require('../lib/fingerprint');
const { parseIdeas } = require('../lib/ideas');
const { appleTransactionGrants, googlePurchaseGrants } = require('../lib/iap');

test('free cache hits do not count and the sixth refresh is refused', () => {
  let usage = emptyUsage();
  const limits = { free: 5, paidPerMonth: 20 };
  const now = new Date('2026-10-22T12:00:00Z');
  const first = canRefresh({ usage, paid: false, now, limits, refresh: false, cacheHit: false });
  assert.equal(first.counted, true);
  usage = nextUsage(usage, false, now);
  const cached = canRefresh({ usage, paid: false, now, limits, refresh: false, cacheHit: true });
  assert.equal(cached.counted, false);
  for (let i = 0; i < 4; i += 1) {
    usage = nextUsage(usage, false, now);
  }
  const blocked = canRefresh({ usage, paid: false, now, limits, refresh: true, cacheHit: true });
  assert.equal(blocked.ok, false);
});

test('paid refreshes reset with the month', () => {
  const limits = { free: 5, paidPerMonth: 20 };
  let usage = emptyUsage();
  const october = new Date('2026-10-22T12:00:00Z');
  for (let i = 0; i < 20; i += 1) {
    usage = nextUsage(usage, true, october);
  }
  assert.equal(canRefresh({ usage, paid: true, now: october, limits, refresh: true, cacheHit: false }).ok, false);
  const november = new Date('2026-11-01T00:00:00Z');
  assert.equal(canRefresh({ usage, paid: true, now: november, limits, refresh: true, cacheHit: false }).ok, true);
});

test('fingerprint ignores the anonymous uid', () => {
  const one = fingerprint('pepper', 'device-a');
  const two = fingerprint('pepper', 'device-a');
  const other = fingerprint('pepper', 'device-b');
  assert.equal(one, two);
  assert.notEqual(one, other);
  assert.equal(one.length, 64);
});

test('idea parser keeps valid objects and drops malformed ones', () => {
  const parsed = parseIdeas(JSON.stringify({
    ideas: [
      { title: 'A wool scarf', priceMin: 20, priceMax: 40, reason: 'A warm layer for cold days.', searchQuery: 'wool scarf cold weather' },
      'A mug',
      { title: 'Broken', priceMin: 10, priceMax: 20, reason: 'Nope.', searchQuery: 'too short' },
      { title: 'Reversed', priceMin: 80, priceMax: 30, reason: 'Prices get ordered.', searchQuery: 'ceramic everyday mug' },
    ],
  }));
  assert.deepEqual(parsed, [
    { title: 'A wool scarf', priceMin: 20, priceMax: 40, reason: 'A warm layer for cold days.', searchQuery: 'wool scarf cold weather' },
    { title: 'Reversed', priceMin: 30, priceMax: 80, reason: 'Prices get ordered.', searchQuery: 'ceramic everyday mug' },
  ]);
  assert.deepEqual(parseIdeas('1. A book\n- A mug'), []);
});

test('idea requests omit temperature and log only the OpenAI error', async () => {
  const { requestIdeas } = require('../lib/ideas');
  const originalFetch = global.fetch;
  const originalError = console.error;
  const logged = [];
  console.error = (...args) => {
    logged.push(args);
  };
  try {
    const bodies = [];
    global.fetch = async (_url, init) => {
      bodies.push(JSON.parse(init.body));
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: '{"ideas":[{"title":"A wool scarf","priceMin":20,"priceMax":40,"reason":"A warm layer for cold days.","searchQuery":"wool scarf cold weather"}]}' } }] }),
      };
    };
    const ideas = await requestIdeas('sk-test-key', 'gpt-test', { name: 'Ada', tags: ['books'] });
    assert.deepEqual(ideas, [{ title: 'A wool scarf', priceMin: 20, priceMax: 40, reason: 'A warm layer for cold days.', searchQuery: 'wool scarf cold weather' }]);
    assert.equal(Object.hasOwn(bodies[0], 'temperature'), false);
    assert.deepEqual(bodies[0].response_format, { type: 'json_object' });
    assert.equal(JSON.stringify(bodies[0].messages).includes('Ada'), false);

    global.fetch = async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: "Unsupported value: 'temperature' does not support 0.7 with this model. Only the default (1) value is supported." } }),
    });
    await assert.rejects(
      () => requestIdeas('sk-test-key', 'gpt-test', { name: 'Ada', tags: ['books'] }),
      /openai_400/,
    );
    const text = JSON.stringify(logged);
    assert.match(text, /400/);
    assert.match(text, /Unsupported value/);
    assert.equal(text.includes('sk-test-key'), false);
    assert.equal(text.includes('Ada'), false);
    assert.equal(text.includes('books'), false);
  } finally {
    global.fetch = originalFetch;
    console.error = originalError;
  }
});

test('idea prompt stresses relationship and age and still omits the name', async () => {
  const { requestIdeas, promptHash, modelPrompt } = require('../lib/ideas');
  const originalFetch = global.fetch;
  const bodies = [];
  global.fetch = async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: '{"ideas":[{"title":"A linen apron","priceMin":30,"priceMax":50,"reason":"A kitchen layer they can actually use.","searchQuery":"linen kitchen apron adult"}]}' } }] }),
    };
  };
  try {
    await requestIdeas('sk-test-key', 'gpt-test', { name: 'Ada', relationship: 'Sister', age: 34, ageBand: 'adult', avoid: ['Pottery wheel class'], tags: ['books'] });
    const message = JSON.stringify(bodies[0].messages);
    assert.equal(message.includes('Ada'), false);
    assert.match(message, /Sister/);
    assert.match(message, /34/);
    assert.match(message, /adult/);
    assert.match(message, /Pottery wheel class/);
    assert.match(message, /Avoid these/);
    assert.match(bodies[0].messages[0].content, /life stage/);
    assert.match(bodies[0].messages[0].content, /kids' toys/);
    assert.match(bodies[0].messages[0].content, /same opening/);
    assert.equal(Object.hasOwn(bodies[0], 'temperature'), false);
    const shaped = modelPrompt({ name: 'Ada', relationship: 'Sister', age: 34 });
    assert.equal(JSON.stringify(shaped).includes('Ada'), false);
    assert.equal(shaped.relationship, 'Sister');
    assert.equal(shaped.age, 34);
    const hashed = promptHash('person', { relationship: 'Sister', age: 34 });
    assert.equal(hashed.includes('Ada'), false);
    assert.match(hashed, /Sister/);
    assert.match(hashed, /34/);
    assert.match(hashed, /"v":5/);
    const withBand = modelPrompt({ name: 'Ada', relationship: 'Sister', ageBand: 'adult', avoid: ['Pottery wheel class'] });
    assert.equal(JSON.stringify(withBand).includes('Ada'), false);
    assert.equal(withBand.ageBand, 'adult');
    assert.deepEqual(withBand.avoid, ['Pottery wheel class']);
  } finally {
    global.fetch = originalFetch;
  }
});

test('store receipts grant only a matching unrevoked purchase', () => {
  assert.equal(appleTransactionGrants({ productId: 'gifteez_unlock', bundleId: 'com.gifteez' }, 'gifteez_unlock', 'com.gifteez'), true);
  assert.equal(appleTransactionGrants({ productId: 'other', bundleId: 'com.gifteez' }, 'gifteez_unlock', 'com.gifteez'), false);
  assert.equal(appleTransactionGrants({ productId: 'gifteez_unlock', bundleId: 'com.gifteez', revocationDate: 1 }, 'gifteez_unlock', 'com.gifteez'), false);
  assert.equal(googlePurchaseGrants({ purchaseState: 0 }, 'gifteez_unlock', 'gifteez_unlock'), true);
  assert.equal(googlePurchaseGrants({ purchaseState: 1 }, 'gifteez_unlock', 'gifteez_unlock'), false);
});

test('people slots stop at the free limit on the list, and extras lock instead of deleting', () => {
  const people = ['a', 'b', 'c', 'd', 'e'].map((id, index) => ({ id, createdAt: index }));
  const blocked = decidePersonWrite({ entitled: false, people, personId: 'f', createdAt: 6, deleted: false, limit: 5 });
  assert.equal(blocked.ok, false);
  const paid = decidePersonWrite({ entitled: true, people, personId: 'f', createdAt: 6, deleted: false, limit: 5 });
  assert.equal(paid.ok, true);
  const six = [...people, { id: 'f', createdAt: 6 }];
  assert.deepEqual(lockedPersonIds(six, false, 5), ['f']);
  const removed = decidePersonWrite({ entitled: false, people: six, personId: 'f', createdAt: 6, deleted: true, limit: 5 });
  assert.equal(removed.ok, true);
  if (removed.ok) {
    assert.deepEqual(removed.lockedPersonIds, []);
  }
  assert.equal(shouldRevokeEntitlement('not_configured'), false);
  assert.equal(shouldRevokeEntitlement('unknown'), false);
  assert.equal(shouldRevokeEntitlement('revoked'), true);
  assert.equal(configuredVerdict(false, 'revoked'), 'not_configured');
});

test('firestore rules no longer cover groups or invites', () => {
  const root = path.join(__dirname, '..', '..');
  const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
  assert.equal(rules.includes('match /groups/'), false);
  assert.equal(rules.includes('match /invites/'), false);
  assert.equal(rules.includes('privateGifts'), false);
  assert.match(rules, /match \/aiUsage\/\{fingerprint\}/);
  assert.match(rules, /match \/aiCache\/\{fingerprint\}/);
  assert.match(rules, /match \/entitlements\/\{fingerprint\}/);
  assert.match(rules, /allow read, write: if false/);
  assert.match(fs.readFileSync(path.join(root, '.env.example'), 'utf8'), /GROUP_MAX_MEMBERS=10/);
  const fnEnv = fs.readFileSync(path.join(root, 'functions', '.env.example'), 'utf8');
  assert.match(fnEnv, /GROUP_MAX_MEMBERS=10/);
  assert.match(fnEnv, /FREE_TIER_MAX_PEOPLE=5/);
});

test('deployed callables stay the entitlement and idea proxy', () => {
  const root = path.join(__dirname, '..', '..');
  const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
  assert.match(rules, /match \/accounts\/\{uid\}/);
  const accounts = rules.slice(rules.indexOf('match /accounts/{uid}'));
  assert.match(accounts, /allow write: if false/);
  const index = fs.readFileSync(path.join(root, 'functions', 'src', 'index.ts'), 'utf8');
  assert.equal(index.includes('export const joinGroup'), false);
  assert.equal(index.includes('export const createOwnedGroup'), false);
  assert.equal(index.includes('export const writePerson'), false);
  assert.equal(index.includes('applyEntitlement'), false);
  assert.equal(index.includes('claimPersonSlot'), false);
  assert.match(index, /collection\('accounts'\)/);
  assert.match(index, /recheckEntitlements/);
  const ideas = index.slice(index.indexOf('export const generateGiftIdeas'), index.indexOf('export const getEntitlement'));
  assert.match(ideas, /account\.data\(\)\?\.entitled === true \|\| await isPaid\(id\)/);
  assert.equal(ideas.includes('assertPerson'), false);
});

test('index.js installs crypto.getRandomValues before the app loads', () => {
  const index = fs.readFileSync(path.join(__dirname, '..', '..', 'index.js'), 'utf8');
  const firstLine = index.split('\n').find(line => line.trim().length > 0);
  assert.equal(firstLine, "import 'react-native-get-random-values';");
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8'));
  assert.match(pkg.dependencies['react-native-get-random-values'], /^\^2\./);
});

test('pod install enables the Firebase Firestore SwiftPM trait', () => {
  const podfile = fs.readFileSync(path.join(__dirname, '..', '..', 'ios', 'Podfile'), 'utf8');
  const helper = fs.readFileSync(path.join(__dirname, '..', '..', 'ios', 'firebase_spm_traits.rb'), 'utf8');
  const manifest = fs.readFileSync(
    path.join(__dirname, '..', '..', 'ios', 'FirebaseFirestoreTrait', 'Package.swift'),
    'utf8',
  );
  assert.match(podfile, /require_relative 'firebase_spm_traits'/);
  assert.ok(
    podfile.indexOf("require_relative 'firebase_spm_traits'") < podfile.indexOf('prepare_react_native_project!'),
    'the trait attribute must be registered before the Xcode project is opened',
  );
  assert.match(podfile, /gifteez_enable_firebase_spm_traits_for_installer\(installer\)/);
  assert.match(podfile, /gifteez_install_firebase_spm_traits_hook!\(installer\)/);
  assert.match(helper, /GIFTEEZ_FIREBASE_SPM_TRAITS = %w\[Firestore default\]/);
  assert.match(helper, /github.com\/firebase\/firebase-ios-sdk/);
  assert.match(helper, /run_podfile_post_integrate_hooks/);
  assert.match(helper, /RNFBFirestore/);
  assert.match(helper, /FirebaseFirestoreTrait/);
  assert.match(manifest, /exact: "13\.0\.0"/);
  assert.match(manifest, /"Firestore"/);
  assert.match(manifest, /\.defaults/);
  assert.match(manifest, /product\(name: "FirebaseFirestore"/);
});
