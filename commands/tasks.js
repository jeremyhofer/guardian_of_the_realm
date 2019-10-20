const utils = require('../utils.js');

module.exports = {
  pray (args, player_data) {

    /*
     * Possibly earn money. 1h cooldown
     * min: 0, max: 200
     */
    let reply = "";

    if (Array.isArray(args) && args.length) {
      reply = "pray does not take any arguments";
    } else {
      // Ensure the minimum cooldown time has been passed
      const cooldown = 1 * (60 * 60 * 1000);
      const current_time = Date.now();
      const last_time = player_data.pray_last_time;

      if(current_time - last_time >= cooldown) {

        /*
         * Determine payout. Set last time and new money amount.
         * Let player know and save to database.
         */
        player_data.pray_last_time = current_time;
        const payout = utils.get_random_value_in_range(0, 200);
        player_data.money += payout;
        reply = "Your prayers were heard! " +
          `You received ${payout} bringing you to ${player_data.money}`;
      } else {
        // Not enough time has passed. Let player know
        const time_until = last_time + cooldown - current_time;
        const time_until_string = utils.get_time_until_string(time_until);
        reply = "No one is around to hear your prayers " +
          "for another " + time_until_string;
      }
    }

    return [
      0,
      player_data,
      reply
    ];
  },
  smuggle (args, player_data) {

    /*
     * Send ships to try and steal money. 50/50 success. lose lose ships, win
     * gain money <SHIPS>. win ships * (400 - 1000). fail lose 10-20% ships
     */
    let reply = "";
    if (Array.isArray(args) && args.length === 1) {
      reply = "Arg matey! You set sail to smuggle but " +
        "forgot you were only in the bath!";
    } else {
      reply = "smuggle takes one argument: number of ships";
    }

    return [
      0,
      player_data,
      reply
    ];
  },
  subvert (args, player_data) {

    /*
     * Possible earn money. 12h cooldown
     * min: 1000, max: 4000. 50/50. fine 200-1000
     */
    let reply = "";
    if (Array.isArray(args) && args.length) {
      reply = "subvert does not take any arguments";
    } else {
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
          player_data.money += payout;
          reply = "You caught the ear of a wealthy noble. They granted you " +
            `${payout} bringing you to ${player_data.money}`;
        } else {
          // Failure. Take penalty.
          const penalty = utils.get_random_value_in_range(200, 1000);
          player_data.money -= penalty;
          reply = "The watch have caught on to your ways. You have been " +
            `tried and fined ${penalty} bringing you to ${player_data.money}`;
        }
        player_data.subvert_last_time = current_time;
      } else {
        const time_until = last_time + cooldown - current_time;
        const time_until_string = utils.get_time_until_string(time_until);
        reply = "The watch is in high presence right now. You should try " +
          "again in another " + time_until_string;
      }
    }

    return [
      0,
      player_data,
      reply
    ];
  },
  train (args, player_data) {

    /*
     * Possible earn men. 12h cooldown. 20% fail risk - fine 10-100
     * min: 1, max : 20
     */
    let reply = "";
    if (Array.isArray(args) && args.length) {
      reply = "train does not take any arguments";
    } else {
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
          player_data.men += payout;
          reply = `You have successfully recruited ${payout} men to your ` +
            `cause bringing you to ${player_data.men} men`;
        } else {
          // Failure. Take penalty.
          const penalty = utils.get_random_value_in_range(10, 100);
          player_data.money -= penalty;
          reply = "You spoke with a variety of people, but none joined your " +
            `cause. You spent ${penalty} in the process bringing you ` +
            `to ${player_data.money}`;
        }
        player_data.train_last_time = current_time;
      } else {
        const time_until = last_time + cooldown - current_time;
        const time_until_string = utils.get_time_until_string(time_until);
        reply = "You have been training tirelessly. " +
          "You should rest for " + time_until_string;
      }
    }

    return [
      0,
      player_data,
      reply
    ];
  },
  work (args, player_data) {

    /*
     * Gain money. 6h cooldown
     * min: 500, max: 2000
     */
    let reply = "";
    if (Array.isArray(args) && args.length) {
      reply = "work does not take any arguments";
    } else {
      // Ensure the minimum cooldown time has been passed
      const cooldown = 6 * (60 * 60 * 1000);
      const current_time = Date.now();
      const last_time = player_data.work_last_time;

      if(current_time - last_time >= cooldown) {

        /*
         * Determine payout. Set last time and new money amount.
         * Let player know and save to database.
         */
        player_data.work_last_time = current_time;
        const payout = utils.get_random_value_in_range(500, 2000);
        player_data.money += payout;
        reply = "Your hard work has paid off! " +
          `You received ${payout} bringing you to ${player_data.money}`;
      } else {
        // Not enough time has passed. Let player know
        const time_until = last_time + cooldown - current_time;
        const time_until_string = utils.get_time_until_string(time_until);
        reply = "You continue to slave away, but you will not be paid " +
          "for another " + time_until_string;
      }
    }

    return [
      0,
      player_data,
      reply
    ];
  }
};
