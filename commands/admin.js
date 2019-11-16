const db = require('../database.js');

/*
 * Edit player data. will take flags i.e. --house. will hard set to the
 * value given @player --house <HOUSE> --money <MONEY> --men <MEN> --ships
 * <SHIPS> --title <array>
 */
const edit = () => null;

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
