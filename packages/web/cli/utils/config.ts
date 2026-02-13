import { existsSync } from "node:fs";
import { resolve } from "node:path";

export const DOCKER_IMAGE = "ghcr.io/maxcwolf/argus-web";
export const DEFAULT_DIR = "./argus";
export const DEFAULT_PORT = 3000;
export const DEFAULT_DB_PASSWORD = "argus";
export const DEFAULT_SCREENSHOTS_PATH = "./argus-data/images";

export function findArgusDir(dir?: string): string {
  const target = dir ? resolve(dir) : resolve(process.cwd(), DEFAULT_DIR);

  if (!existsSync(resolve(target, "docker-compose.yml"))) {
    throw new Error(
      `No docker-compose.yml found in ${target}.\nRun 'argus-web init' first to set up Argus.`
    );
  }

  return target;
}
