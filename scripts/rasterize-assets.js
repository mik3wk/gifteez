#!/usr/bin/env node
/**
 * Rasterize assets/src/*.svg into the iOS icon set, Android adaptive icon,
 * splash, in-app art, and store graphics. Commit both the SVGs and the PNGs.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'assets/src');

async function png(name, width, height, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  await sharp(path.join(src, name), { density: 300 })
    .resize(width, height, { fit: 'fill' })
    .png({ compressionLevel: 9, palette: true })
    .toFile(dest);
}

async function circlePng(name, size, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`,
  );
  const icon = await sharp(path.join(src, name), { density: 300 })
    .resize(size, size, { fit: 'fill' })
    .png()
    .toBuffer();
  await sharp(icon)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png({ compressionLevel: 9 })
    .toFile(dest);
}

async function main() {
  const iconDir = path.join(root, 'ios/Gifteez/Images.xcassets/AppIcon.appiconset');
  const icons = [
    ['icon-20@2x.png', 40],
    ['icon-20@3x.png', 60],
    ['icon-29@2x.png', 58],
    ['icon-29@3x.png', 87],
    ['icon-40@2x.png', 80],
    ['icon-40@3x.png', 120],
    ['icon-60@2x.png', 120],
    ['icon-60@3x.png', 180],
    ['icon-20.png', 20],
    ['icon-29.png', 29],
    ['icon-40.png', 40],
    ['icon-76.png', 76],
    ['icon-76@2x.png', 152],
    ['icon-83.5@2x.png', 167],
    ['icon-1024.png', 1024],
  ];
  for (const [file, size] of icons) {
    await png('icon.svg', size, size, path.join(iconDir, file));
  }
  const contents = {
    images: [
      { filename: 'icon-20@2x.png', idiom: 'iphone', scale: '2x', size: '20x20' },
      { filename: 'icon-20@3x.png', idiom: 'iphone', scale: '3x', size: '20x20' },
      { filename: 'icon-29@2x.png', idiom: 'iphone', scale: '2x', size: '29x29' },
      { filename: 'icon-29@3x.png', idiom: 'iphone', scale: '3x', size: '29x29' },
      { filename: 'icon-40@2x.png', idiom: 'iphone', scale: '2x', size: '40x40' },
      { filename: 'icon-40@3x.png', idiom: 'iphone', scale: '3x', size: '40x40' },
      { filename: 'icon-60@2x.png', idiom: 'iphone', scale: '2x', size: '60x60' },
      { filename: 'icon-60@3x.png', idiom: 'iphone', scale: '3x', size: '60x60' },
      { filename: 'icon-20.png', idiom: 'ipad', scale: '1x', size: '20x20' },
      { filename: 'icon-20@2x.png', idiom: 'ipad', scale: '2x', size: '20x20' },
      { filename: 'icon-29.png', idiom: 'ipad', scale: '1x', size: '29x29' },
      { filename: 'icon-29@2x.png', idiom: 'ipad', scale: '2x', size: '29x29' },
      { filename: 'icon-40.png', idiom: 'ipad', scale: '1x', size: '40x40' },
      { filename: 'icon-40@2x.png', idiom: 'ipad', scale: '2x', size: '40x40' },
      { filename: 'icon-76.png', idiom: 'ipad', scale: '1x', size: '76x76' },
      { filename: 'icon-76@2x.png', idiom: 'ipad', scale: '2x', size: '76x76' },
      { filename: 'icon-83.5@2x.png', idiom: 'ipad', scale: '2x', size: '83.5x83.5' },
      { filename: 'icon-1024.png', idiom: 'ios-marketing', scale: '1x', size: '1024x1024' },
    ],
    info: { author: 'xcode', version: 1 },
  };
  fs.writeFileSync(path.join(iconDir, 'Contents.json'), `${JSON.stringify(contents, null, 2)}\n`);

  const splashSet = path.join(root, 'ios/Gifteez/Images.xcassets/SplashLogo.imageset');
  await png('splash.svg', 200, 200, path.join(splashSet, 'splash.png'));
  await png('splash.svg', 400, 400, path.join(splashSet, 'splash@2x.png'));
  await png('splash.svg', 600, 600, path.join(splashSet, 'splash@3x.png'));
  fs.writeFileSync(
    path.join(splashSet, 'Contents.json'),
    `${JSON.stringify({
      images: [
        { filename: 'splash.png', idiom: 'universal', scale: '1x' },
        { filename: 'splash@2x.png', idiom: 'universal', scale: '2x' },
        { filename: 'splash@3x.png', idiom: 'universal', scale: '3x' },
      ],
      info: { author: 'xcode', version: 1 },
    }, null, 2)}\n`,
  );

  const legacy = [
    ['mipmap-mdpi', 48],
    ['mipmap-hdpi', 72],
    ['mipmap-xhdpi', 96],
    ['mipmap-xxhdpi', 144],
    ['mipmap-xxxhdpi', 192],
  ];
  const foreground = [
    ['mipmap-mdpi', 108],
    ['mipmap-hdpi', 162],
    ['mipmap-xhdpi', 216],
    ['mipmap-xxhdpi', 324],
    ['mipmap-xxxhdpi', 432],
  ];
  for (const [folder, size] of legacy) {
    const dir = path.join(root, 'android/app/src/main/res', folder);
    await png('icon.svg', size, size, path.join(dir, 'ic_launcher.png'));
    await circlePng('icon.svg', size, path.join(dir, 'ic_launcher_round.png'));
  }
  for (const [folder, size] of foreground) {
    const dir = path.join(root, 'android/app/src/main/res', folder);
    await png('icon-foreground.svg', size, size, path.join(dir, 'ic_launcher_foreground.png'));
  }
  await png('splash.svg', 512, 512, path.join(root, 'android/app/src/main/res/drawable-nodpi/splash_logo.png'));

  const art = path.join(root, 'src/assets');
  await png('empty-people.svg', 800, 420, path.join(art, 'empty-people.png'));
  await png('empty-fairness.svg', 800, 420, path.join(art, 'empty-fairness.png'));
  for (const season of ['base', 'fall', 'winter', 'spring', 'summer']) {
    await png(`skin-${season}.svg`, 1200, 320, path.join(art, 'skins', `${season}.png`));
  }

  const store = path.join(root, 'assets/store');
  const phones = [
    ['store-people.svg', 'iphone-people'],
    ['store-person.svg', 'iphone-person'],
    ['store-fairness.svg', 'iphone-fairness'],
  ];
  for (const [file, name] of phones) {
    await png(file, 1290, 2796, path.join(store, `${name}-6.7.png`));
    await png(file, 1284, 2778, path.join(store, `${name}-6.5.png`));
    await png(file, 1080, 1920, path.join(store, name.replace('iphone', 'android') + '.png'));
  }
  await png('store-feature.svg', 1024, 500, path.join(store, 'feature-graphic.png'));
  await png('store-ipad.svg', 2048, 2732, path.join(store, 'ipad-people.png'));
  console.log('Rasterized Gifteez assets.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
