// 作品筛选与排序。所有作品内容（标题/链接/截图）都写在 index.html 的 <ol class="portfolio-list"> 里。
// 本文件只做三件事：按 data-year 生成年份徽标、按 data-tags 生成筛选按钮、点按钮重排或隐藏卡片。
// 加作品或改标题只改 index.html，这里一行都不用动。
// data-* 是 HTML5 自定义数据属性，写在标签上，JS 用 dataset 读取。

const list = document.querySelector('.portfolio-list')
const tagBox = document.querySelector('#works-tags')
const sortButton = document.querySelector('#works-sort')

const cards = [...list.querySelectorAll('.work-card')].map((card, index) => ({
  card,
  tags: (card.dataset.tags || '').split(/\s+/).filter(Boolean),
  year: Number(card.dataset.year) || 0,
  index,
}))

for (const item of cards) {
  if (!item.year) continue
  const badge = document.createElement('span')
  badge.className = 'work-year'
  badge.textContent = item.year
  item.card.prepend(badge)
}

let activeTag = '全部'
let newestFirst = true

function getVisibleCards() {
  const matched = activeTag === '全部' ? cards : cards.filter(item => item.tags.includes(activeTag))
  return [...matched].sort((a, b) => (newestFirst ? b.year - a.year : a.year - b.year) || a.index - b.index)
}

function renderWorks() {
  const visible = getVisibleCards()

  if (visible.length === 0) {
    const empty = document.createElement('li')
    empty.className = 'works-empty'
    empty.textContent = '这个标签下还没有作品。'
    list.replaceChildren(empty)
    return
  }

  // 重画只复用 HTML 里原有的卡片并调整顺序，不要重新创建，否则年份徽标会重复
  list.replaceChildren(...visible.map(item => item.card))
}

function renderTags() {
  const tags = ['全部', ...new Set(cards.flatMap(item => item.tags))]

  tagBox.replaceChildren(
    ...tags.map(tag => {
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = tag
      button.setAttribute('aria-pressed', String(tag === activeTag))
      button.addEventListener('click', () => {
        activeTag = tag
        renderTags()
        renderWorks()
      })
      return button
    }),
  )
}

sortButton.addEventListener('click', () => {
  newestFirst = !newestFirst
  sortButton.textContent = newestFirst ? '按年份：新→旧' : '按年份：旧→新'
  renderWorks()
})

renderTags()
renderWorks()