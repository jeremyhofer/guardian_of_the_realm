const assets = require('../assets.js');
const db = require('../database.js');

// Show help text. optional specific command
const help = () => null;

/*
 * Lists the players money, men, and ships with
 * the unique faction name for each.
 */
const bal = ({player_data}) => {
  let reply = `Your account: ${player_data.money} :moneybag: ` +
  `${player_data.men} ${assets.emojis.MenAtArms} ${player_data.ships} ` +
  `${assets.emojis.Warship}`;

  reply += "\n\nSiege Contributions:\n";

  let siege_contributions = "";
  const player_pledges = db.get_all_player_pledges.all(player_data);

  player_pledges.forEach(pledge => {
    siege_contributions += `${pledge.tile} ${pledge.men} ` +
      `${assets.emojis.MenAtArms} ${pledge.choice}`;
  });

  siege_contributions = siege_contributions
    ? siege_contributions
    : "none";

  reply += siege_contributions;

  return {reply};
};

module.exports = {
  "dispatch": {
    "help": {
      "function": help,
      "args": [],
      "command_args": [[]],
      "usage": []
    },
    "bal": {
      "function": bal,
      "args": ["player_data"],
      "command_args": [[]],
      "usage": []
    }
  }
};
