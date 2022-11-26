import { CommandDispatch, CommandReturn } from '../types';
import * as assets from '../assets';
import * as gameTasks from '../game_tasks';
import * as utils from '../utils';
import { PlayerData } from '../entity/PlayerData';

// Show help text. optional specific command
const help = async(): Promise<CommandReturn> => {
  return {
    reply: 'sorry, not much help',
    success: true
  };
};

/*
 * Lists the players money, men, and ships with
 * the unique faction name for each.
 */
const bal = async({ playerData, playerRoles }: { playerData: PlayerData, playerRoles: string[] }): Promise<CommandReturn> => {
  let reply = `Your account: ${playerData.money} :moneybag: ` +
    `${playerData.men} ${assets.emojis.MenAtArms} ${playerData.ships} ` +
    `${assets.emojis.Warship}`;

  reply += '\n\nSiege Contributions:\n';

  let siegeContributions = '';
  let blockadeContributions = '';
  const playerPledges = playerData.pledges;

  // TODO: select all siege + tile + pledge by user
  playerPledges.forEach(pledge => {
    if(pledge.siege.tile.type === 'port') {
      blockadeContributions += `${pledge.siege.tile.tile} ${pledge.units} ${assets.emojis.Warship} ${pledge.choice}\n`;
    } else {
      siegeContributions += `${pledge.siege.tile.tile} ${pledge.units} ${assets.emojis.MenAtArms} ${pledge.choice}\n`;
    }
  });

  siegeContributions = siegeContributions !== '' ? siegeContributions : 'none';

  blockadeContributions = blockadeContributions !== '' ? blockadeContributions : 'none';

  reply += siegeContributions;
  reply += '\nBlockade Contributions:\n';
  reply += blockadeContributions;
  reply += '\n\n';
  reply += gameTasks.generateRolesReply({ playerRoles });

  return { reply, success: true };
};

const cooldown = async({ playerData, commandDispatch }: { playerData: PlayerData, commandDispatch: CommandDispatch }): Promise<CommandReturn> => {
  const now = Date.now();

  const cooldownMap: { [key: string]: string } = {
    arson_last_time: 'arson',
    pirate_last_time: 'pirate',
    pray_last_time: 'pray',
    raid_last_time: 'raid',
    scandal_last_time: 'scandal',
    spy_last_time: 'spy',
    subvert_last_time: 'subvert',
    thief_last_time: 'thief',
    train_last_time: 'train',
    trade_last_time: 'trade',
    work_last_time: 'work'

  };

  let reply = '';

  for(const key in cooldownMap) {
    const commandCooldown = commandDispatch[cooldownMap[key]].cooldown?.time ?? 0;
    // TODO: consider improving things to remove this any cast
    let timeLeft = (playerData as any)[key] - now + commandCooldown;
    const keyCap = cooldownMap[key][0].toUpperCase() + cooldownMap[key].slice(1);
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
    usage: []
  },
  bal: {
    function: bal,
    args: [
      'playerData',
      'playerRoles'
    ],
    command_args: [[]],
    usage: []
  },
  cooldown: {
    function: cooldown,
    args: [
      'playerData',
      'commandDispatch'
    ],
    command_args: [[]],
    usage: []
  }
};
