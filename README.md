# React Native Visual Testing

A Chromatic-like visual regression testing tool for React Native Storybook on iOS simulators.

## Features

- 📸 Automated screenshot capture from iOS Simulators
- 🔍 Fast image comparison using ODiff or Pixelmatch
- 📊 SSIM-based similarity scoring
- 🌐 Web dashboard for reviewing changes (coming soon)
- 🔄 Git-based baseline management
- ⚡ CI/CD integration ready

## Prerequisites

- macOS with Xcode installed
- Node.js >= 20
- Yarn >= 4 or npm
- React Native app with Storybook configured
- iOS Simulator

## Installation

```bash
# Install globally
yarn global add @rn-visual-testing/cli

# Or install in your project
yarn add -D @rn-visual-testing/cli
```

## Quick Start

### 1. Initialize in your React Native project

```bash
cd ~/workspace/your-rn-app
rn-visual-test init
```

This creates a `.rn-visual-testing.json` configuration file.

### 2. Configure your app

Edit `.rn-visual-testing.json`:

```json
{
  "storybook": {
    "port": 7007,
    "storiesPattern": "src/**/__stories__/**/*.stories.?(ts|tsx|js|jsx)"
  },
  "simulator": {
    "device": "iPhone 15 Pro",
    "os": "iOS 17.0",
    "appScheme": "your-app-scheme"
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

### 3. Capture screenshots

```bash
# Build your app first (ensure Storybook is enabled)
yarn ios

# Capture screenshots
rn-visual-test capture
```

Screenshots are saved to `.visual-screenshots/<branch>/`

### 4. Create baselines

On your first run, copy screenshots to baselines:

```bash
mkdir -p .visual-baselines/ios/iPhone15Pro
cp .visual-screenshots/$(git branch --show-current)/* .visual-baselines/ios/iPhone15Pro/
git add .visual-baselines
git commit -m "chore: add visual baselines"
```

### 5. Make changes and compare

```bash
# Make UI changes to your components

# Capture new screenshots
rn-visual-test capture

# Compare against baselines
rn-visual-test compare

# View HTML report
open .visual-screenshots/$(git branch --show-current)/report.html
```

## CLI Commands

### `capture`

Capture screenshots of all Storybook stories.

```bash
rn-visual-test capture [options]

Options:
  -b, --branch <branch>    Override current git branch
  -d, --device <device>    Override simulator device
  --skip-boot              Skip booting the simulator
  --skip-shutdown          Skip shutting down the simulator
```

### `compare`

Compare screenshots against baselines.

```bash
rn-visual-test compare [options]

Options:
  --base <branch>          Base branch for comparison (default: main)
  --current <branch>       Current branch (default: current git branch)
  -t, --threshold <value>  Difference threshold 0-1 (default: 0.01)
  --no-report              Skip HTML report generation
```

### `init`

Initialize visual testing in your project.

```bash
rn-visual-test init
```

## NPM Scripts

Add these to your `package.json`:

```json
{
  "scripts": {
    "visual:capture": "rn-visual-test capture",
    "visual:compare": "rn-visual-test compare",
    "visual:baseline": "cp -r .visual-screenshots/$(git branch --show-current)/* .visual-baselines/ios/iPhone15Pro/"
  }
}
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Visual Tests
on: [pull_request]

jobs:
  visual-test:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: yarn install

      - name: Build app
        run: |
          cd ios
          pod install
          xcodebuild -workspace App.xcworkspace \
            -scheme App \
            -configuration Debug \
            -sdk iphonesimulator \
            -derivedDataPath build

      - name: Run visual tests
        run: |
          yarn visual:capture
          yarn visual:compare

      - name: Upload screenshots
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: visual-test-results
          path: .visual-screenshots/
```

## Configuration

### Storybook Setup

Your React Native app needs Storybook configured with WebSocket support. Example:

```typescript
// .storybook/index.tsx
import { getStorybookUI } from '@storybook/react-native'

const StorybookUI = getStorybookUI({
  port: 7007,
  host: 'localhost',
})

export default StorybookUI
```

### App Integration

The CLI launches your app and expects it to show Storybook UI. Configure your app entry point:

```typescript
// index.js
import { AppRegistry } from 'react-native'
import App from './App'
import StorybookUI from './.storybook'

const RootComponent = __DEV__ && process.env.STORYBOOK_ENABLED
  ? StorybookUI
  : App

AppRegistry.registerComponent('YourApp', () => RootComponent)
```

## Performance

For faster comparisons, install ODiff:

```bash
# macOS
brew install odiff

# Or build from source
npm install -g odiff-bin
```

Without ODiff, the tool uses Pixelmatch (slower but still accurate).

## Troubleshooting

### Simulator not found

Ensure the device name in config matches exactly:

```bash
xcrun simctl list devices
```

### App doesn't launch

1. Verify `appScheme` or `bundleId` in config
2. Check app is installed: `xcrun simctl listapps booted`
3. Build app first: `yarn ios`

### Storybook connection fails

1. Verify `port` in config matches Storybook server
2. Ensure Storybook is running in app
3. Check WebSocket support is enabled

## Project Structure

```
rn-visual-testing/
├── packages/
│   ├── cli/           # CLI tool
│   ├── web/           # Web dashboard (coming soon)
│   └── shared/        # Shared types
└── README.md
```

## Development

```bash
# Install dependencies
yarn install

# Build all packages
yarn build

# Develop CLI
cd packages/cli
yarn dev

# Link for local testing
yarn link
```

## Roadmap

- [x] iOS screenshot capture
- [x] Image comparison (ODiff, Pixelmatch, SSIM)
- [x] HTML reports
- [ ] Web dashboard (TanStack Start)
- [ ] Approval workflow
- [ ] Git baseline updates
- [ ] Android emulator support
- [ ] CI/CD webhooks
- [ ] GitHub PR integration

## License

MIT
