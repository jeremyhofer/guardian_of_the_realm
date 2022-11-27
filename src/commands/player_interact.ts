import * as assets from '../assets';
import { Database } from '../data-source';
import * as game_tasks from '../game_tasks';
import * as utils from '../utils';
import * as flavor from '../data/flavor.json';
import { AvailableStoreItems, CommandDispatch, CommandReturn } from '../types';
import { PlayerData } from '../entity/PlayerData';
import { Guild } from 'discord.js';
import { ArgTypes } from '../enums';

/*
 * Attempt to destroy a person's income roles
 * Chance is X / X + Y, based on number of roles each has.
 * Cost is 1/2 the price of the building trying to be destroyed.
 * penalty??
 * Usage:
 * @player <ROLE>
 */
const arson = async ({
  args,
  playerData,
  playerRoles,
  guild,
}: {
  args: string[];
  playerData: PlayerData;
  playerRoles: string[];
  guild: Guild;
}): Promise<CommandReturn> => {
  const [playerMention, roleToArson] = args;

  const playerMentionUser = (playerMention as any).user as string;

  const commandReturn: CommandReturn = {
    update: {
      playerData,
      roles: {
        other_player: {
          id: playerMentionUser,
          add: [],
          remove: [] as string[],
        },
      },
    },
    reply: '',
    success: false,
  };

  const otherPlayerRoleIds: string[] = [];
  const incomeRoleIds: string[] = [];
  const targetRoleName =
    guild.roles.cache.get(roleToArson)?.name.toLowerCase() ?? '';

  for (const key in assets.storeItems) {
    if (assets.storeItems[key].type === 'income') {
      const roleId = utils.findRoleIdGivenName(key, assets.gameRoles);
      incomeRoleIds.push(roleId);
    }
  }

  /*
   * For this we are just checking the store items. The player may
   * have additional roles but they would not be in the store.
   */
  guild.members.cache.get(playerMentionUser)?.roles.cache.forEach((role) => {
    if (incomeRoleIds.includes(role.id)) {
      otherPlayerRoleIds.push(role.id);
    }
  });

  /*
   * Ensure that the role mentioned is an income producing role
   * and that the other player has that role
   */
  if (
    utils.isAvailableStoreItem(targetRoleName) &&
    incomeRoleIds.includes(roleToArson)
  ) {
    if (otherPlayerRoleIds.includes(roleToArson)) {
      // Ensure player has enough money to arson this role
      const arsonPrice = Math.round(assets.storeItems[targetRoleName].cost / 2);
      const playerMoney = playerData.money;

      if (playerMoney >= arsonPrice) {
        // Good to arson!
        let penalty = 0;
        let replyTemplate = '';

        if (utils.riskSuccess(playerRoles.length, otherPlayerRoleIds.length)) {
          // Player wins! Remove the role from the other player
          commandReturn.update?.roles?.other_player?.remove.push(roleToArson);
          replyTemplate = utils.randomElement(flavor.arson_success);
        } else {
          // Player failed! Assess a fine
          penalty = utils.getRandomValueInRange(
            assets.rewardPayoutsPenalties.arson_penalty_min,
            assets.rewardPayoutsPenalties.arson_penalty_max
          );
          (commandReturn.update?.playerData as PlayerData).money -= penalty;
          replyTemplate = utils.randomElement(flavor.arson_fail);
        }

        commandReturn.reply = utils.templateReplace(replyTemplate, {
          amount: penalty,
          targetMention: `<@${playerMentionUser}>`,
          roleToArson: targetRoleName,
        });

        // Deduct price for the arson
        (commandReturn.update?.playerData as PlayerData).money -= arsonPrice;
        commandReturn.success = true;
      } else {
        commandReturn.reply = `You do not have enough money to arson the <@&${roleToArson}>. The cost is ${arsonPrice}`;
      }
    } else {
      commandReturn.reply = `<@${playerMentionUser}> does not have the <@&${roleToArson}> role`;
    }
  } else {
    commandReturn.reply = `<@&${roleToArson}> is not an income producing role`;
  }

  return commandReturn;
};

/*
 * Give another player money
 * @player <VALUE>
 */
