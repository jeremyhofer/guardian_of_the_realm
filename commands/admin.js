module.exports = {
  edit (args) {

    /*
     * Edit player data. will take flags i.e. --house. will hard set to the
     * value given @player --house <HOUSE> --money <MONEY> --men <MEN> --ships
     * <SHIPS> --title <array>
     */
  },
  gift (args) {

    /*
     * Give person title, men, ships, money
     * @player [TITLE|MEN|SHIPS|MONEY] <VALUE>
     */
  },
  map (args) {

    /*
     * Generates a map. 8x12 (tiles are emojis). top row and left column are
     * positions (A1, etc.) outer edge all sea. inner random. 14 castles on
     * grid owned by houses are what matter
     */
  },
  take (args) {

    /*
     * Take person title, men, ships, money
     * @player [TITLE|MEN|SHIPS|MONEY] <VALUE>
     */
  },
  view (args) {
    // VIEW ALL THE STUFF!!!!!!!!!!
  }
};
