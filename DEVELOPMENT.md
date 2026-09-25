<p align="center">
  <a href="./README.md">← 返回用户文档</a> | <a href="./README_EN.md">← Back to English README</a> | <a href="./DEVELOPMENT_EN.md">English Version</a>
</p>

# 开发者文档

## 技术栈

| 层 | 技术 |
|---|------|
| 框架 | React 19 + TypeScript |
| 构建 | Vite 8 |
| 状态管理 | Zustand |
| 存储 | Dexie.js (IndexedDB) |
| 样式 | Tailwind CSS v4 |
| 渲染 | epub.js |
| 动效 | motion (formerly framer-motion) |
| 图标 | Lucide |
| 移动端壳 | Capacitor 8（Android WebView 封装，生成 APK） |
| 桌面壳 | Tauri v2（Windows WebView2 封装，NSIS 安装包） |

## 开发命令

```bash
npm install
npm run dev       # 开发服务器（默认 http://localhost:5173）
npm run build     # tsc -b + vite build
npm run preview   # 预览生产构建
npm run lint      # oxlint 代码检查

# Android（APK 构建）
npm run android:build       # 一条龙：npm run build → cap sync → gradlew assembleDebug → APK 自动复制到 release/

# 桌面壳（Tauri v2，唯一桌面分发）
npm run desktop:dev         # 开发模式（自动起 Vite dev + 编译运行）
npm run desktop:build       # 打包 Windows 安装包（NSIS，最新产物自动复制到 release/）
```

> **桌面（Tauri）构建环境**：rustup `x86_64-pc-windows-gnu` 工具链 + MSYS2 mingw64（`C:\msys64`）。链路依赖三样外部工具，缺一不可：① binutils 的 `dlltool.exe`（raw-dylib 导入库）→ `C:\msys64\mingw64\bin`（本机已于 2026-09-03 持久化进用户环境变量；新机器需自行持久化，或每个新会话 `export PATH="$PATH:C:/msys64/mingw64/bin"`）；② `~/.cargo/config.toml` 已把 linker 指向 rustup 自带的 `rust-lld.exe`（GNU 工具链不自带 gcc，链接无需外置 gcc）；③ **mingw `gcc`**（`pacman -S mingw-w64-x86_64-gcc`）——windres 预处理 `resource.rc` 时会调用 `gcc -E`，缺失时 tauri-build 静默失败（表现为 stdout 以 `package.metadata does not exist` 信息行收尾后 exit 101，真正的报错被 tauri-winres 的 `.unwrap()` 吞掉，需手动跑 windres 复现）。MSYS2 仓库镜像见 `/etc/pacman.d/mirrorlist.mingw`（本机已配 TUNA `…/msys2/mingw/$repo`，注意 ucrt64/clang64 不在 TUNA 上）。

> **国内网络打包注意**：`tauri build` 会从 GitHub Releases 下载 NSIS 工具链（tauri-bundler 2.9.4 需两个资产：`nsis-3.11.zip`（SHA1 `ef7ff767…bb10d`）与 `nsis_tauri_utils-v0.5.3` 的 dll（SHA1 `75197fee…9b860`））。GitHub 直连会 502。两种解法：① 设 `TAURI_BUNDLER_TOOLS_GITHUB_MIRROR=https://gh-proxy.com/https://github.com`（值 = 代理前缀 + 完整 github 域名）重跑；② 最稳——手动经代理下载两个资产，把 zip 剥掉 `nsis-3.11/` 顶层解压到 `%LOCALAPPDATA%\tauri\NSIS`，dll 放入 `Plugins\x86-unicode\additional\`（bundler 校验必需文件齐全即跳过下载）。本机已预置，直接 `npm run desktop:build` 即可。

> **Android 构建环境**（见下文「移动端适配」）：JDK 21 + Android SDK（platform 36、build-tools 34.0.0）。国内网络需配置 Maven/Gradle 镜像（`~/.gradle/init.gradle` + `android/gradle/wrapper/gradle-wrapper.properties`），`android/local.properties` 的 `sdk.dir` 必须用正斜杠（`sdk.dir=C:/android-sdk`，反斜杠会被 Java Properties 转义吞掉）。

## 目录结构

```
src/
├── core/           # 共享类型、ServiceRegistry 单例、五大抽象接口
├── adapters/       # 存储适配器（IndexedDBAdapter）
├── engines/        # 阅读引擎（EpubEngine，含触屏手势事件）
├── parsers/        # 元数据解析器（EpubParser）
├── features/       # 功能插件（预留扩展点）
├── stores/         # Zustand store（8 个独立 store）
├── hooks/          # React hooks（useReader, useKeyboard, useTheme, useIsTouch）
├── components/     # UI 组件（LibraryPage, ReaderPage, OnboardingOverlay, AboutOverlay, ErrorBoundary, ToastContainer）
└── plugins/        # 应用启动注册（default-plugins）

