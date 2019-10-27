const assets = require('../assets.js');

/*
 * Assigns player to a house w/ default money and men
 * need merc role. lose it after
 * <HOUSE>
 */
const join = ({player_data, role_mention}) => {
  const command_return = {
    "update": {
      "player_data": {...player_data},
      "roles": {
        "add": []
      }
    },
    "reply": ""
  };

  // See if the player is in a house. If they are they cannot join another one
  if(player_data.house) {
    command_return.reply = "you are already part of a house";
  } else if(role_mention && assets.houses.includes(role_mention)) {
    // Add the player to the house
    command_return.update.player_data.house = role_mention;
    command_return.update.roles.add.push(role_mention);
    command_return.reply = `you successfully joined <@&${role_mention}>!`;
  } else {
    command_return.reply = "you must @ mention a house to join";
  }

  return command_return;
};

/*
 * Pledge men to a tile to attack/defend
 * <TILE> <NUMBER> [ATTACK|DEFEND]
 */
const pledge = () => null;

/*
 * Start a siege on a tile. must be with a house you are at war with
 * <TILE>
 */
const siege = () => null;

/*
 * Open a vote between two waring houses to stop the war. majority of each
 * house must agree <HOUSE> [YES|NO]
 */
const truce = () => null;

/*
 * Start vote in house to begin a war. choose other houses, or no war.
 * majority wins [HOUSE|PEACE]
 */
const war = () => null;

module.exports = {
  "dispatch": {
    "join": {
      "function": join,
      "args": [
        "player_data",
        "role_mention"
      ]
    },
    "pledge": {
      "function": pledge,
      "args": []
    },
    "siege": {
      "function": siege,
      "args": []
    },
    "truce": {
      "function": truce,
      "args": []
    },
    "war": {
      "function": war,
      "args": []
    }
  }
};
