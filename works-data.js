// 作品数组：页面上那份作品列表的**镜像副本，不是数据源**。
//
//   页面真正渲染的作品写在 index.html 的 <ol class="portfolio-list"> 里，
//   筛选和排序由 works-render.js 读 HTML 的 data-tags / data-year 完成，
//   都不读这个文件。所以加作品、改标题仍然只改 index.html。
//
//   但为了让两份数据不会静默分叉，这里要同步维护一份：
//   tools/check-page.mjs 第 8 项会逐条比对数量、标题、说明、封面、链接、年份、标签，
//   任何一处不一致自检就失败——改了页面忘了改这里，CI 会拦住。
//
// 六个字段各管一件事：
//   title        卡片标题
//   description  一句话说明
//   image        封面图路径，必须是真实存在的文件（当前在 imgs/ 下）
//   url          点击去哪，与 index.html 里 <a href> 保持一致
//   year         年份，用来排序和显示右上角徽标
//   tags         标签数组，用来筛选。一个作品可以有多个标签
const works = [
  {
    title: '热点洞察',
    description: '2026年海峡两岸暨港澳地区大学生计算机创新作品赛广东省赛优秀奖',
    image: 'imgs/HotInsight.png',
    url: '#',
    year: 2026,
    tags: ['前端', '后端', '数据库'],
  },
  {
    title: '龙芯架构软件实训智能评价系统',
    description: '“中国软件杯”大学生软件设计大赛B1组全国总决赛二等奖',
    image: 'imgs/EvalAI.png',
    url: '#',
    year: 2026,
    tags: ['前端', '数据库', '部署'],
  },
]
