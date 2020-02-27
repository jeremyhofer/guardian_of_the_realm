const args_js = require('../args.js');
const assets = require('../assets.js');
const db = require('../database.js');
const utils = require('../utils.js');

/*
 * Assigns player to a house w/ default money and men
 * need merc role. lose it after
 * <HOUSE>
 */
const join = ({player_data}) => {
  const command_return = {
    "update": {
      "player_data": {...player_data},
      "roles": {
        "player": {
          "add": []
        }
      }
    },
    "reply": ""
  };

  // See if the player is in a house. If they are they cannot join another one
  if(player_data.house) {
    command_return.reply = "You are already part of a house";
  } else {
    // Add the player to a house with an opening
    const house_counts = {};

    assets.houses.forEach(house => {
      if(house !== "625905668263510017") {
        house_counts[house] = 0;
      }
    });

    db.count_all_players_in_house.all().forEach(data => {
      house_counts[data.house] = data.num_members;
    });

    const sorted_houses = [];

    for(const key in house_counts) {
      if(key in house_counts) {
        sorted_houses.push({
          "id": key,
          "count": house_counts[key]
        });
      }
    }

    sorted_houses.sort((first, second) => first.count - second.count);

    const selected_house = sorted_houses[0].id;

    command_return.update.player_data.house = selected_house;
    command_return.update.roles.player.add.push(selected_house);
    command_return.reply = `You successfully joined <@&${selected_house}>!`;
  }

  return command_return;
};

/*
 * Pledge units to a tile to attack/defend
 * <TILE> <NUMBER> [ATTACK|DEFEND]
 *
 * deduct the units from the player's count when the pledge is made
 */
const pledge = ({args, player_data, player_roles}) => {
  const command_return = {
    "sieges": {},
    "update": {
      "player_data": {...player_data}
    },
    "pledges": {},
    "reply": ""
  };

  // Validate args
  const selected_tile = args[0].toLowerCase();
  const num_units = parseInt(args[1], 10);
  const action = args[2].toLowerCase();

  const tile_owner = db.get_tile_owner.get(selected_tile);

  if(tile_owner) {
    const is_port = tile_owner.type === "port";
    const p_units = is_port
      ? player_data.ships
      : player_data.men;

    let role_limit = is_port
      ? assets.role_ship_limits.unsworn
      : assets.role_troop_limits.unsworn;

    if(player_roles.includes("duke")) {
      role_limit = is_port
        ? assets.role_ship_limits.duke
        : assets.role_troop_limits.duke;
    } else if (player_roles.includes("earl")) {
      role_limit = is_port
        ? assets.role_ship_limits.earl
        : assets.role_troop_limits.earl;
    } else if (player_roles.includes("baron")) {
      role_limit = is_port
        ? assets.role_ship_limits.baron
        : assets.role_troop_limits.baron;
    }

    if(isNaN(num_units) || num_units < 1) {
      command_return.reply = "The number of units must be a positive number";
    } else if (num_units > role_limit) {
      command_return.reply = `You may only send at most ${role_limit} units`;
    } else if(action !== "attack" && action !== "defend") {
      command_return.reply = "The action must be ATTACK or DEFEND";
    } else {
      // Ensure a siege exists on the tile
      const existing_siege = db.get_siege_on_tile.get(selected_tile);

      if(existing_siege) {
        // See if the player already has a pledge on the siege.
        const existing_pledge = db.get_player_pledge_for_siege.get({
          "user": player_data.user,
          "siege": existing_siege.siege_id
        });

        let valid = false;
        let units_to_deduct = 0;

        if(existing_pledge) {
          if(num_units > p_units + existing_pledge.units) {
            command_return.reply = `You do not have ${num_units} units`;
          } else {
            units_to_deduct = existing_pledge.units;
            command_return.pledges.remove = existing_pledge;
            valid = true;
          }
        } else if(num_units > p_units) {
          command_return.reply = `You do not have ${num_units} units`;
        } else {
          valid = true;
        }

        if(valid) {
          // Add the pledge
          command_return.pledges.add = {
            "siege": existing_siege.siege_id,
            "user": player_data.user,
            "units": num_units,
            "choice": action
          };

          if(is_port) {
            command_return.update.player_data.ships -=
              num_units - units_to_deduct;
          } else {
            command_return.update.player_data.men -=
              num_units - units_to_deduct;
          }

          command_return.reply = `You successfully pledged ${num_units} to ` +
            `${action} ${selected_tile.toUpperCase()}`;
          command_return.sieges.update = existing_siege;
        }
      } else {
        command_return.reply = `There is no active attack on ${selected_tile}`;
      }
    }
  } else {
    command_return.reply =
      `${selected_tile.toUpperCase()} is not a castle or port`;
  }

  return command_return;
};

