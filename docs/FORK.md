# 本 Fork 说明（相对上游 Akaal-Creatives/LibreDiary 的定制）

这是 [LibreDiary](https://github.com/Akaal-Creatives/LibreDiary) 的自托管定制版，部署在 agentdockai.cn。
本文件只讲**本 Fork 新增/改动了什么**，以及**如何下载、安装、配置、构建、部署**。
通用部署（Docker、S3、Meilisearch 等）请看上游的 [`docs/deployment.md`](./deployment.md)。

> 机密（`.env`、AI key、数据库密码、SSH 私钥）**不在本仓库**，只有 `.env.example` 模板。换机器后需自行补全，见下文「环境变量」。

---

## 一、这个 Fork 加了什么

写作页把 Tiptap UI Kit 的编辑体验移植了进来（**只移植功能，UI 用本站设计令牌**）：

- **完整格式化工具栏**（顶部通栏、单行）：撤销/重做、格式刷、清除格式、字体、字号、粗/斜/下划线/删除线/行内码、文字颜色、高亮、标题、项目/编号/待办列表、四种对齐、链接/表格/图片/导入。
- **划词悬浮工具条**：选中文字后浮现，含 H1/H2/H3、粗斜下删、颜色/高亮、链接、列表，及右侧 AI 下拉；用自定义 `shouldShow` 保证任何非空选区都能可靠弹出。
- **AI 写作**：继续写作 / 润色 / 总结 / 自定义指令 / 翻译，输出采用「**预览 → 接受后写入**」；顶部工具栏与悬浮条共用同一套逻辑。
- 后端新增 `custom` AI action + `instruction` 字段。

### 主要涉及文件

| 位置 | 说明 |
|---|---|
| `apps/web/src/components/editor/EditorToolbar.vue` | 顶部完整工具栏 |
| `apps/web/src/components/editor/BubbleToolbar.vue` | 划词悬浮工具条 |
| `apps/web/src/components/editor/extensions/FormatPainter.ts` | 移植的格式刷扩展 |
| `apps/web/src/composables/useEditorAi.ts` | 工具栏/悬浮条共用的 AI 逻辑 |
| `apps/web/src/components/editor/TiptapEditor.vue` | 注册 TextStyle/Color/FontFamily/FontSize/Highlight/TextAlign/FormatPainter |
| `apps/web/src/pages/app/PageView.vue` | 写作页布局（顶栏 + 居中正文列） |
| `apps/server/src/modules/ai/writing.service.ts`、`writing.routes.ts` | 后端 `custom` action |

---

## 二、下载

```bash
git clone https://github.com/Sunne927/LibreDiary.git
cd LibreDiary
```

或下载 ZIP：仓库页 → **Code** → **Download ZIP**（不含 git 历史）。

---

## 三、环境要求

- Node.js ≥ 18（本项目在 Node 24 上验证过）
- 包管理器 **pnpm 9.15.0**（仓库已用 `packageManager` 锁定，用 corepack 即可，无需全局安装）
- 后端运行还需 PostgreSQL（见上游部署文档）

```bash
corepack enable
```

---

## 四、安装依赖

```bash
corepack pnpm install
```

> **踩过的坑**：若报 `ERR_PNPM_UNEXPECTED_STORE` / `PUBLIC_HOIST_PATTERN_DIFF` / `VIRTUAL_STORE_DIR_MAX_LENGTH_DIFF`（多因 node_modules 曾被别的 pnpm 版本装过），删掉各处 `node_modules` 后用固定版本干净重装：
>
> ```bash
> rm -rf node_modules apps/*/node_modules packages/*/node_modules
> corepack pnpm install --config.confirm-modules-purge=false
> ```

---

## 五、环境变量（机密不在仓库，需自行补）

从模板复制并填入真实值：

```bash
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example    apps/web/.env   # 如存在
```

AI 相关关键项（后端 `.env`）：

| 变量 | 说明 |
|---|---|
| `OPENROUTER_BASE_URL` | AI 接口地址（OpenAI Chat Completions 兼容） |
| `OPENROUTER_API_KEY` | AI key（**保密，勿提交**） |
| `AI_DEFAULT_MODEL` | 默认模型名 |

其余（数据库、存储、SSO 等）见 `apps/server/.env.example` 与上游 `docs/deployment.md`。
是否启用 AI 由数据库 `SystemSettings.aiEnabled` 控制；后台 `/admin/settings` 可改 key/model/开关。

---

## 六、开发 / 构建

```bash
# 前端开发
corepack pnpm --filter @librediary/web dev

# 全量构建
corepack pnpm run build

# 类型检查 / 测试
corepack pnpm --filter @librediary/web typecheck
corepack pnpm --filter @librediary/web exec vitest run src/components/editor
corepack pnpm --filter @librediary/server exec vitest run src/modules/ai
```

前端构建产物在 `apps/web/dist/`（静态站）；后端产物在 `apps/server/dist/`（`node dist/index.js` 启动）。

---

## 七、部署（通用要点）

1. 构建前后端（上一节）。
2. 前端 `apps/web/dist/` 作为静态站点由反向代理（Caddy/Nginx）服务，SPA fallback 到 `index.html`。
3. 后端 `apps/server/dist/index.js` 由进程管理器（systemd/pm2/docker）常驻，反代 `/api/*`、`/collaboration*`、`/uploads/*`、`/health` 到后端端口。
4. 换版本时替换对应目录并重启后端。

> **PWA/Service Worker 缓存注意**：站点是 Workbox PWA，`.js/.css` 走 CacheFirst。全量 `vite build` 会重新生成 `sw.js`（含 `skipWaiting`+`clientsClaim`），普通刷新会在下次导航自动更新；本人首刷有时需 Ctrl+F5 硬刷一次。

> 若你的部署在 `web/` 目录里注入了构建产物之外的脚本（如首页问候），每次全量替换 `web/` 都会覆盖掉，需要重新注入并更新 `sw.js` 的 precache（本项目在私有部署里靠一个恢复脚本处理，细节见本地部署记录，不在公开仓库）。

---

## 八、与上游同步

上游仍作为 `origin` 保留（若你的本地是从服务器工作树推来的）：

```bash
git remote add upstream https://github.com/Akaal-Creatives/LibreDiary.git   # 如未添加
git fetch upstream
git merge upstream/main   # 或 rebase，注意解决与本 Fork 改动的冲突
```

---

许可证沿用上游 **AGPL-3.0**，见 [`LICENSE`](../LICENSE)。
