import * as assets from '../assets';
import { Database } from '../data-source';
import * as game_tasks from '../game_tasks';
import * as utils from '../utils';
import * as flavor from '../data/flavor.json';
import { ArgParserFn, CommandDispatch, CommandReturn } from '../types';
import {
  APIRole,
  ChatInputCommandInteraction,
  Role,
  SlashCommandBuilder,
  User,
} from 'discord.js';

/*
 * Attempt to destroy a person's income roles
 * Chance is X / X + Y, based on number of roles each has.
 * Cost is 1/2 the price of the building trying to be destroyed.
 * penalty??
 * Usage:
 * @player <ROLE>
 */
const arson = async (
  interaction: ChatInputCommandInteraction
): Promise<CommandReturn> => {
  const argParser: ArgParserFn<{ player: User; role: Role | APIRole }> = (
    options
  ) => {
    const player = options.getUser('player');
    const role = options.getRole('role');

    if (player === null || role === null) {
      return null;
    }

    return { player, role };
  };

  const parsedArgs = argParser(interaction.options);

  if (parsedArgs === null) {
    return {
      reply: 'Issue with arguments. Contact a Developer.',
      success: true,
    };
  }

  const playerData = await Database.playerData.getOrCreatePlayer(
    interaction.user.id
  );
  const playerMention = await Database.playerData.getOrCreatePlayer(
    parsedArgs.player.id
  );

  if (playerData.user === playerMention.user) {
    return {
      reply: 'You cannot arson your own infrastructure!',
      success: true,
    };
  }

  const incomeRoleIds: string[] = game_tasks.getStoreRoleIdsGivenType('income');
  const targetRoleName = parsedArgs.role.name.toLowerCase() ?? '';

  /*
   * For this we are just checking the store items. The player may
   * have additional roles but they would not be in the store.
   */
  const playerRoles: string[] = game_tasks.getMemberOwnedRoleIds(
    interaction,
    interaction.user,
    incomeRoleIds
  );
  const otherPlayerRoleIds: string[] = game_tasks.getMemberOwnedRoleIds(
    interaction,
    parsedArgs.player,
    incomeRoleIds
  );

  /*
   * Ensure that the role mentioned is an income producing role
   * and that the other player has that role
   */
  if (
    !utils.isAvailableStoreItem(targetRoleName) ||
    !incomeRoleIds.includes(parsedArgs.role.id)
  ) {
    return {
      reply: `<@&${parsedArgs.role.id}> is not an income producing role`,
      success: true,
    };
  }
  if (!otherPlayerRoleIds.includes(parsedArgs.role.id)) {
    return {
      reply: `${parsedArgs.player.toString()} does not have the <@&${
        parsedArgs.role.id
      }> role`,
      success: true,
    };
  }

  // Ensure player has enough money to arson this role
  const arsonPrice = Math.round(assets.storeItems[targetRoleName].cost / 2);
  const playerMoney = playerData.money;

  if (playerMoney < arsonPrice) {
    return {
      reply: `You do not have enough money to arson the <@&${parsedArgs.role.id}>. The cost is ${arsonPrice}`,
      success: true,
    };
  }

  // Good to arson!
  let penalty = 0;
  let replyTemplate = '';

  if (utils.riskSuccess(playerRoles.length, otherPlayerRoleIds.length)) {
    // Player wins! Remove the role from the other player
    await game_tasks.alterRole(
      interaction,
      parsedArgs.player,
      targetRoleName,
      'remove'
    );
    replyTemplate = utils.randomElement(flavor.arson_success);
  } else {
    // Player failed! Assess a fine
    penalty = utils.getRandomValueInRange(
      assets.rewardPayoutsPenalties.arson_penalty_min,
      assets.rewardPayoutsPenalties.arson_penalty_max
    );
    playerData.money -= penalty;
    replyTemplate = utils.randomElement(flavor.arson_fail);
  }

  const reply = utils.templateReplace(replyTemplate, {
    amount: penalty,
    targetMention: parsedArgs.player.toString(),
    roleToArson: targetRoleName,
  });

  // Deduct price for the arson
  playerData.money -= arsonPrice;

  await Database.playerData.saveMultiple([playerData]);

  return { reply, success: true };
};

