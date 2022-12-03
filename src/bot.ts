import {
  ChatInputCommandInteraction,
  Interaction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { Database } from './data-source';
import * as admin from './commands/admin';
import * as clan_interact from './commands/clan_interact';
import * as economy from './commands/economy';
import * as general from './commands/general';
import * as player_interact from './commands/player_interact';
import * as assets from './assets';
import * as game_tasks from './game_tasks';
import * as tasks from './commands/tasks';
import * as utils from './utils';
import { CommandDispatch, CommandReturn, CooldownCommandFields } from './types';

export const commandDispatch: CommandDispatch = {
  ...admin.dispatch,
  ...clan_interact.dispatch,
  ...economy.dispatch,
  ...general.dispatch,
  ...player_interact.dispatch,
  ...tasks.dispatch,
  map: {
    function: async (
      interaction: ChatInputCommandInteraction
    ): Promise<CommandReturn> => {
      if (interaction.guild !== null) {
        return await game_tasks.postUpdatedMap(interaction.guild);
      }

      return { reply: 'issue generating map', success: true };
    },
    args: ['guild'],
    command_args: [[]],
    usage: [],
    slashCommandBuilder: new SlashCommandBuilder()
      .setName('map')
      .setDescription('map the things')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  },
  reset: {
    function: async (
      interaction: ChatInputCommandInteraction
    ): Promise<CommandReturn> => {
      if (interaction.guild !== null) {
        return await game_tasks.resetEverything(interaction.guild, Date.now());
      }

      return { reply: 'issue resetting', success: true };
    },
    args: ['guild', 'playerRoles', 'currentTime'],
    command_args: [[]],
    usage: [],
    slashCommandBuilder: new SlashCommandBuilder()
      .setName('reset')
      .setDescription('reset the things')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  },
};

export async function interactionHandler(
  interaction: Interaction,
  gameActive: boolean
): Promise<void> {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  const commandName = interaction.commandName;

  if (commandName in commandDispatch) {
    if (!gameActive) {
      await interaction.reply('The game is over. Please play again soon!');
      return;
    }
    if (
      assets.blockedChannels.includes(interaction.channel?.id ?? '') &&
        !(interaction.guild?.members.cache.get(interaction.user.id)?.roles.cache.has(assets.developerRole) ?? false)
    ) {
      await interaction.reply('commands are not allowed in this channel');
      return;
    }

    const commandConfig = commandDispatch[interaction.commandName];

    if ('allowed_channels' in commandConfig && !(commandConfig.allowed_channels?.includes(interaction.channel?.id ?? '') ?? false) &&
        !(interaction.guild?.members.cache.get(interaction.user.id)?.roles.cache.has(assets.developerRole) ?? false)
    ) {
      await interaction.reply('this command is not allowed in this channel.');
      return;
    }
    // Get playerData
    const playerData = await Database.playerData.getOrCreatePlayer(
      interaction.user.id
    );

    let cooldown = false;
    let cooldownPassed = false;
    let cooldownField: CooldownCommandFields | undefined;
    let cooldownFailMessage = null;
    const currentTime = Date.now();

    if ('cooldown' in commandConfig) {
      // Check to see if the cooldown for the command has passed
      cooldown = true;
      cooldownField = commandConfig.cooldown?.field;
      if (cooldownField !== undefined) {
        const lastTime: number = playerData[cooldownField] ?? 0;
        const cooldownTime = commandConfig.cooldown?.time ?? 0;
        const baseReply: string =
          commandConfig.cooldown?.reply ?? '';
        const timeUntil = utils.getTimeUntilString(
          lastTime + cooldownTime - currentTime
        );

        cooldownPassed = currentTime - lastTime >= cooldownTime;
        cooldownFailMessage = cooldownPassed
          ? ''
          : baseReply + ' ' + timeUntil;
      } else {
        console.error('Cooldown field not defined');
      }
    }

    if ('cooldown_from_start' in commandConfig) {
      // Check to see if the cooldown for the command has passed
      cooldown = true;
      const gameStartTracker = await Database.tracker.getTrackerByName(
        'gameStart'
      );
      const gameStart: number =
        gameStartTracker === null ? 0 : gameStartTracker.value;
      const cooldownTime: number =
        commandConfig.cooldown_from_start ?? 0;
      const baseReply = `You cannot perform a ${commandName} for`;
      const timeUntil = utils.getTimeUntilString(
        gameStart + cooldownTime - currentTime
      );

      cooldownPassed = currentTime - gameStart >= cooldownTime;
      cooldownFailMessage = cooldownPassed
        ? ''
        : baseReply + ' ' + timeUntil;
    }

    // If we do not have a cooldown or the cooldown is passed, continue
    if (cooldown && !cooldownPassed) {
      // Cooldown failed. Reply.
      await interaction.reply(cooldownFailMessage ?? 'Cooldown in effect.');
      return;
    }

    await interaction.deferReply();

    // commandDispatch supplied as input for cooldown command
    const commandReturn = await commandConfig.function(
      interaction,
      commandDispatch
    );

    if (commandReturn === null || commandReturn === undefined) {
      // TODO: figure out more proper response here if needed
      await interaction.editReply('Command is not yet implemented');
      return;
    }

    if (!commandReturn.success) {
      await interaction.editReply(
        'The command failed. Please check with a Developer.'
      );
      return;
    }

    if(cooldown && cooldownField !== undefined) {
      /*
      * If the command had a cooldown and playerData was not
      * returned As part of an update for the command, update the
      * cooldown here
      */
      await Database.playerData.updateCommandLastTime(interaction.user.id, cooldownField, currentTime);
    }

    await interaction.editReply({
      embeds: [{ description: commandReturn.reply }],
    });
  } else {
    await interaction.reply('This slash command is not recognized.');
  }
}
