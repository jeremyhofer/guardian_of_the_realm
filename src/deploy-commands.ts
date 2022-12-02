import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import * as auth from './auth.json';
import { commandDispatch } from './bot';

const commands: Array<SlashCommandBuilder | Partial<SlashCommandBuilder>> =
  Object.values(commandDispatch).map(
    (commandConfig) => commandConfig.slashCommandBuilder
  );

// Construct and prepare an instance of the REST module
const rest = new REST({ version: '10' }).setToken(auth.token);

// and deploy your commands!
async function loadCommands(): Promise<void> {
  try {
    console.log(
      `Started refreshing ${commands.length} application (/) commands.`
    );

    // The put method is used to fully refresh all commands in the guild with the current set
    const data: any[] = (await rest.put(
      Routes.applicationGuildCommands(auth.clientId, auth.guildId),
      { body: commands }
    )) as any[];

    console.log(
      `Successfully reloaded ${data.length} application (/) commands.`
    );
  } catch (error) {
    // And of course, make sure you catch and log any errors!
    console.error(error);
  }
}

loadCommands().catch((error) => {
  console.error('Issue loading commands');
  console.error(error);
});
