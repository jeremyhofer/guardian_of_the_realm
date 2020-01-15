const args_js = require("../args.js");
const assets = require("../assets.js");
const db = require("../database.js");
const game_tasks = require('../game_tasks.js');
const utils = require("../utils.js");
const flavor = require('../data/flavor.json');

/*
 * Attempt to destroy a person's income roles
 * Chance is X / X + Y, based on number of roles each has.
 * Cost is 1/2 the price of the building trying to be destroyed.
 * penalty??
 * Usage:
 * @player <ROLE>
 */
const arson = ({args, player_data, player_roles, guild}) => {
  const [
    player_mention,
    role_to_arson
  ] = args;

  const command_return = {
    "update": {
      "player_data": {...player_data},
      "roles": {
        "other_player": {
          "id": player_mention.user,
          "remove": []
        }
      }
    },
    "reply": "",
    "success": false
  };

  const other_player_role_ids = [];
  const income_role_ids = [];
  const target_role_name = guild.roles.get(role_to_arson).name.toLowerCase();

  for(const key in assets.store_items) {
    if(key in assets.store_items) {
      if(assets.store_items[key].type === "income") {
        const role_id = utils.find_role_id_given_name(
          key,
          assets.game_roles
        );
        income_role_ids.push(role_id);
      }
    }
  }

  /*
   * For this we are just checking the store items. The player may
   * have additional roles but they would not be in the store.
   */
  guild.members.get(player_mention.user.user).roles.forEach(role => {
    if(income_role_ids.indexOf(role.id) >= 0) {
      other_player_role_ids.push(role.id);
    }
  });

  /*
   * Ensure that the role mentioned is an income producing role
   * and that the other player has that role
   */
  if(income_role_ids.indexOf(role_to_arson) >= 0) {
    if(other_player_role_ids.indexOf(role_to_arson) >= 0) {
      // Ensure player has enough money to arson this role
      const arson_price =
        Math.round(assets.store_items[target_role_name].cost / 2);
      const player_money = player_data.money;

      if(player_money >= arson_price) {
        // Good to arson!
        let fail_risk = Math.round(player_roles.length /
          (player_roles.length + other_player_role_ids.length) * 100);

        if(fail_risk < 0) {
          fail_risk = 0;
        } else if(fail_risk > 100) {
          fail_risk = 100;
        }

        const chance = utils.get_random_value_in_range(1, 100);

        if(chance >= fail_risk) {
          // Player wins! Remove the role from the other player
          command_return.roles.other_player.remove.push(role_to_arson);
          command_return.reply =
            `You successfully burned <@${player_mention.user}>'s ` +
            `<@&${role_to_arson}> to the ground!`;
        } else {
          // Player failed! Assess a fine
          const penalty = utils.get_random_value_in_range(200, 1000);
          command_return.update.player_data.money -= penalty;
          command_return.reply =
            `You failed to burn <@${player_mention.user}>'s ` +
            `<@&${role_to_arson}> to the ground.`;
        }

        // Deduct price for the arson
        command_return.player_data.money -= arson_price;
        command_return.success = true;
      } else {
        command_return.reply =
          `You do not have enough money to arson the <@&${role_to_arson}>. ` +
          `The cost is ${arson_price}`;
      }
    } else {
      command_return.reply =
        `<@${player_mention.user}> does not have the <@&${role_to_arson}> role`;
    }
  } else {
    command_return.reply =
      `<@&${role_to_arson}> is not an income producing role`;
  }

  return command_return;
};

/*
 * Give another player money
 * @player <VALUE>
 */
