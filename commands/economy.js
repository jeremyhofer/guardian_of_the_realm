module.exports = {
  buy (args, client, msg, player_data) {

    /*
     * Buy some item in a quantity. titles only one, cant buy more or same
     * again.  <OBJECT> <AMOUNT>
     */
  },
  loan (args, client, msg, player_data) {

    /*
     * Request a loan of a given amount. must repay within 24 hours.
     * no more than 50% total money. random 5-50% interest. only one at a time
     */
  },
  market (args, client, msg, player_data) {
    // Lists everything in the market they may buy
  }
};
