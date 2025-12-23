import type { Services } from "../di/container.js";
import type { CommandModule } from "../types/command.js";
import { createPauseCommand } from "./pause.js";
import { createPlayCommand } from "./play.js";
import { createResumeCommand } from "./resume.js";
import { createSkipCommand } from "./skip.js";

export function createCommands(services: Services): CommandModule[] {
  return [
    createPlayCommand(services),
    createPauseCommand(services),
    createResumeCommand(services),
    createSkipCommand(services)
  ];
}
