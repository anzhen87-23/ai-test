# 安振-AI-笔记 - 移动端文档

## 技术栈

- **框架**: React Native 0.76
- **平台**: Expo SDK 52
- **语言**: TypeScript
- **导航**: React Navigation 6 (Stack)
- **存储**: @react-native-async-storage/async-storage
- **图片选择**: expo-image-picker
- **文件选择**: expo-document-picker

## 项目结构

```
packages/mobile/
├── App.tsx                       # 应用入口，导航管理
├── src/
│   ├── api.ts                    # API 客户端
│   └── screens/
│       ├── LoginScreen.tsx       # 登录/注册页
│       ├── NoteListScreen.tsx    # 笔记列表（含文件夹、搜索）
│       └── NoteEditorScreen.tsx  # 笔记编辑器（块、附件）
```

## 组件说明

### App.tsx — 应用入口

- Stack 导航：Notes → Editor
- Token 管理：启动时从 AsyncStorage 读取
- handleLogin：登录成功后保存 token
- handleLogout：清除 token 和 AsyncStorage
- 未登录状态渲染 Login 页面，已登录渲染 Notes/Editor

```
┌─────────────────────┐
│     Login (stack)    │  ← 无 token 时显示
│         ↓ login      │
│     Notes (stack)    │  ← 有 token 时显示
│         ↓ open note  │
│     Editor (stack)   │
└─────────────────────┘
```

### LoginScreen.tsx — 登录/注册页

功能：

- 邮箱/密码输入
- 登录/注册按钮切换
- 深色渐变背景
- "安振-AI-笔记" 品牌标识
- 错误提示（红色居中显示）

交互：

- 登录成功 → 调用 `onLogin(token)` 切换页面
- 注册成功 → 自动登录
- 密码错误/邮箱已注册 → 显示错误提示

### NoteListScreen.tsx — 笔记列表

功能：

- **深色标题栏**: "安振-AI-笔记" + 文件夹+ / 笔记+ / 退出按钮
- **搜索栏**: 输入后 300ms 防抖搜索
- **文件夹筛选**: 横向滚动文件夹芯片，点击切换选中
- **笔记列表**: 彩色圆点图标 + 标题 + 日期
- **下拉刷新**: pull-to-refresh 重新加载数据
- **新建文件夹弹窗**: 输入文件夹名称
- **删除确认**: 删除笔记弹窗确认

状态管理：

- `notes[]` — 所有笔记
- `folders[]` — 所有文件夹
- `selectedFolderId` — 选中的文件夹（null = 全部）
- `searchQuery` — 搜索关键词
- `searchResults` — 搜索结果
- `refreshing` — 下拉刷新状态
- `folderModal` — 文件夹弹窗状态
- `folderName` — 新建文件夹名称

显示逻辑：

- 有搜索关键词 → 显示搜索结果
- 有选中文件夹 → 过滤显示该文件夹的笔记
- 否则 → 显示全部笔记

### NoteEditorScreen.tsx — 笔记编辑器

功能：

- **标题编辑**: 点击标题进入编辑，失焦/Enter 保存
- **保存状态**: Saved / Unsaved / Saving...
- **块列表**: FlatList 渲染
- **附件区**: 上传、预览、下载、删除
- **图片预览**: 全屏黑色半透明遮罩

**块编辑**：

- TextInput 原生组件，系统自动处理 IME
- onChange：更新本地块内容，显示/隐藏斜杠菜单
- onEndEditing：失焦保存内容
- onSubmitEditing：添加新块并保存
- onKeyPress：Backspace 删除空块

**块类型**：

| 类型 | 渲染 |
| :--- | :--- |
| text | 普通 TextInput |
| heading | 大号加粗 TextInput |
| bullet_list | 红色 • 标记 + TextInput |
| todo | 蓝色方框 + TextInput |
| divider | 黄色分割线 View |
| image | Image 显示或 URL 输入 |

**斜杠菜单**：

- 输入 `/` 时弹出
- 点击选项切换块类型
- 定位在输入框下方

**附件上传**：

- 点击 + Add → 选择来源（相册 / 文件）
- 相册：支持多图选择（expo-image-picker）
- 文件：支持多选文件（expo-document-picker）
- FormData 上传到 `/api/notes/:noteId/attachments`

**附件预览/下载**：

- 点击文件名 → 预览（图片/文本/PDF）
- 点击下载按钮 ⬇ → 系统浏览器打开
- 点击 × → 删除确认

**预览类型**：

- 图片：全屏 Image 组件内联显示
- PDF：提示通过浏览器打开
- 文本：fetch 内容后 ScrollView 滚动显示
- 其他类型：浏览器打开文件

**自动保存**：

- 500ms 防抖
- 使用 `blocksRef` 确保读取最新值
- PUT `/api/notes/:id/blocks` 批量保存
- 保存成功后更新 saved 状态

## API 客户端 (api.ts)

```typescript
// 认证
authApi.login(email, password)
authApi.register(email, password)

// 文件夹
foldersApi.list(token)
foldersApi.create(name, token)

// 笔记
notesApi.list(token, folderId?)
notesApi.get(id, token)
notesApi.create({ title?, folderId? }, token)
notesApi.update(id, { title?, folderId? }, token)
notesApi.remove(id, token)
notesApi.saveBlocks(noteId, blocks, token)

// 搜索
searchApi.query(keyword, token)

// 附件
attachmentsApi.list(noteId, token)
attachmentsApi.upload(noteId, files, token)  // FormData 上传
attachmentsApi.remove(noteId, id, token)
attachmentsApi.downloadUrl(id, token)    // 生成下载链接
attachmentsApi.previewUrl(id, token)     // 生成预览链接
```

所有请求通过 `token` 参数显式传递，不依赖 localStorage。

## 与 Web 端功能对齐

| 功能 | Web | Mobile | 备注 |
| :--- | :--- | :--- | :--- |
| 注册/登录 | ✅ | ✅ | |
| 文件夹管理 | ✅ | ✅ | 创建、筛选 |
| 笔记 CRUD | ✅ | ✅ | |
| 全文搜索 | ✅ | ✅ | 防抖搜索 |
| 块编辑器 | ✅ | ✅ | TextInput 替代 contentEditable |
| 自动保存 | ✅ | ✅ | 500ms 防抖 |
| 斜杠菜单 | ✅ | ✅ | |
| 标题编辑 | ✅ | ✅ | 失焦/Enter 保存 |
| 附件上传 | ✅ | ✅ | 相册/文件选择器 |
| 附件预览 | ✅ | ✅ | 图片/文本/PDF |
| 附件下载 | ✅ | ✅ | 系统浏览器打开 |
| 退出登录 | ✅ | ✅ | |
| 图片块 | ✅ | ✅ | URL 输入 |

## 运行方式

```bash
# 开发模式（Expo Dev Tools）
npm start

# Android 模拟器/设备
npm run android

# iOS 模拟器/设备
npm run ios
```

开发服务器默认连接 `http://localhost:3001`，真机测试需修改 `BASE_URL` 为局域网 IP。

## 已知限制

- PDF 预览依赖系统浏览器（React Native 无内置 PDF 查看器）
- TextInput 的 `onKeyPress` 在部分 Android 设备上 Backspace 事件可能不准确
- 附件上传需要用户授予相册/文件访问权限
