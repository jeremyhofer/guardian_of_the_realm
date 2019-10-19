module.exports = {
  help (args, client, msg, player_data) {
    // Show help text. optional specific command
  },
  bal (args, client, msg, player_data) {

    /*
     * Lists the players money, men, and ships with
     * the unique faction name for each.
     */
    msg.reply(`Your account: ${player_data.money} :moneybag: ` +
      `${player_data.men} :MenAtArms: ${player_data.ships} :Warship:`);

    return 0;
  }
};
