<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/banner-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="assets/banner-light.svg">
    <img alt="Argus" src="assets/banner-light.svg" width="640">
  </picture>
  <br><br>
  Capture screenshots from iOS Simulators for all your Storybook stories,<br>compare them against baselines, and review changes — in CI or a self-hosted dashboard.
</p>

## Features

- **Automated Screenshot Capture** - Captures screenshots from iOS Simulators for all Storybook stories
- **Fast Image Comparison** - Uses Pixelmatch with configurable thresholds and SSIM scoring
- **Portable HTML Reports** - Self-contained HTML report with side-by-side, overlay, diff, and search — works as a CI artifact with no server required
- **Web Dashboard** (optional) - Self-hosted review interface with GitHub OAuth, persistent history, and approval workflows
- **Git Integration** - Branch-based screenshot management with baselines committed to your repo
- **CI/CD Ready** - Works out of the box with GitHub Actions and CircleCI (macOS runners)

## Prerequisites

- macOS with Xcode installed
- Node.js >= 20
- React Native app with Storybook configured
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

Auto-detects your Storybook configuration, finds available iOS simulators, and creates `.argus.json`.

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

# Commit your baselines
git add .visual-baselines
git commit -m "chore: add visual baselines"
```

### 4. Set up `.gitignore`

```gitignore
# Argus — screenshots are ephemeral, baselines are committed
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

## CI Integration

Argus works standalone in CI — no web dashboard or database needed. Use `--portable` to generate a self-contained HTML report with embedded images, then upload it as a build artifact.

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

> **Note:** Both require a **macOS runner** for the iOS Simulator. See complete workflow files in [`packages/cli/ci-templates/`](packages/cli/ci-templates/).

The portable report includes:
- **Side-by-side** baseline vs current comparison
- **Diff overlay** with adjustable opacity slider
- **Diff-only** and **current-only** views
- **Search/filter** across all stories
- **Dark mode** with system preference detection
- Auto-expands changed stories so you see what matters first

### What the CI flow looks like

1. PR is opened with UI changes
2. CI runner captures screenshots on macOS
3. Argus compares against baselines committed in the repo
4. HTML report is uploaded as a build artifact
5. Optionally, a PR comment summarizes the results (see [full GHA template](packages/cli/ci-templates/github-actions.yml))
6. Reviewer downloads the report, reviews diffs, and approves or requests baseline updates

See the **[full CI integration guide](packages/cli/README.md#ci-integration)** in the CLI README for details on what the report includes, the full workflow, and how to update baselines after review.

## CLI Commands

| Command | Description |
|---------|-------------|
| `argus test` | Full cycle: capture → compare → report. Add `--portable` for CI. |
| `argus init` | Interactive setup wizard — creates `.argus.json` |
| `argus baseline --update` | Update baselines from current screenshots |
| `argus compare` | Compare without capturing. Add `--portable` for CI. |
| `argus capture-all` | Capture without comparing |
| `argus upload` | Upload results to the web dashboard (optional) |
| `argus list-stories` | List all detected Storybook stories |

See the **[full command reference](packages/cli/README.md#commands)** with all options and flags in the CLI README.

## Configuration

Configuration is stored in `.argus.json` in your project root. Run `argus init` to generate it.

```json
{
  "storybook": {
    "port": 7007,
    "scheme": "myapp"
  },
  "simulator": {
    "device": "iPhone 16 Pro",
    "os": "18.2",
    "bundleId": "com.myapp"
  },
  "comparison": {
    "threshold": 0.01
  },
  "baselineDir": ".visual-baselines",
  "screenshotDir": ".visual-screenshots"
}
```

See the **[full configuration reference](packages/cli/README.md#configuration)** with all fields in the CLI README.

## Web Dashboard (Optional)

For teams that want a persistent review interface with authentication and history, Argus includes a self-hosted web dashboard ([`@argus-vrt/web`](https://www.npmjs.com/package/@argus-vrt/web)). It's fully optional — you can use Argus purely with CLI + CI artifacts.

The dashboard requires **GitHub OAuth** for authentication. Create a [GitHub OAuth App](https://github.com/settings/developers) before running `init`.

```bash
npx @argus-vrt/web init     # Interactive setup wizard
npx @argus-vrt/web start    # Start containers
npx @argus-vrt/web setup-ssl <domain>  # Let's Encrypt certificate
```

Then point the CLI at it:

```json
{
  "apiUrl": "https://argus.yourcompany.com",
  "apiKey": "your-api-key-from-init"
}
```

See the [@argus-vrt/web README](packages/web/README.md) for full setup and deployment instructions.

## How It Works

1. **Capture** — Boots iOS simulator, launches your app with Storybook, navigates to each story via deep links, and captures screenshots
2. **Compare** — Compares current screenshots against baselines using Pixelmatch, generates diff images with pixel-level precision
3. **Report** — Generates a self-contained HTML report with side-by-side diffs, overlay view, search, and dark mode
4. **Upload** — Optionally sends results to the web dashboard for persistent review and approval workflows

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
│   │   └── ci-templates/  # Example CI workflow files
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
