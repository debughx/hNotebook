# hNotebook

**hNotebook** 是个人知识库向的笔记应用：**React + Vite** 单页前端，**Spring Boot** 负责笔记 / 文件夹 / 标签与账号（JWT），**FastAPI** 提供 RAG（兼容 OpenAI 协议的向量与对话）。浏览器侧通过 **IndexedDB** 做**本地优先**缓存与离线编辑，联网后按 **LWW** 与服务端对齐。

**语言：** [English](README.md) · 简体中文（本页）

---

## 功能概览

- **笔记与 Markdown** — Markdown 正文；侧栏目录树与文件夹；按标题 / 正文搜索。
- **账号** — 注册 / 登录，JWT；数据按用户隔离。
- **离线可用** — IndexedDB 镜像 + 待发队列；联网后同步；与服务端 `updatedAt` 做 **LWW** 合并。
- **知识库问答（RAG）** — 将笔记写入向量索引、多会话聊天、模型与 API 可在界面或环境中配置。
- **主题** — 多套界面配色（含浅色 / 深色倾向），强调色与控件风格一致。
- **Docker** — Compose 一键起网关，统一暴露 **`/api`**、**`/rag`**（默认 **8080** 端口）。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19、TypeScript、Vite 6、Dexie（IndexedDB）、react-markdown |
| API | Java 21、Spring Boot、JWT、默认 H2 文件库 |
| RAG | Python 3.12+、FastAPI、Uvicorn |
| 部署 | Docker Compose、nginx 网关 |

---

## 仓库结构

| 路径 | 说明 |
|------|------|
| `apps/web` | 前端；开发时 Vite 代理 `/api` 与 `/rag` |
| `services/api` | Java 服务，统一前缀 **`/api`** |
| `services/rag` | Python RAG 服务 |
| `deploy/` | `docker-compose.yml` 与网关镜像 |
| `contracts/` | 可选：OpenAPI / 共享 Schema |
| `docs/` | 架构与本地开发说明 |
| `scripts/` | 辅助脚本（如 Windows 下 `dev.ps1`） |

---

## 环境要求

- **Node.js** 20+
- **JDK 21** 与 **Maven 3.9+**（运行 `services/api`），或仅用 Docker 构建/运行 API
- **Python 3.12+**（运行 `services/rag`）
- **Docker**（可选，用于 Compose）

---

## 快速开始

### 方式 A — Docker（API + RAG 网关）

在仓库根目录执行：

```bash
cd deploy
docker compose up --build
```

- API 健康检查：`http://127.0.0.1:8080/api/health`
- RAG 健康检查：`http://127.0.0.1:8080/rag/health`

使用真实向量/对话能力时，请配置 `OPENAI_API_KEY`（及可选的 `OPENAI_BASE_URL`、模型等）。**完整 Web 界面**在开发阶段通常用下面的 **Vite** 启动。

### 方式 B — 本地三进程

建议顺序：**Java API → RAG → Vite 前端**。

```bash
# 1) API
cd services/api && mvn spring-boot:run

# 2) RAG
cd services/rag
python -m venv .venv && .venv\Scripts\activate   # Windows
# source .venv/bin/activate                        # macOS / Linux
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# 3) 前端
cd apps/web && npm install && npm run dev
```

浏览器打开 Vite 输出的地址（常见为 `http://127.0.0.1:5173`）。

**更详细的命令与排错：** [docs/local-dev.md](docs/local-dev.md)

---

## 配置说明

- **JWT：** 默认密钥在 `application.yml`。生产环境请设置 **`HNOTEBOOK_JWT_SECRET`**（至少 32 字节）。Compose 里自带的是开发占位，**正式部署前务必修改**。
- **RAG：** 可在应用内 **「知识库配置」** 填写 Base URL、API Key 与模型；也可通过 Compose 环境变量配置（见 `deploy/docker-compose.yml`）。
- **本地优先：** 数据在浏览器 IndexedDB（库名 `hnotebook`）。部分文件夹/标签操作仍可能依赖服务端规则，需联网。

---

## 文档索引

| 文档 | 内容 |
|------|------|
| [docs/local-dev.md](docs/local-dev.md) | 环境、命令、中英文提示与排错 |
| [docs/architecture.md](docs/architecture.md) | 模块边界与演进思路（以英文为主） |

---

## 许可证

本项目为**个人 GitHub 仓库**。若对外开源，请自行在仓库根目录添加 `LICENSE` 并选择合适的协议。

---

<p align="center">
  <a href="README.md">→ English README</a>
</p>
