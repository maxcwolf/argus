# @argus-vrt/cli

**Visual Regression Testing for React Native**

Capture screenshots from iOS Simulators for all your Storybook stories, compare them against baselines, and review changes in a web dashboard.

## Prerequisites

- macOS with Xcode installed
- Node.js >= 20
- React Native app with [Storybook](https://storybook.js.org/tutorials/intro-to-storybook/react-native/en/get-started/) configured
- iOS Simulator

## Installation

```bash
yarn add -D @argus-vrt/cli
# or
npm install -D @argus-vrt/cli
```

## Quick Start

### 1. Initialize

```bash
yarn argus init
```

This will auto-detect your Storybook config, find available iOS simulators, and create `.argus.json` with sensible defaults.

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

## Commands

### `argus test`

Run a complete visual test cycle: capture screenshots, compare against baselines, and upload results.

```
argus test [options]

Options:
  -b, --branch <branch>       Override current git branch
  --base <branch>              Base branch for comparison (default: main)
  --skip-capture               Skip screenshot capture, use existing screenshots
  --skip-upload                Skip uploading results to the web dashboard
  -t, --threshold <threshold>  Difference threshold 0-1 (default: 0.01)
```

### `argus init`

Interactive setup wizard for your project.

```
argus init [options]

Options:
  -f, --force   Overwrite existing configuration
```

### `argus baseline`

Manage visual baselines.

```
argus baseline [options]

Options:
  --update             Update baselines from current screenshots
  --clear              Clear all baselines
  -b, --branch <branch>  Branch to use for screenshots (default: current)
```

### `argus capture-all`

Capture screenshots of all Storybook stories.

```
argus capture-all [options]

Options:
  -b, --branch <branch>     Override current git branch
  -s, --scheme <scheme>     URL scheme for deep linking
  -d, --delay <ms>          Delay between captures in ms (default: 1500)
  -f, --filter <pattern>    Filter stories by regex pattern
  --skip-shutdown            Keep simulator running after capture
```

### `argus compare`

Compare current screenshots against baselines.

```
argus compare [options]

Options:
  --base <branch>              Base branch for comparison (default: main)
  --current <branch>           Current branch (default: current git branch)
  -t, --threshold <threshold>  Difference threshold 0-1 (default: 0.01)
  --no-report                  Skip HTML report generation
```

### `argus upload`

Upload comparison results to the web dashboard.

```
argus upload [options]

Options:
  -b, --branch <branch>    Override current git branch
  -u, --api-url <url>      Override API URL from config
```

### `argus list-stories`

List all Storybook stories detected in the project.

```
argus list-stories [options]

Options:
  --json   Output as JSON
```

## Configuration

Configuration is stored in `.argus.json` in your project root. Run `argus init` to generate it interactively.

```json
{
  "storybook": {
    "port": 7007,
    "scheme": "myapp",
    "startCommand": "yarn storybook:ios"
  },
  "simulator": {
    "device": "iPhone 16 Pro",
    "os": "18.2",
    "bundleId": "com.myapp"
  },
  "comparison": {
    "mode": "threshold",
    "threshold": 0.01,
    "includeMetrics": true
  },
  "baselineDir": ".visual-baselines",
  "screenshotDir": ".visual-screenshots",
  "apiUrl": "http://localhost:3000"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `storybook.port` | Yes | Storybook WebSocket port |
| `storybook.scheme` | Yes | iOS URL scheme for deep linking |
| `storybook.startCommand` | No | Command to start Storybook |
| `simulator.device` | Yes | Exact simulator device name (from `xcrun simctl list devices`) |
| `simulator.os` | Yes | iOS version |
| `simulator.bundleId` | Yes | App bundle identifier |
| `comparison.mode` | No | `"strict"` or `"threshold"` (default: `"threshold"`) |
| `comparison.threshold` | No | Pixel diff threshold 0-1 (default: `0.01`) |
| `baselineDir` | No | Directory for baseline images (default: `.visual-baselines`) |
| `screenshotDir` | No | Directory for screenshots (default: `.visual-screenshots`) |
| `apiUrl` | No | Web dashboard URL for uploading results |

## Web Dashboard

For a visual review interface with side-by-side diffs and overlay views, see [@argus-vrt/web](https://www.npmjs.com/package/@argus-vrt/web).

## How It Works

1. **Capture** - Boots iOS simulator, launches your app with Storybook, navigates to each story via deep links, and captures screenshots
2. **Compare** - Compares current screenshots against baselines using Pixelmatch, generates diff images highlighting changed pixels
3. **Upload** - Sends results to the web dashboard API (optional)
4. **Review** - Use the web dashboard to review changes with overlay, side-by-side, and diff views

## License

MIT
