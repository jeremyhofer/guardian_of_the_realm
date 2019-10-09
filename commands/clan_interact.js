module.exports = {
  join (args) {

    /*
     * Assigns player to a house w/ default money and men
     * need merc role. lose it after
     * <HOUSE>
     */
  },
  pledge (args) {

    /*
     * Pledge men to a tile to attack/defend
     * <TILE> <NUMBER> [ATTACK|DEFEND]
     */
  },
  siege (args) {

    /*
     * Start a siege on a tile. must be with a house you are at war with
     * <TILE>
     */
  },
  truce (args) {

    /*
     * Open a vote between two waring houses to stop the war. majority of each
     * house must agree <HOUSE> [YES|NO]
     */
  },
  war (args) {

    /*
     * Start vote in house to begin a war. choose other houses, or no war.
     * majority wins [HOUSE|PEACE]
     */
  }
};