/*
 * Start a siege on a tile. must be with a house you are at war with
 * <TILE>
 *
 * Any player in a house may start a siege on a castle at any time.
 *
 * Lasts 6 hours.
 *
 * Winner chance is attacking / (attacking + defending).
 *
 * Resolution will occur when the siege time ends. All pledges will be counted
 * and included at the time. If a player made a pledge and does not have
 * that many troops the number of troops will be reduced to what they have
 * at the time the resolution occurs.
 *
 * Defender losses = attackers * (10-30%)
 * Attacker losses = defenders * (10-30%)
 *
 * Losses are proportional by pledge amount from each person, so
 * pledger / total attacker or defender.
 *
 * Winning house gets (or keeps) the castle.
 *
 * Winning cash pot of 6000 * num pledges, distributed proportionately
 * among the winners by pledge amount.
 *
 * Losing men pot of 20 * num pledges, distributed proportionately among
 * the losers by pledge amount.
 *
 */
const handle_attack = ({args, player_data}, type) => {
  const command_return = {
    "sieges": {},
    "reply": ""
  };

  // Check tile
  const selected_tile = args[0].toLowerCase();
  const tile_owner = db.get_tile_owner.get(selected_tile);
  const house_sieges = db.count_house_sieges.get(player_data.house);
  const valid_blockade =
    tile_owner && tile_owner.type === "port" && type === "blockade";
  const valid_siege =
    tile_owner && tile_owner.type === "castle" && type === "siege";

  if(valid_blockade || valid_siege) {
    // Tile is good. Make sure it is owned by a house at war with
    if(player_data.house === tile_owner.house) {
      command_return.reply = type === "blockade"
        ? "Your house owns this port"
        : "Your house owns this castle";
    } else if(house_sieges.num_sieges >= 3) {
      command_return.reply = "Your house already has 3 declared attacks";
    } else {
      const war = db.get_war_between_houses.get({
        "house1": player_data.house,
        "house2": tile_owner.house
      });

      if(war) {
        // Make sure a siege does not already exist on this tile
        const existing_siege = db.get_siege_on_tile.get(selected_tile);

        if(existing_siege) {
          command_return.reply = type === "blockade"
            ? "A blockade is in progress on that port"
            : "A siege is in progress on that castle";
        } else {
          // Good to go! Add the siege
          command_return.sieges.add = {
            "tile": selected_tile,
            "attacker": player_data.house,
            "time": Date.now() + utils.hours_to_ms(8)
          };
          delete command_return.reply;
        }
      } else {
        command_return.reply = "Your house is not at war with " +
          `<@&${tile_owner.house}>`;
      }
    }
  } else {
    command_return.reply = type === "blockade"
      ? `${selected_tile} is not a port`
      : `${selected_tile} is not a castle`;
  }

  return command_return;
};

const siege = ({args, player_data}) => handle_attack(
  {
    args,
    player_data
  },
  "siege"
);

const blockade = ({args, player_data}) => handle_attack(
  {
    args,
    player_data
  },
  "blockade"
);

/*
 * Open a vote between two waring houses to stop the war. majority of each
 * house must agree <HOUSE> [YES|NO]
 *
 * When a player uses this command pull all current votes in the votes table
 * of type "truce" for all people in the player's house and the other house
 * in the truce vote. This is the set of all votes for the truce.
 *
 * Once the set is retrieved, see if the player already has a vote in place.
 * If the player has voted there is nothing for them to do. If the player does
 * not have a vote validate and record their vote in the pool.
 *
 * Before saving check to see if all players in both houses have voted on the
 * truce. If so, check the votes in both houses. See if at least half of both
 * houses agree on the truce. If so, remove the war. If not the war remains.
 *
 * After a vote finishes delete all the votes for the truce in the database.
 * Announce the outcome in channels.
 *
 * If a vote is not finished add the player's vote to the database.
 *
 * Vote also ends in a majority after 6 hours time.
 */
const pact = ({args, player_data}) => {
  const command_return = {
    "votes": {},
    "reply": ""
  };

  // Figure it out
  var [
    house_vote,
    player_choice
  ] = args;

  player_choice = player_choice.toLowerCase();

  // See if the player has already voted for this
  const yes_votes = db.get_player_vote_by_type.all(
    player_data.user,
    "pact_yes"
  );
  const no_votes = db.get_player_vote_by_type.all(
    player_data.user,
    "pact_no"
  );
  const all_votes = yes_votes.concat(no_votes);

  const existing_vote = all_votes.filter(vote => vote &&
    'choice' in vote && vote.choice === house_vote);

  if(existing_vote.length) {
    // Already voted in this pact vote
    const [vote] = existing_vote;
    const choice = vote.type === "pact_yes"
      ? "YES"
      : "NO";

    command_return.reply = `You have already voted ${choice} to a pact ` +
      `with <@&${vote.choice}>`;
  } else {
    // Ensure a war exists between the houses
    const existing_war = db.get_war_between_houses.get({
      "house1": player_data.house,
      "house2": house_vote
    });

    if(existing_war) {
      // Check yes/no choice
      let pact_type = "";

      if(player_choice === "yes") {
        pact_type = "pact_yes";
      } else if(player_choice === "no") {
        pact_type = "pact_no";
      }

      if(pact_type) {
        // Truce vote is good. Add it
        command_return.votes.add = {
          "type": pact_type,
          "user": player_data.user,
          "choice": house_vote,
          "time": Date.now()
        };
        command_return.reply = `Your choice of ${player_choice} was ` +
          "recorded";
      } else {
        command_return.reply = "You must vote YES or NO";
      }
    } else {
      command_return.reply = "Your house is not at war with " +
        `<@&${house_vote}>`;
    }
  }

  return command_return;
};