const gift = async ({
  args,
  playerData,
}: {
  args: any[];
  playerData: PlayerData;
}): Promise<CommandReturn> => {
  const commandReturn: CommandReturn = {
    update: {
      playerData: { ...playerData },
    },
    reply: '',
    success: true,
  };

  const playerMention = args[0] as unknown as PlayerData;
  const amountToGive = parseInt(args[1]);

  (commandReturn.update as any).playerMention = playerMention;
  // Make sure the player has enough money
  const pMoney = playerData.money;
  if (playerData.user === playerMention.user) {
    commandReturn.reply = 'You cannot gift yourself!';
  } else if (pMoney > 0) {
    // Ensure the args are valid
    if (Array.isArray(args) && args.length === 2) {
      if (isNaN(amountToGive) || amountToGive < 1) {
        commandReturn.reply = 'Amount to give must be a positive number';
      } else if (pMoney >= amountToGive) {
        // All good! Grant the cash
        (commandReturn.update?.playerData as PlayerData).money -= amountToGive;
        (commandReturn.update?.playerMention as PlayerData).money +=
          amountToGive;
        commandReturn.reply = `You successfully gave <@${playerMention.user}> ${amountToGive} :moneybag:`;
      } else {
        commandReturn.reply = `You only have ${pMoney} available`;
      }
    } else {
      commandReturn.reply = 'gift usage: .gift @player <money amount>';
    }
  } else {
    commandReturn.reply = 'You do not have any money to gift';
  }

  return commandReturn;
};

/*
 * Destroy ships! failRisk = yours / (theirs + 2*yours)
 * fail lose 5-15, other 1-9. win lose 1-9, other 10-20
 * <PLAYER>
 */
const pirate = async ({
  args,
  playerData,
}: {
  args: any[];
  playerData: PlayerData;
}): Promise<CommandReturn> => {
  const commandReturn: CommandReturn = {
    update: {
      playerData: { ...playerData },
    },
    reply: '',
    success: false,
  };

  const playerMention = args[0] as PlayerData;

  (commandReturn.update as any).playerMention = playerMention;
  // Make sure both have enough ships
  const pShips = playerData.ships;
  const mShips = playerMention.ships;
  if (playerData.user === playerMention.user) {
    commandReturn.reply = 'You cannot pirate yourself!';
  } else if (pShips >= 5) {
    if (mShips >= 5) {
      // Both have at least 5 ship. Figure out who wins!
      let playerLose = 0;
      let mentionLose = 0;
      let winner = 'player';
      let reward = 0;

      if (utils.riskSuccess(pShips, mShips)) {
        // Player wins! Adjust ships
        reward = utils.getRandomValueInRange(
          assets.rewardPayoutsPenalties.pirate_reward_min,
          assets.rewardPayoutsPenalties.pirate_reward_max
        );
        (commandReturn.update?.playerData as PlayerData).money += reward;
        playerLose = utils.getRandomValueInRange(
          assets.rewardPayoutsPenalties.pirate_success_attacker_loss_min,
          assets.rewardPayoutsPenalties.pirate_success_attacker_loss_max
        );
        mentionLose = utils.getRandomValueInRange(
          assets.rewardPayoutsPenalties.pirate_success_defender_loss_min,
          assets.rewardPayoutsPenalties.pirate_success_defender_loss_max
        );
      } else {
        // Mention wins! Adjust ships
        playerLose = utils.getRandomValueInRange(
          assets.rewardPayoutsPenalties.pirate_fail_attacker_loss_min,
          assets.rewardPayoutsPenalties.pirate_fail_attacker_loss_max
        );
        mentionLose = utils.getRandomValueInRange(
          assets.rewardPayoutsPenalties.pirate_fail_defender_loss_min,
          assets.rewardPayoutsPenalties.pirate_fail_defender_loss_max
        );
        winner = 'mention';
      }

      playerLose = playerLose > pShips ? pShips : playerLose;

      mentionLose = mentionLose > mShips ? mShips : mentionLose;

      (commandReturn.update?.playerData as PlayerData).ships -= playerLose;
      (commandReturn.update?.playerMention as PlayerData).ships -= mentionLose;
      const successReplyTemplate = utils.randomElement(flavor.pirate_success);
      const failReplyTemplate = utils.randomElement(flavor.pirate_fail);
      const usedTemplate =
        winner === 'player' ? successReplyTemplate : failReplyTemplate;
      commandReturn.reply = utils.templateReplace(usedTemplate, {
        reward,
        myLost: playerLose,
        enemyLost: mentionLose,
        targetMention: `<@${playerMention.user}>`,
        eWarship: assets.emojis.Warship,
      });
      commandReturn.success = true;
    } else {
      commandReturn.reply = 'The other player must have at least 5 ships';
    }
  } else {
    commandReturn.reply =
      'You must have a least 5 ships to launch a pirate raid.';
  }

  return commandReturn;
};

