// 页面交互层：阅读进度条 / 栏目徽标 / 导航高亮 / 返回顶部 / 栏目进入视口淡入。
// 全部是渐进增强：导航靠 <a href="#栏目id"> 本身就能跳转，脚本失效页面照常可读。
// 依赖 index.html 提供这 5 个 id（见 tools/check-page.mjs 第 3 项）：
//   #reading-progress #section-indicator #to-top #works-tags #works-sort

// ===================== 准备：把要用到的元素抓到手 =====================
const progressBar = document.querySelector('#reading-progress')
const indicator = document.querySelector('#section-indicator')
const toTopButton = document.querySelector('#to-top')
const navLinks = document.querySelectorAll('nav a')

// 页面上所有栏目。hero 是首屏，section 是其余栏目，两类都要。
const sections = document.querySelectorAll('main .hero[id], main section[id]')

// 导航链接上的文字就是栏目的中文名，直接拿来用，不另外维护一份对照表：
// 以后在 HTML 里加栏目，这个文件一行都不用改。
const sectionNames = new Map()
navLinks.forEach(link => {
  sectionNames.set(link.getAttribute('href'), link.textContent.trim())
})

// ===================== 阅读进度条 =====================
// 已滚距离 ÷ 可滚总距离 = 读了百分之多少。页面太短时可滚距离为 0，
// 直接除会得到 NaN 让进度条停住，所以先挡一下分母。
function updateProgress() {
  const scrollable = document.documentElement.scrollHeight - window.innerHeight
  const ratio = scrollable > 0 ? window.scrollY / scrollable : 0
  progressBar.style.width = `${ratio * 100}%`
}

// ===================== 把"当前栏目"反映到界面上 =====================
// 高亮长什么样由 CSS 的 nav a.is-current 决定，JS 只管什么时候加这个类。
function showCurrent(hash) {
  // 没有 # 时默认第一个栏目，否则刚打开页面什么都不高亮
  const current = hash || '#about'

  // Map.get 取不到时返回 undefined，用 || '' 兜底，别让页面出现 "undefined"
  indicator.textContent = sectionNames.get(current) || ''

  navLinks.forEach(link => {
    const isCurrent = link.getAttribute('href') === current
    link.classList.toggle('is-current', isCurrent)

    // 顺带告诉读屏软件"当前在这一项"，视觉上看不见但无障碍需要
    if (isCurrent) link.setAttribute('aria-current', 'location')
    else link.removeAttribute('aria-current')
  })
}

// ===================== 点导航、按前进后退，高亮都要跟着走 =====================
window.addEventListener('hashchange', () => showCurrent(location.hash))
// 这里必须再直接调用一次：直接访问 index.html#skills 进来时 hash 从头到尾
// 没有"变化"过，hashchange 不会触发，不写这行就什么都不高亮。
showCurrent(location.hash)

// ===================== 滚过一屏，浮出"返回顶部" =====================
toTopButton.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
  // 回到顶部后地址栏的 # 还停在原处，手动同步一下，否则徽标还写着刚才那个栏目
  history.replaceState(null, '', location.pathname)
  showCurrent('#about')
})

// 滚动时做两件事，合成一个监听器：滚动一秒触发几十次，监听器越少越好。
window.addEventListener('scroll', () => {
  updateProgress()
  // 用 innerHeight * 0.6 而不是写死像素——手机屏和电脑屏高度差很多
  toTopButton.classList.toggle('is-visible', window.scrollY > window.innerHeight * 0.6)
})

// 首屏也要算一次，否则刷新时进度条是 0，但其实已经滚在中间了
updateProgress()

// ===================== 往下滚，高亮自己跟着走（scroll spy）=====================
// rootMargin 把判定用的视口上下各收窄 45%，只剩中间一条：必须滚到屏幕中间
// 才算"进入这个栏目"。不收窄的话栏目刚露头就切换，滚动时高亮会来回乱跳。
const spy = new IntersectionObserver(
  entries => {
    for (const entry of entries) {
      if (entry.isIntersecting) showCurrent(`#${entry.target.id}`)
    }
  },
  { rootMargin: '-45% 0px -45% 0px' },
)
sections.forEach(section => spy.observe(section))

// ===================== 栏目进入视口时淡入上移 =====================
// threshold 比上面那个宽松：露出 15% 就算进入，且只演一次（unobserve）。
const reveal = new IntersectionObserver(
  (entries, observer) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      entry.target.classList.add('is-visible')
      observer.unobserve(entry.target)
    }
  },
  { threshold: 0.15 },
)
sections.forEach(section => reveal.observe(section))
