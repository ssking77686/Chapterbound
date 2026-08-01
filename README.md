<p align="center">
  <a href="./README_EN.md">English</a> | <a href="./DEVELOPMENT.md">开发者文档</a>
</p>

<h1 align="center">电子阅读器</h1>
<p align="center">一个跑在浏览器里的电子书阅读器，灵感来自 RPG 游戏中的角色词条系统。</p>

---

## 截图

<div align="center">
  <img src="public/shelf.png" alt="书架" width="45%" />
  <img src="public/reader.png" alt="阅读器" width="45%" />
</div>
<div align="center">
  <img src="public/compendium-detail.png" alt="人物图鉴详情" width="45%" />
  <img src="public/compendium-location.png" alt="地点图鉴详情" width="45%" />
</div>

---

## 图鉴系统

项目最大的差异化 feature。看书时随着剧情推进，人物、地点、怪物会逐一在图鉴中解锁——不会提前剧透。

> **灵感来源**：玩《巫师 3》时那种打开角色词条、逐条解锁的体验。每翻到新章节，新的信息自然浮现，就像一路捡起散落在故事里的拼图。

**核心设计：**

- **人物 / 地点 / 怪物**三大分类，各自独立 tab
- **按章节自动解锁**——基于 epub.js spine index，读到哪解锁到哪，无需手动标记
- **发现日志分层**——每个条目的信息按章节拆分，翻到新章才显示对应内容
- **关系网**——条目之间可以建立关联（恋人、导师、宿敌、包含……），点击直达
- **文献引述**——嵌入世界观内的原文引用，像 RPG 里的"书中书"
- **解锁提示**——有新内容解锁时图鉴按钮上亮金色光点，点进去看过就熄
- **独立配色**——图鉴内部是深羊皮纸配色，与全局日夜间模式互不干扰
- **AI 辅助生成**——内置写作指南，把指南 + 全文发给 AI 即可批量生成图鉴 JSON
- **支持重新导入**——修改 JSON 后重新导入，旧数据自动覆盖，章节进度重置

---

## 功能

- 导入 EPUB，自动提取封面和元数据
- 封面支持自定义上传和重置
- 阅读进度自动记录，下次打开接着看
- 字号、字体、行间距可调，偏好持久化
- 日间 / 夜间模式，手动切换或跟随系统
- 暖色暗色主题，不刺眼
- 宽屏自动双页展开，书架响应式多列
- 彩色书签（五色可选），侧栏管理可跳转
- 文字选中高亮
- 目录点击跳转章节

---

## 快速开始

```bash
npm install
npm run dev      # 开发服务器
npm run build    # 生产构建
npm run lint     # 代码检查
```

---

## 链接

- [English README](./README_EN.md)
- [开发者文档](./DEVELOPMENT.md)
- [写作指南](public/guides/compendium-guide.md) — 发给 AI 生成图鉴 JSON
- [图鉴 JSON 字段速查](public/guides/compendium-schema.md)
- [图鉴使用说明](public/guides/compendium-readme.md)

---

## 更新日志

**v1.1.1** (2026-08)
- 新增项目介绍页（关于按钮），展示仓库、所有者和贡献者
- 图鉴面板内置写作指南下载
- 写作指南去特定世界观化，任何书籍通用
- 多项 Bug 修复（宽屏点击、引擎错误处理、页面闪烁、图鉴持久化）

**v1.1.0** (2026-07)
- 图鉴系统：人物/地点/怪物三大类，JSON 批量导入，按章节自动解锁
- 书籍封面自定义（上传 + 重置）
- 彩色书签系统（五色可选）
- 阅读设置（字号/字体/行间距）
- 明暗主题切换（暖棕暗色）
- 宽屏双页展开 + 书架响应式列数

**v1.0.0** (2026-06)
- 初始版本：EPUB 阅读、阅读进度、书签、高亮、目录导航

---

## 许可

[MIT](LICENSE) © ahine Yang
