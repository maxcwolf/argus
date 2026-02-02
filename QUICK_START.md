# Quick Start Guide

Get up and running with RN Visual Testing in 5 minutes.

## Prerequisites

- macOS with Xcode
- React Native app with Storybook configured
- Node.js 20+

## Installation

```bash
cd ~/workspace/your-rn-app
yarn add -D @rn-visual-testing/cli
```

## Setup

### 1. Initialize

```bash
yarn rn-visual-test init
```

This creates `.rn-visual-testing.json` in your project root.

### 2. Configure

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

**Key settings to update:**
- `appScheme`: Your app's scheme (from `app.json` or Info.plist)
- `device`: Run `xcrun simctl list devices` to see available devices
- `storiesPattern`: Match your Storybook stories location

### 3. Add NPM Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "visual:capture": "rn-visual-test capture",
    "visual:compare": "rn-visual-test compare",
    "visual:baseline": "cp -r .visual-screenshots/$(git branch --show-current)/* .visual-baselines/ios/iPhone15Pro/",
    "visual:report": "open .visual-screenshots/$(git branch --show-current)/report.html"
  }
}
```

### 4. Update .gitignore

Add to `.gitignore`:

```
.visual-screenshots/
```

**Don't ignore** `.visual-baselines/` - these should be committed!

## First Run

### Step 1: Build Your App

```bash
yarn ios
```

Ensure your app builds and Storybook shows up.

### Step 2: Capture Screenshots

```bash
yarn visual:capture
```

This will:
1. Boot iOS simulator
2. Launch your app
3. Connect to Storybook
4. Navigate through each story
5. Capture screenshots
6. Save to `.visual-screenshots/<branch>/`

### Step 3: Create Baselines

First run needs baselines:

```bash
yarn visual:baseline
git add .visual-baselines
git commit -m "chore: add visual baselines"
```

## Daily Workflow

### Making UI Changes

```bash
# 1. Create feature branch
git checkout -b feature/new-button-style

# 2. Make your UI changes
# ... edit components ...

# 3. Capture new screenshots
yarn visual:capture

# 4. Compare against baselines
yarn visual:compare

# 5. View report
yarn visual:report
```

### Understanding Results

The compare command will output:
```
✓ Comparison complete: 50 stories
  Passed: 45
  Changed: 5
  Failed: 0
```

- **Passed**: No visual changes detected
- **Changed**: Visual differences found (review needed)
- **Failed**: Comparison errors (missing baselines, etc.)

### Reviewing Changes

The HTML report shows:
- Side-by-side baseline vs current
- Diff highlighting
- Percentage of pixels changed
- SSIM similarity score

### Approving Changes

If changes look good:

```bash
# Update baselines with new screenshots
yarn visual:baseline

# Commit updated baselines
git add .visual-baselines
git commit -m "chore: update visual baselines for button style"
```

## Common Commands

```bash
# Initialize project
rn-visual-test init

# Capture screenshots
rn-visual-test capture

# Compare with main branch
rn-visual-test compare --base main

# Capture without shutting down simulator
rn-visual-test capture --skip-shutdown

# Compare with custom threshold (2% difference allowed)
rn-visual-test compare --threshold 0.02

# Skip HTML report generation
rn-visual-test compare --no-report
```

## Tips

### Faster Comparisons

Install ODiff for 5-10x faster comparisons:

```bash
brew install odiff
```

### Debug Mode

Enable verbose logging:

```bash
DEBUG=* yarn visual:capture
```

### Simulator Issues

If simulator doesn't boot:

```bash
# List available devices
xcrun simctl list devices

# Manually boot
xcrun simctl boot "iPhone 15 Pro"

# Run capture without booting
yarn rn-visual-test capture --skip-boot
```

### Story Timeouts

If stories take long to render:

```json
{
  "storybook": {
    "renderTimeout": 10000
  }
}
```

## CI/CD Integration

### GitHub Actions Example

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
        run: yarn ios:build

      - name: Run visual tests
        run: |
          yarn visual:capture
          yarn visual:compare

      - name: Upload results on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: visual-test-results
          path: .visual-screenshots/
```

## Troubleshooting

### "Simulator not found"
- Check device name matches exactly: `xcrun simctl list devices`
- Update config with exact name

### "App won't launch"
- Verify `appScheme` or `bundleId` in config
- Ensure app is built: `yarn ios`

### "Storybook connection timeout"
- Verify Storybook is enabled in app
- Check port matches config: `lsof -i :7007`

### "No stories found"
- Check `storiesPattern` in config
- Ensure Storybook is configured correctly

For more help, see [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

## Next Steps

1. ✅ Capture your first screenshots
2. ✅ Create baselines
3. ✅ Make a UI change and compare
4. ✅ Review the HTML report
5. ✅ Approve and update baselines
6. ✅ Add to CI/CD pipeline

## Resources

- [Full Documentation](README.md)
- [Troubleshooting Guide](TROUBLESHOOTING.md)
- [Contributing Guide](CONTRIBUTING.md)
- [Example Config](.rn-visual-testing.example.json)

Happy testing! 🎨📸