src-tauri/          # Tauri v2 桌面壳（Rust 入口 + tauri.conf.json 配置）
android/            # Capacitor Android 工程（Gradle；由 cap sync 管理）
capacitor.config.ts # Capacitor 配置（appId: com.chapterbound.app，webDir: dist）
ui-console.html     # UI 检查台（开发工具；根级 HTML，不进构建产物、不进 APK）
console/            # 检查台实现（audit.ts 判据 / viewports.ts 档位 / mirror.ts 镜像 / ConsoleApp.tsx 界面）
```

## 架构

插件化设计——引擎、解析器、存储、功能模块全部通过 `ServiceRegistry` 独立注册，不修改核心代码即可扩展。

### 核心层 (`src/core/`)

- `types.ts` — 共享类型：`BookRecord`, `Bookmark`, `Highlight`, `ReadingProgress`, `TOCItem`, `CompendiumEntry` 等
- `registry.ts` — `ServiceRegistry` 单例，管理引擎/解析器/存储/功能插件的注册和查询，支持拓扑排序激活
- `interfaces/` — 五个抽象接口：`IReaderEngine`, `IStorageAdapter`, `IBookParser`, `IFeaturePlugin`

### 状态管理 (Zustand)

八 个独立 store：

| Store | 职责 |
|-------|------|
| `bookshelfStore` | 书架列表、导入/删除书籍 |
| `bookmarkStore` | 书签 CRUD，按 bookId 过滤 |
| `highlightStore` | 高亮 CRUD，支持备注 |
| `progressStore` | 阅读位置保存/加载，按 bookId |
| `settingsStore` | 阅读器设置 + 页面主题 + 图鉴字号，持久化到 localStorage |
| `compendiumStore` | 图鉴导入/加载/解锁/搜索 |
| `onboardingStore` | 入门引导状态，localStorage 持久化，跨页面导航 |
| `toastStore` | Toast 通知：success/error/info 三类型，auto-dismiss |

### 设计系统

暖色系配色（参考 Apple Books），所有颜色通过 CSS 自定义属性管理：

| 变量 | 亮色 | 暗色 |
|------|------|------|
| Page bg | `#F5F1EA` | `#2B2420` |
| Text | `#3C3226` | `#F5EFE6` |
| Accent | `#B87C4B` | `#D4996A` |

圆角卡片（16px），暖色调阴影。

### 动效

motion/react 提供，三套 spring 配置：
- `springDefault`: bounce 0, duration 0.3s（UI 进出）
- `springPress`: bounce 0, duration 0.2s（按钮点击反馈）
- `springSlide`: bounce 0.15, duration 0.3s（侧栏滑入）

### 移动端适配（Capacitor Android）

同一份 Web 应用通过两种壳分发：Tauri（Windows 桌面）、Capacitor WebView（Android APK）。移动端适配的几条关键机制：

**触屏判定（单源）** — `useIsTouch`：`matchMedia('(hover: none), (pointer: coarse)')` 自动检测，`localStorage['force-touch']='1'/'0'` 可强制覆盖（调试用，无 UI 入口）。全应用不散落 matchMedia。判定结果由 `applyTouchMode()` 同步写到 `<html data-touch="1">`，**CSS 一律读这个属性、不写 `@media (hover: none)`** —— 媒体查询曾是第二处判定源，`force-touch` 一开 JS 和 CSS 就各说各话（历史 bug：JS 认为触屏、CSS 认为不是，`.icon-btn` 的 44px 命中区静默失效）。`data-touch` 是**派生值，不要直接写**；要切模式就改 `force-touch` 再重载。属性在 `main.tsx` 首次绘制前设好，避免触屏设备闪一帧桌面布局。

**翻页手势（引擎级）** — `EpubEngine` 在 iframe 的 `contents` 上绑定 touch 事件（epub.js 会把 iframe 内 DOM 事件转发出来），发出 `gesture:swipe`（|dx|≥60px、|dx|>2|dy|、≤600ms）和 `gesture:tap`（≤350ms、≤10px 位移）事件；长按选词（selection 非空）时抑制翻页。桌面端不注册手势，零影响。

