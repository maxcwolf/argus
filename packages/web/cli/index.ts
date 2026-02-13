import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { startCommand } from "./commands/start.js";
import { stopCommand } from "./commands/stop.js";
import { logsCommand } from "./commands/logs.js";
import { statusCommand } from "./commands/status.js";
import { upgradeCommand } from "./commands/upgrade.js";

const program = new Command();

program
  .name("argus-web")
  .description("Set up and manage the Argus web dashboard")
  .version("0.1.0");

program
  .command("init")
  .description("Interactive setup wizard — generates docker-compose.yml, .env, and nginx.conf")
  .option("-d, --dir <path>", "Output directory", "./argus")
  .action(initCommand);

program
  .command("start")
  .description("Start Argus (docker compose up -d)")
  .option("-d, --dir <path>", "Argus directory")
  .action(startCommand);

program
  .command("stop")
  .description("Stop Argus (docker compose down)")
  .option("-d, --dir <path>", "Argus directory")
  .action(stopCommand);

program
  .command("logs")
  .description("View logs (docker compose logs -f)")
  .option("-d, --dir <path>", "Argus directory")
  .option("-s, --service <name>", "Service name (web, db, nginx)")
  .action(logsCommand);

program
  .command("status")
  .description("Check container status and health")
  .option("-d, --dir <path>", "Argus directory")
  .action(statusCommand);

program
  .command("upgrade")
  .description("Pull latest images and restart")
  .option("-d, --dir <path>", "Argus directory")
  .action(upgradeCommand);

program.parse();
