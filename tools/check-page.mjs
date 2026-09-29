// 个人主页自检脚本
//
// 用法：node tools/check-page.mjs
//
// 它做八件事：
//   1. 必须有的文件在不在
//   2. index.html 里有没有编辑器残留属性（data-page-node-id 之类）
//   3. id 是否唯一、5 个必需 id 是否都在
//   4. 导航和栏目是否一一对应（漏写一边都算错）
//   5. index.html 引用的本地文件（css / js / 图片）是不是真的存在
//   6. 页内锚点 #xxx 有没有对应的 id
//   7. 每张图片有没有像样的 alt
//   8. works-data.js 的作品数组和 index.html 里的卡片是不是一一对应
//
// 第 2~4 项守的是「加内容只改 index.html」这条约定：日常维护只动 HTML，
// 写错了这里就拦住，不用靠人眼盯着。
//
// 不依赖任何第三方包，Node 24 自带的能力就够。
// GitHub Actions 里也跑这一条，所以推上去之前先在本地跑一次。

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const problems = [];
const ok = (msg) => console.log('  [OK]', msg);
const bad = (msg) => { problems.push(msg); console.log('  [X] ', msg); };

console.log('== 1. 必须有的文件 ==');
// index.html 是内容，其余是机制层：改内容时它们都不用动，但不能丢
for (const name of ['index.html', 'styles.css', 'app.js', 'works-render.js', 'motion.js', 'works-data.js']) {
  if (fs.existsSync(path.join(root, name))) ok(name);
  else bad(`缺少 ${name}`);
}

const htmlPath = path.join(root, 'index.html');
if (!fs.existsSync(htmlPath)) {
  console.log('\n找不到 index.html，后面的检查没法做。');
  process.exit(1);
}
const html = fs.readFileSync(htmlPath, 'utf8');

// 注释里也会出现标签示例（比如模板里的 <li class="work-card">、"href=#新id"），
// 那是写给人数看的说明，不是真标签。当成真标签会误报，所以先摘掉注释再检查。
const markup = html.replace(/<!--[\s\S]*?-->/g, '');

console.log('\n== 2. 编辑器残留属性 ==');
// data-page-node-id 是页面编辑器写进标签里的内部元数据，全项目没有任何代码读它。
// 这里盯着它，别让它再写回来。
const junkAttrs = [...new Set([...markup.matchAll(/\s(data-page-[a-z-]+)=/g)].map((m) => m[1]))];
if (junkAttrs.length === 0) {
  ok('没有 data-page-* 残留属性');
} else {
  for (const name of junkAttrs) bad(`index.html 里有 ${name} 残留属性（编辑器写进去的，请删掉）`);
}

