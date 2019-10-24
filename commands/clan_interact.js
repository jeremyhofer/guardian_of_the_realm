/*
 * Assigns player to a house w/ default money and men
 * need merc role. lose it after
 * <HOUSE>
 */
const join = () => null;

/*
 * Pledge men to a tile to attack/defend
 * <TILE> <NUMBER> [ATTACK|DEFEND]
 */
const pledge = () => null;

/*
 * Start a siege on a tile. must be with a house you are at war with
 * <TILE>
 */
const siege = () => null;

/*
 * Open a vote between two waring houses to stop the war. majority of each
 * house must agree <HOUSE> [YES|NO]
 */
const truce = () => null;

/*
 * Start vote in house to begin a war. choose other houses, or no war.
 * majority wins [HOUSE|PEACE]
 */
const war = () => null;

module.exports = {
  "dispatch": {
    "join": {
      "function": join,
      "args": []
    },
    "pledge": {
      "function": pledge,
      "args": []
    },
    "siege": {
      "function": siege,
      "args": []
    },
    "truce": {
      "function": truce,
      "args": []
    },
    "war": {
      "function": war,
      "args": []
    }
  }
};
