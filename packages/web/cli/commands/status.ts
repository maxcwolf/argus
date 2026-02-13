import chalk from "chalk";
import { findArgusDir } from "../utils/config.js";
import { ensureDocker, dockerCompose } from "../utils/docker.js";

export async function statusCommand(options: { dir?: string }) {
  const cwd = findArgusDir(options.dir);

  await ensureDocker();

  console.log(chalk.blue("Argus status:\n"));
  await dockerCompose(["ps"], cwd);

  // Try a health check on the web container
  try {
    const result = await dockerCompose(
      ["exec", "web", "wget", "--spider", "--quiet", "http://localhost:3000"],
      cwd,
      { stdio: "pipe" }
    );
    if (result.exitCode === 0) {
      console.log(chalk.green("\nWeb dashboard is healthy."));
    }
  } catch {
    console.log(chalk.yellow("\nWeb dashboard health check failed — container may still be starting."));
  }
}
