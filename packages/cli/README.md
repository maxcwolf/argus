# @argus-vrt/cli

**Visual Regression Testing for React Native**

Capture screenshots from iOS Simulators for all your Storybook stories, compare them against baselines, and review changes in a portable HTML report or a self-hosted web dashboard.

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

Auto-detects your Storybook config, finds available iOS simulators, and creates `.argus.json` with sensible defaults.

### 2. Add scripts to `package.json`

```json
{
  "scripts": {
    "visual:test": "argus test --skip-upload --portable",
    "visual:baseline": "argus baseline --update"
  }
}
```

### 3. Create initial baselines

```bash
# Make sure your React Native app with Storybook is running
yarn ios

# Capture screenshots and set baselines
yarn visual:test
yarn visual:baseline

# Commit your baselines (screenshots are ephemeral)
git add .visual-baselines
git commit -m "chore: add visual baselines"
```

### 4. Set up `.gitignore`

Add this to your `.gitignore` — baselines are committed, screenshots are regenerated each run:

```gitignore
.visual-screenshots/
```

### 5. Run visual tests

```bash
# After making UI changes — generates report.html
yarn visual:test

# Open the report to review changes
open .visual-screenshots/$(git branch --show-current)/report.html

# If changes are intentional, update baselines
yarn visual:baseline
```

## Commands

### `argus test`

Run a complete visual test cycle: capture screenshots, compare against baselines, and generate a report.

```
argus test [options]

Options:
  -b, --branch <branch>       Override current git branch
  --base <branch>              Base branch for comparison (default: main)
  --skip-capture               Skip screenshot capture, use existing screenshots
  --skip-upload                Skip uploading results to the web dashboard
  -t, --threshold <threshold>  Difference threshold 0-1 (default: 0.01)
  --portable                   Embed images in HTML report (for CI artifacts)
```

**Typical usage:**

```bash
# Local development (file:// image URLs, opens in browser)
yarn argus test --skip-upload

# CI (self-contained HTML with embedded images)
yarn argus test --skip-upload --portable
```

### `argus init`

Interactive setup wizard for your project.

```
argus init [options]

Options:
  -f, --force   Overwrite existing configuration
```

### `argus baseline`

Manage visual baselines. Baselines are the "expected" screenshots that live in your repo.

```
argus baseline [options]

Options:
  --update             Update baselines from current screenshots
  --clear              Clear all baselines
  -b, --branch <branch>  Branch to use for screenshots (default: current)
```

**When to update baselines:**
- After making intentional UI changes
- After reviewing the HTML report and confirming the changes look correct
- Then commit the updated baselines so CI passes on the next run

### `argus capture-all`

Capture screenshots of all Storybook stories (without comparing).

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

Compare current screenshots against baselines (without capturing).

```
argus compare [options]

Options:
  --base <branch>              Base branch for comparison (default: main)
  --current <branch>           Current branch (default: current git branch)
  -t, --threshold <threshold>  Difference threshold 0-1 (default: 0.01)
  --no-report                  Skip HTML report generation
  --portable                   Embed images in HTML report (for CI artifacts)
```

### `argus upload`

Upload comparison results to the web dashboard. Only needed if you're running [`@argus-vrt/web`](https://www.npmjs.com/package/@argus-vrt/web). Requires an API key if the dashboard has `ARGUS_API_KEY` configured.

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
  "screenshotDir": ".visual-screenshots"
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
| `apiUrl` | No | Web dashboard URL — only needed if using `@argus-vrt/web` |
| `apiKey` | No | API key for authenticating uploads to the dashboard |

## CI Integration

Argus works standalone in CI — no web dashboard or database required. Use `--portable` to generate a self-contained HTML report with embedded images that can be uploaded as a build artifact.

### GitHub Actions

```yaml
- name: Run visual tests
  continue-on-error: true
  run: yarn argus test --skip-upload --portable

- name: Upload visual report
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: visual-regression-report
    path: .visual-screenshots/**/report.html
    retention-days: 30
```

### CircleCI

```yaml
- run:
    name: Run visual tests
    command: yarn argus test --skip-upload --portable
    when: always

- store_artifacts:
    path: .visual-screenshots
    destination: visual-regression-report
```

> **Important:** Both require a **macOS runner** for the iOS Simulator (`runs-on: macos-latest` for GHA, `macos` executor for CircleCI).

See complete workflow files with PR comments and build failure handling in [`ci-templates/`](./ci-templates/).

### What the portable report includes

The `--portable` flag generates a single HTML file with all images embedded as base64. The report features:

- **Side-by-side** — baseline vs current comparison
- **Diff overlay** — current screenshot with diff highlighted, adjustable opacity slider
- **Diff-only** — just the difference image
- **Current-only** — latest screenshot in isolation
- **Search/filter** — find stories by name
- **Dark mode** — toggleable, respects system preference
- **Auto-expand** — changed stories are expanded by default so you see diffs immediately

### CI workflow overview

1. Developer opens a PR with UI changes
2. CI captures screenshots on a macOS runner
3. Argus compares against baselines committed in the repo
4. Portable HTML report is uploaded as a build artifact
5. (Optional) A PR comment summarizes pass/fail counts — see the [full GHA template](./ci-templates/github-actions.yml)
6. Reviewer downloads the report, reviews diffs in the browser
7. If changes are intentional: `yarn visual:baseline && git add .visual-baselines && git commit`

## Web Dashboard (Optional)

For teams that want a persistent review interface with GitHub OAuth authentication, user history, and approval workflows, see [`@argus-vrt/web`](https://www.npmjs.com/package/@argus-vrt/web). The dashboard is fully optional — you can use Argus purely with CLI + CI artifacts.

To use the dashboard, add `apiUrl` and `apiKey` to your `.argus.json`:

```json
{
  "apiUrl": "https://argus.yourcompany.com",
  "apiKey": "your-api-key-from-init"
}
```

## How It Works

1. **Capture** — Boots iOS simulator, launches your app with Storybook, navigates to each story via deep links, and captures screenshots
2. **Compare** — Compares current screenshots against baselines using Pixelmatch, generates diff images with pixel-level precision
3. **Report** — Generates a self-contained HTML report with side-by-side diffs, overlay view, search, and dark mode
4. **Upload** — Optionally sends results to the web dashboard for persistent review and approval workflows

## License

MIT
