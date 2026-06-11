# Testing

## Commands

```bash
npm ci
npm audit --audit-level=moderate
npm test
npm run build
```

E2E tests require the built app to be served at the URL expected by `tests/e2e/route-smoke.mjs`:

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 3002
npm run test:e2e
```

The default e2e URL is `http://127.0.0.1:3002/klinefelter-game/`. Override it with `APP_URL` if needed. The script uses system Chrome from `CHROME_PATH` or `/usr/bin/google-chrome`.

## Current Coverage

- Unit and regression tests run with Vitest and jsdom.
- Route smoke tests run with Playwright against desktop and mobile viewports.
- Security regression coverage includes persisted score/nickname rendering, storage corruption, route fuzzing, save parsing, error export sanitization, autosave recovery, and Block Blast pointer cleanup.

## CI

`.github/workflows/deploy.yml` runs install, build, unit tests, starts `vite preview` on port 3002, runs e2e route smoke, and deploys `dist/` to GitHub Pages.
