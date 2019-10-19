module.exports = {
  help (args, player_data) {
    // Show help text. optional specific command
  },
  bal (args, player_data) {

    /*
     * Lists the players money, men, and ships with
     * the unique faction name for each.
     */
    let reply = `Your account: ${player_data.money} :moneybag: ` +
      `${player_data.men} :MenAtArms: ${player_data.ships} :Warship:`;

    return [
      0,
      player_data,
      reply
    ]
  }
};
