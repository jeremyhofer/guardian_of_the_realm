/*
 * Edit player data. will take flags i.e. --house. will hard set to the
 * value given @player --house <HOUSE> --money <MONEY> --men <MEN> --ships
 * <SHIPS> --title <array>
 */
const edit = () => null;

/*
 * Generates a map. 8x12 (tiles are emojis). top row and left column are
 * positions (A1, etc.) outer edge all sea. inner random. 14 castles on
 * grid owned by houses are what matter
 */
const map = () => null;

/*
 * Take person title, men, ships, money
 * @player [TITLE|MEN|SHIPS|MONEY] <VALUE>
 */
const take = () => null;

// VIEW ALL THE STUFF!!!!!!!!!!
const view = () => null;

module.exports = {
  "dispatch": {
    "edit": {
      "function": edit,
      "args": []
    },
    "map": {
      "function": map,
      "args": []
    },
    "take": {
      "function": take,
      "args": []
    },
    "view": {
      "function": view,
      "args": []
    }
  }
};
