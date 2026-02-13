import * as p from "@clack/prompts";
import chalk from "chalk";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateDockerCompose, type ComposeOptions } from "../templates/docker-compose.js";
import { generateEnv, type EnvOptions } from "../templates/env.js";
import { generateNginxConf } from "../templates/nginx.js";
import { DEFAULT_DIR, DEFAULT_PORT, DEFAULT_DB_PASSWORD, DEFAULT_SCREENSHOTS_PATH } from "../utils/config.js";
import { isDockerInstalled } from "../utils/docker.js";

export async function initCommand(options: { dir?: string }) {
  p.intro(chalk.bold("Argus Web Dashboard Setup"));

  const outputDir = resolve(options.dir || DEFAULT_DIR);

  if (existsSync(resolve(outputDir, "docker-compose.yml"))) {
    const overwrite = await p.confirm({
      message: `Configuration already exists in ${outputDir}. Overwrite?`,
      initialValue: false,
    });

    if (p.isCancel(overwrite) || !overwrite) {
      p.cancel("Setup cancelled.");
      process.exit(0);
    }
  }

  const hasDocker = await isDockerInstalled();
  if (!hasDocker) {
    p.log.warn(
      "Docker is not installed. You can still generate config files, but you'll need Docker to run Argus."
    );
  }

  const answers = await p.group(
    {
      deployMethod: () =>
        p.select({
          message: "Deployment method",
          options: [
            { value: "compose", label: "Docker Compose", hint: "recommended" },
            { value: "manual", label: "Config files only", hint: "generate files without starting" },
          ],
        }),

      includeDb: () =>
        p.select({
          message: "PostgreSQL setup",
          options: [
            { value: true, label: "Include PostgreSQL container", hint: "recommended" },
            { value: false, label: "External PostgreSQL", hint: "enter connection string" },
          ],
        }),

      dbConnectionString: ({ results }) => {
        if (results.includeDb) return Promise.resolve(undefined);
        return p.text({
          message: "PostgreSQL connection string",
          placeholder: "postgresql://user:password@host:5432/argus",
          validate: (value) => {
            if (!value) return "Connection string is required";
            if (!value.startsWith("postgresql://") && !value.startsWith("postgres://")) {
              return "Must start with postgresql:// or postgres://";
            }
          },
        });
      },

      dbPassword: ({ results }) => {
        if (!results.includeDb) return Promise.resolve(DEFAULT_DB_PASSWORD);
        return p.text({
          message: "Database password",
          defaultValue: DEFAULT_DB_PASSWORD,
          placeholder: DEFAULT_DB_PASSWORD,
        });
      },

      port: () =>
        p.text({
          message: "Port",
          defaultValue: String(DEFAULT_PORT),
          placeholder: String(DEFAULT_PORT),
          validate: (value) => {
            const num = parseInt(value, 10);
            if (isNaN(num) || num < 1 || num > 65535) return "Must be a valid port (1-65535)";
          },
        }),

      domain: () =>
        p.text({
          message: "Domain (leave empty for localhost)",
          placeholder: "argus.yourcompany.com",
        }),

      https: ({ results }) => {
        if (!results.domain) return Promise.resolve("none" as const);
        return p.select({
          message: "HTTPS configuration",
          options: [
            { value: "letsencrypt" as const, label: "Let's Encrypt", hint: "automatic certificates" },
            { value: "custom" as const, label: "Custom certificate", hint: "provide your own certs" },
            { value: "none" as const, label: "No HTTPS", hint: "HTTP only" },
          ],
        });
      },

      includeNginx: ({ results }) => {
        if (!results.domain) return Promise.resolve(false);
        return p.select({
          message: "Reverse proxy",
          options: [
            { value: true, label: "Include Nginx container", hint: "recommended with domain" },
            { value: false, label: "No reverse proxy", hint: "you manage this yourself" },
          ],
        });
      },

      screenshotsPath: () =>
        p.text({
          message: "Screenshots storage path",
          defaultValue: DEFAULT_SCREENSHOTS_PATH,
          placeholder: DEFAULT_SCREENSHOTS_PATH,
        }),
    },
    {
      onCancel: () => {
        p.cancel("Setup cancelled.");
        process.exit(0);
      },
    }
  );

  const s = p.spinner();
  s.start("Generating configuration files");

  // Create output directory
  mkdirSync(outputDir, { recursive: true });

  const port = parseInt(answers.port as string, 10) || DEFAULT_PORT;

  // Generate docker-compose.yml
  const composeOptions: ComposeOptions = {
    port,
    includeDb: answers.includeDb as boolean,
    dbConnectionString: answers.dbConnectionString as string | undefined,
    dbPassword: (answers.dbPassword as string) || DEFAULT_DB_PASSWORD,
    includeNginx: answers.includeNginx as boolean,
    domain: answers.domain as string | undefined,
    https: answers.https as "letsencrypt" | "custom" | "none",
    screenshotsPath: (answers.screenshotsPath as string) || DEFAULT_SCREENSHOTS_PATH,
  };

  writeFileSync(
    resolve(outputDir, "docker-compose.yml"),
    generateDockerCompose(composeOptions)
  );

  // Generate .env
  const envOptions: EnvOptions = {
    port,
    includeDb: answers.includeDb as boolean,
    dbConnectionString: answers.dbConnectionString as string | undefined,
    dbPassword: (answers.dbPassword as string) || DEFAULT_DB_PASSWORD,
    screenshotsPath: (answers.screenshotsPath as string) || DEFAULT_SCREENSHOTS_PATH,
  };

  writeFileSync(resolve(outputDir, ".env"), generateEnv(envOptions));

  // Generate nginx.conf if needed
  if (answers.includeNginx && answers.domain) {
    writeFileSync(
      resolve(outputDir, "nginx.conf"),
      generateNginxConf({
        domain: answers.domain as string,
        https: answers.https as "letsencrypt" | "custom" | "none",
      })
    );
  }

  s.stop("Configuration files generated");

  // Summary
  p.note(
    [
      `${chalk.dim("Directory:")}  ${outputDir}`,
      `${chalk.dim("Files:")}      docker-compose.yml, .env${answers.includeNginx ? ", nginx.conf" : ""}`,
      "",
      `${chalk.dim("Next steps:")}`,
      `  cd ${options.dir || DEFAULT_DIR}`,
      "  argus-web start",
    ].join("\n"),
    "Setup complete"
  );

  if (answers.https === "letsencrypt" && answers.domain) {
    p.log.info(
      `Run this to obtain your initial SSL certificate:\n  docker compose run --rm certbot certonly --webroot -w /var/www/certbot -d ${answers.domain}`
    );
  }

  p.outro(chalk.green("Happy testing!"));
}
