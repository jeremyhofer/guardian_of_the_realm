const assets = require("../assets.js");
const utils = require("../utils.js");

/*
 * Give another player money
 * @player <VALUE>
 */
const gift = ({args, player_data, player_mention}) => {
  const command_return = {
    "update": {
      "player_data": {...player_data}
    },
    "reply": ""
  };

  if(Object.keys(player_mention).length) {
    command_return.update.player_mention = {...player_mention};
    // Make sure the player has enough money
    const p_money = player_data.money;
    if(p_money > 0) {
      // Ensure the args are valid
      if(Array.isArray(args) && args.length === 2) {
        const amount_to_give = parseInt(args[1], 10);

        if(isNaN(amount_to_give) || amount_to_give < 1) {
          command_return.reply = "Amount to give must be a positive number";
        } else if(p_money >= amount_to_give) {
          // All good! Grant the cash
          command_return.update.player_data.money -= amount_to_give;
          command_return.update.player_mention.money += amount_to_give;
          command_return.reply = "You successfully gave " +
            `<@${player_mention.user}> ${amount_to_give} :moneybag:`;
        } else {
          command_return.reply = `You only have ${p_money} available`;
        }
      } else {
        command_return.reply = "gift usage: .gift @player <money amount>";
      }
    } else {
      command_return.reply = "You do not have any money to gift";
    }
  } else {
    command_return.reply = "You must @ mention another player";
  }

  return command_return;
};

/*
 * Destroy ships! fail_risk = yours / (theirs + 2*yours)
 * fail lose 5-15, other 1-9. win lose 1-9, other 10-20
 * <PLAYER>
 */
const pirate = ({player_data, player_mention}) => {
  const command_return = {
    "update": {
      "player_data": {...player_data}
    },
    "reply": "",
    "success": false
  };

  if(Object.keys(player_mention).length) {
    command_return.update.player_mention = {...player_mention};
    // Make sure both have enough ships
    const p_ships = player_data.ships;
    const m_ships = player_mention.ships;
    if(p_ships >= 5) {
      if(m_ships >= 5) {
        // Both have at least 5 ship. Figure out who wins!
        let fail_risk = Math.round(p_ships /
          (m_ships + (2 * p_ships)) * 100);

        if(fail_risk < 0) {
          fail_risk = 0;
        } else if(fail_risk > 100) {
          fail_risk = 100;
        }

        const chance = utils.get_random_value_in_range(1, 100);

        let player_lose = 0;
        let mention_lose = 0;
        let winner = 'player';

        if(chance >= fail_risk) {
          // Player wins! Adjust ships
          player_lose = utils.get_random_value_in_range(0, 5);
          mention_lose = utils.get_random_value_in_range(5, 10);
        } else {
          // Mention wins! Adjust ships
          player_lose = utils.get_random_value_in_range(5, 8);
          mention_lose = utils.get_random_value_in_range(3, 6);
          winner = 'mention';
        }

        player_lose = player_lose > p_ships
          ? p_ships
          : player_lose;

        mention_lose = mention_lose > m_ships
          ? m_ships
          : mention_lose;

        command_return.update.player_data.ships -= player_lose;
        command_return.update.player_mention.ships -= mention_lose;
        command_return.reply = winner === 'player'
          ? `Your pirate adventures were successful! You lost ${player_lose} ` +
            `ships. <@${player_mention.user}> lost ${mention_lose} ships.`
          : `Your pirate adventures were thwarted. You lost ${player_lose} ` +
            `ships. <@${player_mention.user}> lost ${mention_lose} ships.`;
        command_return.success = true;
      } else {
        command_return.reply = "The other player must have at least 5 ships";
      }
    } else {
      command_return.reply = "You must have a least 5 ships to launch a pirate raid.";
    }
  } else {
    command_return.reply = "You must @ mention another player";
  }

  return command_return;
};

/*
 * Destroy men! fail_risk = yours / (theirs + 2*yours)
 * fail lose 50-150, other 10-90. win lose 10-90, other 100-150
 * <PLAYER>.
 */
const raid = ({player_data, player_mention}) => {
  const command_return = {
    "update": {
      "player_data": {...player_data}
    },
    "reply": "",
    "success": false
  };

  if(Object.keys(player_mention).length) {
    command_return.update.player_mention = {...player_mention};
    // Make sure both have enough men
    const p_men = player_data.men;
    const m_men = player_mention.men;
    if(p_men >= 50) {
      if(m_men >= 50) {
        // Both have at least 50 men. Figure out who wins!
        let fail_risk = Math.round(p_men /
          (m_men + (2 * p_men)) * 100);

        if(fail_risk < 0) {
          fail_risk = 0;
        } else if(fail_risk > 100) {
          fail_risk = 100;
        }

        const chance = utils.get_random_value_in_range(1, 100);

        let player_lose = 0;
        let mention_lose = 0;
        let winner = 'player';

        if(chance >= fail_risk) {
          // Player wins! Adjust men
          player_lose = utils.get_random_value_in_range(0, 50);
          mention_lose = utils.get_random_value_in_range(50, 100);
        } else {
          // Mention wins! Adjust men
          player_lose = utils.get_random_value_in_range(50, 80);
          mention_lose = utils.get_random_value_in_range(30, 60);
          winner = 'mention';
        }

        player_lose = player_lose > p_men
          ? p_men
          : player_lose;

        mention_lose = mention_lose > m_men
          ? m_men
          : mention_lose;

        command_return.update.player_data.men -= player_lose;
        command_return.update.player_mention.men -= mention_lose;
        command_return.reply = winner === 'player'
          ? `You successfully raided the encampment! You lost ${player_lose} ` +
            `men. <@${player_mention.user}> lost ${mention_lose} men.`
          : "Scouts spotted your raid part. Defenses were prepared. You lost " +
            `${player_lose} men. <@${player_mention.user}> lost ` +
            `${mention_lose} men.`;
        command_return.success = true;
      } else {
        command_return.reply = "The other player must have at least 50 men.";
      }
    } else {
      command_return.reply = "You must have at least 50 men to launch a raid.";
    }
  } else {
    command_return.reply = "You must @ mention another player";
  }

  return command_return;
};

