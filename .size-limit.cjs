// Bundle budget (plan 3.1 step 6, ENGINEERING_STANDARDS): the JavaScript a browser must load before the
// first screen — the entry script plus every chunk index.html preloads — stays within 300 kB gzip.
// Run after `npm run build`: `npm run size`. Lazy route chunks are not part of the initial budget.
const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, 'dist');
const html = fs.existsSync(path.join(dist, 'index.html'))
  ? fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
  : '';
const initial = [
  ...html.matchAll(/<script[^>]+type="module"[^>]+src="\/?([^"]+\.js)"/g),
  ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="\/?([^"]+\.js)"/g),
].map((match) => path.join('dist', match[1]));

module.exports = [
  {
    name: 'initial JS (entry + preloaded chunks)',
    path: initial.length > 0 ? initial : ['dist/index.html.missing-run-npm-run-build'],
    limit: '300 kB',
    gzip: true,
  },
];
