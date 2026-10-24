const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const art = path.join(__dirname, '../src/assets/art');
const skins = [
  'birthday',
  'anniversary',
  'wedding',
  'baby',
  'holiday',
  'hanukkah',
  'diwali',
  'valentine',
  'mother',
  'father',
  'graduation',
  'house',
  'gift',
];
const empties = ['people', 'fairness', 'occasions', 'ideas', 'group', 'error', 'offline'];
const celebrate = ['celebrate-claim', 'celebrate-save-idea', 'celebrate-purchase'];

function expectScales(dir, name) {
  expect(fs.existsSync(path.join(dir, `${name}.png`))).toBe(true);
  expect(fs.existsSync(path.join(dir, `${name}@2x.png`))).toBe(true);
  expect(fs.existsSync(path.join(dir, `${name}@3x.png`))).toBe(true);
}

test('every emblem, empty state, and celebration has a 1x, 2x, and 3x sticker', () => {
  expect(skins).toHaveLength(13);
  const emblems = [...skins, 'bloom', 'crescent', 'harvest', 'lantern', 'toast'];
  emblems.forEach(name => {
    expectScales(path.join(art, 'emblems'), `emblem-${name}`);
    expectScales(path.join(art, 'emblems'), `emblem-${name}-dark`);
  });
  empties.forEach(name => {
    expectScales(path.join(art, 'empty'), `empty-${name}`);
    expectScales(path.join(art, 'empty'), `empty-${name}-dark`);
  });
  celebrate.forEach(name => expectScales(path.join(art, 'celebrate'), name));
  expectScales(path.join(art, 'avatars'), 'group-avatar');
  expect(fs.existsSync(path.join(art, 'celebrate', 'confetti-burst.png'))).toBe(true);
  expect(fs.existsSync(path.join(art, 'celebrate', 'confetti-burst@2x.png'))).toBe(true);
  expect(fs.existsSync(path.join(art, 'celebrate', 'confetti-burst@3x.png'))).toBe(true);
  ['not-started', 'idea-saved', 'purchased', 'logged', 'balanced'].forEach(name => {
    expectScales(path.join(art, 'seals'), `seal-${name}`);
  });
  expect(fs.existsSync(path.join(art, 'seals', 'seal-claimed.png'))).toBe(false);
  ['ribbon-bow', 'ribbon-bow-dark', 'ribbon-divider', 'ribbon-divider-dark'].forEach(name => {
    expectScales(path.join(art, 'ribbon'), name);
  });
  expectScales(path.join(art, 'crest'), 'crest-wreath');
  expectScales(path.join(art, 'crest'), 'crest-wreath-dark');
  ['hero-gift-card', 'hero-gift-card-dark'].forEach(name => expectScales(path.join(art, 'hero'), name));
  ['ribbon-banner-slice', 'ribbon-banner-slice-dark', 'ribbon-banner-center', 'ribbon-banner-center-dark'].forEach(name => {
    expectScales(path.join(art, 'banner'), name);
  });
});

test('the iOS marketing icon is a square RGB PNG without alpha', async () => {
  const meta = await sharp(path.join(__dirname, '../ios/Gifteez/Images.xcassets/AppIcon.appiconset/icon-1024.png')).metadata();
  expect(meta.width).toBe(1024);
  expect(meta.height).toBe(1024);
  expect(meta.hasAlpha).toBe(false);
  expect(meta.isPalette).toBe(false);
  expect(meta.channels).toBe(3);
});
