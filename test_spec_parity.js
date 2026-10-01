/**
 * The platform table exists twice: src/lib/platformSpecs.ts drives the UI, the previews and the
 * editor limits; tools/generate_calendar.py drives what is actually generated and at what size.
 * If they drift, the app promises one thing and the generator does another - which is exactly how
 * "the image came out the wrong size" bugs happen. This suite fails when they disagree.
 *
 * Run: node test_spec_parity.js
 */
const fs = require('fs');
const path = require('path');

const ts = fs.readFileSync(path.join(__dirname, 'src', 'lib', 'platformSpecs.ts'), 'utf8');
const py = fs.readFileSync(path.join(__dirname, 'tools', 'generate_calendar.py'), 'utf8');

let pass = 0;
let fail = 0;
const check = (name, ok, detail) => {
  if (ok) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ''}`);
  }
};

/** The body of one object literal, from its key to the matching close. */
function block(text, keyPattern) {
  const m = text.match(keyPattern);
  if (!m || m.index === undefined) return null;
  const from = m.index + m[0].length;
  const end = text.indexOf('\n  }', from);
  return text.slice(from, end === -1 ? undefined : end);
}

function fromTs(platform) {
  const b = block(ts, new RegExp(`\\b${platform}:\\s*\\{`));
  if (!b) return null;
  const size = (b.match(/imageSize:\s*\[(\d+),\s*(\d+)\]/) || []).slice(1, 3).map(Number);
  return {
    maxChars: Number((b.match(/maxChars:\s*(\d+)/) || [])[1]),
    size,
    ratio: (b.match(/ratio:\s*'([^']+)'/) || [])[1],
    hashtags: (b.match(/hashtags:\s*'([^']+)'/) || [])[1],
  };
}

function fromPy(platform) {
  const b = block(py, new RegExp(`"${platform}":\\s*\\{`));
  if (!b) return null;
  const size = (b.match(/"image_size":\s*\((\d+),\s*(\d+)\)/) || []).slice(1, 3).map(Number);
  return {
    maxChars: Number((b.match(/"max_chars":\s*(\d+)/) || [])[1]),
    size,
    ratio: (b.match(/"ratio":\s*"([^"]+)"/) || [])[1],
    hashtags: (b.match(/"hashtags":\s*"([^"]+)"/) || [])[1],
  };
}

console.log('\n=== platform spec parity: src/lib/platformSpecs.ts  vs  tools/generate_calendar.py ===\n');

const PLATFORMS = ['TWITTER', 'LINKEDIN', 'INSTAGRAM'];
const sizes = [];
const ratios = [];

for (const platform of PLATFORMS) {
  const a = fromTs(platform);
  const b = fromPy(platform);
  check(
    `${platform}: present in both tables`,
    !!a && !!b,
    a ? (b ? '' : 'missing in the python generator') : 'missing in typescript'
  );
  if (!a || !b) continue;

  console.log(`        ts  ${a.maxChars} chars, ${a.size.join('x')} (${a.ratio}), hashtags ${a.hashtags}`);
  console.log(`        py  ${b.maxChars} chars, ${b.size.join('x')} (${b.ratio}), hashtags ${b.hashtags}`);

  check(`${platform}: character limit matches`, a.maxChars === b.maxChars, `ts ${a.maxChars} vs py ${b.maxChars}`);
  check(
    `${platform}: image size matches`,
    a.size[0] === b.size[0] && a.size[1] === b.size[1],
    `ts ${a.size.join('x')} vs py ${b.size.join('x')}`
  );
  check(`${platform}: aspect ratio matches`, a.ratio === b.ratio, `ts ${a.ratio} vs py ${b.ratio}`);
  check(`${platform}: hashtag guidance matches`, a.hashtags === b.hashtags, `ts "${a.hashtags}" vs py "${b.hashtags}"`);

  sizes.push(`${a.size[0]}x${a.size[1]}`);
  ratios.push(a.ratio);
}

console.log('');
check('present for all three platforms', sizes.length === PLATFORMS.length, `${sizes.length} of ${PLATFORMS.length}`);
check('no two platforms share an image size', new Set(sizes).size === sizes.length, sizes.join(' | '));
check('each platform has its own aspect ratio', new Set(ratios).size === ratios.length, ratios.join(' | '));

console.log(`\n================================================`);
console.log(`  RESULT: ${pass} passed, ${fail} failed`);
console.log(`================================================\n`);
process.exit(fail === 0 ? 0 : 1);