/*
 * Give another player money
 * @player <VALUE>
 */
const gift = async (
  interaction: ChatInputCommandInteraction
): Promise<CommandReturn> => {
  const argParser: ArgParserFn<{ player: User; amount: number }> = (
    options
  ) => {
    const player = options.getUser('player');
    const amount = options.getNumber('amount');

    if (player === null || amount === null) {
      return null;
    }

    return { player, amount };
  };

  const parsedArgs = argParser(interaction.options);

  if (parsedArgs === null) {
    return {
      reply: 'Issue with arguments. Contact a Developer.',
      success: true,
    };
  }

  const playerData = await Database.playerData.getOrCreatePlayer(
    interaction.user.id
  );
  const playerMention = await Database.playerData.getOrCreatePlayer(
    parsedArgs.player.id
  );

  const amountToGive = parsedArgs.amount;

  // Make sure the player has enough money
  const pMoney = playerData.money;

  if (playerData.user === playerMention.user) {
    return { reply: 'You cannot gift yourself!', success: true };
  }

  if (pMoney <= 0) {
    return { reply: 'You do not have any money to gift', success: true };
  }

  if (pMoney < amountToGive) {
    return { reply: `You only have ${pMoney} available`, success: true };
  }

  // All good! Grant the cash
  playerData.money -= amountToGive;
  playerMention.money += amountToGive;

  await Database.playerData.saveMultiple([playerData, playerMention]);

  return {
    reply: `You successfully gave ${parsedArgs.player.toString()} ${amountToGive} ${
      assets.emojis.Money
    }`,
    success: true,
  };
};

/*
 * Destroy men! failRisk = yours / (theirs + 2*yours)
 * fail lose 50-150, other 10-90. win lose 10-90, other 100-150
 * <PLAYER>.
 */