/*
 * Destroy men! failRisk = yours / (theirs + 2*yours)
 * fail lose 50-150, other 10-90. win lose 10-90, other 100-150
 * <PLAYER>.
 */
const raid = async ({
  args,
  playerData,
}: {
  args: any[];
  playerData: PlayerData;
}): Promise<CommandReturn> => {
  const commandReturn: CommandReturn = {
    update: {
      playerData,
    },
    reply: '',
    success: false,
  };

  const playerMention = args[0] as PlayerData;

  (commandReturn?.update as any).playerMention = playerMention;
  // Make sure both have enough men
  const pMen = playerData.men;
  const mMen = playerMention.men;
  if (playerData.user === playerMention.user) {
    commandReturn.reply = 'You cannot raid yourself!';
  } else if (pMen >= 50) {
    if (mMen >= 50) {
      // Both have at least 50 men. Figure out who wins!
      let playerLose = 0;
      let mentionLose = 0;
      let winner = 'player';
      let reward = 0;

      if (utils.riskSuccess(pMen, mMen)) {
        // Player wins! Adjust men
        reward = utils.getRandomValueInRange(
          assets.rewardPayoutsPenalties.raid_reward_min,
          assets.rewardPayoutsPenalties.raid_reward_max
        );
        (commandReturn.update?.playerData as PlayerData).money += reward;
        playerLose = utils.getRandomValueInRange(
          assets.rewardPayoutsPenalties.raid_success_attacker_loss_min,
          assets.rewardPayoutsPenalties.raid_success_attacker_loss_max
        );
        mentionLose = utils.getRandomValueInRange(
          assets.rewardPayoutsPenalties.raid_success_defender_loss_min,
          assets.rewardPayoutsPenalties.raid_success_defender_loss_max
        );
      } else {
        // Mention wins! Adjust men
        playerLose = utils.getRandomValueInRange(
          assets.rewardPayoutsPenalties.raid_fail_attacker_loss_min,
          assets.rewardPayoutsPenalties.raid_fail_attacker_loss_max
        );
        mentionLose = utils.getRandomValueInRange(
          assets.rewardPayoutsPenalties.raid_fail_defender_loss_min,
          assets.rewardPayoutsPenalties.raid_fail_defender_loss_max
        );
        winner = 'mention';
      }

      playerLose = playerLose > pMen ? pMen : playerLose;

      mentionLose = mentionLose > mMen ? mMen : mentionLose;

      (commandReturn.update?.playerData as PlayerData).men -= playerLose;
      (commandReturn.update?.playerMention as PlayerData).men -= mentionLose;
      const successReplyTemplate = utils.randomElement(flavor.raid_success);
      const failReplyTemplate = utils.randomElement(flavor.raid_fail);
      const usedTemplate =
        winner === 'player' ? successReplyTemplate : failReplyTemplate;
      commandReturn.reply = utils.templateReplace(usedTemplate, {
        reward,
        myLost: playerLose,
        enemyLost: mentionLose,
        targetMention: `<@${playerMention.user}>`,
        eMenAtArms: assets.emojis.MenAtArms,
      });
      commandReturn.success = true;
    } else {
      commandReturn.reply = 'The other player must have at least 50 men.';
    }
  } else {
    commandReturn.reply = 'You must have at least 50 men to launch a raid.';
  }

  return commandReturn;
};

/*
 * Attempt to remove a person's title.
 * Each usage will drop a person by one title rank, if possible.
 * Chance is X / X + Y, based on number of ?????.
 * Cost is ????.
 * penalty??
 * Usage:
 * @player
 */
