# Deploying to a VPS with Docker Compose

The simplest way to run RAG Studio in production: one small VPS, the provided
`docker-compose.prod.yml`, and Caddy for automatic HTTPS. No Ollama — generation
and embeddings use cloud API keys, so a 1–2 GB RAM server is enough.

**Architecture:** `Internet → Caddy (:80/:443, auto-HTTPS) → frontend (nginx) → backend (FastAPI :8090)`.
The frontend already proxies `/api` and `/ws` (WebSocket) to the backend. ChromaDB,
the SQLite run history, and uploads persist in Docker volumes.

---

## 1. Provision a server

- A VPS with **Ubuntu 22.04/24.04**, 1–2 GB RAM (e.g. Hetzner CX22 ~€4/mo, DigitalOcean, Scaleville…).
- Point a **domain** at it: create a DNS **A record** (e.g. `ragviz.example.com → <server-ip>`).
  HTTPS needs a real domain. (No domain? You can still test over HTTP — see step 5.)
- Open ports **80** and **443** in the provider's firewall / `ufw`:
  ```bash
  sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw allow OpenSSH && sudo ufw enable
  ```

## 2. Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # then log out/in so `docker` works without sudo
```
This includes the `docker compose` plugin.

## 3. Get the code

```bash
git clone https://github.com/Nokimalos/rag-vizualisation.git
cd rag-vizualisation
# deploy the redesigned UI until it's merged to main:
git checkout worktree-ui-redesign
```

## 4. Configure secrets and domain

**Backend API keys** — create `backend/.env` from the example:
```bash
cp backend/.env.example backend/.env
```
Edit `backend/.env` and set at least:
```ini
OPENAI_API_KEY=sk-...        # used for embeddings (text-embedding-3-small)
ANTHROPIC_API_KEY=sk-ant-... # used for generation (or use OPENAI for both)
```
Leave the vector-DB / Ollama lines as-is; ChromaDB (local, persisted in a volume)
is the default and needs no configuration.

**Domain** — create a root `.env` for Compose:
```bash
cp .env.prod.example .env
# edit .env → DOMAIN=ragviz.example.com
```

## 5. Launch

```bash
docker compose -f docker-compose.prod.yml up -d --build
```
First boot builds both images (a few minutes). Caddy then provisions a Let's Encrypt
certificate automatically for your domain.

Visit **https://your-domain** 🎉

> **HTTP-only test (no domain):** set `DOMAIN=:80` in `.env`, also set
> `CORS_ORIGINS=http://<server-ip>` in `backend/.env`, then `up -d --build` and open
> `http://<server-ip>`.

## 6. First use

Open the app → **Réglages** to confirm the active providers (OpenAI embeddings,
Anthropic/OpenAI generation), then upload a document on **Pipeline** and run a query.

---

## Operations

**Logs**
```bash
docker compose -f docker-compose.prod.yml logs -f          # all
docker compose -f docker-compose.prod.yml logs -f backend  # one service
```

**Update to the latest code**
```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

**Restart / stop**
```bash
docker compose -f docker-compose.prod.yml restart
docker compose -f docker-compose.prod.yml down            # stop (volumes kept)
```

**Backups** — all state lives in named volumes (`backend-data` = ChromaDB + SQLite,
`backend-uploads` = documents, `caddy-data` = TLS certs). Back up `backend-data` and
`backend-uploads`:
```bash
docker run --rm -v rag-vizualisation_backend-data:/data -v "$PWD":/backup alpine \
  tar czf /backup/backend-data-$(date +%F).tar.gz -C /data .
```
(Volume name = `<project-dir>_<volume>`; check with `docker volume ls`.)

## Faster deploys with prebuilt images (optional)

Tagging a release (`git tag v0.1.0 && git push origin v0.1.0`) publishes images to
GHCR via the existing `release.yml` workflow. You can then swap the `build:` lines in
`docker-compose.prod.yml` for:
```yaml
  backend:
    image: ghcr.io/nokimalos/rag-vizualisation-backend:latest
  frontend:
    image: ghcr.io/nokimalos/rag-vizualisation-frontend:latest
```
and run `docker compose -f docker-compose.prod.yml pull && ... up -d` (no on-server build).

## Cost & scaling notes

- A single 1–2 GB VPS comfortably runs this for demo / light use; LLM/embedding compute
  is offloaded to the API providers (you pay per token there).
- Persistence is local to the box. For higher availability, move the vector store to a
  managed **Qdrant** and the run history to managed **Postgres** (the backend already
  has Qdrant/pgvector providers — set `QDRANT_URL` / `PGVECTOR_CONNECTION_STRING`).
