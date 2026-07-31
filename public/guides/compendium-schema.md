# 图鉴 JSON 字段速查表

供 AI 自查阶段使用。逐字段核对，确认格式和约束是否正确。

## 顶层结构

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `bookId` | `string` | 是 | 与 EPUB 文件名一致（不含扩展名），或空字符串 |
| `characters` | `object[]` | 是 | 至少 1 条 |
| `locations` | `object[]` | 是 | 可空数组 `[]` |
| `monsters` | `object[]` | 是 | 可空数组 `[]` |

## 条目通用字段

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `id` | `string` | 是 | 全局唯一；仅英文小写、数字、下划线 |
| `name` | `string` | 是 | 完整中文名/原文名 |
| `aliases` | `string[]` | 是 | 至少 1 个；无则 `[""]` |
| `image` | `string` | 否 | base64 或空 `""` |
| `category` | `enum` | 是 | `"character"` / `"location"` / `"monster"` |
| `description` | `string` | 是 | 3-5 句；丹德里恩口吻；不含超出最大 entry.chapter 的信息 |
| `history` | `string` | 否 | 仅地点建议填写；2-4 句；书面笔法 |
| `entries` | `object[]` | 是 | 按 `chapter` 升序排列 |
| `relations` | `object[]` | 是 | 可空 `[]` |
| `quotations` | `object[]` | 否 | 可空 `[]` |

## entries 子字段

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `chapter` | `number` | 是 | 正整数；≤ 书籍总章数；同一章可多条 |
| `text` | `string` | 是 | 2-4 句；丹德里恩口吻；只写该章读者已知信息 |

## relations 子字段

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `targetId` | `string` | 是 | 必须存在于当前 JSON 中；全局唯一匹配 |
| `label` | `string` | 是 | 3-6 字；关系必须双向（A→B 则 B→A，label 可不同视角） |

## quotations 子字段

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `text` | `string` | 是 | 引用原文或虚构文献；2-5 句 |
| `attribution` | `string` | 是 | 注明出处，格式如"——作者，《作品》章节" |
| `chapter` | `number` | 否 | 填了则按章节解锁；不填则始终可见；不能超过总章数 |

## 快速核对清单

- [ ] `id` 全部唯一（包括跨 categories）
- [ ] `relations[].targetId` 全部能在 JSON 中找到
- [ ] 关系双向引用完整
- [ ] `entries` 中 `chapter` 升序排列
- [ ] 所有 `chapter` 值为数字，非字符串
- [ ] `category` 值仅为三者之一
- [ ] description 不超过 5 句话
- [ ] JSON 语法合法（无尾逗号、引号闭合）
