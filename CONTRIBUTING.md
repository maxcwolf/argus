# Contributing to RN Visual Testing

Thank you for your interest in contributing! This document provides guidelines and instructions for development.

## Development Setup

### Prerequisites

- macOS with Xcode
- Node.js >= 20
- Yarn >= 4
- Git

### Getting Started

1. Clone the repository:
```bash
git clone https://github.com/yourusername/rn-visual-testing.git
cd rn-visual-testing
```

2. Install dependencies:
```bash
yarn install
```

3. Build all packages:
```bash
yarn build
```

4. Run CLI in development:
```bash
yarn cli --help
```

## Project Structure

```
rn-visual-testing/
├── packages/
│   ├── cli/          # CLI tool for screenshot capture and comparison
│   ├── web/          # Web dashboard (coming soon)
│   └── shared/       # Shared types and utilities
├── .yarnrc.yml       # Yarn configuration
├── turbo.json        # Turborepo configuration
└── package.json      # Root package.json with workspaces
```

## Making Changes

### Development Workflow

1. Create a new branch:
```bash
git checkout -b feature/your-feature-name
```

2. Make your changes in the appropriate package

3. Build and test:
```bash
yarn build
yarn cli init  # Test CLI commands
```

4. Commit your changes:
```bash
git add .
git commit -m "feat: add your feature"
```

### Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `chore:` - Maintenance tasks

Examples:
- `feat: add Android emulator support`
- `fix: resolve screenshot timeout issue`
- `docs: update installation instructions`

## Package Development

### CLI Package (`packages/cli`)

The CLI package handles:
- iOS simulator control
- Storybook integration via WebSocket
- Screenshot capture
- Image comparison
- Report generation

Key files:
- `src/commands/` - CLI commands
- `src/ios/` - iOS simulator integration
- `src/comparison/` - Image comparison algorithms
- `src/utils/` - Utility functions

To develop:
```bash
cd packages/cli
yarn dev  # Watch mode
```

### Shared Package (`packages/shared`)

Contains shared TypeScript types and constants used across packages.

To develop:
```bash
cd packages/shared
yarn dev  # Watch mode
```

### Web Package (`packages/web`) - Coming Soon

Will contain the TanStack Start web dashboard for reviewing visual changes.

## Testing

### Manual Testing

1. Create a test React Native project with Storybook
2. Link the CLI:
```bash
cd packages/cli
yarn link
```

3. In your test project:
```bash
yarn link @rn-visual-testing/cli
rn-visual-test init
rn-visual-test capture
```

### Integration Testing with Hermes App

Test with the Hermes app at `~/workspace/hermes`:

```bash
# Build CLI
cd ~/workspace/rn-visual-testing
yarn build

# Link CLI
cd packages/cli
yarn link

# Use in Hermes
cd ~/workspace/hermes
yarn link @rn-visual-testing/cli
yarn visual:capture
```

## Code Style

- Use TypeScript for all new code
- Follow existing code style
- Add JSDoc comments for public APIs
- Use meaningful variable and function names

## Adding New Features

### Adding a New CLI Command

1. Create command file in `packages/cli/src/commands/`
2. Implement command logic
3. Add command to `packages/cli/src/cli.ts`
4. Update README with command documentation
5. Add tests if applicable

Example:
```typescript
// packages/cli/src/commands/my-command.ts
export async function myCommand(options: MyOptions): Promise<void> {
  // Implementation
}
```

### Adding New Comparison Algorithms

1. Create algorithm file in `packages/cli/src/comparison/`
2. Export comparison function
3. Integrate into compare command
4. Document algorithm and configuration

## Performance Considerations

- Screenshot capture should be < 30s for 50 stories
- Image comparison should be < 10s for 50 pairs
- Prefer ODiff over Pixelmatch for performance
- Use streaming for large file operations

## Documentation

- Update README.md for user-facing changes
- Update CHANGELOG.md with all changes
- Add JSDoc comments for new APIs
- Include examples for new features

## Pull Request Process

1. Update documentation
2. Add entry to CHANGELOG.md
3. Ensure all packages build successfully
4. Test manually with a real React Native project
5. Create PR with clear description
6. Link any related issues

## Release Process

1. Update version in all package.json files
2. Update CHANGELOG.md with release notes
3. Create git tag: `git tag v0.1.0`
4. Push tag: `git push origin v0.1.0`
5. Publish to npm (maintainers only)

## Getting Help

- Open an issue for bugs or feature requests
- Check existing issues before creating new ones
- Provide reproduction steps for bugs
- Include system information (OS, Node version, etc.)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
