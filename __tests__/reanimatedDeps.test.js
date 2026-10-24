const fs = require('fs');
const path = require('path');

const CALL = /(?:useAnimatedStyle|useDerivedValue)\s*(?:<[^>]*>)?\s*\(/g;

function filesUnder(dir) {
  const found = [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...filesUnder(full));
      return;
    }
    if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
      found.push(full);
    }
  });
  return found;
}

/** True when a call has a second argument. Native Reanimated ignores that array and warns. */
function callHasDeps(source, openParen) {
  let parens = 0;
  let braces = 0;
  let brackets = 0;
  let quote = '';
  for (let i = openParen; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];
    if (quote) {
      if (ch === '\\') {
        i += 1;
        continue;
      }
      if (ch === quote) {
        quote = '';
      }
      continue;
    }
    if (ch === '/' && next === '/') {
      const end = source.indexOf('\n', i);
      i = end === -1 ? source.length : end;
      continue;
    }
    if (ch === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      i = end === -1 ? source.length : end + 1;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '(') {
      parens += 1;
      continue;
    }
    if (ch === ')') {
      parens -= 1;
      if (parens === 0) {
        return false;
      }
      continue;
    }
    if (ch === '{') {
      braces += 1;
      continue;
    }
    if (ch === '}') {
      braces -= 1;
      continue;
    }
    if (ch === '[') {
      brackets += 1;
      continue;
    }
    if (ch === ']') {
      brackets -= 1;
      continue;
    }
    if (ch === ',' && parens === 1 && braces === 0 && brackets === 0) {
      return true;
    }
  }
  return false;
}

function depsCalls(source) {
  const hits = [];
  CALL.lastIndex = 0;
  let match = CALL.exec(source);
  while (match) {
    const openParen = match.index + match[0].length - 1;
    if (callHasDeps(source, openParen)) {
      const line = source.slice(0, match.index).split('\n').length;
      hits.push(`${match[0].replace(/\s+/g, '')} line ${line}`);
    }
    match = CALL.exec(source);
  }
  return hits;
}

test('animated styles and derived values take no dependency array', () => {
  const root = path.join(__dirname, '../src');
  const hits = filesUnder(root).flatMap(file => (
    depsCalls(fs.readFileSync(file, 'utf8')).map(hit => `${path.relative(root, file)} ${hit}`)
  ));
  expect(hits).toEqual([]);
});

test('the dependency scan notices a second argument', () => {
  expect(depsCalls('useAnimatedStyle(() => ({ opacity: 1 }))')).toEqual([]);
  expect(depsCalls('useAnimatedStyle(() => {\n  return { opacity: 1, transform: [{ scale: 1 }] };\n})')).toEqual([]);
  expect(depsCalls('useDerivedValue(() => value.value)')).toEqual([]);
  expect(depsCalls('useAnimatedStyle(() => ({ opacity: 1 }), [distance])').length).toBe(1);
  expect(depsCalls('useAnimatedStyle(\n() => ({ opacity: progress.value }),\n[distance],\n)').length).toBe(1);
  expect(depsCalls('useDerivedValue(() => value.value, [value])').length).toBe(1);
});
