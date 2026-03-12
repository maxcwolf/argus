import chalk from "chalk";
import { findArgusDir } from "../utils/config.js";
import { ensureDocker, dockerCompose } from "../utils/docker.js";

export async function setupSslCommand(
  domain: string,
  options: { dir?: string }
) {
  const cwd = findArgusDir(options.dir);

  await ensureDocker();

  console.log(chalk.blue(`Obtaining SSL certificate for ${domain}...`));
  await dockerCompose(
    [
      "run",
      "--rm",
      "certbot",
      "certonly",
      "--webroot",
      "-w",
      "/var/www/certbot",
      "-d",
      domain,
    ],
    cwd
  );

  console.log(chalk.blue("Restarting nginx..."));
  await dockerCompose(["restart", "nginx"], cwd);

  console.log(chalk.green("SSL certificate installed successfully."));
}
