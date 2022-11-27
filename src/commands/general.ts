import {
  CommandDispatch,
  CommandReturn,
  CooldownCommandFields,
  CooldownCommands,
} from '../types';
import * as assets from '../assets';
import * as gameTasks from '../game_tasks';
import * as utils from '../utils';
import { PlayerData } from '../entity/PlayerData';

// Show help text. optional specific command
const help = async (): Promise<CommandReturn> => {
  return {
    reply: 'sorry, not much help',
    success: true,
  };
};

/*
 * Lists the players money, men, and ships with
 * the unique faction name for each.
 */
const bal = async ({
  playerData,
  playerRoles,
}: {
  playerData: PlayerData;
  playerRoles: string[];
}): Promise<CommandReturn> => {
  let reply =
    `Your account: ${playerData.money} :moneybag: ` +
    `${playerData.men} ${assets.emojis.MenAtArms} ${playerData.ships} ` +
    `${assets.emojis.Warship}`;

  reply += '\n\nSiege Contributions:\n';

  let siegeContributions = '';
  let blockadeContributions = '';
  const playerPledges = playerData.pledges;

  // TODO: select all siege + tile + pledge by user
  playerPledges.forEach((pledge) => {
    if (pledge.siege.tile.type === 'port') {
      blockadeContributions += `${pledge.siege.tile.tile} ${pledge.units} ${assets.emojis.Warship} ${pledge.choice}\n`;
    } else {
      siegeContributions += `${pledge.siege.tile.tile} ${pledge.units} ${assets.emojis.MenAtArms} ${pledge.choice}\n`;
    }
  });

  siegeContributions = siegeContributions !== '' ? siegeContributions : 'none';

  blockadeContributions =
    blockadeContributions !== '' ? blockadeContributions : 'none';

  reply += siegeContributions;
  reply += '\nBlockade Contributions:\n';
  reply += blockadeContributions;
  reply += '\n\n';
  reply += gameTasks.generateRolesReply({ playerRoles });

  return { reply, success: true };
};

const cooldown = async ({
  playerData,
  commandDispatch,
}: {
  playerData: PlayerData;
  commandDispatch: CommandDispatch;
}): Promise<CommandReturn> => {
  const now = Date.now();

  let reply = '';

  for (const command of CooldownCommands) {
    const key: CooldownCommandFields = `${command}_last_time`;
    const commandCooldown = commandDispatch[command].cooldown?.time ?? 0;
    let timeLeft = playerData[key] - now + commandCooldown;
    const keyCap = command[0].toUpperCase() + command.slice(1);
    timeLeft = timeLeft < 0 ? 0 : timeLeft;
    const timeUntilString = utils.getTimeUntilString(timeLeft);
    reply += `${keyCap} ${timeUntilString}\n`;
  }

  return { reply, success: true };
};

export const dispatch: CommandDispatch = {
  help: {
    function: help,
    args: [],
    command_args: [[]],
    usage: [],
  },
  bal: {
    function: bal,
    args: ['playerData', 'playerRoles'],
    command_args: [[]],
    usage: [],
  },
  cooldown: {
    function: cooldown,
    args: ['playerData', 'commandDispatch'],
    command_args: [[]],
    usage: [],
  },
};
