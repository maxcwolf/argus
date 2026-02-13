import chalk from "chalk";
import { findArgusDir } from "../utils/config.js";
import { ensureDocker, dockerCompose } from "../utils/docker.js";

export async function upgradeCommand(options: { dir?: string }) {
  const cwd = findArgusDir(options.dir);

  await ensureDocker();

  console.log(chalk.blue("Pulling latest images..."));
  await dockerCompose(["pull"], cwd);

  console.log(chalk.blue("Restarting with new images..."));
  await dockerCompose(["up", "-d"], cwd);

  console.log(chalk.green("Argus upgraded successfully."));
}
