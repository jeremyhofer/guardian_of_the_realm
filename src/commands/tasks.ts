import * as assets from '../assets';
import * as utils from '../utils';
import * as flavor from '../data/flavor.json';
import { CommandDispatch, CommandReturn } from '../types';
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { Database } from '../data-source';

/*
 * Possibly earn money. 1h cooldown
 * min: 0, max: 200
 */
const pray = async (
  interaction: ChatInputCommandInteraction
): Promise<CommandReturn> => {
  const playerData = await Database.playerData.getOrCreatePlayer(
    interaction.user.id
  );

  /*
   * Determine payout. Set last time and new money amount.
   * Let player know and save to database.
   */
  const payout = utils.getRandomValueInRange(
    assets.rewardPayoutsPenalties.pray_reward_min,
    assets.rewardPayoutsPenalties.pray_reward_max
  );
  playerData.money += payout;
  const replyTemplate = utils.randomElement(flavor.pray);
  const reply = utils.templateReplace(replyTemplate, {
    amount: payout,
  });

  await Database.playerData.setPlayer(playerData);

  return { reply, success: true };
};

/*
 * Possible earn money. 12h cooldown
 * min: 1000, max: 4000. 50/50. fine 200-1000
 */
const subvert = async (
  interaction: ChatInputCommandInteraction
): Promise<CommandReturn> => {
  const playerData = await Database.playerData.getOrCreatePlayer(
    interaction.user.id
  );

  let reply = '';

  // Determine if this is a successful attempt
  const chance = utils.getRandomValueInRange(1, 100);
  if (chance >= 50) {
    // Success! Pay reward
    const payout = utils.getRandomValueInRange(
      assets.rewardPayoutsPenalties.subvert_reward_min,
      assets.rewardPayoutsPenalties.subvert_reward_max
    );
    playerData.money += payout;
    const replyTemplate = utils.randomElement(flavor.subvert_success);
    reply = utils.templateReplace(replyTemplate, {
      amount: payout,
    });
  } else {
    // Failure. Take penalty.
    const penalty = utils.getRandomValueInRange(
      assets.rewardPayoutsPenalties.subvert_penalty_min,
      assets.rewardPayoutsPenalties.subvert_penalty_max
    );
    playerData.money -= penalty;
    const replyTemplate = utils.randomElement(flavor.subvert_fail);
    reply = utils.templateReplace(replyTemplate, {
      amount: penalty,
    });
  }

  await Database.playerData.setPlayer(playerData);

  return { reply, success: true };
};

/*
 * Possible earn men. 12h cooldown. 20% fail risk - fine 10-100
 * min: 1, max : 20
 */
const train = async (
  interaction: ChatInputCommandInteraction
): Promise<CommandReturn> => {
  const playerData = await Database.playerData.getOrCreatePlayer(
    interaction.user.id
  );

  let reply = '';

  // Determine if this is a successful attempt
  const chance = utils.getRandomValueInRange(1, 100);
  if (chance >= 20) {
    // Success! Pay reward
    const payout = utils.getRandomValueInRange(
      assets.rewardPayoutsPenalties.train_reward_min,
      assets.rewardPayoutsPenalties.train_reward_max
    );
    playerData.men += payout;
    const replyTemplate = utils.randomElement(flavor.train_success);
    reply = utils.templateReplace(replyTemplate, {
      amount: payout,
      eMenAtArms: assets.emojis.MenAtArms,
    });
  } else {
    // Failure. Take penalty.
    const penalty = utils.getRandomValueInRange(
      assets.rewardPayoutsPenalties.train_penalty_min,
      assets.rewardPayoutsPenalties.train_penalty_max
    );
    playerData.money -= penalty;
    const replyTemplate = utils.randomElement(flavor.train_fail);
    reply = utils.templateReplace(replyTemplate, {
      amount: penalty,
    });
  }

  await Database.playerData.setPlayer(playerData);

  return { reply, success: true };
};

/*
 * Gain money. 6h cooldown
 * min: 500, max: 2000
 */
const work = async (
  interaction: ChatInputCommandInteraction
): Promise<CommandReturn> => {
  const playerData = await Database.playerData.getOrCreatePlayer(
    interaction.user.id
  );

  /*
   * Determine payout. Set last time and new money amount.
   * Let player know and save to database.
   */
  const payout = utils.getRandomValueInRange(
    assets.rewardPayoutsPenalties.work_reward_min,
    assets.rewardPayoutsPenalties.work_reward_max
  );
  playerData.money += payout;
  const replyTemplate = utils.randomElement(flavor.work);
  const reply = utils.templateReplace(replyTemplate, {
    amount: payout,
  });

  await Database.playerData.setPlayer(playerData);

  return { reply, success: true };
};

export const dispatch: CommandDispatch = {
  pray: {
    type: 'slash',
    function: pray,
    cooldown: {
      time: utils.hoursToMs(assets.timeoutLengths.pray),
      field: 'pray_last_time',
      reply: 'No one is around to hear your prayers for another',
    },
    args: ['playerData'],
    command_args: [[]],
    usage: [''],
    slashCommandBuilder: new SlashCommandBuilder()
      .setName('pray')
      .setDescription('pray the things'),
  },
  subvert: {
    type: 'slash',
    function: subvert,
    cooldown: {
      time: utils.hoursToMs(assets.timeoutLengths.subvert),
      field: 'subvert_last_time',
      reply:
        'The watch is in high presence right now. You should try again in another',
    },
    args: ['playerData'],
    command_args: [[]],
    usage: [''],
    slashCommandBuilder: new SlashCommandBuilder()
      .setName('subvert')
      .setDescription('subvert the things'),
  },
  train: {
    type: 'slash',
    function: train,
    cooldown: {
      time: utils.hoursToMs(assets.timeoutLengths.train),
      field: 'train_last_time',
      reply: 'You have been training tirelessly. You should rest for ',
    },
    args: ['playerData'],
    command_args: [[]],
    usage: [''],
    slashCommandBuilder: new SlashCommandBuilder()
      .setName('train')
      .setDescription('train the things'),
  },
  work: {
    type: 'slash',
    function: work,
    cooldown: {
      time: utils.hoursToMs(assets.timeoutLengths.work),
      field: 'work_last_time',
      reply: 'You continue to slave away, but you will not be paid for another',
    },
    args: ['playerData'],
    command_args: [[]],
    usage: [''],
    slashCommandBuilder: new SlashCommandBuilder()
      .setName('work')
      .setDescription('work the things'),
  },
};
