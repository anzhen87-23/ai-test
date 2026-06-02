# 安振-AI-笔记 - Web 前端文档

## 技术栈

- **框架**: React 18
- **构建工具**: Vite 6
- **样式**: 纯 CSS（无第三方 UI 库）
- **配色**: 红黄蓝三色主题（`#FF3B3B` / `#FFC107` / `#2979FF`）

## 项目结构

```
packages/web/
├── index.html
├── vite.config.js
├── src/
│   ├── main.jsx              # React 入口
│   ├── App.jsx               # 应用主框架（认证、布局）
│   ├── api.js                # API 客户端
│   ├── styles/
│   │   └── index.css         # 全局样式
│   └── components/
│       ├── Sidebar.jsx       # 侧边栏（文件夹树、笔记列表、搜索、退出）
│       ├── NoteEditor.jsx    # 笔记编辑器（标题、附件区、预览弹窗）
│       ├── BlockEditor.jsx   # 块编辑器（状态管理、自动保存、快捷键）
│       └── BlockTypes.jsx    # 块渲染器（文本、标题、列表、待办、分割线、图片）
```

## 组件说明

### App.jsx — 应用主框架

- 管理认证状态（token）
- 注册/登录表单
- 主布局（Sidebar + 内容区）
- 全局状态：当前笔记 ID、搜索关键词、选中的文件夹
- 退出确认 + 全状态清理

### Sidebar.jsx — 侧边栏

功能：

- **品牌标识**: "安振-AI-笔记" 渐变色标题
- **操作按钮**: 新建文件夹(📁+)、新建笔记(📝+)、退出(退出)
- **搜索框**: 输入后 300ms 防抖搜索
- **文件夹组**: 彩色文件夹图标，点击切换选中/取消
- **笔记列表**: 彩色笔记图标，hover 显示删除按钮
- **搜索结果**: 带高亮片段的笔记列表
- **搜索模式**: 搜索时显示 "Search Results" 标题

交互：

- 点击文件夹 → 筛选该文件夹下的笔记
- 再次点击同一文件夹 → 取消筛选（显示全部）
- 新建笔记时自动归入当前选中的文件夹
- 长标题自动省略号截断

### NoteEditor.jsx — 笔记编辑器

功能：

- **标题编辑**: 失焦/Enter 保存，更新笔记元信息
- **块编辑器**: BlockEditor 组件
- **保存状态**: 显示 Saved / Unsaved / Saving...
- **附件区**: 上传、列表、预览、下载、删除

附件操作：

- 点击文件名 → 预览（图片/PDF/文本）
- 点击下载按钮 ⬇ → 下载原文件
- 点击 × → 删除（需确认）
- 点击 + Add → 选择文件上传

**预览弹窗 (PreviewModal)**：

- 图片：`<img>` 标签内联显示，`onLoad` 后隐藏 loading
- PDF：`<iframe>` 内嵌浏览器预览
- 文本：fetch 内容后在 `<pre>` 中显示
- 其他类型：提示不支持预览，提供下载链接
- 点击遮罩或关闭按钮关闭

### BlockEditor.jsx — 块编辑器

**状态管理**：

- `blocks`：块数组状态
- `blocksRef`：实时引用，确保自动保存读取最新值
- `focusedIndex`：当前聚焦的块索引
- `slashMenu`：斜杠菜单位置

**自动保存**：

- 500ms 防抖
- PUT `/api/notes/:id/blocks` 批量保存
- 保存成功后仅合并 ID 回写，不改变块顺序
- 避免 useEffect 依赖循环导致的无限保存

**键盘导航**：

- Enter → 在下方添加新块
- Backspace（空块）→ 删除当前块，聚焦上一块
- ArrowUp（光标在开头）→ 聚焦上一块
- ArrowDown（光标在末尾）→ 聚焦下一块
- `/`（空块输入）→ 打开斜杠菜单

**斜杠菜单 (SlashMenu)**：

- 箭头键上下选择
- Enter 确认选择
- Escape 关闭
- 支持类型：Text(Aa)、Heading(H)、Bullet List(•)、Todo(☐)、Divider(─)、Image(🖼️)

### BlockTypes.jsx — 块渲染器

**无控组件设计**：contentEditable 元素不依赖 React state，避免输入时 DOM 重渲染导致的字符顺序问题。

渲染器：

| 类型 | 组件 | 渲染 |
| :--- | :--- | :--- |
| text | TextBlock | `<div contentEditable>` |
| heading | HeadingBlock | `<h2 contentEditable>` |
| bullet_list | BulletListBlock | 带红色 `•` 标记的输入框 |
| todo | TodoBlock | 带复选框的输入框 |
| divider | DividerBlock | 渐变色分割线 `<hr>` |
| image | ImageBlock | 图片 URL 输入框或 `<img>` 显示 |

**中文输入法支持**：

- 通过 `onCompositionStart/onCompositionEnd` 跟踪 IME 状态
- 组合期间忽略 Enter 键处理
- `compositionend` 延迟重置，确保 Enter keydown 时仍能检测到组合状态
- 避免中文输入法回车确认时误触添加新块

## API 客户端 (api.js)

所有请求自动携带 `Authorization: Bearer <token>`。

```javascript
// 认证
auth.register({ email, password })
auth.login({ email, password })

// 文件夹
folders.list()
folders.create({ name })

// 笔记
notes.list(folderId?)
notes.get(id)
notes.create({ title?, folderId? })
notes.update(id, { title?, folderId? })
notes.remove(id)
notes.saveBlocks(noteId, blocks)

// 搜索
search.query(keyword)

// 附件
attachments.list(noteId)
attachments.upload(noteId, File[])   // FormData 上传
attachments.remove(noteId, id)
attachments.downloadUrl(id)          // 生成下载链接
attachments.previewUrl(id)           // 生成预览链接
```

## 构建与运行

```bash
# 开发模式（Vite 热更新）
npm run dev

# 生产构建
npm run build

# 预览构建产物
npm run preview
```

构建产物输出到 `packages/web/dist/`，由 Koa 服务端静态文件中间件提供。生产部署只需启动 Node.js 服务即可。

## 样式说明

### 主题变量 (CSS Custom Properties)

```css
--red: #FF3B3B;
--yellow: #FFC107;
--blue: #2979FF;
--red-light: #FFE0E0;
--yellow-light: #FFF8E1;
--blue-light: #E3F2FD;
```

### 布局

- 侧边栏：280px 宽，深色渐变背景
- 内容区：居中 720px 最大宽度
- 编辑区：彩虹渐变标题底部边框

### 交互效果

- 按钮：hover 时上浮 + 蓝色发光阴影
- 文件夹图标：黄蓝红三色循环
- 笔记图标：蓝红黄三色循环
- 块 hover：蓝色左侧渐变指示条
- 分割线：红黄蓝渐变
- 附件项 hover：橙色背景
- 下载/删除按钮：hover 时显示