/*
 * View money, ships, men of a player. costs 400
 * <PLAYER>
 */
const spy = ({player_data, player_mention}) => {
  const command_return = {
    "update": {
      "player_data": {...player_data}
    },
    "reply": "",
    "success": false
  };

  if(Object.keys(player_mention).length) {
    command_return.update.player_mention = {...player_mention};
    // Make sure both have enough money
    const p_money = player_data.money;
    if(p_money >= 200) {
      command_return.update.player_data.money -= 200;
      command_return.reply = `<@${player_mention.user}> has ` +
        `${player_mention.money} :moneybag: ${player_mention.men} ` +
        `${assets.emojis.MenAtArms} ${player_mention.ships} ` +
        `${assets.emojis.Warship}`;
      command_return.success = true;
    } else {
      command_return.reply = "You do not have enough money. spy costs 200.";
    }
  } else {
    command_return.reply = "You must @ mention another player";
  }

  return command_return;
};

/*
 * Steal money from someone. fail_risk = yours / (theirs + yours)
 * on succeed, take 2-10%. fail pay 100-1000 to player
 * <PLAYER>
 */
const thief = ({player_data, player_mention}) => {
  const command_return = {
    "update": {
      "player_data": {...player_data}
    },
    "reply": "",
    "success": false
  };

  if(Object.keys(player_mention).length) {
    command_return.update.player_mention = {...player_mention};
    // Make sure both have enough money, and no debt.
    const p_money = player_data.money;
    const m_money = player_mention.money;
    if(p_money >= 0) {
      if(m_money > 0) {
        // Both have at least some money. Figure out who wins!
        let fail_risk = Math.round(p_money /
          (m_money + p_money) * 100);

        if(fail_risk < 0) {
          fail_risk = 0;
        } else if(fail_risk > 100) {
          fail_risk = 100;
        }

        const chance = utils.get_random_value_in_range(1, 100);

        let money_change = 0
        let winner = 'player';

        if(chance >= fail_risk) {
          // Player wins! Adjust money
          money_change = utils.get_percent_of_value_given_range(m_money, 2, 10);
        } else {
          // Mention wins! Adjust money
          money_change = utils.get_random_value_in_range(100, 1000);
          winner = 'mention';
        }

        if(winner === 'player') {
          money_change = money_change > m_money
            ? m_money
            : money_change;
          command_return.update.player_data.money += money_change;
          command_return.update.player_mention.money -= money_change;
        } else {
          command_return.update.player_data.money -= money_change;
          command_return.update.player_mention.money += money_change;
        }

        command_return.reply = winner === 'player'
          ? `You successfully raided the cophers! You stole ${money_change} ` +
            `from <@${player_mention.user}>.`
          : "You were caught by the guards. You paid a fine of " +
            `${money_change} to <@${player_mention.user}>.`

        command_return.success = true;
      } else {
        command_return.reply = "The other player does not have any money";
      }
    } else {
      command_return.reply = "You are in debt. You should find other ways " +
        "to make money";
    }
  } else {
    command_return.reply = "You must @ mention another player";
  }

  return command_return;
};

module.exports = {
  "dispatch": {
    "gift": {
      "function": gift,
      "args": [
        "args",
        "player_data",
        "player_mention"
      ],
      "allowed_channels": assets.player_interact_channels
    },
    "pirate": {
      "function": pirate,
      "cooldown": {
        "time": utils.hours_to_ms(24),
        "field": "pirate_last_time",
        "reply": "Pirating now would not be wise as the navy is patroling. " +
          "They are due to leave in"
      },
      "args": [
        "player_data",
        "player_mention"
      ],
      "allowed_channels": assets.player_interact_channels
    },
    "raid": {
      "function": raid,
      "cooldown": {
        "time": utils.hours_to_ms(24),
        "field": "raid_last_time",
        "reply": "Your troops are still resting from the last raid. " +
          "Your party may leave again in"
      },
      "args": [
        "player_data",
        "player_mention"
      ],
      "allowed_channels": assets.player_interact_channels
    },
    "spy": {
      "function": spy,
      "cooldown": {
        "time": utils.hours_to_ms(1),
        "field": "spy_last_time",
        "reply": "The spy is out to lunch and will be back in"
      },
      "args": [
        "player_data",
        "player_mention"
      ],
      "allowed_channels": assets.player_interact_channels
    },
    "thief": {
      "function": thief,
      "cooldown": {
        "time": utils.hours_to_ms(24),
        "field": "thief_last_time",
        "reply": "The guards are on the aleart for thieves. Maybe you can try again in"
      },
      "args": [
        "player_data",
        "player_mention"
      ],
      "allowed_channels": assets.player_interact_channels
    }
  }
};