**安全区注入（原生桥接）** — Android WebView 的 `env(safe-area-inset-*)` 恒为 0。`android/app/src/main/java/com/chapterbound/app/MainActivity.java` 的 `injectSafeArea()` 启动时读取 `statusBars()` / `navigationBars()` / `displayCutout()`，**四个值一起**注入为 CSS 变量 `--safe-top`/`--safe-bottom`/`--safe-left`/`--safe-right`（页面未就绪自动重试），工具栏/侧栏/书页区/图鉴详情据此避开状态栏、刘海与手势条。三个易错点：**(1) 必须除以 `density`** —— `WindowInsetsCompat.getInsets()` 返回物理像素，而 WebView 里 1 CSS px = 1 dp，漏掉这步 `--safe-top` 会被放大 density 倍（2.0~3.5，历史 bug：顶栏被压低几十像素）；**(2) 四个值必须与标记同步写入** —— `data-safe-top-injected` 的语义是「四个值都已注入」，只写 top 却带标记会让 CSS 保底连带失效（历史 bug：`--safe-bottom` 掉回 0，页码胶囊压在手势条下）；**(3) 顶部仍只取 `statusBars()`，不要对 `displayCutout()` 取 max** —— 竖屏刘海已含在状态栏高度内，取大会下移过头（历史 bug）。左/右只在横屏刘海机（手机横屏）非 0。旋转/折叠/分屏**不重建 Activity**（manifest 声明了 `configChanges`），所以 `onConfigurationChanged()` 里会重新注入。CSS 侧保底规则是 `:root[data-touch='1']:not([data-safe-top-injected])`，16px，仅在注入失败时生效；桌面四个值恒为 0，零回归。

**edge-to-edge** — Android 15/16 对 targetSdk 35+ 强制 edge-to-edge，会让 WebView 内容铺到状态栏后面。`android/app/src/main/res/values-v35/styles.xml` 里写了 `windowOptOutEdgeToEdgeEnforcement` 想豁免，状态栏颜色与 Web 主题色对齐（`values-night-v35` 深色变体）。

> ⚠️ **`windowOptOutEdgeToEdgeEnforcement` 实际上是失效的**，不要把它当成安全区的第一道防线。Capacitor 的 `BridgeActivity.onCreate` 会把主题换成 `AppTheme_NoActionBar`，而那个主题里没有这一项，于是豁免读不到、应用真的在 edge-to-edge 下跑。**真实生效的只有原生注入 + CSS 保底那条路**。（「关于面板的关闭按钮被状态栏压住」这个 bug 能出现，本身就证明了视口确实伸到状态栏下面。）

**返回键逐层退出** — `ReaderPage` 用单条目 `history.replaceState` 方案：打开侧栏/图鉴详情/书签选择器只更新条目 state（不新增历史），popstate 时按 refs 分发关闭覆盖层（图鉴详情 → 侧栏 → 阅读器），关掉覆盖层后重新压回条目。历史栈恒为两条，返回键语义稳定。（Phase 3 预留 Capacitor `@capacitor/app` backButton 事件叠加。）

**Android 构建环境备忘**：
- JDK 21（`JAVA_HOME` 必须指向 Windows 绝对路径，unix 风格路径对 .bat 无效）
- Android SDK：`C:/android-sdk`（platforms/android-36 + build-tools/34.0.0 + platform-tools + cmdline-tools）
- 国内镜像：`~/.gradle/init.gradle` 注入腾讯云 nexus maven-public + Google 官方 + 阿里云后备；`gradle-wrapper.properties` 的 distributionUrl 用腾讯云 gradle 镜像
- **修改 web 代码后跑 `npm run android:build`**（内含 build + cap sync），裸跑 assembleDebug 会打包旧 web 产物

## UI 检查台（开发工具）

`npm run dev` 后打开 `http://localhost:5173/ui-console.html`。

给「看不见所以点不到」这一类问题上保险的图形工具：它在**同源 iframe 里跑真实应用**（所以审的是组装后的真实界面，不是隔离的组件 —— 遮罩那类 bug 只有组装起来才存在），左栏调视口/安全区/触屏，右栏是真实应用，按「检查」跑四条判据（越界 / 点得到 / 命中区 ≥44 / `fixed inset-0` 是否真铺满视口），违规画红框并可点条目定位。

