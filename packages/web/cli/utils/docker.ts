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
  return execa("docker", ["compose", ...args], {
    cwd,
    stdio: "inherit",
    ...options,
  });
}

export async function ensureDocker(): Promise<void> {
  if (!(await isDockerInstalled())) {
    throw new Error(
      "Docker is not installed. Please install Docker first:\nhttps://docs.docker.com/get-docker/"
    );
  }

  if (!(await isDockerRunning())) {
    throw new Error(
      "Docker is not running. Please start Docker Desktop or the Docker daemon."
    );
  }
}
