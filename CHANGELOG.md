# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-02-02

### Added

- Initial implementation of visual regression testing tool
- CLI tool for screenshot capture and comparison
- iOS simulator support using `xcrun simctl`
- Storybook WebSocket integration for story enumeration
- Image comparison using Pixelmatch
- SSIM (Structural Similarity Index) scoring
- ODiff support for faster comparisons (optional)
- HTML report generation for comparison results
- Git integration for branch and commit information
- Performance metrics collection (render time)
- Configurable threshold-based comparison
- `capture` command for taking screenshots
- `compare` command for comparing against baselines
- `init` command for project initialization
- Shared types package for type safety across packages
- Monorepo structure with Turborepo
- Comprehensive documentation and examples

### Coming Soon

- Web dashboard (TanStack Start)
- Approval workflow for accepting changes
- Automatic baseline updates via web app
- Android emulator support
- CI/CD webhook integration
- GitHub PR status checks and comments
- S3 integration for image storage
- Database schema with Drizzle ORM
- Authentication with Better Auth
- Multi-device testing support
