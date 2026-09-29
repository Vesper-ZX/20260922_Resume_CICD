// 动效层：只做增强，不接管任何功能。整个文件删掉，页面照常能读能点。
//
// 两条约定：
//   1. 不碰 app.js / works-render.js 的逻辑，只搭在它们已经做好的结果上。
//   2. 所有动效样式都挂在 <html class="motion-on"> 下（见 styles.css 末尾），
//      没有这个类就一条都不生效——这就是"关了动效就完全回到静态样式"。
//
// 效果清单：
//   01 栏目内容按顺序错峰上浮淡入   02 头像跟随鼠标轻微视差
//   03 作品卡片悬停 3D 倾斜 + 高光    04 筛选 / 排序走 FLIP 平移动画
//   05 正文滚动后侧栏压出一层投影

const motionReduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ============ 01 错峰入场 ============
// 元素不写死在 HTML 里，由下面的选择器自动认领——
// 以后在 index.html 里加一条经历 / 一个奖项 / 一张作品卡，动效自动带上。
const REVEAL_SELECTORS = [
  '.hero-copy > *',          // 姓名、身份、学校
  '.hero-visual',            // 头像
  '.research-direction',     // 学习方向
  '.profile-details > div',  // 基本资料
  '.section-heading',        // 每个栏目的标题
  '.experience-item',        // 教育经历
  '.research-item',          // 项目经历
  '.skills-list > li',       // 竞赛奖项
  '.works-toolbar',          // 作品筛选栏
  '.portfolio-list > li',    // 作品卡片
  '.group > h3',             // 项目经历 / 竞赛经历 / 学习记录的小节标题
  '.group > ol > li',
]

const REVEAL_STEP = 60     // 相邻两项之间隔多久（毫秒）
// 单批等待上限：让首屏那批（姓名/身份/学校/头像/方向 + 资料 5 条）都排得上队，
// 又不至于让条目很多的栏目等到天荒地老。
const REVEAL_MAX_DELAY = 540

function startReveal() {
  // 没有 IntersectionObserver 就整段不启用：宁可没有动效，
  // 也不能让内容因为"永远等不到 is-revealed"而一直隐形。
  if (!('IntersectionObserver' in window)) return

  const scopes = document.querySelectorAll('main .hero[id], main section[id]')

  scopes.forEach(scope => {
    collectRevealTargets(scope).forEach((element, index) => {
      element.classList.add('reveal-item')
      // 用行内 CSS 变量传延迟，比给每个元素写一个类名灵活得多
      element.style.setProperty('--reveal-delay', `${Math.min(index * REVEAL_STEP, REVEAL_MAX_DELAY)}ms`)
    })
  })

  const observer = new IntersectionObserver(
    (entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.querySelectorAll('.reveal-item').forEach(el => el.classList.add('is-revealed'))
        obs.unobserve(entry.target) // 只演一次，往回滚不再重播
      }
    },
    { threshold: 0.08, rootMargin: '0px 0px -6% 0px' },
  )
  scopes.forEach(scope => observer.observe(scope))
}

// 按选择器挨个收，去重后再按文档顺序排——
// 保证"错峰"顺序和眼睛看到的从上到下顺序一致。
function collectRevealTargets(scope) {
  const targets = []
  for (const selector of REVEAL_SELECTORS) {
    scope.querySelectorAll(selector).forEach(el => {
      if (!targets.includes(el)) targets.push(el)
    })
  }
  return targets.sort((a, b) =>
    a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
  )
}

// ============ 05 侧栏投影 ============
// 只切一个类名，长什么样由 CSS 决定（宽屏往右投、窄屏往下投）。
function startSidebarShadow() {
  const sidebar = document.querySelector('.sidebar')
  if (!sidebar) return

  let queued = false
  const update = () => {
    queued = false
    sidebar.classList.toggle('is-scrolled', window.scrollY > 40)
  }
  // 滚动一秒触发几十次，用 rAF 压成每帧最多算一次
  window.addEventListener('scroll', () => {
    if (queued) return
    queued = true
    requestAnimationFrame(update)
  }, { passive: true })
  update()
}

