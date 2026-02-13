export interface NginxOptions {
  domain: string;
  https: "letsencrypt" | "custom" | "none";
}

export function generateNginxConf(options: NginxOptions): string {
  const lines: string[] = [];

  if (options.https !== "none") {
    // HTTP → HTTPS redirect
    lines.push("server {");
    lines.push("    listen 80;");
    lines.push(`    server_name ${options.domain};`);
    lines.push("");

    if (options.https === "letsencrypt") {
      lines.push("    location /.well-known/acme-challenge/ {");
      lines.push("        root /var/www/certbot;");
      lines.push("    }");
      lines.push("");
    }

    lines.push("    location / {");
    lines.push("        return 301 https://$server_name$request_uri;");
    lines.push("    }");
    lines.push("}");
    lines.push("");

    // HTTPS server
    lines.push("server {");
    lines.push("    listen 443 ssl http2;");
    lines.push(`    server_name ${options.domain};`);
    lines.push("");

    if (options.https === "letsencrypt") {
      lines.push(`    ssl_certificate /etc/letsencrypt/live/${options.domain}/fullchain.pem;`);
      lines.push(`    ssl_certificate_key /etc/letsencrypt/live/${options.domain}/privkey.pem;`);
    } else {
      lines.push("    ssl_certificate /etc/nginx/certs/fullchain.pem;");
      lines.push("    ssl_certificate_key /etc/nginx/certs/privkey.pem;");
    }

    lines.push("");
    lines.push("    # SSL settings");
    lines.push("    ssl_protocols TLSv1.2 TLSv1.3;");
    lines.push("    ssl_prefer_server_ciphers off;");
    lines.push("");
  } else {
    // HTTP only
    lines.push("server {");
    lines.push("    listen 80;");
    lines.push(`    server_name ${options.domain};`);
    lines.push("");
  }

  // Common proxy config
  lines.push("    client_max_body_size 50M;");
  lines.push("");
  lines.push("    location / {");
  lines.push("        proxy_pass http://web:3000;");
  lines.push("        proxy_http_version 1.1;");
  lines.push("        proxy_set_header Upgrade $http_upgrade;");
  lines.push("        proxy_set_header Connection 'upgrade';");
  lines.push("        proxy_set_header Host $host;");
  lines.push("        proxy_set_header X-Real-IP $remote_addr;");
  lines.push("        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;");
  lines.push("        proxy_set_header X-Forwarded-Proto $scheme;");
  lines.push("        proxy_cache_bypass $http_upgrade;");
  lines.push("    }");
  lines.push("}");

  return lines.join("\n") + "\n";
}
