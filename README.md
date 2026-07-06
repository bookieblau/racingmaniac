# Racing Maniac

Offroad desert racing in the browser, built with [Babylon.js](https://www.babylonjs.com/) and [Vite](https://vite.dev/).

Live site: [racingmaniac.lol](https://racingmaniac.lol)

## Development

Requires Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

**Controls:** WASD or arrow keys.

## Build

```bash
npm run build
npm run preview
```

Production files are written to `dist/`.

## Deployment

Pushes to `main` trigger a GitHub Action that builds the game and publishes `dist/` to the `deploy` branch.

In Porkbun Static Hosting → GitHub Connect, point the site at:

- **Repository:** `bookieblau/racingmaniac`
- **Branch:** `deploy`

## Project layout

```text
src/           Game source (TypeScript)
public/        Static assets copied into the build
index.html     Page shell
dist/          Build output (generated, not committed)
```
