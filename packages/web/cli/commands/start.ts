import chalk from "chalk";
import { findArgusDir } from "../utils/config.js";
import { ensureDocker, dockerCompose } from "../utils/docker.js";

export async function startCommand(options: { dir?: string }) {
  const cwd = findArgusDir(options.dir);

  await ensureDocker();

  console.log(chalk.blue("Starting Argus..."));
  await dockerCompose(["up", "-d"], cwd);
  console.log(chalk.green("Argus is running."));
}
