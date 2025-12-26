# Walkscape Planner

A SvelteKit application for planning recipes in the Walkscape game.

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

## GitHub Pages Deployment

This project is configured for automatic deployment to GitHub Pages.

### Automatic Deployment

1. Push changes to the `main` branch
2. GitHub Actions will automatically build and deploy to GitHub Pages
3. Your site will be available at `https://[username].github.io/walkscape-planner`

### Manual Deployment

To deploy manually:

```sh
npm run deploy
```

### Configuration Notes

- Uses `@sveltejs/adapter-static` for static site generation
- Base path is set to `/walkscape-planner` for GitHub Pages
- Build output is directed to the `build` directory
- GitHub Actions workflow handles automatic deployment from main branch
