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
  "bal": general.bal,
  "gift": player_interact.gift,
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
  "smuggle": tasks.smuggle,
  "spy": player_interact.spy,
  "subvert": tasks.subvert,
  "take": admin.take,
  "thief": player_interact.thief,
  "train": tasks.train,
  "truce": clan_interact.truce,
  "view": admin.view,
  "war": clan_interact.war,
  "work": tasks.work
};

client.on("ready", () => {
  // Check if the table "player_data" exists.
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
        money INTEGER,
        gift_last_time INTEGER,
        loan_last_time INTEGER,
        pirate_last_time INTEGER,
        pray_last_time INTEGER,
        raid_last_time INTEGER,
        smuggle_last_time INTEGER,
        spy_last_time INTEGER,
        subvert_last_time INTEGER,
        thief_last_time INTEGER,
        train_last_time INTEGER,
        work_last_time INTEGER
      );
    `).run();
    // Ensure that the "id" row is always unique and indexed.
    sql.prepare(`
      CREATE UNIQUE INDEX idx_player_data_id ON player_data (user);
    `).run();
    sql.pragma("synchronous = 1");
    sql.pragma("journal_mode = wal");
  }

  client.getPlayer = sql.prepare("SELECT * FROM player_data WHERE user = ?");
  client.setPlayer = sql.prepare(`
    INSERT OR REPLACE INTO player_data (
      user, house, men, ships, money, pray_last_time,
      gift_last_time, loan_last_time, pirate_last_time,
      pray_last_time, raid_last_time, smuggle_last_time,
      spy_last_time, subvert_last_time, thief_last_time,
      train_last_time, work_last_time)
    VALUES (
      @user, @house, @men, @ships, @money, @pray_last_time,
      @gift_last_time, @loan_last_time, @pirate_last_time,
      @pray_last_time, @raid_last_time, @smuggle_last_time,
      @spy_last_time, @subvert_last_time, @thief_last_time,
      @train_last_time, @work_last_time);
  `);
  client.defaultPlayerData = {
    "user": '',
    "house": '',
    "men": 20,
    "ships": 2,
    "money": 2000,
    "gift_last_time": 0,
    "loan_last_time": 0,
    "pirate_last_time": 0,
    "pray_last_time": 0,
    "raid_last_time": 0,
    "smuggle_last_time": 0,
    "spy_last_time": 0,
    "subvert_last_time": 0,
    "thief_last_time": 0,
    "train_last_time": 0,
    "work_last_time": 0
  };

  console.log(`Logged in as ${client.user.tag}!`);
});

client.login(auth.token);

client.on('message', msg => {
  var tokens = msg.content.split(" ");

  if (tokens[0].startsWith(PREFIX)) {
    var command = tokens[0].substring(1);

    if(command in command_dispatch) {
      let player_data = client.getPlayer.get(msg.author.id);

      if (!player_data) {
        player_data = {...client.defaultPlayerData};
        player_data.user = msg.author.id;
      }

      const r_val = command_dispatch[command](tokens.slice(1), client, msg, player_data);

      if(r_val !== 0) {
        msg.reply(command + ' is not yet implemented');
      }
    } else{
      msg.reply(command + ' is not a recognized command');
    }
  }
});