const gift = ({args, player_data}) => {
  const command_return = {
    "update": {
      "player_data": {...player_data}
    },
    "reply": ""
  };

  const [
    player_mention,
    amount_to_give
  ] = args;

  command_return.update.player_mention = {...player_mention};
  // Make sure the player has enough money
  const p_money = player_data.money;
  if(player_data.user === player_mention.user) {
    command_return.reply = "You cannot gift yourself!";
  } else if(p_money > 0) {
    // Ensure the args are valid
    if(Array.isArray(args) && args.length === 2) {
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

  return command_return;
};

/*
 * Destroy ships! fail_risk = yours / (theirs + 2*yours)
 * fail lose 5-15, other 1-9. win lose 1-9, other 10-20
 * <PLAYER>
 */
const pirate = ({args, player_data}) => {
  const command_return = {
    "update": {
      "player_data": {...player_data}
    },
    "reply": "",
    "success": false
  };

  const [player_mention] = args;

  command_return.update.player_mention = {...player_mention};
  // Make sure both have enough ships
  const p_ships = player_data.ships;
  const m_ships = player_mention.ships;
  if(player_data.user === player_mention.user) {
    command_return.reply = "You cannot pirate yourself!";
  } else if(p_ships >= 5) {
    if(m_ships >= 5) {
      // Both have at least 5 ship. Figure out who wins!
      let fail_risk = Math.round(p_ships /
        (m_ships + p_ships) * 100);

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
        const reward = utils.get_random_value_in_range(2000, 3000);
        command_return.update.player_data.money += reward;
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
      const success_reply_template =
        utils.random_element(flavor.pirate_success);
      const fail_reply_template = utils.random_element(flavor.pirate_fail);
      const used_template = winner === 'player'
        ? success_reply_template
        : fail_reply_template;
      command_return.reply = utils.template_replace(
        used_template,
        {
          "myLost": player_lose,
          "enemyLost": mention_lose,
          "target_mention": `<@${player_mention.user}>`,
          "e_Warship": assets.emojis.Warship
        }
      );
      command_return.success = true;
    } else {
      command_return.reply = "The other player must have at least 5 ships";
    }
  } else {
    command_return.reply =
      "You must have a least 5 ships to launch a pirate raid.";
  }

  return command_return;
};

/*
 * Destroy men! fail_risk = yours / (theirs + 2*yours)
 * fail lose 50-150, other 10-90. win lose 10-90, other 100-150
 * <PLAYER>.
 */
const raid = ({args, player_data}) => {
  const command_return = {
    "update": {
      "player_data": {...player_data}
    },
    "reply": "",
    "success": false
  };

  const [player_mention] = args;

  command_return.update.player_mention = {...player_mention};
  // Make sure both have enough men
  const p_men = player_data.men;
  const m_men = player_mention.men;
  if(player_data.user === player_mention.user) {
    command_return.reply = "You cannot raid yourself!";
  } else if(p_men >= 50) {
    if(m_men >= 50) {
      // Both have at least 50 men. Figure out who wins!
      let fail_risk = Math.round(p_men /
        (m_men + p_men) * 100);

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
        const reward = utils.get_random_value_in_range(2000, 3000);
        command_return.update.player_data.money += reward;
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
      const success_reply_template =
        utils.random_element(flavor.raid_success);
      const fail_reply_template = utils.random_element(flavor.raid_fail);
      const used_template = winner === 'player'
        ? success_reply_template
        : fail_reply_template;
      command_return.reply = utils.template_replace(
        used_template,
        {
          "myLost": player_lose,
          "enemyLost": mention_lose,
          "target_mention": `<@${player_mention.user}>`,
          "e_MenAtArms": assets.emojis.MenAtArms
        }
      );
      command_return.success = true;
    } else {
      command_return.reply = "The other player must have at least 50 men.";
    }
  } else {
    command_return.reply = "You must have at least 50 men to launch a raid.";
  }

  return command_return;
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
const scandal = ({args, player_data, guild}) => {
  const [player_mention] = args;

  const command_return = {
    "update": {
      "player_data": {...player_data},
      "roles": {
        "other_player": {
          "id": player_mention.user,
          "add": [],
          "remove": []
        }
      }
    },
    "reply": "",
    "success": false
  };

  const noble_role_ids = [];

  for(const key in assets.store_items) {
    if(key in assets.store_items) {
      if(assets.store_items[key].type === "title") {
        const role_id = utils.find_role_id_given_name(
          key,
          assets.game_roles
        );
        noble_role_ids.push(role_id);
      }
    }
  }

  const other_player_role_ids = [];

  /*
   * For this we are just checking the store items. The player may
   * have additional roles but they would not be in the store.
   */
  guild.members.get(player_mention.user.user).roles.forEach(role => {
    if(noble_role_ids.indexOf(role.id) >= 0) {
      other_player_role_ids.push(role.id);
    }
  });

  const noble_roles = [
    "duke",
    "earl",
    "baron"
  ];

  let highest_role_id = "";
  let highest_role = "";

  for(let iter = 0; iter < noble_roles.length; iter += 1) {
    const check_role_id =
      utils.find_role_id_given_name(noble_roles[iter], assets.game_roles);
    if(other_player_role_ids.indexOf(check_role_id) >= 0) {
      highest_role = noble_roles[iter];
      highest_role_id = check_role_id;
      break;
    }
  }

  if(highest_role_id) {
    // We have a highest role to try and scandal. Make sure we have the moola
    const scandal_cost = Math.round(assets.store_items[highest_role].cost / 2);

    if(player_data.money >= scandal_cost) {
      // Determine if the scandal is a success
      const chance = utils.get_random_value_in_range(1, 100);

      if(chance >= 50) {
        // The scandal succeeded! Determine what role the other player drops to
        const current_role_index = noble_roles.indexOf(highest_role);
        const new_role = current_role_index < noble_roles.length - 1
          ? noble_roles[current_role_index - 1]
          : "unsworn";

        if(new_role !== "unsworn") {
          command_return.roles.other_player.add.push(new_role);
        }
        command_return.roles.other_player.remove.push(highest_role);
        command_return.reply = `Your scandal was successful!`;
      } else {
        const penalty = utils.get_random_value_in_range(200, 1000);
        command_return.update.player_data.money -= penalty;
        command_return.reply = `Your scandal failed!`;
      }

      command_return.player_data.money -= scandal_cost;
      command_return.success = true;
    } else {
      command_return.reply = `Instigating a scandal against ${highest_role} ` +
        `<@${player_mention.user}> costs ${scandal_cost} :moneybag:. You do ` +
        ` not have enough to afford the scandal.`;
    }
  } else {
    command_return.reply = `<@${player_mention.user}> is unsworn!`;
  }

  return command_return;
};

/*
 * View money, ships, men of a player. costs 400
 * <PLAYER>
 */
const spy = ({args, player_data, guild}) => {
  const command_return = {
    "update": {
      "player_data": {...player_data}
    },
    "reply": "",
    "success": false
  };

  const [player_mention] = args;

  command_return.update.player_mention = {...player_mention};
  // Make sure both have enough money
  const p_money = player_data.money;
  if(player_data.user === player_mention.user) {
    command_return.reply = "You cannot spy yourself!";
  } else if(p_money >= 200) {
    const player_roles = [];
    guild.members.get(player_mention.user).roles.forEach(role => {
      player_roles.push(role.name.toLowerCase());
    });
    const role_reply = game_tasks.generate_roles_reply({player_roles});
    command_return.update.player_data.money -= 200;
    command_return.reply = `<@${player_mention.user}> has ` +
      `${player_mention.money} :moneybag: ${player_mention.men} ` +
      `${assets.emojis.MenAtArms} ${player_mention.ships} ` +
      `${assets.emojis.Warship}\n\n${role_reply}`;
    command_return.success = true;
  } else {
    command_return.reply = "You do not have enough money. spy costs 200.";
  }

  return command_return;
};

/*
 * Steal money from someone. fail_risk = yours / (theirs + yours)
 * on succeed, take 2-10%. fail pay 100-1000 to player
 * <PLAYER>
 */
const thief = ({args, player_data}) => {
  const command_return = {
    "update": {
      "player_data": {...player_data}
    },
    "reply": "",
    "success": false
  };

  const [player_mention] = args;

  command_return.update.player_mention = {...player_mention};
  // Make sure both have enough money, and no debt.
  const p_money = player_data.money;
  const m_money = player_mention.money;
  if(player_data.user === player_mention.user) {
    command_return.reply = "You cannot thief yourself!";
  } else if(p_money >= 0) {
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

      let money_change = 0;
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

      const success_reply_template =
        utils.random_element(flavor.thief_success);
      const fail_reply_template = utils.random_element(flavor.thief_fail);
      const used_template = winner === 'player'
        ? success_reply_template
        : fail_reply_template;
      command_return.reply = utils.template_replace(
        used_template,
        {
          "amount": money_change,
          "target_mention": `<@${player_mention.user}>`,
          "e_MenAtArms": assets.emojis.MenAtArms
        }
      );
      command_return.success = true;
    } else {
      command_return.reply = "The other player does not have any money";
    }
  } else {
    command_return.reply = "You are in debt. You should find other ways " +
      "to make money";
  }

  return command_return;
};

/*
 * Trade with a different player that is in a house in which you have a pact
 * @player <SHIPS>
 */
const trade = ({args, player_data}) => {
  const command_return = {
    "update": {
      "player_data": {...player_data}
    },
    "reply": ""
  };

  const [
    player_mention,
    num_ships
  ] = args;

  command_return.update.player_mention = {...player_mention};

  // Make sure the players' houses are in a pact
  const pact = db.get_pact_between_houses.get({
    "house1": player_data.house,
    "house2": player_mention.house
  });

  if(pact) {
    // Make sure the player has ships
    const p_ships = player_data.ships;
    if(player_data.user === player_mention.user) {
      command_return.reply = "You cannot trade yourself!";
    } else if(p_ships > 0) {
      // Ensure the args are valid
      if(isNaN(num_ships) || num_ships < 1) {
        command_return.reply = "Number of ships must be a positive number";
      } else if(p_ships >= num_ships) {
        // All good! Grant the cash
        const trader_pay =
          utils.get_random_value_in_range(200, 300) * num_ships;
        const tradee_pay =
          utils.get_random_value_in_range(100, 200) * num_ships;
        command_return.update.player_data.money += trader_pay;
        command_return.update.player_mention.money += tradee_pay;
        const reply_template = utils.random_element(flavor.trade);
        command_return.reply = utils.template_replace(
          reply_template,
          {
            trader_pay,
            tradee_pay,
            "trader": `<@${player_data.user}>`,
            "tradee": `<@${player_mention.user}>`
          }
        );
        command_return.success = true;
      } else {
        command_return.reply = `You only have ${p_ships} ` +
          `${assets.emojis.Warship} available`;
      }
    } else {
      command_return.reply = "You do not have any ships to trade with";
    }
  } else {
    command_return.reply = `Your house is not in a pact with ` +
      `<@&${player_mention.house}>!`;
  }

  return command_return;
};
module.exports = {
  "dispatch": {
    "arson": {
      "function": arson,
      "cooldown": {
        "time": utils.hours_to_ms(24),
        "field": "arson_last_time",
        "reply": "The fire watch is on high alert. " +
          "They are due to leave in"
      },
      "args": [
        "args",
        "player_data",
        "player_roles",
        "guild"
      ],
      "command_args": [
        [
          args_js.arg_types.player_mention,
          args_js.args_js.game_role
        ]
      ],
      "usage": ["@PLAYER INCOME_ROLE"],
      "allowed_channels": assets.player_interact_channels
    },
    "gift": {
      "function": gift,
      "args": [
        "args",
        "player_data"
      ],
      "command_args": [
        [
          args_js.arg_types.player_mention,
          args_js.arg_types.number
        ]
      ],
      "usage": ["@PLAYER MONEY"],
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
        "args",
        "player_data"
      ],
      "command_args": [[args_js.arg_types.player_mention]],
      "usage": ["@PLAYER"],
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
        "args",
        "player_data"
      ],
      "command_args": [[args_js.arg_types.player_mention]],
      "usage": ["@PLAYER"],
      "allowed_channels": assets.player_interact_channels
    },
    "scandal": {
      "function": scandal,
      "cooldown": {
        "time": utils.hours_to_ms(72),
        "field": "scandal_last_time",
        "reply": "The fire watch is on high alert. " +
          "They are due to leave in"
      },
      "args": [
        "args",
        "player_data",
        "guild"
      ],
      "command_args": [[args_js.arg_types.player_mention]],
      "usage": ["@PLAYER"],
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
        "args",
        "player_data",
        "guild"
      ],
      "command_args": [[args_js.arg_types.player_mention]],
      "usage": ["@PLAYER"],
      "allowed_channels": assets.player_interact_channels
    },
    "thief": {
      "function": thief,
      "cooldown": {
        "time": utils.hours_to_ms(24),
        "field": "thief_last_time",
        "reply": "The guards are on the alert for thieves. " +
          "Maybe you can try again in"
      },
      "args": [
        "args",
        "player_data"
      ],
      "command_args": [[args_js.arg_types.player_mention]],
      "usage": ["@PLAYER"],
      "allowed_channels": assets.player_interact_channels
    },
    "trade": {
      "function": trade,
      "cooldown": {
        "time": utils.hours_to_ms(24),
        "field": "trade_last_time",
        "reply": "Your merchants are buying goods from the guilds, and " +
          "their sailors are drunk in the tavern. You can set sail again at"
      },
      "args": [
        "args",
        "player_data"
      ],
      "command_args": [
        [
          args_js.arg_types.player_mention,
          args_js.arg_types.number
        ]
      ],
      "usage": ["@PLAYER SHIPS"],
      "allowed_channels": assets.player_interact_channels
    }
  }
};
