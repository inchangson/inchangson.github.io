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

The development server includes draft posts across the blog so series and navigation can be previewed before publishing. Drafts are marked with a `Draft` badge and remain excluded from production builds.

## Build

```bash
npm run build
```

## Content

- Blog posts live in `src/content/posts/`
- Shared layout and components live in `src/layouts/` and `src/components/`
- Global styles live in `src/styles/global.css`

## Local editor

Run the local-only WYSIWYG editor at `http://127.0.0.1:4322`:

```bash
npm run editor
```

The editor reads and writes blog Markdown, structured Resume data, and series definitions. Blog posts support one category, multiple tags, and an optional ordered series. Pasted images are stored under `public/images/posts/<slug>/`. It does not commit, push, or ship with the GitHub Pages build. Run `npm run dev` separately if you want the preview links to open the live Astro pages.

## Deployment

The repository is configured for GitHub Pages deployment through `.github/workflows/deploy.yml`.
The Astro config is set for the `inchangson.github.io` Pages URL in `astro.config.mjs`.