console.log('\n== 3. id 唯一性与必需 id ==');
const idList = [...markup.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const idCount = new Map();
for (const id of idList) idCount.set(id, (idCount.get(id) || 0) + 1);

const dupes = [...idCount].filter(([, n]) => n > 1);
if (dupes.length) {
  // 重复 id 会让 getElementById 只认第一个，锚点跳转也会跳错地方
  for (const [id, n] of dupes) bad(`id="${id}" 出现了 ${n} 次，id 必须唯一`);
} else {
  ok(`页面共 ${idCount.size} 个 id，无重复`);
}

// 这 5 个 id 是 app.js 直接 getElementById 取的。
// 删掉任意一个，脚本会抛错，整页卡在淡入前的半透明状态——页面看起来"像是坏了"。
const REQUIRED_IDS = ['reading-progress', 'section-indicator', 'to-top', 'works-tags', 'works-sort'];
for (const id of REQUIRED_IDS) {
  if (idCount.has(id)) ok(`#${id}`);
  else bad(`缺少必需的 id="${id}"（app.js 会报错，整页卡在半透明状态）`);
}

console.log('\n== 4. 导航与栏目是否对齐 ==');
// 「栏目」的判定要和 app.js 的选择器保持一致：main 里 class 含 section 或 hero、且带 id 的元素。
// 用整词匹配，这样 class="section-heading" / "section-indicator" 不会被误当成栏目。
const mainHtml = (markup.match(/<main\b[^>]*>([\s\S]*)<\/main>/) || [, ''])[1];
const sectionIds = [];
for (const tag of mainHtml.matchAll(/<(?:section|div)\b([^>]*)>/g)) {
  const attrs = tag[1];
  const classes = ((attrs.match(/\sclass="([^"]*)"/) || [, ''])[1]).split(/\s+/).filter(Boolean);
  if (!classes.includes('section') && !classes.includes('hero')) continue;
  const id = (attrs.match(/\sid="([^"]+)"/) || [, ''])[1];
  if (id) sectionIds.push(id);
}

const navHtml = (markup.match(/<nav\b[^>]*>([\s\S]*?)<\/nav>/) || [, ''])[1];
const navHrefs = [...navHtml.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);

// 单独计数：本项没问题才报 OK，不受前面第 1~3 项结果影响
let navProblems = 0;
const badNav = (msg) => { navProblems++; bad(msg); };

if (sectionIds.length === 0) badNav('main 里没找到任何栏目（class 含 section 或 hero 且带 id 的元素）');

const dupNav = navHrefs.filter((h, i) => navHrefs.indexOf(h) !== i);
for (const h of new Set(dupNav)) badNav(`导航里 #${h} 重复出现`);

for (const href of navHrefs) {
  if (!sectionIds.includes(href)) badNav(`导航指向 #${href}，但 main 里没有这个栏目`);
}
for (const id of sectionIds) {
  if (!navHrefs.includes(id)) badNav(`栏目 id="${id}" 没有出现在导航里（加了栏目要同步加导航）`);
}
if (navProblems === 0) {
  ok(`导航 ${navHrefs.length} 项，栏目 ${sectionIds.length} 个，一一对应`);
}

console.log('\n== 5. index.html 引用的本地文件 ==');
// 取出所有 href/src，跳过 http(s)、data:、mailto: 和页内锚点
const refs = [...markup.matchAll(/(?:href|src)="([^"]+)"/g)]
  .map((m) => m[1])
  .filter((v) => !/^(https?:|data:|mailto:|#|\/\/)/.test(v));

for (const ref of [...new Set(refs)]) {
  const target = path.join(root, ref.split('?')[0].split('#')[0]);
  if (fs.existsSync(target)) ok(ref);
  else bad(`引用了不存在的文件：${ref}`);
}

console.log('\n== 6. 页内锚点 ==');
const ids = new Set(idList);
const anchors = [...new Set([...markup.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]))];
// 注释已整段剥掉，正常不会碰到占位符；留一道保险，
// 以免以后有人把「栏目模板」写在注释外面被当真锚点检查。
const PLACEHOLDER_ANCHORS = new Set(['栏目ID', '新id']);
for (const anchor of anchors) {
  if (PLACEHOLDER_ANCHORS.has(anchor)) continue;
  if (ids.has(anchor)) ok(`#${anchor}`);
  else bad(`导航指向 #${anchor}，但页面里没有 id="${anchor}"`);
}

console.log('\n== 7. 图片的 alt ==');
// alt 是图片加载失败时的替代文字，也是视障用户理解图片的唯一途径。
// 它很容易在改代码时被删掉，而且页面看起来完全正常，人工发现不了。
const WEAK_ALT = new Set(['图片', '照片', 'image', 'photo', 'img']);
const imgs = [...markup.matchAll(/<img[^>]*>/g)].map((m) => m[0]);
for (const tag of imgs) {
  const found = tag.match(/alt="([^"]*)"/);
  const brief = tag.slice(0, 60);
  if (!found) bad(`图片缺少 alt：${brief}`);
  else if (!found[1].trim()) bad(`图片的 alt 是空的：${brief}`);
  else if (WEAK_ALT.has(found[1].trim())) bad(`alt 写得太笼统（"${found[1]}"）：${brief}`);
  else ok(found[1]);
}

console.log('\n== 8. works-data.js 与 index.html 的作品是否对齐 ==');
// 页面渲染的作品在 index.html 里，works-data.js 里还有一份同样内容的数组。
// 两份数据一旦分叉，页面看起来还是正常的——这正是最该交给机器查的问题。
// 这里用 vm 把 works-data.js 当普通脚本跑一遍取值，它没有 import/export，不需要打包工具。

const worksDataPath = path.join(root, 'works-data.js');
const attr = (attrs, name) => (attrs.match(new RegExp(`${name}="([^"]*)"`)) || [, ''])[1];
const text = (s) => s.replace(/\s+/g, ' ').trim();
const pick = (source, re) => text((source.match(re) || [, ''])[1]);

let works = null;
if (!fs.existsSync(worksDataPath)) {
  bad('缺少 works-data.js（作品数组）');
} else {
  try {
    const sandbox = {};
    vm.createContext(sandbox);
    vm.runInContext(
      `${fs.readFileSync(worksDataPath, 'utf8')}\n;globalThis.__works = works;`,
      sandbox,
      { filename: 'works-data.js' },
    );
    works = sandbox.__works;
    if (!Array.isArray(works)) bad('works-data.js 里的 works 不是数组');
  } catch (err) {
    bad(`works-data.js 读不出来（语法错误？）：${err.message}`);
  }
}

// 从页面里取出每张作品卡片：属性在 <li> 上，标题/说明/封面/链接在卡片内部
const pageWorks = [...markup.matchAll(/<li[^>]*\sclass="work-card[^"]*"([^>]*)>([\s\S]*?)<\/li>/g)]
  .map((m) => {
    const [, attrs, inner] = m;
    return {
      title: pick(inner, /<h3[^>]*>([\s\S]*?)<\/h3>/),
      description: pick(inner, /<p[^>]*>([\s\S]*?)<\/p>/),
      image: pick(inner, /<img[^>]*\ssrc="([^"]*)"/),
      url: pick(inner, /<a[^>]*\shref="([^"]*)"/),
      year: Number(attr(attrs, 'data-year')) || 0,
      tags: attr(attrs, 'data-tags').split(/\s+/).filter(Boolean),
    };
  });

if (Array.isArray(works)) {
  if (works.length !== pageWorks.length) {
    bad(`作品数量不一致：works-data.js 有 ${works.length} 个，index.html 有 ${pageWorks.length} 个`);
  } else {
    works.forEach((work, i) => {
      const page = pageWorks[i];
      const diffs = [];
      if (work.title !== page.title) diffs.push(`title「${work.title}」≠ 页面「${page.title}」`);
      if (work.description !== page.description) diffs.push(`description「${work.description}」≠ 页面「${page.description}」`);
      if (work.image !== page.image) diffs.push(`image「${work.image}」≠ 页面「${page.image}」`);
      if (work.url !== page.url) diffs.push(`url「${work.url}」≠ 页面「${page.url}」`);
      if (Number(work.year) !== page.year) diffs.push(`year「${work.year}」≠ 页面「${page.year}」`);
      if ((work.tags || []).join(' ') !== page.tags.join(' ')) diffs.push(`tags「${(work.tags || []).join(' ')}」≠ 页面「${page.tags.join(' ')}」`);
      if (diffs.length) bad(`第 ${i + 1} 个作品对不上：${diffs.join('；')}`);
      else ok(`第 ${i + 1} 个作品：${page.title}`);
    });
  }

  // 数组里的封面图不在 index.html 的引用里，第 5 项查不到，这里单独查一遍
  for (const work of works) {
    if (!work.image) continue;
    if (fs.existsSync(path.join(root, work.image))) ok(`封面 ${work.image}`);
    else bad(`封面图不存在：${work.image}`);
  }
}

console.log('');
if (problems.length) {
  console.log(`自检未通过，共 ${problems.length} 个问题，请逐条修好再提交。`);
  process.exit(1);
}
console.log('自检通过。');
