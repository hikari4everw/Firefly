# 追番页 Implementation Plan

**Goal:** 新增可在本机编辑并静态发布的季度追番排行。
**Architecture:** 共享纯数据规则 + 本机 Vite 中间件 + Astro 公开页面/Svelte 编辑器。
**Spec:** docs/superpowers/specs/2026-10-09-anime-ranking.md

## Global Constraints
- 中文文案，沿用现有主题，pnpm，不修改已有用户内容。
- 计划三档、评价五档；相邻边界封面上下各占一半，无过渡档标签。
- 生产仅公开快照，草稿本机保存；快照不可覆盖。

## Review Focus
- 非同源或非本机请求不可读取草稿或写入。
- 过期草稿不得覆盖新保存内容，失败不得损坏公开数据。
- API 返回空页/重复条目/失败时不得丢失既有清单。
- 任意季度及旧版本刷新后仍展示该版本。
- 计划转换评价不继承错误等级；多个边界封面不得挡住普通封面。

### Task 1: 数据和排序规则
**Produces:** AnimeDraft/AnimeArchive 类型；validateDraft、moveItem、convertMode、mergeImported、createSnapshot。
- [x] 写数据行为测试，运行 node --import tsx --test scripts/anime-ranking.test.ts，Expected: 缺失实现失败。
- [x] 实现 schema、档位位置、移动去重、模式转换和不可变快照，运行同一测试，Expected: 全通过。

### Task 2: 本机持久化和导入
**Consumes:** Task 1 的数据规则。
**Produces:** animeDevApi Vite 插件；独立可测的 store 和季度导入函数。
- [x] 临时目录测试草稿冲突、快照隔离、关联文章及拒绝非法请求；季度翻年/分页/失败测试。Expected: 缺失实现失败。
- [x] 实现 .local/anime 草稿、src/data/anime.json 公开数据、原子写及固定上游请求，接入开发插件。Expected: 全通过。

### Task 3: 展示、编辑与发布说明
**Consumes:** 公共 archive、草稿 API、位置规则。
- [x] 实现 /anime/ 和 /anime/{board}/{version}/ 静态展示、导航及页面开关，Svelte 编辑器仅开发加载。
- [x] 验证新季度、导入、档内/边界排序、快捷移动、模式切换、保存/复制/公开版本及关联点评。
- [x] pnpm check、pnpm type-check、pnpm build 和全部 Node 测试，Expected: 无新增错误，产物不含草稿/编辑器。
- [x] 浏览器检查桌面、手机、深浅色和页面切换；记录截图及操作说明。
