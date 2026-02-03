# Diffinitely

**React Native Storybook Visual Diff Testing**

A Chromatic-like visual regression testing tool for React Native Storybook on iOS simulators. Capture screenshots, compare visual differences, and review changes in a web dashboard.

## Features

- **Automated Screenshot Capture** - Captures screenshots from iOS Simulators for all Storybook stories
- **Fast Image Comparison** - Uses Pixelmatch with configurable thresholds
- **SSIM Scoring** - Structural similarity scoring for more accurate diff detection
- **Web Dashboard** - Review visual changes with side-by-side, diff, and overlay views
- **Dark Mode** - Full dark mode support in the web dashboard
- **Diff Overlay** - See exactly where pixels changed with red/magenta highlights
- **Git Integration** - Branch-based screenshot management
- **CI/CD Ready** - Upload results to the web dashboard from your CI pipeline

## Prerequisites

- macOS with Xcode installed
- Node.js >= 20
- Yarn >= 4
- React Native app with Storybook configured
- iOS Simulator
- Docker (for local PostgreSQL database)

## Installation

Install as a dev dependency in your React Native project:

```bash
npm install -D @diffinitely/cli

# Or with yarn
yarn add -D @diffinitely/cli
```

Then use via `npx diffinitely` or add npm scripts (recommended).

## Quick Start

### 1. Initialize in your React Native project

```bash
cd ~/your-rn-app
npx diffinitely init
```

This will:
- Detect your Storybook configuration
- Find available iOS simulators
- Create `.diffinitely.json` with sensible defaults
- Update your `.gitignore`

### 2. Add npm scripts

```json
{
  "scripts": {
    "visual:test": "diffinitely test",
    "visual:baseline": "diffinitely baseline --update"
  }
}
```

### 3. Create initial baselines

```bash
# Ensure your RN app with Storybook is running
yarn ios

# Capture screenshots and create baselines
yarn visual:test --skip-upload
yarn visual:baseline

# Commit your baselines
git add .visual-baselines
git commit -m "chore: add visual baselines"
```

### 4. Run visual tests

```bash
# After making UI changes, run the test
yarn visual:test

# If changes are intentional, update baselines
yarn visual:baseline
```

### 5. (Optional) Web dashboard

For a visual review interface with diff overlays, deploy the web dashboard with Docker:

```bash
cd packages/web

# Start dashboard and database
docker compose -f docker-compose.prod.yml up -d

# Run migrations (first time)
docker compose -f docker-compose.prod.yml exec web npx drizzle-kit push
```

Dashboard will be at `http://localhost:3000`

Add the URL to your `.diffinitely.json`:
```json
{
  "apiUrl": "http://localhost:3000"
}
```

See [packages/web/DEPLOYMENT.md](packages/web/DEPLOYMENT.md) for full instructions including HTTPS, nginx, and team setups.

**Dashboard features:**
- Side-by-side image comparison
- Diff overlay view with opacity slider
- Dark mode support
- Story filtering by status

## CLI Commands

### Main Commands

#### `diffinitely init`

Interactive setup wizard that auto-detects your project configuration.

```bash
diffinitely init [--force]
```

#### `diffinitely test`

Run a complete visual test cycle: capture, compare, and upload (if configured).

```bash
diffinitely test [options]

Options:
  --skip-capture     Use existing screenshots
  --skip-upload      Don't upload results
  --base <branch>    Base branch for comparison (default: main)
  -t, --threshold    Difference threshold 0-1 (default: 0.01)
```

#### `diffinitely baseline`

Manage visual baselines.

```bash
diffinitely baseline [options]

Options:
  --update    Update baselines from current screenshots
  --clear     Remove all baselines
```

### Individual Step Commands

#### `diffinitely capture-all`

Capture screenshots of all Storybook stories.

```bash
diffinitely capture-all [options]

Options:
  -b, --branch <branch>    Override current git branch
  -f, --filter <pattern>   Filter stories by regex
  --skip-shutdown          Keep simulator running
```

#### `diffinitely compare`

Compare screenshots against baselines.

```bash
diffinitely compare [options]

Options:
  --base <branch>          Base branch (default: main)
  -t, --threshold <value>  Difference threshold 0-1
  --no-report              Skip HTML report
```

#### `diffinitely upload`

Upload results to web dashboard.

```bash
diffinitely upload [--api-url <url>]
```

## Web Dashboard

The web dashboard provides a visual interface for reviewing test results:

- **Dashboard** - Overview of all test runs with status
- **Test Detail** - Review individual story changes
- **View Modes**:
  - Side by Side - Compare baseline and current
  - Diff Only - See only the difference image
  - Overlay - See diff highlights on the current screenshot
  - Current Only - View just the current screenshot
- **Diff Opacity Slider** - Adjust overlay visibility
- **Dark Mode** - Toggle between light and dark themes

## Project Structure

```
diffinitely/
├── packages/
│   ├── cli/           # CLI tool for capture/compare/upload
│   ├── web/           # TanStack Start web dashboard
│   └── shared/        # Shared types and constants
├── docker-compose.yml # PostgreSQL for local development
└── README.md
```

## Configuration

### Required Settings

| Field | Description |
|-------|-------------|
| `storybook.port` | Storybook WebSocket port |
| `storybook.scheme` | iOS URL scheme for deep linking |
| `simulator.device` | Exact simulator device name |
| `simulator.bundleId` | App bundle identifier |

### Optional Settings

| Field | Default | Description |
|-------|---------|-------------|
| `comparison.threshold` | `0.01` | Pixel diff threshold (0-1) |
| `baselineDir` | `.visual-baselines` | Directory for baseline images |
| `screenshotDir` | `.visual-screenshots` | Directory for screenshots |
| `apiUrl` | - | Web dashboard URL for uploads |

## How It Works

1. **Capture** - CLI boots simulator, launches app with Storybook, navigates to each story via deep links, and captures screenshots
2. **Compare** - Compares current screenshots against baselines using Pixelmatch, generates diff images with transparent backgrounds for changed pixels
3. **Upload** - Sends results to the web dashboard API, which stores metadata in PostgreSQL
4. **Review** - Use the web dashboard to review changes with overlay view showing exactly where pixels differ

## Development

```bash
# Install dependencies
yarn install

# Build all packages
yarn build

# Develop CLI
cd packages/cli && yarn dev

# Develop web app
cd packages/web && yarn dev
```

## Troubleshooting

### Simulator not found

Ensure the device name in config matches exactly:
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

Ensure the web app server is running and can access the screenshot directories on your local filesystem.

## Tech Stack

- **CLI**: Node.js, TypeScript, Pixelmatch, Sharp, Commander
- **Web**: TanStack Start, TanStack Router, Drizzle ORM, Tailwind CSS
- **Database**: PostgreSQL
- **Containerization**: Docker

## License

MIT
