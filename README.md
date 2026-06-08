# inchangson.github.io

Astro-based personal blog for GitHub Pages.

## Stack

- Astro
- Markdown content collections
- GitHub Pages deployment via GitHub Actions

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Content

- Blog posts live in `src/content/posts/`
- Shared layout and components live in `src/layouts/` and `src/components/`
- Global styles live in `src/styles/global.css`

## Deployment

The repository is configured for GitHub Pages deployment through `.github/workflows/deploy.yml`.
The Astro config is set for the `inchangson.github.io` Pages URL in `astro.config.mjs`.
