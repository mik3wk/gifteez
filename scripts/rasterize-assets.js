#!/usr/bin/env node
/**
 * Rasterize seasonal banners and store graphics from assets/src/*.svg.
 * The app icon and launch mark come from assets/brand (sticker renders).
 * Commit the sources and the generated PNGs.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'assets/src');

async function png(name, width, height, dest, options = {}) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  await sharp(path.join(src, name), { density: 300 })
    .resize(width, height, { fit: 'fill' })
    .png({ compressionLevel: 9, palette: options.palette !== false })
    .toFile(dest);
}

function hexByte(value) {
  return value.toString(16).padStart(2, '0');
}

async function borderColor(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  const take = (x, y) => {
    const i = (y * info.width + x) * 4;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n += 1;
  };
  for (let x = 0; x < info.width; x += 4) {
    take(x, 0);
    take(x, info.height - 1);
  }
  for (let y = 0; y < info.height; y += 4) {
    take(0, y);
    take(info.width - 1, y);
  }
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
}

async function rasterizeBrand() {
  const brand = path.join(root, 'assets/brand');
  const iconSrc = path.join(brand, 'app-icon-1024.png');
  const bg = await borderColor(iconSrc);
  const rgb1024 = await sharp(iconSrc)
    .resize(1024, 1024, { fit: 'fill', kernel: 'lanczos3' })
    .flatten({ background: bg })
    .removeAlpha()
    .toColorspace('srgb')
    .png({ compressionLevel: 9, palette: false })
    .toBuffer();
  const iconMeta = await sharp(rgb1024).metadata();
  if (iconMeta.hasAlpha || iconMeta.isPalette || iconMeta.width !== 1024 || iconMeta.channels !== 3) {
    throw new Error(`app icon must be 1024 RGB without alpha, got ${JSON.stringify(iconMeta)}`);
  }
  fs.writeFileSync(iconSrc, rgb1024);

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
    await sharp(rgb1024)
      .resize(size, size, { fit: 'fill', kernel: 'lanczos3' })
      .removeAlpha()
      .png({ compressionLevel: 9, palette: false })
      .toFile(path.join(iconDir, file));
  }

  const res = path.join(root, 'android/app/src/main/res');
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
    const dir = path.join(res, folder);
    await sharp(rgb1024)
      .resize(size, size, { fit: 'fill', kernel: 'lanczos3' })
      .removeAlpha()
      .png({ compressionLevel: 9, palette: false })
      .toFile(path.join(dir, 'ic_launcher.png'));
    const mask = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`,
    );
    const icon = await sharp(rgb1024).resize(size, size, { fit: 'fill' }).png().toBuffer();
    await sharp(icon)
      .composite([{ input: mask, blend: 'dest-in' }])
      .png({ compressionLevel: 9 })
      .toFile(path.join(dir, 'ic_launcher_round.png'));
  }
  for (const [folder, size] of foreground) {
    const inner = Math.round(size * 0.8);
    const scaled = await sharp(rgb1024).resize(inner, inner, { fit: 'fill', kernel: 'lanczos3' }).png().toBuffer();
    await sharp({
      create: { width: size, height: size, channels: 4, background: { ...bg, alpha: 255 } },
    })
      .composite([{ input: scaled, gravity: 'center' }])
      .png({ compressionLevel: 9 })
      .toFile(path.join(res, folder, 'ic_launcher_foreground.png'));
  }
  const monoFolders = [
    ['drawable-mdpi', 108],
    ['drawable-hdpi', 162],
    ['drawable-xhdpi', 216],
    ['drawable-xxhdpi', 324],
    ['drawable-xxxhdpi', 432],
  ];
  for (const [folder, size] of monoFolders) {
    fs.mkdirSync(path.join(res, folder), { recursive: true });
    const inner = Math.round(size * 0.8);
    const resized = await sharp(rgb1024).resize(inner, inner, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixels = Buffer.from(resized.data);
    for (let i = 0; i < pixels.length; i += 4) {
      const dist = Math.hypot(pixels[i] - bg.r, pixels[i + 1] - bg.g, pixels[i + 2] - bg.b);
      pixels[i] = 255;
      pixels[i + 1] = 255;
      pixels[i + 2] = 255;
      pixels[i + 3] = dist < 48 ? 0 : pixels[i + 3];
    }
    const glyph = await sharp(pixels, {
      raw: { width: resized.info.width, height: resized.info.height, channels: 4 },
    }).png().toBuffer();
    await sharp({
      create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([{ input: glyph, gravity: 'center' }])
      .png({ compressionLevel: 9 })
      .toFile(path.join(res, folder, 'ic_launcher_monochrome.png'));
  }
  fs.rmSync(path.join(res, 'drawable/ic_launcher_monochrome.xml'), { force: true });
  const colorsPath = path.join(res, 'values/colors.xml');
  const hex = `#${hexByte(bg.r)}${hexByte(bg.g)}${hexByte(bg.b)}`.toUpperCase();
  const colors = fs.readFileSync(colorsPath, 'utf8').replace(
    /(<color name="icon_background">)#[0-9A-Fa-f]{6}(<\/color>)/,
    `$1${hex}$2`,
  );
  fs.writeFileSync(colorsPath, colors);

  const splashSet = path.join(root, 'ios/Gifteez/Images.xcassets/SplashLogo.imageset');
  const splashScales = [
    ['splash-mark.png', 'splash.png', 'splash-dark.png'],
    ['splash-mark@2x.png', 'splash@2x.png', 'splash-dark@2x.png'],
    ['splash-mark@3x.png', 'splash@3x.png', 'splash-dark@3x.png'],
  ];
  for (const [sourceName, lightName, darkName] of splashScales) {
    const bytes = fs.readFileSync(path.join(brand, sourceName));
    fs.writeFileSync(path.join(splashSet, lightName), bytes);
    fs.writeFileSync(path.join(splashSet, darkName), bytes);
  }
  const mark = fs.readFileSync(path.join(brand, 'splash-mark@3x.png'));
  for (const folder of ['drawable-xxhdpi', 'drawable-night-xxhdpi']) {
    fs.mkdirSync(path.join(res, folder), { recursive: true });
    fs.writeFileSync(path.join(res, folder, 'splash_logo.png'), mark);
  }
  const padded = await sharp({
    create: { width: 600, height: 600, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: await sharp(mark).resize(360, 360, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(), gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toBuffer();
  for (const folder of ['drawable-xxhdpi', 'drawable-night-xxhdpi']) {
    fs.writeFileSync(path.join(res, folder, 'splash_icon.png'), padded);
  }
  fs.rmSync(path.join(res, 'drawable-nodpi/splash_logo.png'), { force: true });
  fs.rmSync(path.join(res, 'drawable-night-nodpi/splash_logo.png'), { force: true });
  console.log(`Brand icon background ${hex}`);
}

async function main() {
  await rasterizeBrand();
  const art = path.join(root, 'src/assets');
  for (const season of ['base', 'fall', 'winter', 'spring', 'summer']) {
    await png(`skin-${season}.svg`, 1200, 320, path.join(art, 'skins', `${season}.png`), { palette: false });
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

const job = process.argv.includes('--brand') ? rasterizeBrand : main;
job().catch(error => {
  console.error(error);
  process.exit(1);
});
