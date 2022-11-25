import * as assets from '../assets';
import * as utils from '../utils';
import * as flavor from '../data/flavor.json';
import { CommandDispatch, CommandReturn } from '../types';
import { PlayerData } from '../entity/PlayerData';

/*
 * Possibly earn money. 1h cooldown
 * min: 0, max: 200
 */
const pray = async({ playerData }: { playerData: PlayerData }): Promise<CommandReturn> => {
  const commandReturn: CommandReturn = {
    reply: '',
    update: {
      playerData
    },
    success: true
  };

  /*
   * Determine payout. Set last time and new money amount.
   * Let player know and save to database.
   */
  const payout = utils.getRandomValueInRange(
    assets.rewardPayoutsPenalties.pray_reward_min,
    assets.rewardPayoutsPenalties.pray_reward_max
  );
  (commandReturn.update?.playerData as PlayerData).money += payout;
  const replyTemplate = utils.randomElement(flavor.pray);
  commandReturn.reply = utils.templateReplace(
    replyTemplate,
    { amount: payout }
  );

  return commandReturn;
};

/*
 * Possible earn money. 12h cooldown
 * min: 1000, max: 4000. 50/50. fine 200-1000
 */
const subvert = async({ playerData }: { playerData: PlayerData }): Promise<CommandReturn> => {
  const commandReturn: CommandReturn = {
    reply: '',
    update: {
      playerData
    },
    success: true
  };

  // Determine if this is a successful attempt
  const chance = utils.getRandomValueInRange(1, 100);
  if(chance >= 50) {
    // Success! Pay reward
    const payout = utils.getRandomValueInRange(
      assets.rewardPayoutsPenalties.subvert_reward_min,
      assets.rewardPayoutsPenalties.subvert_reward_max
    );
    (commandReturn.update?.playerData as PlayerData).money += payout;
    const replyTemplate = utils.randomElement(flavor.subvert_success);
    commandReturn.reply = utils.templateReplace(
      replyTemplate,
      { amount: payout }
    );
  } else {
    // Failure. Take penalty.
    const penalty = utils.getRandomValueInRange(
      assets.rewardPayoutsPenalties.subvert_penalty_min,
      assets.rewardPayoutsPenalties.subvert_penalty_max
    );
    (commandReturn.update?.playerData as PlayerData).money -= penalty;
    const replyTemplate = utils.randomElement(flavor.subvert_fail);
    commandReturn.reply = utils.templateReplace(
      replyTemplate,
      { amount: penalty }
    );
  }

  return commandReturn;
};

/*
 * Possible earn men. 12h cooldown. 20% fail risk - fine 10-100
 * min: 1, max : 20
 */
const train = async({ playerData }: { playerData: PlayerData }): Promise<CommandReturn> => {
  const commandReturn: CommandReturn = {
    reply: '',
    update: {
      playerData
    },
    success: true
  };

  // Determine if this is a successful attempt
  const chance = utils.getRandomValueInRange(1, 100);
  if(chance >= 20) {
    // Success! Pay reward
    const payout = utils.getRandomValueInRange(
      assets.rewardPayoutsPenalties.train_reward_min,
      assets.rewardPayoutsPenalties.train_reward_max
    );
    (commandReturn.update?.playerData as PlayerData).men += payout;
    const replyTemplate = utils.randomElement(flavor.train_success);
    commandReturn.reply = utils.templateReplace(
      replyTemplate,
      {
        amount: payout,
        e_MenAtArms: assets.emojis.MenAtArms
      }
    );
  } else {
    // Failure. Take penalty.
    const penalty = utils.getRandomValueInRange(
      assets.rewardPayoutsPenalties.train_penalty_min,
      assets.rewardPayoutsPenalties.train_penalty_max
    );
    (commandReturn.update?.playerData as PlayerData).money -= penalty;
    const replyTemplate = utils.randomElement(flavor.train_fail);
    commandReturn.reply = utils.templateReplace(
      replyTemplate,
      { amount: penalty }
    );
  }

  return commandReturn;
};

/*
 * Gain money. 6h cooldown
 * min: 500, max: 2000
 */
const work = async({ playerData }: { playerData: PlayerData }): Promise<CommandReturn> => {
  const commandReturn: CommandReturn = {
    reply: '',
    update: {
      playerData
    },
    success: true
  };

  /*
   * Determine payout. Set last time and new money amount.
   * Let player know and save to database.
   */
  const payout = utils.getRandomValueInRange(
    assets.rewardPayoutsPenalties.work_reward_min,
    assets.rewardPayoutsPenalties.work_reward_max
  );
  (commandReturn.update?.playerData as PlayerData).money += payout;
  const replyTemplate = utils.randomElement(flavor.work);
  commandReturn.reply = utils.templateReplace(
    replyTemplate,
    { amount: payout }
  );

  return commandReturn;
};

export const dispatch: CommandDispatch = {
  pray: {
    function: pray,
    cooldown: {
      time: utils.hoursToMs(assets.timeoutLengths.pray),
      field: 'pray_last_time',
      reply: 'No one is around to hear your prayers for another'
    },
    args: ['playerData'],
    command_args: [[]],
    usage: ['']
  },
  subvert: {
    function: subvert,
    cooldown: {
      time: utils.hoursToMs(assets.timeoutLengths.subvert),
      field: 'subvert_last_time',
      reply: 'The watch is in high presence right now. You should try again in another'
    },
    args: ['playerData'],
    command_args: [[]],
    usage: ['']
  },
  train: {
    function: train,
    cooldown: {
      time: utils.hoursToMs(assets.timeoutLengths.train),
      field: 'train_last_time',
      reply: 'You have been training tirelessly. You should rest for '
    },
    args: ['playerData'],
    command_args: [[]],
    usage: ['']
  },
  work: {
    function: work,
    cooldown: {
      time: utils.hoursToMs(assets.timeoutLengths.work),
      field: 'work_last_time',
      reply: 'You continue to slave away, but you will not be paid for another'
    },
    args: ['playerData'],
    command_args: [[]],
    usage: ['']
  }
};