const raid = async (
  interaction: ChatInputCommandInteraction
): Promise<CommandReturn> => {
  const argParser: ArgParserFn<{ player: User }> = (options) => {
    const player = options.getUser('player');

    if (player === null) {
      return null;
    }

    return { player };
  };

  const parsedArgs = argParser(interaction.options);

  if (parsedArgs === null) {
    return {
      reply: 'Issue with arguments. Contact a Developer.',
      success: true,
    };
  }

  const playerData = await Database.playerData.getOrCreatePlayer(
    interaction.user.id
  );
  const playerMention = await Database.playerData.getOrCreatePlayer(
    parsedArgs.player.id
  );

  // Make sure both have enough men
  const pMen = playerData.men;
  const mMen = playerMention.men;
  if (playerData.user === playerMention.user) {
    return { reply: 'You cannot raid yourself!', success: true };
  }
  if (pMen < 50) {
    return {
      reply: 'You must have at least 50 men to launch a raid.',
      success: true,
    };
  }
  if (mMen < 50) {
    return {
      reply: 'The other player must have at least 50 men.',
      success: true,
    };
  }

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
    playerData.money += reward;
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

  playerData.men -= playerLose;
  playerMention.men -= mentionLose;
  const successReplyTemplate = utils.randomElement(flavor.raid_success);
  const failReplyTemplate = utils.randomElement(flavor.raid_fail);
  const usedTemplate =
    winner === 'player' ? successReplyTemplate : failReplyTemplate;
  const reply = utils.templateReplace(usedTemplate, {
    reward,
    myLost: playerLose,
    enemyLost: mentionLose,
    targetMention: parsedArgs.player.toString(),
    eMenAtArms: assets.emojis.MenAtArms,
  });
  await Database.playerData.saveMultiple([playerData, playerMention]);

  return { reply, success: true };
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
const scandal = async (
  interaction: ChatInputCommandInteraction
): Promise<CommandReturn> => {
  const argParser: ArgParserFn<{ player: User }> = (options) => {
    const player = options.getUser('player');

    if (player === null) {
      return null;
    }

    return { player };
  };

  const parsedArgs = argParser(interaction.options);

  if (parsedArgs === null) {
    return {
      reply: 'Issue with arguments. Contact a Developer.',
      success: true,
    };
  }

  const playerData = await Database.playerData.getOrCreatePlayer(
    interaction.user.id
  );
  const playerMention = await Database.playerData.getOrCreatePlayer(
    parsedArgs.player.id
  );

  if (playerData.user === playerMention.user) {
    return { reply: 'You cannot commit a scandal on yourself!', success: true };
  }

  const nobleRoleIds: string[] = game_tasks.getStoreRoleIdsGivenType('title');

  /*
   * For this we are just checking the store items. The player may
   * have additional roles but they would not be in the store.
   */
  const otherPlayerRoleIds: string[] = game_tasks.getMemberOwnedRoleIds(
    interaction,
    parsedArgs.player,
    nobleRoleIds
  );

  const nobleRoles = ['duke', 'earl', 'baron'];

  let highestRoleId = '';
  let highestRole = '';

  for (const nobleRole of nobleRoles) {
    const checkRoleId = utils.findRoleIdGivenName(nobleRole, assets.gameRoles);
    if (otherPlayerRoleIds.includes(checkRoleId)) {
      highestRole = nobleRole;
      highestRoleId = checkRoleId;
      break;
    }
  }

  if (highestRoleId === '') {
    return {
      reply: `${parsedArgs.player.toString()} is unsworn!`,
      success: true,
    };
  }

  // We have a highest role to try and scandal. Make sure we have the moola
  const scandalCost = Math.round(assets.storeItems[highestRole].cost / 2);

  if (playerData.money < scandalCost) {
    return {
      reply:
        `Instigating a scandal against ${highestRole} ` +
        `<@${playerMention.user}> costs ${scandalCost} ${assets.emojis.Money}. You do ` +
        ' not have enough to afford the scandal.',
      success: true,
    };
  }

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
      await game_tasks.alterRole(
        interaction,
        parsedArgs.player,
        newRole,
        'add'
      );
    }
    await game_tasks.alterRole(
      interaction,
      parsedArgs.player,
      highestRole,
      'remove'
    );
    replyTemplate = utils.randomElement(flavor.scandal_success);
  } else {
    penalty = utils.getRandomValueInRange(
      assets.rewardPayoutsPenalties.scandal_penalty_min,
      assets.rewardPayoutsPenalties.scandal_penalty_max
    );
    playerData.money -= penalty;
    replyTemplate = utils.randomElement(flavor.scandal_fail);
  }

  const reply = utils.templateReplace(replyTemplate, {
    amount: penalty,
    targetMention: `${parsedArgs.player.toString()}`,
    roleToScandal: highestRole,
  });
  playerData.money -= scandalCost;
  await Database.playerData.saveMultiple([playerData]);

  return { reply, success: true };
};

/*
 * View money, ships, men of a player. costs 400
 * <PLAYER>
 */
const spy = async (
  interaction: ChatInputCommandInteraction
): Promise<CommandReturn> => {
  const argParser: ArgParserFn<{ player: User }> = (options) => {
    const player = options.getUser('player');

    if (player === null) {
      return null;
    }

    return { player };
  };

  const parsedArgs = argParser(interaction.options);

  if (parsedArgs === null) {
    return {
      reply: 'Issue with arguments. Contact a Developer.',
      success: true,
    };
  }

  const playerData = await Database.playerData.getOrCreatePlayer(
    interaction.user.id
  );
  const playerMention = await Database.playerData.getOrCreatePlayer(
    parsedArgs.player.id
  );
  // Make sure both have enough money
  const pMoney = playerData.money;

  if (playerData.user === playerMention.user) {
    return { reply: 'You cannot spy yourself!', success: true };
  }
  if (pMoney < assets.rewardPayoutsPenalties.spy_cost) {
    return {
      reply: `You do not have enough money. Spy costs ${assets.rewardPayoutsPenalties.spy_cost}.`,
      success: true,
    };
  }

  const playerRoles: string[] =
    interaction.guild?.members.cache
      .get(playerMention.user)
      ?.roles.cache.map((role) => role.name.toLowerCase()) ?? [];

  const roleReply = game_tasks.generateRolesReply({ playerRoles });
  playerData.money -= assets.rewardPayoutsPenalties.spy_cost;
  const reply =
    `${parsedArgs.player.toString()} has ` +
    `${playerMention.money} ${assets.emojis.Money} ${playerMention.men} ` +
    `${assets.emojis.MenAtArms} ${playerMention.ships} ` +
    `${assets.emojis.Warship}\n\n${roleReply}`;

  await Database.playerData.saveMultiple([playerData]);

  return { reply, success: true };
};

