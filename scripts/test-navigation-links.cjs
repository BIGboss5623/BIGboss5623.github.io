const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const home = read('index.html');
assert(home.includes('href="#bookmarks">常用网站</a>'));
for (const [url, label] of [
  ['https://openai.com/', 'OpenAI · AI 研究与工具'],
  ['https://chatgpt.com/', 'ChatGPT · AI 对话'],
]) {
  assert(home.includes('href="' + url + '" target="_blank" rel="noopener noreferrer">' + label),
    'missing secure official link: ' + url);
}
assert(read('company-home.html').includes('href="https://openai.com/"'),
  'preserve company official resource');
for (const p of ['fund/index.html', 'hzyx/index.html', 'about.html', 'help.html', 'contact.html', 'privacy.html']) {
  assert(read(p).includes('href="https://zgland.com/">ZGLAND 总导航 ↗</a>'),
    p + ' missing navigation to main portal');
}
for (const p of ['about.html', 'help.html', 'contact.html', 'privacy.html']) {
  assert(!read(p).includes('href="index.html"'), p + ' has ambiguous company home link');
  assert(read(p).includes('href="https://hzct.zgland.com/"'), p + ' needs corporate home');
}
console.log('PASS: official OpenAI/ChatGPT links and cross-site navigation');
