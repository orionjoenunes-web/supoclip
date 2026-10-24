# SupoClip in GitHub Codespaces

## Quick Start

1. **Push this repo to GitHub** (if not already)
2. **Open in Codespaces**: `Code` → `Codespaces` → `Create codespace on main`
3. **Wait ~3 minutes** for build + services to start
4. **Click "Open in Browser"** on the 3107 port notification → Full SupoClip UI

## Required Secrets (Set in Codespaces Settings)

Go to **GitHub Settings → Codespaces → Secrets** and add:

| Secret | Value | Required |
|--------|-------|----------|
| `ASSEMBLY_AI_API_KEY` | Your AssemblyAI key | **Yes** (transcription) |
| `GOOGLE_API_KEY` | Google AI Studio key | **Yes** (LLM for clip selection) |
| `LLM` | `google-gla:gemini-3-flash-preview` | No (default) |
| `OPENAI_API_KEY` | OpenAI key | Alternative to Google |
| `ANTHROPIC_API_KEY` | Anthropic key | Alternative to Google |
| `PEXELS_API_KEY` | Pexels API key | No (B-roll) |
| `YOUTUBE_OAUTH_CLIENT_ID` | Google OAuth client ID | No (social publishing) |
| `YOUTUBE_OAUTH_CLIENT_SECRET` | Google OAuth secret | No (social publishing) |

## What Runs

| Service | Port | Access |
|---------|------|--------|
| Frontend (Next.js) | 3107 | Auto-opens in browser |
| Backend API (FastAPI) | 8000 | `https://<codespace>-8000.app.github.dev/docs` |
| PostgreSQL | 5432 | Internal only |
| Redis | 6379 | Internal only |
| MCP Server | 9100 | `https://<codespace>-9100.app.github.dev` |

## Useful Commands (in Codespaces Terminal)

```bash
# View all service logs
docker-compose logs -f

# Backend logs only
docker-compose logs -f backend

# Worker logs (video processing)
docker-compose logs -f worker

# Restart everything
docker-compose restart

# Rebuild after code changes
docker-compose up -d --build

# Run backend tests
docker-compose exec backend uv run pytest

# Shell into backend
docker-compose exec backend bash

# Database shell
docker-compose exec postgres psql -U supoclip -d supoclip
```

## Developing

- **Frontend edits**: `supoclip/frontend/src/` → hot reloads automatically
- **Backend edits**: `supoclip/backend/src/` → auto-reloads (uvicorn --reload)
- **Database changes**: Edit `supoclip/init.sql` → `docker-compose exec postgres psql -U supoclip -d supoclip -f /docker-entrypoint-initdb.d/init.sql`

## Troubleshooting

**Port 3107 doesn't open:** Check "Ports" tab in VS Code → right-click 3107 → "Port Visibility" → "Public"

**Services unhealthy:** `docker-compose logs backend` → look for missing API keys

**Out of memory:** Codespaces free tier = 4GB. If OOM, reduce `MAX_CLIPS=3` and `YOUTUBE_MAX_HEIGHT=720` in secrets.

**Need more time:** Free tier = 60 hrs/mo. Pauses after 30 min inactivity.