/*
 * Steal money from someone. failRisk = yours / (theirs + yours)
 * on succeed, take 2-10%. fail pay 100-1000 to player
 * <PLAYER>
 */
const thief = async (
  interaction: ChatInputCommandInteraction
): Promise<CommandReturn> => {
  const argParser: ArgParserFn<{ player: User }> = (options) => {
    const player = options.getUser('player');

    if (player === null) {
      return null;
    }

    return { player };
  };

  const parsedArgs = argParser(interaction.options);

  if (parsedArgs === null) {
    return {
      reply: 'Issue with arguments. Contact a Developer.',
      success: true,
    };
  }

  const playerData = await Database.playerData.getOrCreatePlayer(
    interaction.user.id
  );
  const playerMention = await Database.playerData.getOrCreatePlayer(
    parsedArgs.player.id
  );
  // Make sure both have enough money, and no debt.
  const pMoney = playerData.money;
  const mMoney = playerMention.money;

  if (playerData.user === playerMention.user) {
    return { reply: 'You cannot thief yourself!', success: true };
  }

  if (pMoney <= 0) {
    return {
      reply: 'You are in debt. You should find other ways to make money',
      success: true,
    };
  }
  if (mMoney <= 0) {
    return { reply: 'The other player does not have any money', success: true };
  }

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
    playerData.money += moneyChange;
    playerMention.money += moneyChange;
  } else {
    playerData.money -= moneyChange;
    playerMention.money += moneyChange;
  }

  const successReplyTemplate = utils.randomElement(flavor.thief_success);
  const failReplyTemplate = utils.randomElement(flavor.thief_fail);
  const usedTemplate =
    winner === 'player' ? successReplyTemplate : failReplyTemplate;
  const reply = utils.templateReplace(usedTemplate, {
    amount: moneyChange,
    targetMention: parsedArgs.player.toString(),
    eMenAtArms: assets.emojis.MenAtArms,
  });

  await Database.playerData.saveMultiple([playerData, playerMention]);

  return { reply, success: true };
};

/*
 * Trade with a different player that is in a house in which you have a pact
 * @player <SHIPS>
 */
const trade = async (
  interaction: ChatInputCommandInteraction
): Promise<CommandReturn> => {
  const argParser: ArgParserFn<{ player: User; ships: number }> = (options) => {
    const player = options.getUser('player');
    const ships = options.getNumber('ships');

    if (player === null || ships === null) {
      return null;
    }

    return { player, ships };
  };

  const parsedArgs = argParser(interaction.options);

  if (parsedArgs === null) {
    return {
      reply: 'Issue with arguments. Contact a Developer.',
      success: true,
    };
  }

  const playerData = await Database.playerData.getOrCreatePlayer(
    interaction.user.id
  );
  const playerMention = await Database.playerData.getOrCreatePlayer(
    parsedArgs.player.id
  );

  if (playerData.user === playerMention.user) {
    return { reply: 'You cannot trade yourself!', success: true };
  }

  const numShips = parsedArgs.ships;

  // Make sure the players' houses are in a pact
  const pact = await Database.pact.getPactBetweenHouses(
    playerData.house,
    playerMention.house
  );

  if (pact === null) {
    return {
      reply: `Your house is not in a pact with <@&${playerMention.house}>!`,
      success: true,
    };
  }
  // Make sure the player has ships
  const pShips = playerData.ships;
  let roleLimit = assets.roleShipLimits.unsworn;
  const playerRoles: string[] = await game_tasks.getAllPlayerRoleNames(
    interaction,
    interaction.user
  );

  if (playerRoles.includes('duke')) {
    roleLimit = assets.roleShipLimits.duke;
  } else if (playerRoles.includes('earl')) {
    roleLimit = assets.roleShipLimits.earl;
  } else if (playerRoles.includes('baron')) {
    roleLimit = assets.roleShipLimits.baron;
  }

  if (pShips <= 0) {
    return { reply: 'You do not have any ships to trade with', success: true };
  }

  // Ensure the args are valid
  if (numShips > roleLimit) {
    return {
      reply: `You may only use at most ${roleLimit} ships`,
      success: true,
    };
  }

  if (pShips < numShips) {
    return {
      reply: `You only have ${pShips} ${assets.emojis.Warship} available`,
      success: true,
    };
  }
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
  playerData.money += traderPay;
  playerMention.money += tradeePay;
  const replyTemplate = utils.randomElement(flavor.trade);
  const reply = utils.templateReplace(replyTemplate, {
    traderPay,
    tradeePay,
    trader: `<@${playerData.user}>`,
    tradee: `<@${playerMention.user}>`,
  });
  await Database.playerData.saveMultiple([playerData, playerMention]);

  return { reply, success: true };
};

