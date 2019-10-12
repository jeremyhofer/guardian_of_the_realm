module.exports = {
  join (args, client, msg) {

    /*
     * Assigns player to a house w/ default money and men
     * need merc role. lose it after
     * <HOUSE>
     */
  },
  pledge (args, client, msg) {

    /*
     * Pledge men to a tile to attack/defend
     * <TILE> <NUMBER> [ATTACK|DEFEND]
     */
  },
  siege (args, client, msg) {

    /*
     * Start a siege on a tile. must be with a house you are at war with
     * <TILE>
     */
  },
  truce (args, client, msg) {

    /*
     * Open a vote between two waring houses to stop the war. majority of each
     * house must agree <HOUSE> [YES|NO]
     */
  },
  war (args, client, msg) {

    /*
     * Start vote in house to begin a war. choose other houses, or no war.
     * majority wins [HOUSE|PEACE]
     */
  }
};
