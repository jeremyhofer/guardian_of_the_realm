const Discord = require('discord.js');
const SQLite = require("better-sqlite3");
const sql = new SQLite('./data/gotr_bot.sqlite');
const client = new Discord.Client();
const auth = require('./auth.json');
const PREFIX = '.';
var economy = require('./commands/economy.js');
var tasks = require('./commands/tasks.js');
var admin = require('./commands/admin.js');
var player_interact = require('./commands/player_interact.js');
var clan_interact = require('./commands/clan_interact.js');
var general = require('./commands/general.js');
const command_dispatch = {
  "add": admin.add,
  "buy": economy.buy,
  "gift": admin.gift,
  "help": general.help,
  "join": clan_interact.join,
  "loan": economy.loan,
  "map": admin.map,
  "market": economy.market,
  "pirate": player_interact.pirate,
  "pledge": clan_interact.pledge,
  "pray": tasks.pray,
  "raid": player_interact.raid,
  "siege": clan_interact.siege,
  "slut": tasks.slut,
  "smuggle": tasks.smuggle,
  "spy": player_interact.spy,
  "take": admin.take,
  "thief": player_interact.thief,
  "train": tasks.train,
  "truce": clan_interact.truce,
  "view": admin.view,
  "war": clan_interact.war,
  "work": tasks.work
};

client.on("ready", () => {
  // Check if the table "points" exists.
  const table = sql.prepare(`
    SELECT count(*) FROM sqlite_master
    WHERE type='table' AND name = 'player_data';
  `).get();
  if (!table['count(*)']) {
    // If the table isn't there, create it and setup the database correctly.
    sql.prepare(`
      CREATE TABLE player_data (
        user TEXT PRIMARY KEY,
        house TEXT,
        men INTEGER,
        ships INTEGER,
        money INTEGER
      );
    `).run();
    // Ensure that the "id" row is always unique and indexed.
    sql.prepare(`
      CREATE UNIQUE INDEX idx_player_data_id ON player_data (user);
    `).run();
    sql.pragma("synchronous = 1");
    sql.pragma("journal_mode = wal");
  }
});

client.login(auth.token);

client.on('message', msg => {
  var tokens = msg.content.split(" ");
  if (tokens[0].startsWith(PREFIX)) {
    var command = tokens[0].substring(1);
    if(command in command_dispatch) {
      command_dispatch[command](tokens.slice(1));
      msg.reply(command + ' is not yet implemented');
    } else{
      msg.reply(command + ' is not a recognized command');
    }
  }
});
