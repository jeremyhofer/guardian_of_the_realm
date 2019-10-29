const Discord = require('discord.js');
const db = require('./database.js');
const client = new Discord.Client();
const auth = require('./auth.json');
const PREFIX = '.';
const admin = require('./commands/admin.js');
const clan_interact = require('./commands/clan_interact.js');
const economy = require('./commands/economy.js');
const general = require('./commands/general.js');
const player_interact = require('./commands/player_interact.js');
const tasks = require('./commands/tasks.js');
const assets = require('./assets.js');
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
  // Setup database commands for various actions.
  client.getPlayer = db.get_player;
  client.setPlayer = db.set_player;
  client.getPlayerLoans = db.get_loan;
  client.addPlayerLoan = db.add_loan;
  client.updatePlayerLoan = db.update_loan;
  client.removePlayerLoan = db.remove_loan;
  client.defaultPlayerData = db.default_player;
  client.addVote = db.add_vote;
  client.addSiege = db.add_siege;

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
            !command_dispatch[command].args.includes('player_mention') &&
            !command_dispatch[command].args.includes('role_mention')) {
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

          let role_mention = "";
          const mentioned_role = msg.mentions.roles.first();

          if(mentioned_role) {
            role_mention = mentioned_role.id;
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
              case 'role_mention':
                call_args.role_mention = role_mention;
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
                if('add' in command_return.update.roles) {
                  // Adjust player roles as necessary
                  command_return.update.roles.add.forEach(add_role => {
                    // See if this is an ID. If so, use it, otherwise get ID
                    const server_role = add_role in assets.game_roles
                      ? add_role
                      : utils.find_role_id_given_name(
                          add_role,
                          assets.game_roles
                        );
                    if(server_role) {
                      // Add role to player
                      msg.member.addRole(server_role).catch(console.error);
                    } else {
                      msg.reply(`${add_role} is not defined. Contact a dev`);
                    }
                  });
                }
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

            if('votes' in command_return) {
              if('add' in command_return.votes) {
                // Add the vote to the database
                client.addVote.run(command_return.votes.add);
              }
            }

            if('sieges' in command_return) {
              if('add' in command_return.sieges) {
                // Add the siege to the database
                client.addSiege.run(command_return.sieges.add);
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
