module.exports = {
  gift (args, player_data) {

    /*
     * Give person title, men, ships, money
     * @player [TITLE|MEN|SHIPS|MONEY] <VALUE>
     */
  },
  pirate (args, player_data) {

    /*
     * Destroy ships! fail_risk = yours / (theirs + 2*yours)
     * fail lose 5-15, other 1-9. win lose 1-9, other 10-20
     * <PLAYER>
     */
  },
  raid (args, player_data) {

    /*
     * Destroy men! fail_risk = yours / (theirs + 2*yours)
     * fail lose 50-150, other 10-90. win lose 10-90, other 100-150
     * <PLAYER>.
     */
  },
  spy (args, player_data) {

    /*
     * View money, ships, men of a player. costs 400
     * <PLAYER>
     */
  },
  thief (args, player_data) {

    /*
     * Steal money from someone. fail_risk = yours / (theirs + yours)
     * on succeed, take 2-10%. fail pay 100-1000 to player
     * <PLAYER>
     */
  }
};