// ============ 02 头像视差 ============
// 鼠标在首屏移动时头像轻微位移 + 旋转。用「缓动追目标值」而不是直接用鼠标坐标：
// 坐标是跳变的，追值才是顺滑的。
function startHeroParallax() {
  const hero = document.querySelector('main .hero[id]')
  const figure = hero && hero.querySelector('.hero-visual figure')
  if (!figure) return

  const MAX_SHIFT = 10 // 像素，别太大，晕
  let targetX = 0
  let targetY = 0
  let currentX = 0
  let currentY = 0
  let frame = 0

  const tick = () => {
    currentX += (targetX - currentX) * 0.12
    currentY += (targetY - currentY) * 0.12
    figure.style.transform =
      `translate3d(${(currentX * MAX_SHIFT).toFixed(2)}px, ${(currentY * MAX_SHIFT * 0.8).toFixed(2)}px, 0) rotate(${(currentX * 1.2).toFixed(2)}deg)`

    // 还没追上就继续追，追上了就停——不空转，省电
    if (Math.abs(targetX - currentX) > 0.001 || Math.abs(targetY - currentY) > 0.001) {
      frame = requestAnimationFrame(tick)
    } else {
      frame = 0
    }
  }
  const kick = () => { if (!frame) frame = requestAnimationFrame(tick) }

  hero.addEventListener('mousemove', event => {
    const rect = hero.getBoundingClientRect()
    // 归一化到 -0.5 ~ 0.5：这样窗口大小变了效果幅度也不变
    targetX = (event.clientX - rect.left) / rect.width - 0.5
    targetY = (event.clientY - rect.top) / rect.height - 0.5
    kick()
  })
  hero.addEventListener('mouseleave', () => {
    targetX = 0
    targetY = 0
    kick()
  })
}

// ============ 03 作品卡片 3D 倾斜 ============
// 只写 CSS 变量，真正拼 transform 的是 styles.css，两边互不打架。
// 卡片被 works-render.js 重排时是复用的（不重建），所以这里绑一次的监听不会丢。
function startCardTilt() {
  const cards = document.querySelectorAll('.work-card > a')
  const MAX_TILT = 5 // 度。页面是安静的衬线风格，倾斜别给太大

  cards.forEach(card => {
    card.addEventListener('mousemove', event => {
      const rect = card.getBoundingClientRect()
      const px = (event.clientX - rect.left) / rect.width - 0.5
      const py = (event.clientY - rect.top) / rect.height - 0.5
      card.style.setProperty('--tilt-x', `${(-py * MAX_TILT * 2).toFixed(2)}deg`)
      card.style.setProperty('--tilt-y', `${(px * MAX_TILT * 2).toFixed(2)}deg`)
      // 高光位置，交给 CSS 的 radial-gradient
      card.style.setProperty('--glow-x', `${(px * 100 + 50).toFixed(1)}%`)
      card.style.setProperty('--glow-y', `${(py * 100 + 50).toFixed(1)}%`)
    })
    card.addEventListener('mouseleave', () => {
      card.style.setProperty('--tilt-x', '0deg')
      card.style.setProperty('--tilt-y', '0deg')
    })
  })
}

// ============ 04 筛选 / 排序的 FLIP 动画 ============
// FLIP = 先量旧位置、重排后量新位置、算出位移差、再动回去。
// 关键点：用**捕获阶段**监听（第三个参数 true）。
// 事件传播顺序是「捕获 → 目标 → 冒泡」，所以工具栏上的捕获监听一定早于
// 按钮自己（works-render.js）的冒泡监听执行，正好赶上"重排发生之前"量第一遍位置。
// 好处：一行都不用改 works-render.js，两个文件互不干扰。
function startWorksFlip() {
  const list = document.querySelector('.portfolio-list')
  const toolbar = document.querySelector('.works-toolbar')
  if (!list || !toolbar) return

  toolbar.addEventListener('click', () => {
    const before = new Map()
    list.querySelectorAll('.work-card').forEach(card => {
      before.set(card, card.getBoundingClientRect())
    })

    // 等这一刻的同步代码全部跑完（重排已落地）再量第二遍
    requestAnimationFrame(() => {
      list.querySelectorAll('.work-card').forEach(card => {
        const last = card.getBoundingClientRect()
        const first = before.get(card)

        // 之前被筛掉的卡片重新出现：没有旧位置，改成淡入 + 轻微放大
        if (!first) {
          card.animate(
            [{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'none' }],
            { duration: 320, easing: 'cubic-bezier(.22,.61,.36,1)' },
          )
          return
        }

        const dx = first.left - last.left
        const dy = first.top - last.top
        if (!dx && !dy) return // 没挪窝的卡片不用动

        // 先"瞬间"挪回旧位置，再动画放行回新位置，看起来就是卡片自己滑过去的
        card.animate(
          [{ transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)` }, { transform: 'none' }],
          { duration: 420, easing: 'cubic-bezier(.22,.61,.36,1)' },
        )
      })
    })
  }, true)
}

// ============ 统一启动 ============
// 启动必须放在文件最后：上面的 REVEAL_SELECTORS 等常量是 const 声明的，
// 有"暂时性死区"，在它们初始化前调用 startReveal() 会直接抛错。
// 函数声明会提升、const 不会，这个坑很隐蔽：脚本一挂整页动效全没了。
if (!motionReduce) {
  document.documentElement.classList.add('motion-on')
  startSidebarShadow() // 05
  startReveal()        // 01
  startHeroParallax()  // 02
  startCardTilt()      // 03
  startWorksFlip()     // 04
}