export const dispatch: CommandDispatch = {
  arson: {
    function: arson,
    cooldown: {
      time: utils.hoursToMs(assets.timeoutLengths.arson),
      field: 'arson_last_time',
      reply: 'The fire watch is on high alert. ' + 'They are due to leave in',
    },
    allowed_channels: assets.playerInteractChannels,
    slashCommandBuilder: new SlashCommandBuilder()
      .setName('arson')
      .setDescription('arson the things')
      .addUserOption((option) =>
        option
          .setName('player')
          .setDescription('player to arson')
          .setRequired(true)
      )
      .addRoleOption((option) =>
        option.setName('role').setDescription('role to arson').setRequired(true)
      ),
  },
  gift: {
    function: gift,
    allowed_channels: assets.playerInteractChannels,
    slashCommandBuilder: new SlashCommandBuilder()
      .setName('gift')
      .setDescription('gift the things')
      .addUserOption((option) =>
        option
          .setName('player')
          .setDescription('player to gift')
          .setRequired(true)
      )
      .addNumberOption((option) =>
        option
          .setName('amount')
          .setDescription('amount to gift')
          .setRequired(true)
          .setMinValue(1)
      ),
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
    allowed_channels: assets.playerInteractChannels,
    slashCommandBuilder: new SlashCommandBuilder()
      .setName('raid')
      .setDescription('raid the things')
      .addUserOption((option) =>
        option
          .setName('player')
          .setDescription('player to raid')
          .setRequired(true)
      ),
  },
  scandal: {
    function: scandal,
    cooldown: {
      time: utils.hoursToMs(assets.timeoutLengths.scandal),
      field: 'scandal_last_time',
      reply: 'The fire watch is on high alert. ' + 'They are due to leave in',
    },
    allowed_channels: assets.playerInteractChannels,
    slashCommandBuilder: new SlashCommandBuilder()
      .setName('scandal')
      .setDescription('scandal the things')
      .addUserOption((option) =>
        option
          .setName('player')
          .setDescription('player to scandal')
          .setRequired(true)
      ),
  },
  spy: {
    function: spy,
    cooldown: {
      time: utils.hoursToMs(assets.timeoutLengths.spy),
      field: 'spy_last_time',
      reply: 'The spy is out to lunch and will be back in',
    },
    allowed_channels: assets.playerInteractChannels,
    slashCommandBuilder: new SlashCommandBuilder()
      .setName('spy')
      .setDescription('spy the things')
      .addUserOption((option) =>
        option
          .setName('player')
          .setDescription('player to spy')
          .setRequired(true)
      ),
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
    allowed_channels: assets.playerInteractChannels,
    slashCommandBuilder: new SlashCommandBuilder()
      .setName('thief')
      .setDescription('thief the things')
      .addUserOption((option) =>
        option
          .setName('player')
          .setDescription('player to thief')
          .setRequired(true)
      ),
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
    allowed_channels: assets.playerInteractChannels,
    slashCommandBuilder: new SlashCommandBuilder()
      .setName('trade')
      .setDescription('trade the things')
      .addUserOption((option) =>
        option
          .setName('player')
          .setDescription('player to trade')
          .setRequired(true)
      )
      .addNumberOption((option) =>
        option
          .setName('ships')
          .setDescription('number of ships to use in the trade')
          .setRequired(true)
          .setMinValue(1)
      ),
  },
};
