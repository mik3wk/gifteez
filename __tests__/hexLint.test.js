const fs = require('fs');
const path = require('path');

const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g;

function filesUnder(dir) {
  const found = [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
    if (entry.name === 'theme') {
      return;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...filesUnder(full));
      return;
    }
    if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
      found.push(full);
    }
  });
  return found;
}

test('color hexes stay inside the theme', () => {
  const root = path.join(__dirname, '../src');
  const hits = filesUnder(root).flatMap(file => {
    const text = fs.readFileSync(file, 'utf8');
    const matches = text.match(HEX);
    return matches ? [`${path.relative(root, file)} ${matches.join(' ')}`] : [];
  });
  expect(hits).toEqual([]);
});
