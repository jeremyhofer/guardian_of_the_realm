module.exports = {
  edit (args, client, msg, player_data) {

    /*
     * Edit player data. will take flags i.e. --house. will hard set to the
     * value given @player --house <HOUSE> --money <MONEY> --men <MEN> --ships
     * <SHIPS> --title <array>
     */
  },
  map (args, client, msg, player_data) {

    /*
     * Generates a map. 8x12 (tiles are emojis). top row and left column are
     * positions (A1, etc.) outer edge all sea. inner random. 14 castles on
     * grid owned by houses are what matter
     */
  },
  take (args, client, msg, player_data) {

    /*
     * Take person title, men, ships, money
     * @player [TITLE|MEN|SHIPS|MONEY] <VALUE>
     */
  },
  view (args, client, msg, player_data) {
    // VIEW ALL THE STUFF!!!!!!!!!!
  }
};
