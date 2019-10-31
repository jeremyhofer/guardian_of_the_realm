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
  client.getAllDueLoans = db.get_due_loans;
  client.defaultPlayerData = db.default_player;
  client.addVote = db.add_vote;
  client.getExpiredVotes = db.get_expired_votes_by_type;
  client.getAllVotesByHouse = db.get_all_house_votes_by_type;
  client.removeVote = db.remove_vote;
  client.addSiege = db.add_siege;
  client.addPledge = db.add_pledge;
  client.getLastPayout = db.get_last_payout;
  client.updateLastPayout = db.update_last_payout;
  client.getAllPlayers = db.get_all_players;
  client.addWar = db.add_war;

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

            if('pledges' in command_return) {
              if('add' in command_return.pledges) {
                // Add the pledge to the database
                client.addPledge.run(command_return.pledges.add);
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
  const guild = client.guilds.get("572263893729017893");
  const now = Date.now();
  const hours_between_payout = 12;
  const payout_percent = hours_between_payout / 24;
  const last_payout = client.getLastPayout.get();

  if(last_payout.time + utils.hours_to_ms(hours_between_payout) <= now) {
    // Payout roles
    for(const title in assets.daily_payouts) {
      if(title in assets.daily_payouts) {
        const payout = Math.round(assets.daily_payouts[title] * payout_percent);
        const role_id = utils.find_role_id_given_name(title, assets.game_roles);
        guild.roles.get(role_id).members.forEach((value, key) => {
          // Get player_data
          let player_data = client.getPlayer.get(key);

          if (!player_data) {
            player_data = {...client.defaultPlayerData};
            player_data.user = key;
          }

          // Add payout
          player_data.money += payout;

          // Save
          client.setPlayer.run(player_data);

        });
      }
    }

    // Deduct troop prices
    const all_players = client.getAllPlayers.all();

    all_players.forEach(player => {
      const men_cost = player.men * Math.round(assets.daily_costs.men *
        payout_percent);
      const ship_cost = player.ships * Math.round(assets.daily_costs.ships *
        payout_percent);
      player.money -= men_cost;
      player.money -= ship_cost;
      client.setPlayer.run(player);
    });
    client.updateLastPayout.run(now);
  }

  // Collect on all loans that are due
  const due_loans = client.getAllDueLoans.all(now);

  due_loans.forEach(loan => {
    const player_data = client.getPlayer.get(loan.user);
    player_data.money -= loan.amount_due;
    client.setPlayer.run(player_data);
    client.removePlayerLoan.run(loan);

    guild.channels.get(assets.reply_channels.command_tent).send("<@" +
      `${player_data.user}> your loan has expired. The remaining balance ` +
      `of ${loan.amount_due} has been deducted from your account`);
  });

  // Resolve expired war votes
  const expiration_time = now - utils.hours_to_ms(0.1);
  let expired_war_vote = client.getExpiredVotes.get("war", expiration_time);

  while(expired_war_vote) {
    // Get the data for the player who made this vote
    const player_data = client.getPlayer.get(expired_war_vote.user);
    // Get all votes for the house
    const house_votes = client.getAllVotesByHouse.all("war", player_data.house);
    const vote_counts = {};

    // Count the votes
    house_votes.forEach(vote => {
      if(vote.choice in vote_counts) {
        vote_counts[vote.choice] += 1;
      } else {
        vote_counts[vote.choice] = 1;
      }
    });

    // Add the counts as objects in the array so we may sort by count
    const top_choices = [];

    for(const choice in vote_counts) {
      if(choice in vote_counts) {
        top_choices.push({
          choice,
          "votes": vote_counts.choice
        });
      }
    }

    top_choices.sort((first, second) => second.votes - first.votes);

    // Get the top choice and see if we have any ties
    let top_choice = top_choices[0].choice;

    if(top_choices.length > 1) {
      // See if the 2nd highest has the same number. If so there is a tie
      top_choice = top_choices[0].votes === top_choices[1].votes
        ? "peace"
        : top_choice;
    }

    let vote_reply = "";

    // WAR OR PEACE
    if(top_choice === "peace") {
      // Send message that vote ended in peace
      vote_reply = `<@&${player_data.house} your war vote has resulted in ` +
        "peace";
    } else {
      // WE HAVE WAR
      client.addWar.run({
        "house_a": player_data.house,
        "house_b": top_choice
      });

      /*
       * Get all votes from the other house. If any are for the house that
       * declared war, delete them
       */
      const other_house_votes = client.getAllVotesByHouse.all(
        "war",
        top_choice
      );

      other_house_votes.forEach(vote => {
        if(vote.choice === player_data.house) {
          client.removeVote.run(vote);
        }
      });

      vote_reply = `<@&${player_data.house}> has declared war on ` +
        `<@&${top_choice}>`;
    }

    // Send the reply
    guild.channels.get(assets.reply_channels.battle_reports).send(vote_reply);

    // Remove the votes
    house_votes.forEach(vote => {
      client.removeVote.run(vote);
    });

    // Get next vote to resolve, if exists
    expired_war_vote = client.getExpiredVotes.get("war", expiration_time);
  }
}, 10 * 1000);
