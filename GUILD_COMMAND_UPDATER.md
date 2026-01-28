# Guild Command Updater — Quick Guide

Use this guide together with `guildCommandUpdater-example.js` (copy-paste into your bot project).

Goal
- When a plugin/category is disabled on the dashboard for a specific guild, the bot should remove that category's commands from that guild so they are not visible or usable — even by server owners/admins.

How it works
1. Dashboard notifies your bot (webhook) with `{ type: 'plugin_update', guildId, state }`.
2. Your webhook handler persists the state and calls `guildCommandUpdater.queueUpdate(guildId, disabledList)`.
3. `guildCommandUpdater.runPending(client)` is invoked to apply the update:
   - It computes allowed commands and calls `guild.commands.set(allowed)` to replace the guild's commands.
   - Removing commands at the guild level hides them from everyone in that guild, including administrators/owners.

Integration steps
1. Copy `guildCommandUpdater-example.js` into your bot project, e.g. `src/bot/guildCommandUpdater.js`.
2. Implement `getAllCommandData()` in that file (or modify the fallback) so it returns your canonical command definitions (names, descriptions, options). If you register commands programmatically from code, produce the same objects here.
3. Ensure your webhook handler calls `gcu.queueUpdate(guildId, disabledList)` and `gcu.runPending(client)` (your webhook.js already does this in the example).
4. Add logging to confirm `Applied command update for guild <id>` appears when you toggle a plugin.

Notes & pitfalls
- If your bot registers a command globally and you only delete the guild command, global commands may still appear globally in other servers — this is expected. `guild.commands.set([...])` controls commands available in that guild only.
- If your commands rely on being present (e.g., you keep commands in a separate registry), ensure `getAllCommandData()` returns authoritative definitions.
- If your bot also supports text/prefix commands, enforce `isCommandEnabled` checks in your message/interaction handlers to prevent use even if command text invoked.

Example check in your command handler (for message or slash handlers):
```js
const { isCommandEnabled } = require('./webhook'); // or wherever you store guild config
if (!isCommandEnabled(guildId, 'giveaway')){
  return interaction.reply({ content: 'This command is disabled on this server.', ephemeral: true });
}
```

Testing
- Toggle a plugin on the dashboard for a guild.
- Watch the dashboard logs — it should POST to your bot and you should see `Received plugin update for <guild>`.
- Check your bot logs — `Applied command update for guild <id> allowed=[...]` should appear.
- In Discord, confirm the command is no longer available in that server (slash menu / autocompletion disappears).

If you'd like, I can try to generate a small, safe `getAllCommandData()` stub that reads from your bot's command registry if you can share how your bot loads commands (file structure or `client.commands` usage).