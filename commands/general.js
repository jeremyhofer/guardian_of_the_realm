module.exports = {
  help (args, client, msg) {
    // Show help text. optional specific command
  },
  bal (args, client, msg) {

  let player_data = null;

  // Get player data - use defaults if new
  player_data = client.getPlayer.get(msg.author.id);
    if (!player_data) {
      player_data = {...client.defaultPlayerData};
      player_data.user = msg.author.id;
      client.setPlayer.run(player_data);}
    // Lists the players money, men, and ships with the unique faction name for each.
    msg.reply(`Your account: ${player_data.money} :moneybag: ${player_data.men} :MenAtArms: ${player_data.ships} :Warship:`);
    return 0;
  }
};