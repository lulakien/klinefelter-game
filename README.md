# Klinefelter Game

Offline-ready mini game portal built with Vite, TypeScript, vanilla DOM, and PWA caching. The app is static-hosted, lazy-loads each game module, and stores local settings, scores, stats, and optional offline packages in browser storage.

## Setup

```bash
npm ci
npm run dev
```

The development server defaults to `http://localhost:3000/klinefelter-game/`.

## Scripts

```bash
npm test
npm run build
npm run preview -- --host 127.0.0.1 --port 3002
npm run test:e2e
npm audit --audit-level=moderate
```

Run e2e tests against a running preview server at `http://127.0.0.1:3002/klinefelter-game/`.

## Deployment

GitHub Pages deployment is handled by `.github/workflows/deploy.yml` on pushes to `master`. The workflow installs dependencies, builds, runs unit tests, starts a preview server, runs e2e route smoke tests, and deploys `dist/`.

## Docs

- [Architecture](docs/architecture.md)
- [Testing](docs/testing.md)
- [PWA and Offline Behavior](docs/pwa-offline.md)
- [Security Hardening Report](docs/security-hardening-report.md)
- [Historical Notes](docs/history/)
