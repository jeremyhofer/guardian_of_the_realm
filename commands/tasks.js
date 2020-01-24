const assets = require('../assets.js');
const utils = require('../utils.js');
const flavor = require('../data/flavor.json');

/*
 * Possibly earn money. 1h cooldown
 * min: 0, max: 200
 */
const pray = ({player_data}) => {
  const command_return = {
    "reply": "",
    "update": {
      "player_data": {...player_data}
    },
    "success": true
  };

  /*
   * Determine payout. Set last time and new money amount.
   * Let player know and save to database.
   */
  const payout = utils.get_random_value_in_range(
    assets.reward_payouts_penalties.pray_reward_min,
    assets.reward_payouts_penalties.pray_reward_max
  );
  command_return.update.player_data.money += payout;
  const reply_template = utils.random_element(flavor.pray);
  command_return.reply = utils.template_replace(
    reply_template,
    {"amount": payout}
  );

  return command_return;
};

/*
 * Possible earn money. 12h cooldown
 * min: 1000, max: 4000. 50/50. fine 200-1000
 */
const subvert = ({player_data}) => {
  const command_return = {
    "reply": "",
    "update": {
      "player_data": {...player_data}
    },
    "success": true
  };

  // Determine if this is a successful attempt
  const chance = utils.get_random_value_in_range(1, 100);
  if(chance >= 50) {
    // Success! Pay reward
    const payout = utils.get_random_value_in_range(
      assets.reward_payouts_penalties.subvert_reward_min,
      assets.reward_payouts_penalties.subvert_reward_max
    );
    command_return.update.player_data.money += payout;
    const reply_template = utils.random_element(flavor.subvert_success);
    command_return.reply = utils.template_replace(
      reply_template,
      {"amount": payout}
    );
  } else {
    // Failure. Take penalty.
    const penalty = utils.get_random_value_in_range(
      assets.reward_payouts_penalties.subvert_penalty_min,
      assets.reward_payouts_penalties.subvert_penalty_max
    );
    command_return.update.player_data.money -= penalty;
    const reply_template = utils.random_element(flavor.subvert_fail);
    command_return.reply = utils.template_replace(
      reply_template,
      {"amount": penalty}
    );
  }

  return command_return;
};

/*
 * Possible earn men. 12h cooldown. 20% fail risk - fine 10-100
 * min: 1, max : 20
 */
const train = ({player_data}) => {
  const command_return = {
    "reply": "",
    "update": {
      "player_data": {...player_data}
    },
    "success": true
  };

  // Determine if this is a successful attempt
  const chance = utils.get_random_value_in_range(1, 100);
  if(chance >= 20) {
    // Success! Pay reward
    const payout = utils.get_random_value_in_range(
      assets.reward_payouts_penalties.train_reward_min,
      assets.reward_payouts_penalties.train_reward_max
    );
    command_return.update.player_data.men += payout;
    const reply_template = utils.random_element(flavor.train_success);
    command_return.reply = utils.template_replace(
      reply_template,
      {
        "amount": payout,
        "e_MenAtArms": assets.emojis.MenAtArms
      }
    );
  } else {
    // Failure. Take penalty.
    const penalty = utils.get_random_value_in_range(
      assets.reward_payouts_penalties.train_penalty_min,
      assets.reward_payouts_penalties.train_penalty_max
    );
    command_return.update.player_data.money -= penalty;
    const reply_template = utils.random_element(flavor.train_fail);
    command_return.reply = utils.template_replace(
      reply_template,
      {"amount": penalty}
    );
  }

  return command_return;
};

/*
 * Gain money. 6h cooldown
 * min: 500, max: 2000
 */
const work = ({player_data}) => {
  const command_return = {
    "reply": "",
    "update": {
      "player_data": {...player_data}
    },
    "success": true
  };

  /*
   * Determine payout. Set last time and new money amount.
   * Let player know and save to database.
   */
  const payout = utils.get_random_value_in_range(
    assets.reward_payouts_penalties.work_reward_min,
    assets.reward_payouts_penalties.work_reward_max
  );
  command_return.update.player_data.money += payout;
  const reply_template = utils.random_element(flavor.work);
  command_return.reply = utils.template_replace(
    reply_template,
    {"amount": payout}
  );

  return command_return;
};

module.exports = {
  "dispatch": {
    "pray": {
      "function": pray,
      "cooldown": {
        "time": utils.hours_to_ms(assets.timeout_lengths.pray),
        "field": "pray_last_time",
        "reply": "No one is around to hear your prayers for another"
      },
      "args": ["player_data"],
      "command_args": [[]],
      "usage": [""]
    },
    "subvert": {
      "function": subvert,
      "cooldown": {
        "time": utils.hours_to_ms(assets.timeout_lengths.subvert),
        "field": "subvert_last_time",
        "reply": "The watch is in high presence right now. You should try " +
          "again in another"
      },
      "args": ["player_data"],
      "command_args": [[]],
      "usage": [""]
    },
    "train": {
      "function": train,
      "cooldown": {
        "time": utils.hours_to_ms(assets.timeout_lengths.train),
        "field": "train_last_time",
        "reply": "You have been training tirelessly. You should rest for "
      },
      "args": ["player_data"],
      "command_args": [[]],
      "usage": [""]
    },
    "work": {
      "function": work,
      "cooldown": {
        "time": utils.hours_to_ms(assets.timeout_lengths.work),
        "field": "work_last_time",
        "reply": "You continue to slave away, but you will not be paid for " +
          "another"
      },
      "args": ["player_data"],
      "command_args": [[]],
      "usage": [""]
    }
  }
};
