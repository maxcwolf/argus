import chalk from "chalk";
import { findArgusDir } from "../utils/config.js";
import { ensureDocker, dockerCompose } from "../utils/docker.js";

export async function stopCommand(options: { dir?: string }) {
  const cwd = findArgusDir(options.dir);

  await ensureDocker();

  console.log(chalk.blue("Stopping Argus..."));
  await dockerCompose(["down"], cwd);
  console.log(chalk.green("Argus stopped."));
}
