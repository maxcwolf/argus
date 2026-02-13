import { DOCKER_IMAGE } from "../utils/config.js";

export interface ComposeOptions {
  port: number;
  includeDb: boolean;
  dbConnectionString?: string;
  dbPassword: string;
  includeNginx: boolean;
  domain?: string;
  https: "letsencrypt" | "custom" | "none";
  screenshotsPath: string;
}

export function generateDockerCompose(options: ComposeOptions): string {
  const lines: string[] = [];

  lines.push("services:");

  // Web service
  lines.push("  web:");
  lines.push(`    image: ${DOCKER_IMAGE}:latest`);
  lines.push("    container_name: argus-web");

  if (!options.includeNginx) {
    lines.push("    ports:");
    lines.push(`      - "\${PORT:-${options.port}}:3000"`);
  } else {
    lines.push("    expose:");
    lines.push("      - \"3000\"");
  }

  lines.push("    environment:");
  if (options.includeDb) {
    lines.push(
      "      - DATABASE_URL=postgresql://argus:${DB_PASSWORD:-argus}@db:5432/argus"
    );
  } else {
    lines.push("      - DATABASE_URL=${DATABASE_URL}");
  }
  lines.push("      - NODE_ENV=production");

  if (options.includeDb) {
    lines.push("    depends_on:");
    lines.push("      db:");
    lines.push("        condition: service_healthy");
  }

  lines.push("    volumes:");
  lines.push(
    `      - \${SCREENSHOTS_PATH:-${options.screenshotsPath}}:/screenshots:ro`
  );
  lines.push("    restart: unless-stopped");

  // Database service
  if (options.includeDb) {
    lines.push("");
    lines.push("  db:");
    lines.push("    image: postgres:16-alpine");
    lines.push("    container_name: argus-db");
    lines.push("    environment:");
    lines.push("      POSTGRES_USER: argus");
    lines.push("      POSTGRES_PASSWORD: ${DB_PASSWORD:-argus}");
    lines.push("      POSTGRES_DB: argus");
    lines.push("    volumes:");
    lines.push("      - postgres_data:/var/lib/postgresql/data");
    lines.push("    healthcheck:");
    lines.push('      test: ["CMD-SHELL", "pg_isready -U argus"]');
    lines.push("      interval: 5s");
    lines.push("      timeout: 5s");
    lines.push("      retries: 5");
    lines.push("    restart: unless-stopped");
  }

  // Nginx service
  if (options.includeNginx) {
    lines.push("");
    lines.push("  nginx:");
    lines.push("    image: nginx:alpine");
    lines.push("    container_name: argus-nginx");
    lines.push("    ports:");
    lines.push(`      - "\${PORT:-${options.port}}:80"`);

    if (options.https !== "none") {
      lines.push('      - "443:443"');
    }

    lines.push("    volumes:");
    lines.push("      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro");

    if (options.https === "letsencrypt") {
      lines.push("      - certbot_data:/etc/letsencrypt:ro");
      lines.push("      - certbot_www:/var/www/certbot:ro");
    } else if (options.https === "custom") {
      lines.push("      - ./certs:/etc/nginx/certs:ro");
    }

    lines.push("    depends_on:");
    lines.push("      - web");
    lines.push("    restart: unless-stopped");

    if (options.https === "letsencrypt") {
      lines.push("");
      lines.push("  certbot:");
      lines.push("    image: certbot/certbot");
      lines.push("    container_name: argus-certbot");
      lines.push("    volumes:");
      lines.push("      - certbot_data:/etc/letsencrypt");
      lines.push("      - certbot_www:/var/www/certbot");
      lines.push(
        "    entrypoint: /bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done'"
      );
    }
  }

  // Volumes
  const volumes: string[] = [];
  if (options.includeDb) volumes.push("  postgres_data:");
  if (options.https === "letsencrypt") {
    volumes.push("  certbot_data:");
    volumes.push("  certbot_www:");
  }

  if (volumes.length > 0) {
    lines.push("");
    lines.push("volumes:");
    lines.push(...volumes);
  }

  return lines.join("\n") + "\n";
}