- 支持**双窗对照**（各自独立的视口 + 安全区，触屏与缩放共享），带「把 A 的界面镜像到 B」的手动同步。
- 面板上调的四个安全区值就是模拟原生注入，和 `MainActivity.injectSafeArea()` 的行为一致。
- **它依赖两条项目约定**：① 凡可点击元素必须带 `cursor-pointer`；② `data-touch` 由 `useIsTouch` 写、CSS 读。破坏任一条，检查台会**静默地**看不见那些元素。
- 根级 HTML（不在 `public/`），不进构建产物、不进 APK；类型检查在 `tsconfig.console.json` 里，`npm run build` 会检查它。
- 完整的判据理由、能力边界和待办见 `CLAUDE.md` 的「UI console」与「待办」两节；改判据前先读 `console/audit.ts` 的文件头。

### 已知问题

- **epub.js 分页**：部分书籍只显示 1-2 页。EPUB 引擎通过 CSS columns 渲染，初始渲染时若容器高度为 0，columns 会坍缩。`useReader` 中的 ResizeObserver 处理了 post-render resize，但初始渲染时序敏感。
- **epub.js 类型**：`EpubEngine.ts` 和 `EpubParser.ts` 中有 5 处 `as any` 转换。epub.js v0.3.93 的 TypeScript 定义不完整，`currentLocation()` 返回值和 `metadata` 属性未类型化。
- **功能插件是骨架**：`src/features/` 下的 4 个插件注册了生命周期钩子但没有 UI 扩展。插件系统已接线但未使用。
- **仅支持 EPUB**：尚无 PDF 或 TXT 引擎，`registry.getEngine()` 对非 EPUB 格式返回 `undefined`。导入已收敛为仅 `.epub`（含校验，拒绝其他格式并 toast 提示）。
- **Android WebView 持久化**：IndexedDB 数据存于 WebView 应用数据目录，卸载/清数据会丢失（本阶段未做备份导出）。
- **Android 待办（Phase 3+）**：intent-filter 导入（SAF 当前为系统文件选择器回退）、`@capacitor/app` 返回键接入、release 签名、真机选区检索重设计、移动端图鉴工作流（已决策砍掉）。
- **阅读器取色气泡的遮罩只有 header 那么大**（未修，已登记在检查台的「已知缺陷」区）：`ReaderPage.tsx` 的遮罩写了 `fixed inset-0`，但它在带 `backdrop-filter` 的 header 里面 —— `backdrop-filter` 会为后代的 `fixed` 元素**重建包含块**（和 `transform`/`filter` 一样），于是 `inset-0` 解析成 header 的尺寸（实测 412×88），而不是视口。后果：**点书页正文关不掉气泡**，只能靠右上角 X 或点工具栏。修法是把 `backdrop-filter` 从 header 挪到一个内层背景 div（`absolute inset-0 -z-10 pointer-events-none`），header 自身保留半透明底色，层级关系不用动。
- **触屏命中区没铺满**（检查台查出，未修）：书签气泡的 5 个色块与关闭按钮都是 32×32、书架顶栏的「切换主题」「关于」是 40×40、「导入书籍」高 40、书卡上的封面按钮 30×30 —— 都低于 44px。其中「删除」按钮还**没有可访问名称**（无 `aria-label`）。注意色块那组有真实张力：5×44 + 44 = 264px，放进 270px 的气泡会顶到边。
- **`下一页` 是一条 24×811 的隐形热区**（未修）：`absolute right-2` 且贯穿全高，盖住了气泡关闭按钮的右半边 —— 点关闭按钮正中或右半边会**翻页**。修法不是加 z-index，而是那条热区不该贯穿全高、也不该压住贴右缘的浮层。
- **相关文档**：`docs/technical-audit.md` — 代码健康档案：错误处理惯例、数据持久化细节、风险清单、模块导航索引。

### 关键模式

**翻页动画**：阅读卡使用 `useAnimate` hook 触发翻页动画，而非通过改变 `key` prop 来重挂载组件。给 motion.div 改 key 会销毁并重建 epub.js iframe，破坏整个阅读器。

**epub.js 引擎生命周期**：`EpubEngine.load()` 创建 Book 和 Rendition，渲染到传入的容器，触发 `'ready'` 事件。在 `'relocated'` 时触发 `locationChange`（含 cfi、progress、page、total）。清理时务必调用 `destroy()`——它会销毁 rendition 和 book。

**章节检测**：`getChapterMap()` 通过递归遍历 TOC 树，将 TOC 项的 `href` 映射到 epub.js spine index，生成 `章节号 → spine索引` 的双向映射。这个映射被图鉴系统用于自动检测当前章节。
