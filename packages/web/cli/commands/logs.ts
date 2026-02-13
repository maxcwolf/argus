import { findArgusDir } from "../utils/config.js";
import { ensureDocker, dockerCompose } from "../utils/docker.js";

export async function logsCommand(options: {
  dir?: string;
  service?: string;
}) {
  const cwd = findArgusDir(options.dir);

  await ensureDocker();

  const args = ["logs", "-f"];
  if (options.service) {
    args.push(options.service);
  }

  await dockerCompose(args, cwd);
}