const scandal = async ({
  args,
  playerData,
  guild,
}: {
  args: any[];
  playerData: PlayerData;
  guild: Guild;
}): Promise<CommandReturn> => {
  const playerMention = args[0] as PlayerData;

  const commandReturn: CommandReturn = {
    update: {
      playerData,
      roles: {
        other_player: {
          id: playerMention.user,
          add: [] as string[],
          remove: [] as string[],
        },
      },
    },
    reply: '',
    success: false,
  };

  const nobleRoleIds: string[] = [];

  for (const key in assets.storeItems) {
    if (assets.storeItems[key].type === 'title') {
      const roleId = utils.findRoleIdGivenName(key, assets.gameRoles);
      nobleRoleIds.push(roleId);
    }
  }

  const otherPlayerRoleIds: string[] = [];

  /*
   * For this we are just checking the store items. The player may
   * have additional roles but they would not be in the store.
   */
  guild.members.cache.get(playerMention.user)?.roles.cache.forEach((role) => {
    if (nobleRoleIds.includes(role.id)) {
      otherPlayerRoleIds.push(role.id);
    }
  });

  const nobleRoles = ['duke', 'earl', 'baron'];

  let highestRoleId = '';
  let highestRole = '';

  for (let iter = 0; iter < nobleRoles.length; iter += 1) {
    const checkRoleId = utils.findRoleIdGivenName(
      nobleRoles[iter],
      assets.gameRoles
    );
    if (otherPlayerRoleIds.includes(checkRoleId)) {
      highestRole = nobleRoles[iter];
      highestRoleId = checkRoleId;
      break;
    }
  }

  if (highestRoleId !== '') {
    // We have a highest role to try and scandal. Make sure we have the moola
    const scandalCost = Math.round(assets.storeItems[highestRole].cost / 2);

    if (playerData.money >= scandalCost) {
      // Determine if the scandal is a success
      const chance = utils.getRandomValueInRange(1, 100);
      let replyTemplate = '';
      let penalty = 0;

      if (chance >= 50) {
        // The scandal succeeded! Determine what role the other player drops to
        const currentRoleIndex = nobleRoles.indexOf(highestRole);
        const newRole =
          currentRoleIndex < nobleRoles.length - 1
            ? nobleRoles[currentRoleIndex + 1]
            : 'unsworn';

        if (newRole !== 'unsworn') {
          commandReturn.update?.roles?.other_player?.add.push(newRole);
        }
        commandReturn.update?.roles?.other_player?.remove.push(highestRole);
        replyTemplate = utils.randomElement(flavor.scandal_success);
      } else {
        penalty = utils.getRandomValueInRange(
          assets.rewardPayoutsPenalties.scandal_penalty_min,
          assets.rewardPayoutsPenalties.scandal_penalty_max
        );
        (commandReturn.update?.playerData as PlayerData).money -= penalty;
        replyTemplate = utils.randomElement(flavor.scandal_fail);
      }

      commandReturn.reply = utils.templateReplace(replyTemplate, {
        amount: penalty,
        targetMention: `<@${playerMention.user}>`,
        roleToScandal: highestRole,
      });
      (commandReturn.update?.playerData as PlayerData).money -= scandalCost;
      commandReturn.success = true;
    } else {
      commandReturn.reply =
        `Instigating a scandal against ${highestRole} ` +
        `<@${playerMention.user}> costs ${scandalCost} :moneybag:. You do ` +
        ' not have enough to afford the scandal.';
    }
  } else {
    commandReturn.reply = `<@${playerMention.user}> is unsworn!`;
  }

  return commandReturn;
};

/*
 * View money, ships, men of a player. costs 400
 * <PLAYER>
 */
const spy = async ({
  args,
  playerData,
  guild,
}: {
  args: any[];
  playerData: PlayerData;
  guild: Guild;
}): Promise<CommandReturn> => {
  const commandReturn: CommandReturn = {
    update: {
      playerData,
    },
    reply: '',
    success: false,
  };

  const playerMention = args[0] as PlayerData;

  (commandReturn?.update as any).playerMention = playerMention;
  // Make sure both have enough money
  const pMoney = playerData.money;
  if (playerData.user === playerMention.user) {
    commandReturn.reply = 'You cannot spy yourself!';
  } else if (pMoney >= assets.rewardPayoutsPenalties.spy_cost) {
    const playerRoles: string[] = [];
    guild.members.cache.get(playerMention.user)?.roles.cache.forEach((role) => {
      playerRoles.push(role.name.toLowerCase());
    });
    const roleReply = game_tasks.generateRolesReply({ playerRoles });
    (commandReturn.update?.playerData as PlayerData).money -=
      assets.rewardPayoutsPenalties.spy_cost;
    commandReturn.reply =
      `<@${playerMention.user}> has ` +
      `${playerMention.money} :moneybag: ${playerMention.men} ` +
      `${assets.emojis.MenAtArms} ${playerMention.ships} ` +
      `${assets.emojis.Warship}\n\n${roleReply}`;
    commandReturn.success = true;
  } else {
    commandReturn.reply = `You do not have enough money. Spy costs ${assets.rewardPayoutsPenalties.spy_cost}.`;
  }

  return commandReturn;
};

/*
 * Steal money from someone. failRisk = yours / (theirs + yours)
 * on succeed, take 2-10%. fail pay 100-1000 to player
 * <PLAYER>
 */
