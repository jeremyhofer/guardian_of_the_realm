const args_js = require('../args.js');
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
  const payout = utils.get_random_value_in_range(0, 200);
  command_return.update.player_data.money += payout;
  const reply_template = utils.random_element(flavor.pray);
  command_return.reply = utils.template_replace(
    reply_template,
    {"amount": payout}
  );

  return command_return;
};

/*
 * Send ships to try and steal money. 50/50 success. lose lose ships, win
 * gain money <SHIPS>. win ships * (400 - 1000). fail lose 10-20% ships.
 * 24hr cooldown
 */
const smuggle = ({args, player_data}) => {
  const command_return = {
    "reply": "",
    "update": {
      "player_data": {...player_data}
    },
    "success": false
  };

  // Check to make sure the player has enough ships
  const [num_ships] = args;

  if(isNaN(num_ships) || num_ships < 1) {
    command_return.reply = "The number of ships must be a positive number";
  } else if(player_data.ships >= num_ships) {
    // Player has enough ships. See if they win or lose!
    const chance = utils.get_random_value_in_range(1, 100);
    if(chance >= 50) {
      // They win! Determine payout
      const payout = utils.get_random_value_in_range(400, 1000) * num_ships;
      command_return.update.player_data.money += payout;
      const reply_template = utils.random_element(flavor.smuggle_success);
      command_return.reply = utils.template_replace(
        reply_template,
        {"amount": payout}
      );
    } else {
      // They lose! Determine penalty
      const penalty = utils.get_percent_of_value_given_range(
        num_ships,
        10,
        20
      );
      command_return.update.player_data.ships -= penalty;
      const reply_template = utils.random_element(flavor.smuggle_fail);
      command_return.reply = utils.template_replace(
        reply_template,
        {
          "amount": penalty,
          "e_Warship": assets.emojis.Warship
        }
      );
    }
    command_return.success = true;
  } else {
    command_return.reply = `You do not have ${num_ships} available`;
  }

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
    const payout = utils.get_random_value_in_range(1000, 4000);
    command_return.update.player_data.money += payout;
    const reply_template = utils.random_element(flavor.subvert_success);
    command_return.reply = utils.template_replace(
      reply_template,
      {"amount": payout}
    );
  } else {
    // Failure. Take penalty.
    const penalty = utils.get_random_value_in_range(200, 1000);
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
    const payout = utils.get_random_value_in_range(1, 20);
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
    const penalty = utils.get_random_value_in_range(10, 100);
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
  const payout = utils.get_random_value_in_range(500, 2000);
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
        "time": utils.hours_to_ms(1),
        "field": "pray_last_time",
        "reply": "No one is around to hear your prayers for another"
      },
      "args": ["player_data"],
      "command_args": [[]],
      "usage": [""]
    },
    "smuggle": {
      "function": smuggle,
      "cooldown": {
        "time": utils.hours_to_ms(24),
        "field": "smuggle_last_time",
        "reply": "Your sailors are busy swabbing the poop deck. They say " +
          "they may set sail again in"
      },
      "args": [
        "args",
        "player_data"
      ],
      "command_args": [[args_js.arg_types.number]],
      "usage": ["NUMBER_OF_SHIPS"]
    },
    "subvert": {
      "function": subvert,
      "cooldown": {
        "time": utils.hours_to_ms(12),
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
        "time": utils.hours_to_ms(12),
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
        "time": utils.hours_to_ms(6),
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
