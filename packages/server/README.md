# 安振-AI-笔记 - 服务端文档

## 技术栈

- **运行时**: Node.js
- **框架**: Koa 2
- **数据库**: SQLite (better-sqlite3)
- **认证**: JWT (jsonwebtoken)
- **密码**: bcrypt

## 项目结构

```
packages/server/
├── src/
│   ├── index.js              # Koa 应用入口，中间件，路由注册
│   ├── db.js                 # 数据库初始化，表结构，FTS5，触发器
│   ├── middleware/
│   │   └── auth.js           # JWT 认证中间件
│   └── routes/
│       ├── auth.js           # 注册/登录
│       ├── folders.js        # 文件夹 CRUD
│       ├── notes.js          # 笔记 CRUD + 块管理
│       ├── search.js         # 全文搜索 (FTS5)
│       └── attachments.js    # 附件上传/下载/预览
└── data/                     # SQLite 数据库文件
    └── attachments/          # 附件存储目录
```

## 数据库表结构

### users

| 列 | 类型 | 说明 |
| :--- | :--- | :--- |
| id | INTEGER PRIMARY KEY | 用户 ID |
| email | TEXT UNIQUE | 邮箱（登录凭证） |
| password_hash | TEXT | bcrypt 哈希密码 |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | 创建时间 |

### folders

| 列 | 类型 | 说明 |
| :--- | :--- | :--- |
| id | INTEGER PRIMARY KEY | 文件夹 ID |
| user_id | INTEGER REFERENCES users | 所属用户 |
| name | TEXT | 文件夹名称 |
| parent_id | INTEGER REFERENCES folders | 父文件夹（支持嵌套） |
| order | INTEGER DEFAULT 0 | 排序权重 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### notes

| 列 | 类型 | 说明 |
| :--- | :--- | :--- |
| id | INTEGER PRIMARY KEY | 笔记 ID |
| user_id | INTEGER REFERENCES users | 所属用户 |
| folder_id | INTEGER REFERENCES folders | 所属文件夹 |
| title | TEXT DEFAULT '' | 笔记标题 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### blocks

| 列 | 类型 | 说明 |
| :--- | :--- | :--- |
| id | INTEGER PRIMARY KEY | 块 ID |
| note_id | INTEGER REFERENCES notes | 所属笔记 |
| type | TEXT | 块类型 (text/heading/bullet_list/todo/divider/image) |
| content | TEXT | 块内容 |
| order | INTEGER | 排序序号 |
| parent_block_id | INTEGER REFERENCES blocks | 父块 ID（支持嵌套） |

### notes_fts (FTS5 虚拟表)

| 列 | 说明 |
| :--- | :--- |
| title | 笔记标题（全文索引） |
| content | 块内容（全文索引） |
| content_rowid | 关联 notes 表的 rowid |

通过 6 个触发器保持与 notes/blocks 表的实时同步：

- `notes_fts_ins` / `notes_fts_ins_after` — INSERT 时同步
- `notes_fts_del` / `notes_fts_del_after` — DELETE 时同步
- `notes_fts_upd` / `notes_fts_upd_after` — UPDATE 时同步

### attachments

| 列 | 类型 | 说明 |
| :--- | :--- | :--- |
| id | INTEGER PRIMARY KEY | 附件 ID |
| note_id | INTEGER REFERENCES notes | 所属笔记 |
| original_name | TEXT | 原始文件名 |
| stored_name | TEXT | 磁盘存储文件名（随机十六进制） |
| size | INTEGER | 文件大小（字节） |
| mime_type | TEXT | MIME 类型 |
| created_at | DATETIME | 上传时间 |

## API 接口

### 认证

| 方法 | 路径 | Body | 说明 |
| :--- | :--- | :--- | :--- |
| POST | /api/auth/register | `{ email, password }` | 注册 |
| POST | /api/auth/login | `{ email, password }` | 登录 |

**登录响应**:

```json
{
  "token": "jwt_token_here",
  "user": { "id": 1, "email": "user@example.com" }
}
```

### 文件夹

| 方法 | 路径 | Body | 说明 |
| :--- | :--- | :--- | :--- |
| GET | /api/folders | — | 列出所有文件夹 |
| POST | /api/folders | `{ name }` | 创建文件夹 |

### 笔记

| 方法 | 路径 | Body | 说明 |
| :--- | :--- | :--- | :--- |
| GET | /api/notes | `?folderId=1` | 列出笔记（可过滤文件夹） |
| GET | /api/notes/:id | — | 获取笔记详情（含 blocks） |
| POST | /api/notes | `{ title?, folderId? }` | 创建笔记 |
| PUT | /api/notes/:id | `{ title?, folderId? }` | 更新笔记元信息 |
| DELETE | /api/notes/:id | — | 删除笔记 |
| PUT | /api/notes/:id/blocks | `{ blocks[] }` | 批量保存块内容 |