const thief = async ({
  args,
  playerData,
}: {
  args: any[];
  playerData: PlayerData;
}): Promise<CommandReturn> => {
  const commandReturn: CommandReturn = {
    update: {
      playerData,
    },
    reply: '',
    success: false,
  };

  const playerMention = args[0] as unknown as PlayerData;

  (commandReturn.update as any).playerMention = playerMention;
  // Make sure both have enough money, and no debt.
  const pMoney = playerData.money;
  const mMoney = playerMention.money;
  if (playerData.user === playerMention.user) {
    commandReturn.reply = 'You cannot thief yourself!';
  } else if (pMoney >= 0) {
    if (mMoney > 0) {
      // Both have at least some money. Figure out who wins!
      let moneyChange = 0;
      let winner = 'player';

      if (utils.riskSuccess(pMoney, mMoney)) {
        // Player wins! Adjust money
        moneyChange = utils.getPercentOfValueGivenRange(
          mMoney,
          assets.rewardPayoutsPenalties.thief_success_percent_min,
          assets.rewardPayoutsPenalties.thief_success_percent_max
        );
      } else {
        // Mention wins! Adjust money
        moneyChange = utils.getRandomValueInRange(
          assets.rewardPayoutsPenalties.thief_penalty_min,
          assets.rewardPayoutsPenalties.thief_penalty_max
        );
        winner = 'mention';
      }

      if (winner === 'player') {
        moneyChange = moneyChange > mMoney ? mMoney : moneyChange;
        (commandReturn.update?.playerData as PlayerData).money += moneyChange;
        (commandReturn.update?.playerMention as PlayerData).money +=
          moneyChange;
      } else {
        (commandReturn.update?.playerData as PlayerData).money -= moneyChange;
        (commandReturn.update?.playerMention as PlayerData).money +=
          moneyChange;
      }

      const successReplyTemplate = utils.randomElement(flavor.thief_success);
      const failReplyTemplate = utils.randomElement(flavor.thief_fail);
      const usedTemplate =
        winner === 'player' ? successReplyTemplate : failReplyTemplate;
      commandReturn.reply = utils.templateReplace(usedTemplate, {
        amount: moneyChange,
        targetMention: `<@${playerMention.user}>`,
        eMenAtArms: assets.emojis.MenAtArms,
      });
      commandReturn.success = true;
    } else {
      commandReturn.reply = 'The other player does not have any money';
    }
  } else {
    commandReturn.reply =
      'You are in debt. You should find other ways to make money';
  }

  return commandReturn;
};

/*
 * Trade with a different player that is in a house in which you have a pact
 * @player <SHIPS>
 */
const trade = async ({
  args,
  playerData,
  playerRoles,
}: {
  args: any[];
  playerData: PlayerData;
  playerRoles: string[];
}): Promise<CommandReturn> => {
  const commandReturn: CommandReturn = {
    update: {
      playerData,
    },
    reply: '',
    success: true,
  };

  const playerMention = args[0] as PlayerData;
  const numShips = parseInt(args[1]);

  (commandReturn.update as any).playerMention = playerMention;

  // Make sure the players' houses are in a pact
  const pact = await Database.pact.getPactBetweenHouses(
    playerData.house,
    playerMention.house
  );

  if (pact !== null) {
    // Make sure the player has ships
    const pShips = playerData.ships;
    let roleLimit = assets.roleShipLimits.unsworn;

    if (playerRoles.includes('duke')) {
      roleLimit = assets.roleShipLimits.duke;
    } else if (playerRoles.includes('earl')) {
      roleLimit = assets.roleShipLimits.earl;
    } else if (playerRoles.includes('baron')) {
      roleLimit = assets.roleShipLimits.baron;
    }

    if (playerData.user === playerMention.user) {
      commandReturn.reply = 'You cannot trade yourself!';
    } else if (pShips > 0) {
      // Ensure the args are valid
      if (isNaN(numShips) || numShips < 1) {
        commandReturn.reply = 'Number of ships must be a positive number';
      } else if (numShips > roleLimit) {
        commandReturn.reply = `You may only use at most ${roleLimit} ships`;
      } else if (pShips >= numShips) {
        // All good! Grant the cash
        const traderPay =
          utils.getRandomValueInRange(
            assets.rewardPayoutsPenalties.trade_trader_reward_min,
            assets.rewardPayoutsPenalties.trade_trader_reward_max
          ) * numShips;
        const tradeePay =
          utils.getRandomValueInRange(
            assets.rewardPayoutsPenalties.trade_tradee_reward_min,
            assets.rewardPayoutsPenalties.trade_tradee_reward_max
          ) * numShips;
        (commandReturn.update?.playerData as PlayerData).money += traderPay;
        (commandReturn.update?.playerMention as PlayerData).money += tradeePay;
        const replyTemplate = utils.randomElement(flavor.trade);
        commandReturn.reply = utils.templateReplace(replyTemplate, {
          traderPay,
          tradeePay,
          trader: `<@${playerData.user}>`,
          tradee: `<@${playerMention.user}>`,
        });
        commandReturn.success = true;
      } else {
        commandReturn.reply = `You only have ${pShips} ${assets.emojis.Warship} available`;
      }
    } else {
      commandReturn.reply = 'You do not have any ships to trade with';
    }
  } else {
    commandReturn.reply = `Your house is not in a pact with <@&${playerMention.house}>!`;
  }

  return commandReturn;
};

