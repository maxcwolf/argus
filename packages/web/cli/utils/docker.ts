import chalk from "chalk";
import { execa, type Options as ExecaOptions } from "execa";

export async function isDockerInstalled(): Promise<boolean> {
  try {
    await execa("docker", ["--version"]);
    return true;
  } catch {
    return false;
  }
}

export async function isDockerRunning(): Promise<boolean> {
  try {
    await execa("docker", ["info"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export async function dockerCompose(
  args: string[],
  cwd: string,
  options?: ExecaOptions
) {
  try {
    return await execa("docker", ["compose", ...args], {
      cwd,
      stdio: "inherit",
      ...options,
    });
  } catch (error: unknown) {
    const cmd = `docker compose ${args.join(" ")}`;
    const exitCode =
      error && typeof error === "object" && "exitCode" in error
        ? (error as { exitCode: number }).exitCode
        : 1;
    console.error(
      `\n${chalk.red("Error:")} ${chalk.dim(cmd)} exited with code ${exitCode}`
    );
    process.exit(exitCode);
  }
}

export async function ensureDocker(): Promise<void> {
  if (!(await isDockerInstalled())) {
    console.error(
      `${chalk.red("Error:")} Docker is not installed.\nInstall it from: https://docs.docker.com/get-docker/`
    );
    process.exit(1);
  }

  if (!(await isDockerRunning())) {
    console.error(
      `${chalk.red("Error:")} Docker is not running. Please start Docker Desktop or the Docker daemon.`
    );
    process.exit(1);
  }
}
