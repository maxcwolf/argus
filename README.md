<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/banner-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="assets/banner-light.svg">
    <img alt="Argus" src="assets/banner-light.svg" width="640">
  </picture>
  <br><br>
  Capture screenshots from iOS Simulators for all your Storybook stories,<br>compare them against baselines, and review changes in a self-hosted web dashboard.
</p>

## Features

- **Automated Screenshot Capture** - Captures screenshots from iOS Simulators for all Storybook stories
- **Fast Image Comparison** - Uses Pixelmatch with configurable thresholds and SSIM scoring
- **Web Dashboard** - Review visual changes with side-by-side, diff, overlay, and current-only views
- **Story Browser** - Flat list, tree (by component), and grouped (by directory) view modes
- **Git Integration** - Branch-based screenshot management
- **CI/CD Ready** - Upload results to the web dashboard from your CI pipeline

## Prerequisites

- macOS with Xcode installed
- Node.js >= 20
- React Native app with Storybook configured
- iOS Simulator

## Installation

```bash
npm install -D @argus-vrt/cli
# or
yarn add -D @argus-vrt/cli
```

## Quick Start

### 1. Install and initialize

```bash
yarn add -D @argus-vrt/cli
yarn argus init
```

This will auto-detect your Storybook configuration, find available iOS simulators, and create `.argus.json` with sensible defaults.

### 2. Add scripts to `package.json`

```json
{
  "scripts": {
    "visual:test": "argus test",
    "visual:baseline": "argus baseline --update"
  }
}
```

### 3. Create initial baselines

```bash
# Make sure your React Native app with Storybook is running
yarn ios

# Capture screenshots and set baselines
yarn visual:test --skip-upload
yarn visual:baseline

# Commit your baselines
git add .visual-baselines
git commit -m "chore: add visual baselines"
```

### 4. Run visual tests

```bash
# After making UI changes
yarn visual:test

# If changes are intentional, update baselines
yarn visual:baseline
```

## CLI Commands

### `argus test`

Run a complete visual test cycle: capture, compare, and upload (if configured).

```
argus test [options]

Options:
  --skip-capture     Use existing screenshots
  --skip-upload      Don't upload results
  --base <branch>    Base branch for comparison (default: main)
  -t, --threshold    Difference threshold 0-1 (default: 0.01)
```

### `argus init`

Interactive setup wizard that auto-detects your project configuration.

```
argus init [--force]
```

### `argus baseline`

Manage visual baselines.

```
argus baseline [options]

Options:
  --update    Update baselines from current screenshots
  --clear     Remove all baselines
```

### `argus capture-all`

Capture screenshots of all Storybook stories.

```
argus capture-all [options]

Options:
  -b, --branch <branch>    Override current git branch
  -f, --filter <pattern>   Filter stories by regex
  --skip-shutdown          Keep simulator running
```

### `argus compare`

Compare screenshots against baselines.

```
argus compare [options]

Options:
  --base <branch>          Base branch (default: main)
  -t, --threshold <value>  Difference threshold 0-1
  --no-report              Skip HTML report
```

### `argus upload`

Upload results to the web dashboard.

```
argus upload [--api-url <url>]
```

See the full command reference with all options in the [@argus-vrt/cli README](packages/cli/README.md).

## Configuration

Configuration is stored in `.argus.json` in your project root. Run `argus init` to generate it.

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `storybook.port` | Yes | - | Storybook WebSocket port |
| `storybook.scheme` | Yes | - | iOS URL scheme for deep linking |
| `simulator.device` | Yes | - | Exact simulator device name |
| `simulator.bundleId` | Yes | - | App bundle identifier |
| `comparison.threshold` | No | `0.01` | Pixel diff threshold (0-1) |
| `baselineDir` | No | `.visual-baselines` | Directory for baseline images |
| `screenshotDir` | No | `.visual-screenshots` | Directory for screenshots |
| `apiUrl` | No | - | Web dashboard URL for uploads |

## Web Dashboard

Argus includes a self-hosted web dashboard ([`@argus-vrt/web`](https://www.npmjs.com/package/@argus-vrt/web)) for reviewing visual diffs — similar to Chromatic, but self-hosted. It provides side-by-side diffs, overlay views with adjustable opacity, story browsing, search, and dark mode.

Deploy the dashboard with a single command:

```bash
# Interactive setup wizard — generates docker-compose.yml, .env, nginx.conf
npx @argus-vrt/web init

# Start the dashboard
npx @argus-vrt/web start

# Manage your deployment
npx @argus-vrt/web stop      # Stop containers
npx @argus-vrt/web logs      # Stream logs
npx @argus-vrt/web status    # Health check
npx @argus-vrt/web upgrade   # Pull latest image + restart
```

Then point your CLI at it by adding `apiUrl` to your `.argus.json`:

```json
{
  "apiUrl": "http://localhost:3000"
}
```

See the [@argus-vrt/web README](packages/web/README.md) for all CLI options and configuration.

## How It Works

1. **Capture** - Boots iOS simulator, launches your app with Storybook, navigates to each story via deep links, and captures screenshots
2. **Compare** - Compares current screenshots against baselines using Pixelmatch, generates diff images highlighting changed pixels
3. **Upload** - Sends results to the web dashboard API, which stores metadata in PostgreSQL
4. **Review** - Use the web dashboard to review changes with overlay view showing exactly where pixels differ

## Troubleshooting

### Simulator not found

Ensure the device name in `.argus.json` matches exactly:
```bash
xcrun simctl list devices
```

### App doesn't launch

1. Verify `scheme` and `bundleId` in config
2. Check app is installed: `xcrun simctl listapps booted`
3. Build app first: `yarn ios`

### No diff overlay visible

1. Select a story with changes (yellow percentage badge)
2. Click the "Overlay" button
3. Adjust the opacity slider

### Images not loading in web app

Ensure the web app server is running and can access the screenshot directories. See [image serving options](packages/web/DEPLOYMENT.md#image-serving).

---

## Contributing

### Project Structure

```
argus/
├── packages/
│   ├── cli/           # CLI tool (published as @argus-vrt/cli)
│   ├── web/           # Web dashboard (published as @argus-vrt/web)
│   └── shared/        # Shared types/constants (internal, bundled into CLI via tsup)
└── package.json       # Yarn 4 workspaces + Turborepo
```

### Setup

```bash
git clone https://github.com/maxcwolf/argus.git
cd argus
yarn install
yarn build
```

The build compiles all three packages in dependency order via [Turborepo](https://turbo.build/): `shared` (tsc) → `cli` (tsup, inlines shared) → `web` (Vite).

### Dev Workflow

```bash
# CLI — watch mode
yarn workspace @argus-vrt/cli dev

# Web — requires PostgreSQL via Docker
cd packages/web && docker compose up -d
yarn workspace @argus-vrt/web db:push
yarn workspace @argus-vrt/web dev
```

### Tech Stack

- **CLI**: Node.js, TypeScript, tsup, Pixelmatch, Sharp, Commander
- **Web**: TanStack Start, TanStack Router, Drizzle ORM, Tailwind CSS v4, PostgreSQL
- **Build**: Turborepo, Yarn 4 workspaces

## License

MIT