export const dispatch: CommandDispatch = {
  arson: {
    function: arson,
    cooldown: {
      time: utils.hoursToMs(assets.timeoutLengths.arson),
      field: 'arson_last_time',
      reply: 'The fire watch is on high alert. ' + 'They are due to leave in',
    },
    args: ['args', 'playerData', 'playerRoles', 'guild'],
    command_args: [[ArgTypes.player_mention, ArgTypes.game_role]],
    usage: ['@PLAYER INCOME_ROLE'],
    allowed_channels: assets.playerInteractChannels,
  },
  gift: {
    function: gift,
    args: ['args', 'playerData'],
    command_args: [[ArgTypes.player_mention, ArgTypes.number]],
    usage: ['@PLAYER MONEY'],
    allowed_channels: assets.playerInteractChannels,
  },
  pirate: {
    function: pirate,
    cooldown: {
      time: utils.hoursToMs(assets.timeoutLengths.pirate),
      field: 'pirate_last_time',
      reply:
        'Pirating now would not be wise as the navy is patroling. ' +
        'They are due to leave in',
    },
    args: ['args', 'playerData'],
    command_args: [[ArgTypes.player_mention]],
    usage: ['@PLAYER'],
    allowed_channels: assets.playerInteractChannels,
  },
  raid: {
    function: raid,
    cooldown: {
      time: utils.hoursToMs(assets.timeoutLengths.raid),
      field: 'raid_last_time',
      reply:
        'Your troops are still resting from the last raid. ' +
        'Your party may leave again in',
    },
    args: ['args', 'playerData'],
    command_args: [[ArgTypes.player_mention]],
    usage: ['@PLAYER'],
    allowed_channels: assets.playerInteractChannels,
  },
  scandal: {
    function: scandal,
    cooldown: {
      time: utils.hoursToMs(assets.timeoutLengths.scandal),
      field: 'scandal_last_time',
      reply: 'The fire watch is on high alert. ' + 'They are due to leave in',
    },
    args: ['args', 'playerData', 'guild'],
    command_args: [[ArgTypes.player_mention]],
    usage: ['@PLAYER'],
    allowed_channels: assets.playerInteractChannels,
  },
  spy: {
    function: spy,
    cooldown: {
      time: utils.hoursToMs(assets.timeoutLengths.spy),
      field: 'spy_last_time',
      reply: 'The spy is out to lunch and will be back in',
    },
    args: ['args', 'playerData', 'guild'],
    command_args: [[ArgTypes.player_mention]],
    usage: ['@PLAYER'],
    allowed_channels: assets.playerInteractChannels,
  },
  thief: {
    function: thief,
    cooldown: {
      time: utils.hoursToMs(assets.timeoutLengths.thief),
      field: 'thief_last_time',
      reply:
        'The guards are on the alert for thieves. ' +
        'Maybe you can try again in',
    },
    args: ['args', 'playerData'],
    command_args: [[ArgTypes.player_mention]],
    usage: ['@PLAYER'],
    allowed_channels: assets.playerInteractChannels,
  },
  trade: {
    function: trade,
    cooldown: {
      time: utils.hoursToMs(assets.timeoutLengths.trade),
      field: 'trade_last_time',
      reply:
        'Your merchants are buying goods from the guilds, and ' +
        'their sailors are drunk in the tavern. You can set sail again at',
    },
    args: ['args', 'playerData', 'playerRoles'],
    command_args: [[ArgTypes.player_mention, ArgTypes.number]],
    usage: ['@PLAYER SHIPS'],
    allowed_channels: assets.playerInteractChannels,
  },
};
