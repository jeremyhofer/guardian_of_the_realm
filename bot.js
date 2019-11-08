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
               * If the command had a cooldown and player_data was not returned
               * As part of an update for the command, update the cooldown here
               */
              player_data[cooldown_field] = current_time;
              db.set_player.run(player_data);
            }

            if('reply' in command_return) {
              msg.reply(command_return.reply);
            }

            if('send' in command_return) {
              if('message' in command_return.send) {
                if('channel' in command_return.send) {
                  msg.guild.channels.get(command_return.send.channel).send(
                    command_return.send.message,
                    {"split": true}
                  );
                } else {
                  msg.channel.send(command_return.send.message, {"split": true});
                }
              }
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

            if('sieges' in command_return) {
              if('add' in command_return.sieges) {
                // Add the siege to the database
                db.add_siege.run(command_return.sieges.add);
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
  const last_payout = db.get_last_payout.get();

  if(last_payout.time + utils.hours_to_ms(hours_between_payout) <= now) {
    // Payout roles
    for(const title in assets.daily_payouts) {
      if(title in assets.daily_payouts) {
        const payout = Math.round(assets.daily_payouts[title] * payout_percent);
        const role_id = utils.find_role_id_given_name(title, assets.game_roles);
        guild.roles.get(role_id).members.forEach((value, key) => {
          // Get player_data
          let player_data = db.get_player.get(key);

          if (!player_data) {
            player_data = {...db.default_player};
            player_data.user = key;
          }

          // Add payout
          player_data.money += payout;

          // Save
          db.set_player.run(player_data);

        });
      }
    }

    // Deduct troop prices
    const all_players = db.get_all_players.all();

    all_players.forEach(player => {
      const men_cost = player.men * Math.round(assets.daily_costs.men *
        payout_percent);
      const ship_cost = player.ships * Math.round(assets.daily_costs.ships *
        payout_percent);
      player.money -= men_cost;
      player.money -= ship_cost;
      db.set_player.run(player);
    });
    db.update_last_payout.run(now);
  }

  // Collect on all loans that are due
  const due_loans = db.get_due_loans.all(now);

  due_loans.forEach(loan => {
    const player_data = db.get_player.get(loan.user);
    player_data.money -= loan.amount_due;
    db.set_player.run(player_data);
    db.remove_loan.run(loan);

    guild.channels.get(assets.reply_channels.command_tent).send("<@" +
      `${player_data.user}> your loan has expired. The remaining balance ` +
      `of ${loan.amount_due} has been deducted from your account`);
  });

  // Resolve expired war votes
  const expiration_time = now - utils.hours_to_ms(6.0);
  let expired_war_vote = db.get_expired_votes_by_type.get("war", expiration_time);

  while(expired_war_vote) {
    // Get the data for the player who made this vote
    const player_data = db.get_player.get(expired_war_vote.user);
    // Get all votes for the house
    const house_votes = db.get_all_house_votes_by_type.all("war", player_data.house);
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
      db.add_war.run({
        "house_a": player_data.house,
        "house_b": top_choice
      });

      /*
       * Get all votes from the other house. If any are for the house that
       * declared war, delete them
       */
      const other_house_votes = db.get_all_house_votes_by_type.all(
        "war",
        top_choice
      );

      other_house_votes.forEach(vote => {
        if(vote.choice === player_data.house) {
          db.remove_vote.run(vote);
        }
      });

      vote_reply = `<@&${player_data.house}> has declared war on ` +
        `<@&${top_choice}>`;
    }

    // Send the reply
    guild.channels.get(assets.reply_channels.battle_reports).send(vote_reply);

    // Remove the votes
    house_votes.forEach(vote => {
      db.remove_vote.run(vote);
    });

    // Get next vote to resolve, if exists
    expired_war_vote = db.get_expired_votes_by_type.get("war", expiration_time);
  }

  let expired_truce_vote = db.get_expired_truce_vote.get(expiration_time);

  while(expired_truce_vote) {
    // Get the data for the player who made this vote
    const player_data = db.get_player.get(expired_truce_vote.user);
    const other_house = expired_truce_vote.choice;

    // Get all votes for both houses
    const p_house_votes_yes = db.get_all_house_votes_by_type.all(
      "truce_yes",
      player_data.house
    );
    const p_house_votes_no = db.get_all_house_votes_by_type.all(
      "truce_no",
      player_data.house
    );
    const o_house_votes_yes = db.get_all_house_votes_by_type.all(
      "truce_yes",
      other_house
    );
    const o_house_votes_no = db.get_all_house_votes_by_type.all(
      "truce_no",
      other_house
    );

    // Filter all the votes by vote type and specific truce vote
    const p_house_yes = p_house_votes_yes.filter(vote => vote.choice ===
      other_house);
    const p_house_no = p_house_votes_no.filter(vote => vote.choice ===
      other_house);
    const o_house_yes = o_house_votes_yes.filter(vote => vote.choice ===
      player_data.house);
    const o_house_no = o_house_votes_no.filter(vote => vote.choice ===
      player_data.house);

    // Get the votes for/against
    const p_yes_count = p_house_yes.length;
    const p_no_count = p_house_no.length;
    const o_yes_count = o_house_yes.length;
    const o_no_count = o_house_no.length;

    const p_house_vote_count = p_yes_count + p_no_count;
    const o_house_vote_count = o_yes_count + o_no_count;

    let vote_reply = `A truce vote between <@&${player_data.house}> and ` +
          `<@&${other_house}> has finished. `;

    // Determine the vote outcome
    if(p_house_vote_count > 0 && o_house_vote_count > 0) {
      if(p_house_yes > p_house_no && o_house_yes > o_house_no) {
        // We have a truce! Remove the war
        const war = db.get_war_between_houses.get({
          "house1": player_data.house,
          "house2": other_house
        });

        db.remove_war.run(war);

        /*
         * If there were any sieges between the houses, remove them
         * and return the pledged troops
         */

        const sieges_between_houses = db.get_all_siege_id_between_two_houses.all({
          "house_a": player_data.house,
          "house_b": other_house
        });

        // Iterate over each siege
        sieges_between_houses.forEach(siege => {
          const pledges = db.get_all_pledges_for_siege.all(siege);

          // Iterate over each pledge. Return the men and remore the pledge
          pledges.forEach(pledge => {
            const pledger_data = db.get_player.get(pledge.user);
            pledger_data.men += pledge.men;
            db.set_player.run(pledger_data);
            db.remove_pledge.run(pledge);
          });

          // Remove the siege
          db.remove_siege.run(siege);
        });

        vote_reply += "A truce has been declared - the war is over!";
      } else {
        // We continue to WAR
        vote_reply += "A truce was not reached - war continues!";
      }
    } else {
      // This should indicate that the other house did not vote. War continues
      vote_reply += "A truce was not reached - war continues!";
    }

    // Send the reply
    guild.channels.get(assets.reply_channels.battle_reports).send(vote_reply);

    // Remove all associated votes
    p_house_yes.forEach(vote => {
      db.remove_vote.run(vote);
    });

    p_house_no.forEach(vote => {
      db.remove_vote.run(vote);
    });

    o_house_yes.forEach(vote => {
      db.remove_vote.run(vote);
    });

    o_house_no.forEach(vote => {
      db.remove_vote.run(vote);
    });

    // Get next truce to try and resolve, if exists
    expired_truce_vote = db.get_expired_truce_vote.get(expiration_time);
  }

  let expired_siege = db.get_expired_siege.get(now);

  while(expired_siege) {
    // Get pledges for the siege
    const pledges = db.get_all_pledges_for_siege.all(expired_siege);
    const attack_pledges = pledges.filter(pledge => pledge.choice ===
      "attack");
    const defend_pledges = pledges.filter(pledge => pledge.choice ===
      "defend");

    let siege_reply = `The siege on ${expired_siege.tile} is over. `;

    if(attack_pledges.length || defend_pledges.length) {
      // Get men counts
      let attacker_count = 0;
      let defender_count = 0;

      const attackers = {};
      const defenders = {};
      const all_pledgers = {};

      attack_pledges.forEach(pledge => {
        attacker_count += pledge.men;
        attackers[pledge.user] = pledge.men;

        if(!(pledge.user in all_pledgers)) {
          all_pledgers[pledge.user] = db.get_player.get(pledge.user);
        }
      });

      defend_pledges.forEach(pledge => {
        defender_count += pledge.men;
        defenders[pledge.user] = pledge.men;

        if(!(pledge.user in all_pledgers)) {
          all_pledgers[pledge.user] = db.get_player.get(pledge.user);
        }
      });

      // Determine chance to win, the reward pots, and the losses
      let win_chance = Math.round(attacker_count /
        (attacker_count + defender_count) * 100);

      if(win_chance < 0) {
        win_chance = 0;
      } else if(win_chance > 100) {
        win_chance = 100;
      }

      const win_pot = 3000 * (attack_pledges.length + defend_pledges.length);
      const lose_pot = 20 * (attack_pledges.length + defend_pledges.length);
      const attacker_losses = utils.get_percent_of_value_given_range(
        defender_count,
        1,
        30
      );
      const defender_losses = utils.get_percent_of_value_given_range(
        attacker_count,
        1,
        30
      );

      const chance = utils.get_random_value_in_range(1, 100);

      // Determine the outcome
      if(win_chance >= chance) {
        // Attacker wins!

        // Handle winnings for all attackers
        for(const att in attackers) {
          if(att in attackers && att in all_pledgers) {
            const winnings = Math.round(win_pot * attackers[att] /
              attacker_count);
            let troops_returned = attackers[att] - Math.round(attacker_losses *
              attackers[att] / attacker_count);

            troops_returned = troops_returned < 0
              ? 0
              : troops_returned;
            all_pledgers[att].money += winnings;
            all_pledgers[att].men += troops_returned;
          }
        }

        // Handle winnings for all defenders
        for(const att in defenders) {
          if(att in defenders && att in all_pledgers) {
            const winnings = Math.round(lose_pot * defenders[att] /
              defender_count);
            let troops_returned = defenders[att] - Math.round(defender_losses *
              defenders[att] / defender_count);

            troops_returned = troops_returned < 0
              ? 0
              : troops_returned;
            all_pledgers[att].men += winnings + troops_returned;
          }
        }

        // Reassign the tile
        db.update_tile_owner.run(expired_siege.attacker, expired_siege.tile);
        siege_reply += `<@&${expired_siege.attacker}> has won the siege`;
      } else {
        // Defender wins!

        // Handle winnings for all defenders
        for(const att in defenders) {
          if(att in defenders && att in all_pledgers) {
            const winnings = Math.round(win_pot * defenders[att] /
              defender_count);
            let troops_returned = defenders[att] - Math.round(defender_losses *
              defenders[att] / defender_count);

            troops_returned = troops_returned < 0
              ? 0
              : troops_returned;
            all_pledgers[att].money += winnings;
            all_pledgers[att].men += troops_returned;
          }
        }

        // Handle winnings for all attackers
        for(const att in attackers) {
          if(att in attackers && att in all_pledgers) {
            const winnings = Math.round(lose_pot * attackers[att] /
              attacker_count);
            let troops_returned = attackers[att] - Math.round(attacker_losses *
              attackers[att] / attacker_count);

            troops_returned = troops_returned < 0
              ? 0
              : troops_returned;
            all_pledgers[att].men += winnings + troops_returned;
          }
        }

        siege_reply += `<@&${expired_siege.attacker}> has lost the siege`;
      }

      // Update all the player data
      for(const pledger in all_pledgers) {
        if(pledger in all_pledgers) {
          db.set_player.run(all_pledgers[pledger]);
        }
      }

      // Iterate over each pledge and remove it
      attack_pledges.forEach(pledge => {
        db.remove_pledge.run(pledge);
      });

      defend_pledges.forEach(pledge => {
        db.remove_pledge.run(pledge);
      });
    } else {
      // No one pledged
      siege_reply += "No one pledged to support the siege. Nothing is done.";
    }

    // Remove the siege
    db.remove_siege.run(expired_siege);

    // Send the reply
    guild.channels.get(assets.reply_channels.battle_reports).send(siege_reply);

    // Get next truce to try and resolve, if exists
    expired_siege = db.get_expired_siege.get(expiration_time);
  }
}, 60 * 1000);
