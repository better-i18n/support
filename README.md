# Better i18n Support

Self-hosted customer support platform, forked from [Cossistant](https://github.com/cossistantcom/cossistant) (AGPL-3.0).

## About

This is Better i18n's internal support infrastructure — an AI-powered customer support system with real-time chat, conversation management, and an embeddable React widget.

## Stack

- **API:** Bun + Hono + Better Auth + Drizzle ORM
- **Database:** PostgreSQL 17 + pgvector
- **Cache/Queue:** Redis 7
- **AI:** OpenRouter / Gemini + pgvector RAG
- **Widget:** React (headless primitives + styled components)
- **Deploy:** Docker Compose + Dokploy

## Quick Start

```bash
# Clone
git clone https://github.com/better-i18n/support.git
cd support

# Copy env files
cp apps/api/.env.default apps/api/.env
cp apps/workers/.env.default apps/workers/.env

# Start services
docker compose up -d
```

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE) — the same license as the upstream [Cossistant](https://github.com/cossistantcom/cossistant) project.

As required by AGPL-3.0:
- This fork's source code is publicly available
- All modifications are clearly tracked in git history
- The original copyright and license are preserved

## Upstream

This is a fork of [cossistantcom/cossistant](https://github.com/cossistantcom/cossistant). We maintain our customizations (branding, deployment config, widget styling) while keeping the core engine in sync with upstream.
