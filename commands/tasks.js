const utils = require('../utils.js');

/*
 * Possibly earn money. 1h cooldown
 * min: 0, max: 200
 */
const pray = ({player_data}) => {
  const command_return = {
    "reply": "",
    "update": {
      "player_data": {...player_data}
    }
  };

  // Ensure the minimum cooldown time has been passed
  const cooldown = 1 * (60 * 60 * 1000);
  const current_time = Date.now();
  const last_time = player_data.pray_last_time;

  if(current_time - last_time >= cooldown) {

    /*
     * Determine payout. Set last time and new money amount.
     * Let player know and save to database.
     */
    command_return.update.player_data.pray_last_time = current_time;
    const payout = utils.get_random_value_in_range(0, 200);
    command_return.update.player_data.money += payout;
    const player_money = command_return.update.player_data.money;
    command_return.reply = "Your prayers were heard! " +
      `You received ${payout} bringing you to ${player_money}`;
  } else {
    // Not enough time has passed. Let player know
    const time_until = last_time + cooldown - current_time;
    const time_until_string = utils.get_time_until_string(time_until);
    command_return.reply = "No one is around to hear your prayers " +
      "for another " + time_until_string;
  }

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
    }
  };

  // Ensure the minimum cooldown time has been passed
  const cooldown = 24 * (60 * 60 * 1000);
  const current_time = Date.now();
  const last_time = player_data.smuggle_last_time;

  if(current_time - last_time >= cooldown) {
    if (Array.isArray(args) && args.length === 1) {
      // Check to make sure the player has enough ships
      const num_ships = parseInt(args[0], 10);

      if(isNaN(num_ships) || num_ships < 1) {
        command_return.reply = "number of ships must be a positive number";
      } else if(player_data.ships >= num_ships) {
        // Player has enough ships. See if they win or lose!
        const chance = utils.get_random_value_in_range(1, 100);
        if(chance >= 50) {
          // They win! Determine payout
          const payout = utils.get_random_value_in_range(400, 1000) * num_ships;
          command_return.update.player_data.money += payout;
          command_return.reply = "Arg matey! You successfully plundered " +
            `${payout}!`;
        } else {
          // They lose! Determine penalty
          const penalty = utils.get_percent_of_value_given_range(
            num_ships,
            10,
            20
          );
          command_return.update.player_data.ships -= penalty;
          command_return.reply = "You lost the favor of Calypso today. " +
            `${penalty} of your ships were sent to Davy Jones' locker`;
        }

        command_return.update.player_data.smuggle_last_time =
          current_time;
      } else {
        command_return.reply = `you do not have ${num_ships} available`;
      }
    } else {
      command_return.reply = "smuggle takes one argument: number of ships";
    }
  } else {
    const time_until = last_time + cooldown - current_time;
    const time_until_string = utils.get_time_until_string(time_until);
    command_return.reply = "Your sailors are busy swabbing the poop deck. " +
      "They say they may set sail again in " + time_until_string;
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
    }
  };

  // Ensure the minimum cooldown time has been passed
  const cooldown = 12 * (60 * 60 * 1000);
  const current_time = Date.now();
  const last_time = player_data.subvert_last_time;

  if(current_time - last_time >= cooldown) {
    // Determine if this is a successful attempt
    const chance = utils.get_random_value_in_range(1, 100);
    if(chance >= 50) {
      // Success! Pay reward
      const payout = utils.get_random_value_in_range(1000, 4000);
      command_return.update.player_data.money += payout;
      const player_money = command_return.update.player_data.money;
      command_return.reply = "You caught the ear of a wealthy noble. " +
        `They granted you ${payout} bringing you to ${player_money}`;
    } else {
      // Failure. Take penalty.
      const penalty = utils.get_random_value_in_range(200, 1000);
      command_return.update.player_data.money -= penalty;
      const player_money = command_return.update.player_data.money;
      command_return.reply = "The watch have caught on to your ways. You " +
        `have been tried and fined ${penalty} bringing you to ` +
        `${player_money}`;
    }
    command_return.update.player_data.subvert_last_time =
      current_time;
  } else {
    const time_until = last_time + cooldown - current_time;
    const time_until_string = utils.get_time_until_string(time_until);
    command_return.reply = "The watch is in high presence right now. " +
      "You should try again in another " + time_until_string;
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
    }
  };

  // Ensure the minimum cooldown time has been passed
  const cooldown = 12 * (60 * 60 * 1000);
  const current_time = Date.now();
  const last_time = player_data.train_last_time;

  if(current_time - last_time >= cooldown) {
    // Determine if this is a successful attempt
    const chance = utils.get_random_value_in_range(1, 100);
    if(chance >= 20) {
      // Success! Pay reward
      const payout = utils.get_random_value_in_range(1, 20);
      command_return.update.player_data.men += payout;
      const player_men = command_return.update.player_data.men;
      command_return.reply = `You have successfully recruited ${payout} ` +
        `men to your cause bringing you to ${player_men} men`;
    } else {
      // Failure. Take penalty.
      const penalty = utils.get_random_value_in_range(10, 100);
      command_return.update.player_data.money -= penalty;
      const player_money = command_return.update.player_data.money;
      command_return.reply = "You spoke with a variety of people, but " +
        `none joined your cause. You spent ${penalty} in the process ` +
        `bringing you to ${player_money}`;
    }
    command_return.update.player_data.train_last_time = current_time;
  } else {
    const time_until = last_time + cooldown - current_time;
    const time_until_string = utils.get_time_until_string(time_until);
    command_return.reply = "You have been training tirelessly. " +
      "You should rest for " + time_until_string;
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
    }
  };

  // Ensure the minimum cooldown time has been passed
  const cooldown = 6 * (60 * 60 * 1000);
  const current_time = Date.now();
  const last_time = player_data.work_last_time;

  if(current_time - last_time >= cooldown) {

    /*
     * Determine payout. Set last time and new money amount.
     * Let player know and save to database.
     */
    command_return.update.player_data.work_last_time = current_time;
    const payout = utils.get_random_value_in_range(500, 2000);
    command_return.update.player_data.money += payout;
    const player_money = command_return.update.player_data.money;
    command_return.reply = "Your hard work has paid off! " +
      `You received ${payout} bringing you to ${player_money}`;
  } else {
    // Not enough time has passed. Let player know
    const time_until = last_time + cooldown - current_time;
    const time_until_string = utils.get_time_until_string(time_until);
    command_return.reply = "You continue to slave away, but you will not " +
      "be paid for another " + time_until_string;
  }

  return command_return;
};

module.exports = {
  "dispatch": {
    "pray": {
      "function": pray,
      "args": ["player_data"]
    },
    "smuggle": {
      "function": smuggle,
      "args": [
        "args",
        "player_data"
      ]
    },
    "subvert": {
      "function": subvert,
      "args": ["player_data"]
    },
    "train": {
      "function": train,
      "args": ["player_data"]
    },
    "work": {
      "function": work,
      "args": ["player_data"]
    }
  }
};
