# @argus-vrt/web

**Web dashboard for reviewing visual regression test results.**

A self-hosted dashboard that pairs with [@argus-vrt/cli](https://www.npmjs.com/package/@argus-vrt/cli) to give your team a visual review interface for screenshot diffs — similar to Chromatic, but self-hosted.

## Features

- **Test Overview** - Dashboard showing all test runs with status badges
- **Image Comparison** - Four view modes:
  - Side by Side - Compare baseline and current screenshots
  - Diff Only - View the difference image
  - Overlay - See diff highlights overlaid on current screenshot with adjustable opacity
  - Current Only - View just the current screenshot
- **Story Browser** - Three organization modes:
  - Flat list - Simple alphabetical list
  - Tree view - Grouped by component name
  - Grouped view - Organized by directory structure
- **Search** - Typeahead search with Cmd/Ctrl+K keyboard shortcut
- **Filtering** - Filter stories by status (all, changed, new, passed)
- **Mobile Responsive** - Drawer-based navigation on mobile devices
- **Dark Mode** - Full dark mode support

## Deployment

### Quick Start with Docker

```bash
# Clone the repo
git clone https://github.com/maxcwolf/argus.git
cd argus/packages/web

# Start the dashboard and database
docker compose -f docker-compose.prod.yml up -d

# Run database migrations (first time only)
docker compose -f docker-compose.prod.yml exec web npx drizzle-kit push
```

The dashboard will be available at `http://localhost:3000`.

### Configuration

Create a `.env` file to customize settings:

```bash
PORT=3000
DB_PASSWORD=your-secure-password

# Path to screenshots directory (for image serving)
SCREENSHOTS_PATH=/path/to/your/screenshots
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `DATABASE_URL` | (auto) | PostgreSQL connection string |
| `DB_PASSWORD` | `argus` | Database password |
| `SCREENSHOTS_PATH` | `./screenshots` | Path to mount for image serving |

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full production deployment instructions including Nginx reverse proxy with HTTPS, image serving options, and database backup/restore.

## Connecting the CLI

Once the dashboard is running, point your CLI at it by adding `apiUrl` to your project's `.argus.json`:

```json
{
  "apiUrl": "http://localhost:3000"
}
```

Then upload results after running tests:

```bash
npx argus test
```

## Tech Stack

- **Framework**: [TanStack Start](https://tanstack.com/start) with React 19
- **Routing**: [TanStack Router](https://tanstack.com/router) (file-based)
- **Database**: PostgreSQL with [Drizzle ORM](https://orm.drizzle.team/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) with design tokens
- **Fonts**: Inter (body), Space Grotesk (headings), JetBrains Mono (code)

---

## Development

### Prerequisites

- Node.js >= 20
- Yarn >= 4
- Docker (for PostgreSQL)

### Setup

From the repository root:

```bash
# Install all dependencies
yarn install

# Start PostgreSQL (from this directory)
cd packages/web
docker compose up -d

# Push database schema
yarn workspace @argus-vrt/web db:push

# Start dev server at http://localhost:3000
yarn workspace @argus-vrt/web dev
```

Or if you're already in `packages/web`:

```bash
docker compose up -d
yarn db:push
yarn dev
```

### Scripts

| Script | Description |
|--------|-------------|
| `yarn dev` | Start development server on port 3000 |
| `yarn build` | Build for production |
| `yarn preview` | Preview production build |
| `yarn test` | Run tests with Vitest |
| `yarn db:generate` | Generate Drizzle migrations |
| `yarn db:push` | Push schema changes to database |
| `yarn db:studio` | Open Drizzle Studio |

### Project Structure

```
src/
├── components/
│   ├── image/           # Image comparison components
│   ├── story/           # Story list/tree components
│   └── ui/              # Shared UI components
├── hooks/               # React hooks
├── lib/                 # Utilities
├── routes/              # File-based routes
│   ├── __root.tsx       # Root layout
│   ├── index.tsx        # Dashboard home
│   ├── tests/           # Test detail pages
│   └── branches/        # Branch pages
├── db/                  # Database schema
└── styles.css           # Global styles & design tokens
```

## License

MIT
