const assets = require('../assets.js');

module.exports = {
  help ({args, player_data}) {
    // Show help text. optional specific command
  },
  bal ({args, player_data}) {

    /*
     * Lists the players money, men, and ships with
     * the unique faction name for each.
     */
    return {
      "reply": `Your account: ${player_data.money} :moneybag: ` +
        `${player_data.men} ${assets.emojis.MenAtArms} ${player_data.ships} ` +
        `${assets.emojis.Warship}`
    };
  }
};
