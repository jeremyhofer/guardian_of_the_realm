const assets = require('../assets.js');
const db = require('../database.js');

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
const map = () => {
  const e = assets.emojis;
  const castles = [
    ['c', 2],
    ['b', 3],
    ['g', 3],
    ['d', 4],
    ['f', 5],
    ['g', 5],
    ['b', 6],
    ['d', 6],
    ['e', 6],
    ['d', 7],
    ['g', 9],
    ['b', 10],
    ['c', 10],
    ['d', 10]
  ];
  const map_data = [
    [e.RowCompass, e.ColumnA, e.ColumnB, e.ColumnC, e.ColumnD, e.ColumnE, e.ColumnF, e.ColumnG, e.ColumnH],
    [e.Row1, e.TileSea, e.TileSea, e.TileSea, e.TileSea, e.TileSea, e.TileSea, e.TileSea, e.TileSea],
    [e.Row2, e.TileSea, e.TileField, e.TileLion, e.TileSea, e.TileSea, e.TileField, e.TileSea, e.TileSea],
    [e.Row3, e.TileSea, e.TileFalcon, e.TileForest, e.TileBadland, e.TileSea, e.TileBadland, e.TileBear, e.TileSea],
    [e.Row4, e.TileSea, e.TileMount, e.TileMount, e.TileScorpion, e.TileMount, e.TileSea, e.TileField, e.TileSea],
    [e.Row5, e.TileSea, e.TileField, e.TileBadland, e.TileField, e.TileSea, e.TileHydra, e.TileLion, e.TileSea],
    [e.Row6, e.TileSea, e.TileDragon, e.TileSea, e.TileDragon, e.TileScorpion, e.TileSea, e.TileForest, e.TileSea],
    [e.Row7, e.TileSea, e.TileField, e.TileSea, e.TileHydra, e.TileForest, e.TileBadland, e.TileBadland, e.TileSea],
    [e.Row8, e.TileSea, e.TileField, e.TileField, e.TileBadland, e.TileSea, e.TileForest, e.TileField, e.TileSea],
    [e.Row9, e.TileSea, e.TileMount, e.TileSea, e.TileBadland, e.TileSea, e.TileMount, e.TileFalcon, e.TileSea],
    [e.Row10, e.TileSea, e.TileWolf, e.TileBear, e.TileWolf, e.TileBadland, e.TileSea, e.TileSea, e.TileSea],
    [e.Row11, e.TileSea, e.TileField, e.TileMount, e.TileSea, e.TileSea, e.TileMount, e.TileSea, e.TileSea],
    [e.Row12, e.TileSea, e.TileSea, e.TileSea, e.TileSea, e.TileSea, e.TileSea, e.TileSea, e.TileSea]
  ];

  let map_owners = "";

  const tile_owners = db.get_all_tiles.all();
  tile_owners.forEach(tile => {
    const coords = tile.tile;
    const column = parseInt(coords.slice(0, 1).charCodeAt(0), 10) - 96;
    const row = parseInt(coords.slice(1), 10);
    const owner_tile = assets.house_tiles[tile.house];
    const tile_emoji = e[owner_tile];
    map_data[row][column] = tile_emoji;
    map_owners += `${tile.tile.toUpperCase()}: <@&${tile.house}>\n`;
  });

  let map_tiles = "";

  map_data.forEach(row => {
    row.forEach(column => {
      map_tiles += column;
    });
    map_tiles += "\n";
  });

  let active_wars = "";
  const all_wars = db.get_all_wars.all();
  all_wars.forEach(war => {
    active_wars += `<@&${war.house_a}> :crossed_swords: <@&${war.house_b}>\n`;
  });

  active_wars = active_wars === ""
    ? "No active wars"
    : active_wars;

  return {
    "map": {
      "message": map_tiles,
      "embed": {
        "fields": [
          {
            "name": "Owners",
            "value": map_owners
          },
          {
            "name": "Active Wars",
            "value": active_wars
          }
        ]
      }
    }
  };
};

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
