# Deploying Argus Web Dashboard

## Docker Deployment (Recommended)

### Quick Start

```bash
cd packages/web

# Start the dashboard and database
docker compose -f docker-compose.prod.yml up -d

# Run database migrations (first time only)
docker compose -f docker-compose.prod.yml exec web \
  npx drizzle-kit push

# Check logs
docker compose -f docker-compose.prod.yml logs -f
```

The dashboard will be available at `http://localhost:3000`

### Configuration

Create a `.env` file to customize settings:

```bash
# .env
PORT=3000
DB_PASSWORD=your-secure-password

# Path to screenshots directory (for image serving)
SCREENSHOTS_PATH=/path/to/your/screenshots
```

### Image Serving

The dashboard needs access to the screenshot files to display them. You have two options:

#### Option A: Mount Screenshots Directory

If the dashboard runs on the same machine as your screenshots:

```yaml
# In docker-compose.prod.yml
volumes:
  - /Users/yourname/projects:/screenshots:ro
```

Then images at `/Users/yourname/projects/app/.visual-screenshots/...` will be served.

#### Option B: Shared Network Storage

For team setups, mount a shared NFS/SMB volume:

```yaml
volumes:
  - type: nfs
    source: your-nfs-server:/screenshots
    target: /screenshots
```

### Production with Reverse Proxy (Nginx)

For HTTPS and domain setup:

```nginx
# /etc/nginx/sites-available/argus
server {
    listen 80;
    server_name argus.yourcompany.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name argus.yourcompany.com;

    ssl_certificate /etc/letsencrypt/live/argus.yourcompany.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/argus.yourcompany.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Useful Commands

```bash
# Start services
docker compose -f docker-compose.prod.yml up -d

# Stop services
docker compose -f docker-compose.prod.yml down

# View logs
docker compose -f docker-compose.prod.yml logs -f web

# Rebuild after code changes
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d

# Reset database (caution: deletes all data)
docker compose -f docker-compose.prod.yml down -v
docker compose -f docker-compose.prod.yml up -d
```

### Backup Database

```bash
# Backup
docker compose -f docker-compose.prod.yml exec db \
  pg_dump -U argus argus > backup.sql

# Restore
docker compose -f docker-compose.prod.yml exec -T db \
  psql -U argus argus < backup.sql
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Port for the web server |
| `DATABASE_URL` | (auto) | PostgreSQL connection string |
| `DB_PASSWORD` | `argus` | Database password |
| `SCREENSHOTS_PATH` | `./screenshots` | Path to mount for image serving |
| `NODE_ENV` | `production` | Node environment |

---

## Updating

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# Run any new migrations
docker compose -f docker-compose.prod.yml exec web \
  npx drizzle-kit push
```
