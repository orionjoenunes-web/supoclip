# Run SupoClip from prebuilt GHCR images (Windows)

1. Download or clone this repository, install Docker Desktop, and open PowerShell in the repository folder.
2. Run `powershell -ExecutionPolicy Bypass -File .\start-prebuilt.ps1`. The first run copies `.env.example` to `.env`, generates the three app secrets, and opens `.env` in Notepad.
3. Enter your keys in the matching `.env` lines:
   - `ASSEMBLY_AI_API_KEY=` — AssemblyAI transcription key.
   - `GOOGLE_API_KEY=` — Google AI Studio key. The starter sets `LLM=google-gla:gemini-3-flash-preview`. To use another provider, set its key (`OPENAI_API_KEY` or `ANTHROPIC_API_KEY`) and change `LLM` to a model supported by that provider.
4. Save `.env` and run `powershell -ExecutionPolicy Bypass -File .\start-prebuilt.ps1` again. It pulls the three GHCR images, starts Compose, and checks `http://localhost:3107/api/auth/get-session`.
5. Open **http://localhost:3107**.

The generated secrets are `BETTER_AUTH_SECRET`, `BACKEND_AUTH_SECRET`, and `APP_SETTINGS_ENCRYPTION_KEY`. Keep `.env` private; it is ignored by Git. If GHCR asks for authentication, run `docker login ghcr.io` with your GitHub username and a token with `read:packages`.

The override disables local builds and source bind mounts for the three published services. The startup script targets ARM64 by default for an Oracle Ampere A1 VM; the multi-architecture image tags also include AMD64. The optional MCP server is excluded from the default startup. Compose v2.24.4 or newer is required for the override merge tags.
