// guildCommandUpdater-example.js
// Copy this into your bot project and adapt the `getAllCommandData()` function
// so it returns your bot's canonical command definitions (name/description/options etc.).

// This updater will: queue per-guild command updates, and when run will
// set the guild's application commands to only the enabled set (removing disabled commands).

// Requirements: discord.js v13/v14 style client, supports client.application.commands and guild.commands

const pending = new Map(); // guildId -> Set of disabled command names

function queueUpdate(guildId, disabledList){
  pending.set(guildId, new Set(disabledList || []));
  console.log('Queued command update for', guildId, 'disabled=', Array.from(pending.get(guildId))); 
}

// Replace this function with how your bot stores canonical command definitions.
// It should return an array of command data objects suitable for application commands.
// Example: [{ name: 'giveaway', description: 'Start a giveaway', options: [...] }, ...]
async function getAllCommandData(){
  // Default implementation tries to read from global application commands (best-effort fallback)
  // If you have a local `client.commands` collection, prefer returning that instead.
  // NOTE: callers must pass a `client` into updateGuildCommands so we can fetch application commands.
  return null; // signal to use fallback behavior
}

async function updateGuildCommands(client, guildId, disabledSet){
  try{
    const guild = await client.guilds.fetch(guildId).catch(()=>null);
    if (!guild) {
      console.warn('Guild not available in cache:', guildId);
      return false;
    }

    // Build list of allowed commands
    let allCommandsData = null;
    const custom = await getAllCommandData();
    if (Array.isArray(custom) && custom.length > 0){
      allCommandsData = custom;
    } else {
      // fallback: fetch global application commands and use those definitions
      const globalCmds = await client.application.commands.fetch();
      allCommandsData = globalCmds.map(c => {
        // Convert API objects into raw data for setting at guild scope
        return {
          name: c.name,
          description: c.description || '',
          options: c.options || []
        };
      });
    }

    const allowed = allCommandsData.filter(cmd => !disabledSet.has(cmd.name));

    // Set guild commands to the allowed set (this replaces guild commands)
    // This will remove disabled commands from the guild entirely so they won't be visible or usable.
    await guild.commands.set(allowed);
    console.log('Applied command update for guild', guildId, 'allowed=', allowed.map(x=>x.name));
    return true;
  }catch(e){ console.warn('Failed to update guild commands for', guildId, e); return false; }
}

async function runPending(client){
  const toProcess = Array.from(pending.entries());
  for (const [guildId, disabledSet] of toProcess){
    await updateGuildCommands(client, guildId, disabledSet);
    pending.delete(guildId);
  }
}

module.exports = { queueUpdate, runPending, updateGuildCommands };
