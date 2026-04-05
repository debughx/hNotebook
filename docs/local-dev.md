# Local development

## Prerequisites

- **Node.js** 20+ (for `apps/web`)
- **JDK 21** and **Apache Maven 3.9+** on your `PATH` (for `services/api`). If Maven is not installed, use `deploy/docker compose` to build the API image, or install Maven from [https://maven.apache.org/](https://maven.apache.org/).
- **Python 3.12+** (for `services/rag`)

## Run the three processes

### 1. Java API

```bash
cd services/api
mvn spring-boot:run
```

Health: [http://127.0.0.1:8080/api/health](http://127.0.0.1:8080/api/health)

### 2. Python RAG

```bash
cd services/rag
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Health: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

### 3. Web

```bash
cd apps/web
npm install
npm run dev
```

Open the URL Vite prints (usually [http://127.0.0.1:5173](http://127.0.0.1:5173)). The home page calls `/api/health` and `/rag/health` through the Vite proxy.

## Docker (gateway on port 8080)

From repo root:

```bash
cd deploy
docker compose up --build
```

- Gateway: [http://127.0.0.1:8080/api/health](http://127.0.0.1:8080/api/health)
- RAG via gateway: [http://127.0.0.1:8080/rag/health](http://127.0.0.1:8080/rag/health)

For day-to-day UI work, prefer Vite + local JVM/Python; use Compose to verify the nginx paths.

## 中文提示

- 先启动 **Java API**（`services/api`），再开 **Vite**（`apps/web`），否则前端登录会失败。
- JWT 密钥：默认写在 `application.yml`；生产环境请设置环境变量 **`HNOTEBOOK_JWT_SECRET`**（至少 32 字节）。
- **本地优先**：笔记数据在浏览器 **IndexedDB**（库名 `hnotebook`）中缓存；离线时仍可编辑，顶部会显示「离线 / 待同步」；联网或点「刷新/同步」后与 Java API 对齐（**LWW**：服务端更新时间更晚则覆盖本地未推送草稿）。文件夹/标签的新建与删除仍需联网。

## Troubleshooting

- **Frontend build on Windows:** This repo pins **Vite 6** (esbuild). Vite 8’s Rolldown native bindings can fail on some Windows setups; if you upgrade Vite later, do a clean `node_modules` reinstall if you see optional-dependency errors.
