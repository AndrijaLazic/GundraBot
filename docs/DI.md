# DI in GundraBot (Short Version)

## What DI means here

DI = create shared objects once, then pass them where needed.

In this project, `buildServices()` in `src/di/container.ts` creates a `services` object:

- `logger`
- `createMusic(guild)`
- `guildManagers`

## Simple flow

From `src/index.ts`:

```ts
const services = buildServices();
const commands = createCommands(services);
registerClientEvents(client, token, clientId, services);
```

So commands/events use dependencies from `services` instead of creating their own.

## Simple command example

From command files (same pattern for play/pause/resume/skip):

```ts
export function createSkipCommand(services: Services): CommandModule {
  const { guildManagers } = services;
  const logger = services.logger.child({ command: "skip" });
  // use guildManagers/logger here
}
```

Key point: dependency comes in through function args, not global state.

## Guild manager example

`GuildManagerProvider` keeps one `ServerGuildManager` per guild:

```ts
const guildManager = guildManagers.get(interaction.guild, interaction);
```

If it exists, reuse it. If not, create it.

## Adding new things

Add a new shared dependency:

1. Add it to `Services` in `src/di/container.ts`.
2. Create it in `buildServices()`.
3. Use it via `services` in commands/events.

Add a new command:

1. Create `createXCommand(services)`.
2. Register it in `src/commands/index.ts`.