/*
 * Start vote in house to begin a war. choose other houses, or no war.
 * majority wins [HOUSE|PEACE]
 *
 * When a player uses this command pull all current votes in the votes table
 * of type "war" for all people in the player's house. This is the set of
 * current war votes for the house (each house has at most 1 active war vote
 * at a time and last until all have voted).
 *
 * Once the set is retrieved, see if the player already has a vote in place.
 * If the player has voted there is nothing for them to do. If the player
 * does not have a vote see if their vote is for a house and, if so, whether
 * a war already exists between the player's house and the house they vote
 * on. If so, do nothing. If a war does not exist add the player's vote to
 * the vote pool.
 *
 * Before saving to the database see if all players in the house have voted.
 * If all players have voted determine the outcome of the vote, based on the
 * majority. Ties always lead to peace. If a war is the outcome add a new war
 * between the two houses.
 *
 * After a vote finishes delete all of the houses' votes in the database. If a
 * war was the result also delete all existing votes for the other house that
 * are against this house if they exist, allowing those players to choose a
 * different house to vote against. Annouce in channels about the new war.
 *
 * If a vote is not finished add the player's vote to the database.
 *
 * Vote also ends in a majority after 6 hours time.
 */
const war = ({args, player_data}) => {
  const command_return = {
    "votes": {},
    "reply": ""
  };

  // Figure it out
  var [
    house_vote,
    player_choice
  ] = args;

  player_choice = player_choice.toLowerCase();

  // See if the player has already voted for this
  const yes_votes = db.get_player_vote_by_type.all(
    player_data.user,
    "war_yes"
  );
  const no_votes = db.get_player_vote_by_type.all(
    player_data.user,
    "war_no"
  );
  const all_votes = yes_votes.concat(no_votes);

  const existing_vote = all_votes.filter(vote => vote &&
    'choice' in vote && vote.choice === house_vote);

  if(existing_vote.length) {
    // Already voted in this war vote
    const [vote] = existing_vote;
    const choice = vote.type === "war_yes"
      ? "YES"
      : "NO";

    command_return.reply = `You have already voted ${choice} to a war ` +
      `with <@&${vote.choice}>`;
  } else {
    // Ensure a war exists between the houses
    const existing_pact = db.get_pact_between_houses.get({
      "house1": player_data.house,
      "house2": house_vote
    });

    if(existing_pact) {
      // Check yes/no choice
      let war_type = "";

      if(player_choice === "yes") {
        war_type = "war_yes";
      } else if(player_choice === "no") {
        war_type = "war_no";
      }

      if(war_type) {
        // Truce vote is good. Add it
        command_return.votes.add = {
          "type": war_type,
          "user": player_data.user,
          "choice": house_vote,
          "time": Date.now()
        };
        command_return.reply = `Your choice of ${player_choice} was ` +
          "recorded";
      } else {
        command_return.reply = "You must vote YES or NO";
      }
    } else {
      command_return.reply = "Your house does not have a pact with " +
        `<@&${house_vote}>`;
    }
  }

  return command_return;
};
module.exports = {
  "dispatch": {
    "join": {
      "function": join,
      "args": ["player_data"],
      "command_args": [[]],
      "usage": []
    },
    "pledge": {
      "function": pledge,
      "args": [
        "args",
        "player_data",
        "player_roles"
      ],
      "command_args": [
        [
          args_js.arg_types.string,
          args_js.arg_types.number,
          args_js.arg_types.string
        ]
      ],
      "usage": ["TILE NUMBER attack|defend"]
    },
    "siege": {
      "function": siege,
      "args": [
        "args",
        "player_data"
      ],
      "command_args": [[args_js.arg_types.string]],
      "usage": ["TILE"]
    },
    "blockade": {
      "function": blockade,
      "args": [
        "args",
        "player_data"
      ],
      "command_args": [[args_js.arg_types.string]],
      "usage": ["TILE"]
    },
    "pact": {
      "function": pact,
      "args": [
        "args",
        "player_data"
      ],
      "command_args": [
        [
          args_js.arg_types.house,
          args_js.arg_types.string
        ]
      ],
      "usage": ["HOUSE yes|no"]
    },
    "war": {
      "function": war,
      "args": [
        "args",
        "player_data"
      ],
      "command_args": [
        [
          args_js.arg_types.house,
          args_js.arg_types.string
        ]
      ],
      "usage": ["HOUSE yes|no"]
    }
  }
};