**批量保存块格式**:

```json
{
  "blocks": [
    { "type": "text", "content": "Hello", "order": 0, "parentBlockId": null },
    { "type": "heading", "content": "Title", "order": 1, "parentBlockId": null }
  ]
}
```

### 搜索

| 方法 | 路径 | Body | 说明 |
| :--- | :--- | :--- | :--- |
| GET | /api/search | `?q=关键词` | 全文搜索（FTS5） |

**搜索响应**:

```json
{
  "notes": [
    {
      "id": 1,
      "title": "笔记标题",
      "snippet": "包含<span class=\"fts5-highlight\">关键词</span>的内容片段...",
      "updated_at": "2025-01-15T10:30:00Z"
    }
  ]
}
```

### 附件

| 方法 | 路径 | Body | 说明 |
| :--- | :--- | :--- | :--- |
| GET | /api/notes/:noteId/attachments | — | 列出笔记的所有附件 |
| POST | /api/notes/:noteId/attachments | multipart/form-data | 上传附件 |
| DELETE | /api/notes/:noteId/attachments/:id | — | 删除附件 |
| GET | /api/attachments/:id | — | 下载附件（文件下载） |
| GET | /api/attachments/:id/preview | — | 预览附件（内联预览） |

**下载/预览认证**：通过 query 参数传递 JWT token：

```
GET /api/attachments/1?token=jwt_token_here
GET /api/attachments/1/preview?token=jwt_token_here
```

或 Authorization header：

```
GET /api/attachments/1
Authorization: Bearer jwt_token_here
```

## 路由注册顺序

路由注册顺序决定中间件是否生效：

```
1. auth routes          ← 无需认证（注册/登录）
2. attachment download  ← 自认证（query token / header token）
3. attachment preview   ← 自认证（query token / header token）
4. authMiddleware       ← 开始 JWT 验证
5. folder routes        ← 需要 authMiddleware
6. note routes          ← 需要 authMiddleware
7. search routes        ← 需要 authMiddleware
8. attachment routes    ← 需要 authMiddleware（上传/列表/删除）
```

附件下载/预览路由必须在 authMiddleware 之前注册，因为它们使用 query 参数而非 Authorization header 传递 token。

## 认证中间件

除注册/登录、附件下载/预览外的所有接口都需要 JWT 认证。

请求头携带：

```
Authorization: Bearer <token>
```

JWT payload 中 `sub` 字段存储用户 ID，认证通过后挂载到 `ctx.state.userId`。

## 搜索实现

使用 SQLite FTS5 扩展实现全文搜索。搜索流程：

1. 优先使用 `notes_fts MATCH ?` 进行 FTS5 搜索
2. 使用 `snippet()` 函数生成高亮摘要
3. 如果 FTS5 查询语法错误，回退到 LIKE 模糊匹配

搜索同时匹配标题和内容，返回带高亮标记的摘要片段。

## 附件上传

使用自定义的 multipart/form-data 解析器（不依赖外部库）。解析流程：

1. 从 Content-Type 头提取 boundary（支持带引号的边界字符串）
2. 收集请求体所有 chunk，保持原始 Buffer
3. 按 `--boundary\r\n` 分割各 part
4. 分离 headers 和 body（以 `\r\n\r\n` 为分隔符）
5. 文件名支持 `filename="xxx"` 和 `filename*=UTF-8''xxx` 格式
6. body 部分直接存储为 Buffer，不经过字符串转换（避免中文乱码）
7. 文件以随机十六进制文件名存储到 `data/attachments/` 目录
8. 元数据（原始文件名、存储名、大小、MIME 类型）入库

## 运行方式

```bash
# 开发模式（自动重启）
npm run dev

# 生产模式
npm start

# 带环境变量
HOST=127.0.0.1 DB_PATH=/path/to/db PORT=3001 node src/index.js
```

## 环境变量

| 变量 | 默认值 | 说明 |
| :--- | :--- | :--- |
| PORT | 3001 | 服务端口 |
| HOST | localhost | 绑定地址 |
| DB_PATH | — | 数据库路径（可选） |
| JWT_SECRET | dev-secret | JWT 签名密钥 |

## 静态文件服务

Koa 在 `index.js` 中配置了静态文件中间件：

- 非 `/api` 开头的请求走静态文件路由
- 优先从 `packages/web/dist/` 查找对应文件
- 找不到时回退到 `index.html`（支持 SPA 客户端路由）
- 生产部署只需运行 Node.js 服务，无需额外 Nginx
