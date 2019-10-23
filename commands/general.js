const assets = require('../assets.js');

// Show help text. optional specific command
const help = () => null;

/*
 * Lists the players money, men, and ships with
 * the unique faction name for each.
 */
const bal = ({player_data}) => ({
  "reply": `Your account: ${player_data.money} :moneybag: ` +
  `${player_data.men} ${assets.emojis.MenAtArms} ${player_data.ships} ` +
  `${assets.emojis.Warship}`
});

module.exports = {
  "dispatch": {
    "help": {
      "function": help,
      "args": []
    },
    "bal": {
      "function": bal,
      "args": ["player_data"]
    }
  }
};
