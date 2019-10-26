const Discord = require('discord.js');
const SQLite = require("better-sqlite3");
const sql = new SQLite('./data/gotr_bot.sqlite');
const client = new Discord.Client();
const auth = require('./auth.json');
const PREFIX = '.';
const admin = require('./commands/admin.js');
const clan_interact = require('./commands/clan_interact.js');
const economy = require('./commands/economy.js');
const general = require('./commands/general.js');
const player_interact = require('./commands/player_interact.js');
const tasks = require('./commands/tasks.js');
const utils = require('./utils.js');
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
  const player_table = sql.prepare(`
    SELECT count(*) FROM sqlite_master
    WHERE type='table' AND name = 'player_data';
  `).get();
  if (!player_table['count(*)']) {
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

  const loan_table = sql.prepare(`
    SELECT count(*) FROM sqlite_master
    WHERE type='table' AND name = 'loans';
  `).get();
  if (!loan_table['count(*)']) {
    // If the table isn't there, create it and setup the database correctly.
    sql.prepare(`
      CREATE TABLE loans (
        loan_id INTEGER PRIMARY KEY,
        user TEXT,
        amount_due INTEGER,
        time_due INTEGER,
        FOREIGN KEY(user) REFERENCES player_data(user)
      );
    `).run();
    // Ensure that the "id" row is always unique and indexed.
    sql.prepare(`
      CREATE INDEX idx_loan_user_id ON loans (user);
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
  client.getPlayerLoans = sql.prepare("SELECT * FROM loans WHERE user = ?");
  client.addPlayerLoan = sql.prepare(`
    INSERT INTO loans (
      user, amount_due, time_due)
    VALUES (
      @user, @amount_due, @time_due);
  `);
  client.updatePlayerLoan = sql.prepare(`
    UPDATE loans SET amount_due = @amount_due WHERE loan_id = @loan_id;
  `);
  client.removePlayerLoan = sql.prepare(`
    DELETE FROM loans WHERE loan_id = @loan_id;
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

      // Get player_data
      let player_data = client.getPlayer.get(msg.member.id);

      if (!player_data) {
        player_data = {...client.defaultPlayerData};
        player_data.user = msg.author.id;
      }

      let cooldown = false;
      let cooldown_passed = false;
      let cooldown_field = null;
      let cooldown_fail_message = null;
      const current_time = Date.now();

      if('cooldown' in command_dispatch[command]) {
        // Check to see if the cooldown for the command has passed
        cooldown = true;
        cooldown_field = command_dispatch[command].cooldown.field;
        const last_time = player_data[cooldown_field];
        const cooldown_time = command_dispatch[command].cooldown.time;
        const base_reply = command_dispatch[command].cooldown.reply;
        const time_until = utils.get_time_until_string(last_time +
          cooldown_time - current_time);

        cooldown_passed = current_time - last_time >= cooldown_time;
        cooldown_fail_message = cooldown_passed
          ? ""
          : base_reply + " " + time_until;
      }

      // If we do not have a cooldown or the cooldown is passed, continue
      if(!cooldown || cooldown_passed) {
        // See if command should have additional arguments. If not, error
        if(other_tokens.length &&
            !command_dispatch[command].args.includes('args') &&
            !command_dispatch[command].args.includes('player_mention')) {
          msg.reply(`${command} does not take any additional arguments`);
        } else {

          let player_mention = {};
          const mentioned_player = msg.mentions.members.first();

          if(mentioned_player) {
            player_mention = client.getPlayer.get(mentioned_player.user.id);

            if(!player_mention) {
              player_mention = {...client.defaultPlayerData};
              player_mention.user = mentioned_player.user.id;
            }
          }

          const loans = client.getPlayerLoans.all(player_data.user);

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
              case 'loans':
                call_args.loans = loans;
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
                // If there was a cooldown, update the last time
                if(cooldown) {
                  command_return.update.player_data[
                    cooldown_field] = current_time;
                }
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
            } else if(cooldown) {

              /*
               * If the command had a cooldown and player_data was not returned
               * As part of an update for the command, update the cooldown here
               */
              player_data[cooldown_field] = current_time;
              client.setPlayer.run(player_data);
            }

            if('reply' in command_return) {
              msg.reply(command_return.reply);
            }

            if('send' in command_return) {
              msg.channel.send(command_return.send, {"split": true});
            }

            if('loans' in command_return) {
              if('add' in command_return.loans) {
                // Add the new loan to the database
                client.addPlayerLoan.run(command_return.loans.add);
              } else if ('update' in command_return.loans) {
                client.updatePlayerLoan.run(command_return.loans.update);
              } else if ('remove' in command_return.loans) {
                client.removePlayerLoan.run(command_return.loans.remove);
              }
            }
          } else {
            msg.reply(command + ' is not yet implemented');
          }
        }
      } else {
        // Cooldown failed. Reply.
        msg.reply(cooldown_fail_message);
      }
    } else{
      msg.reply(command + ' is not a recognized command');
    }
  }
});
