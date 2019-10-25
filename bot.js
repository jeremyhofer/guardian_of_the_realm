const Discord = require('discord.js');
const SQLite = require("better-sqlite3");
const sql = new SQLite('./data/gotr_bot.sqlite');
const client = new Discord.Client();
const auth = require('./auth.json');
const PREFIX = '.';
var admin = require('./commands/admin.js');
var clan_interact = require('./commands/clan_interact.js');
var economy = require('./commands/economy.js');
var general = require('./commands/general.js');
var player_interact = require('./commands/player_interact.js');
var tasks = require('./commands/tasks.js');
const command_dispatch = {
  ...admin.dispatch,
  ...clan_interact.dispatch,
  ...economy.dispatch,
  ...general.dispatch,
  ...player_interact.dispatch,
  ...tasks.dispatch
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
      const call_function = command_dispatch[command].function;
      const call_args = {};
      const other_tokens = tokens.slice(1);

      // See if command should have additional arguments. If not, error
      if(other_tokens.length &&
          !command_dispatch[command].args.includes('args') &&
          !command_dispatch[command].args.includes('player_mention')) {
        msg.reply(`${command} does not take any additional arguments`);
      } else {
        // Get player_data, in case it is required
        let player_data = client.getPlayer.get(msg.member.id);

        if (!player_data) {
          player_data = {...client.defaultPlayerData};
          player_data.user = msg.author.id;
        }

        let player_mention = {};
        const mentioned_player = msg.mentions.members.first();

        if(mentioned_player) {
          player_mention = client.getPlayer.get(mentioned_player.user.id);

          if(!player_mention) {
            player_mention = {...client.defaultPlayerData};
            player_mention.user = mentioned_player.user.id;
          }
        }

        command_dispatch[command].args.forEach(required_arg => {
          switch(required_arg) {
            case 'args':
              call_args.args = tokens.slice(1);
              break;
            case 'player_data':
              call_args.player_data = player_data;
              break;
            case 'player_mention':
              call_args.player_mention = player_mention;
              break;
            default:
              break;
          }
        });

        const command_return = call_args
          ? call_function(call_args)
          : call_function();

        if(command_return) {
          if('update' in command_return) {
            if('player_data' in command_return.update) {
              client.setPlayer.run(command_return.update.player_data);
            }

            if('player_mention' in command_return.update) {
              client.setPlayer.run(command_return.update.player_mention);
            }

            if('roles' in command_return.update) {
              // Adjust player roles as necessary
              command_return.update.roles.add.forEach(add_role => {
                const server_role =
                  msg.guild.roles.find(role => role.name.toLowerCase() ===
                    add_role);

                if(server_role) {
                  // Add role to player
                  msg.member.addRole(server_role).catch(console.error);
                }
              });
            }
          }

          if('reply' in command_return) {
            msg.reply(command_return.reply);
          }
        } else {
          msg.reply(command + ' is not yet implemented');
        }
      }
    } else{
      msg.reply(command + ' is not a recognized command');
    }
  }
});
