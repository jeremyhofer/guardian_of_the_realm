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
const assets = require('./assets.js');
const game_tasks = require('./game_tasks.js');
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

let client_ready = false;

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
  client_ready = true;
});

client.login(auth.token);

client.on('message', msg => {
  var tokens = msg.content.split(" ");

  if (tokens[0].startsWith(PREFIX)) {
    var command = tokens[0].substring(1);

    if(command in command_dispatch) {
      if(assets.blocked_channels.includes(msg.channel.id) &&
        !msg.member.roles.has(assets.developer_role)) {
        msg.reply("commands are not allowed in this channel");
      } else if(!('allowed_channels' in command_dispatch[command]) ||
        command_dispatch[command].allowed_channels.includes(msg.channel.id) ||
        msg.member.roles.has(assets.developer_role)) {
        const call_function = command_dispatch[command].function;
        const call_args = {};
        const other_tokens = tokens.slice(1);

        // Get player_data
        let player_data = db.get_player.get(msg.member.id);

        if (!player_data) {
          player_data = {...db.default_player};
          player_data.user = msg.member.id;
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
              player_mention = db.get_player.get(mentioned_player.user.id);

              if(!player_mention) {
                player_mention = {...db.default_player};
                player_mention.user = mentioned_player.user.id;
              }
            }

            let role_mention = "";
            const mentioned_role = msg.mentions.roles.first();

            if(mentioned_role) {
              role_mention = mentioned_role.id;
            }

            const player_roles = [];

            msg.member.roles.forEach(value => {
              player_roles.push(value.name.toLowerCase());
            });

            const loans = db.get_loan.all(player_data.user);

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
                case 'player_roles':
                  call_args.player_roles = player_roles;
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
                  if(cooldown && 'success' in
                    command_return && command_return.success) {
                    command_return.update.player_data[
                      cooldown_field] = current_time;
                  }
                  db.set_player.run(command_return.update.player_data);
                }

                if('player_mention' in command_return.update) {
                  db.set_player.run(command_return.update.player_mention);
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

                  if('remove' in command_return.update.roles) {
                    // Adjust the player's roles
                    command_return.update.roles.remove.forEach(remove_role => {
                      const server_role = remove_role in assets.game_roles
                        ? remove_role
                        : utils.find_role_id_given_name(
                            remove_role,
                            assets.game_roles
                          );
                      if(server_role) {
                        // Add role to player
                        msg.member.removeRole(server_role).catch(console.error);
                      }
                    });
                  }
                }
              } else if(cooldown && 'success' in
                command_return && command_return.success) {

                /*
                 * If the command had a cooldown and player_data was not
                 * returned As part of an update for the command, update the
                 * cooldown here
                 */
                player_data[cooldown_field] = current_time;
                db.set_player.run(player_data);
              }

              if('reply' in command_return) {
                // Form an embed and have the reply as the description
                const embed = {
                  "description": command_return.reply
                };
                msg.channel.send({embed});
              }

              if('send' in command_return) {
                if('message' in command_return.send) {
                  if('channel' in command_return.send) {
                    msg.guild.channels.get(command_return.send.channel).send(
                      command_return.send.message,
                      {"split": true}
                    );
                  } else {
                    msg.channel.send(
                      command_return.send.message,
                      {"split": true}
                    );
                  }
                }
              }

              if('map' in command_return) {
                msg.channel.send(
                  command_return.map.message,
                  {
                    "embed": command_return.map.embed,
                    "split": true
                  }
                );
              }

              if('loans' in command_return) {
                if('add' in command_return.loans) {
                  // Add the new loan to the database
                  db.add_loan.run(command_return.loans.add);
                } else if ('update' in command_return.loans) {
                  db.update_loan.run(command_return.loans.update);
                } else if ('remove' in command_return.loans) {
                  db.remove_loan.run(command_return.loans.remove);
                }
              }

              if('votes' in command_return) {
                if('add' in command_return.votes) {
                  // Add the vote to the database
                  db.add_vote.run(command_return.votes.add);
                }
              }

              if('pledges' in command_return) {
                if('add' in command_return.pledges) {
                  // Add the pledge to the database
                  db.add_pledge.run(command_return.pledges.add);
                }

                if('remove' in command_return.pledges) {
                  // Remove the pledge
                  db.remove_pledge.run(command_return.pledges.remove);
                }
              }

              if('sieges' in command_return) {
                if('add' in command_return.sieges) {
                  // Add the siege to the database
                  const info = db.add_siege.run(command_return.sieges.add);
                  const siege_embed = game_tasks.generate_siege_embed(
                    msg.guild.roles,
                    info.lastInsertRowid
                  );
                  const br_channel = assets.reply_channels.battle_reports;
                  const channel =
                    msg.guild.channels.get(br_channel);
                  channel.send({"embed": siege_embed}).then(message => {
                    db.update_siege_message.run(
                      message.id,
                      info.lastInsertRowid
                    );
                  });
                }
                if('update' in command_return.sieges) {
                  const siege = command_return.sieges.update;
                  const siege_embed = game_tasks.generate_siege_embed(
                    msg.guild.roles,
                    siege.siege_id
                  );
                  const br_channel = assets.reply_channels.battle_reports;
                  const channel =
                    msg.guild.channels.get(br_channel);
                  channel.fetchMessage(siege.message).then(message => {
                    message.edit({"embed": siege_embed});
                  });
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
      } else {
        msg.reply(command + ' may not be used in this channel');
      }
    } else{
      msg.reply(command + ' is not a recognized command');
    }
  }
});

setInterval(() => {

  /*
   * Give role payouts if it is time. Payout part every 12 hours
   * Charge 1 money per men every 12 hours
   * Charge 100 money per ship every 12 hours
   * Check to see if a war vote should be finalized and finalize it
   * Check to see if a truce vote should be finalized and finalize it
   * Check to see if a siege should be resolved
   * ST guild ID: 572263893729017893
   */
  if(client_ready) {
    const guild = client.guilds.get("572263893729017893");
    const now = Date.now();
    game_tasks.role_payouts(guild, now);
    game_tasks.collect_loans(guild, now);

    // Resolve expired war votes
    const expiration_time = now - utils.hours_to_ms(6);
    game_tasks.resolve_war_votes(guild, expiration_time);
    game_tasks.resolve_truce_votes(guild, expiration_time);
    game_tasks.resolve_sieges(guild, now);
  }
}, 1000);
