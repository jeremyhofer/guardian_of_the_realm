const assets = require('./assets.js');
const db = require('./database.js');
const utils = require('./utils.js');

module.exports = {
  "role_payouts": (guild, current_time) => {
    const hours_between_payout = 12;
    const payout_percent = hours_between_payout / 24;
    const last_payout = db.get_tracker_by_name.get("payout_time");

    if(last_payout.value +
      utils.hours_to_ms(hours_between_payout) <= current_time) {
      // Payout roles
      for(const title in assets.daily_payouts) {
        if(title in assets.daily_payouts) {
          const payout =
            Math.round(assets.daily_payouts[title] * payout_percent);
          const role_id =
            utils.find_role_id_given_name(title, assets.game_roles);
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

      // Pay port ownership
      const port_payout =
        Math.round(3000 * payout_percent);
      db.get_ports.all().forEach(port => {
        guild.roles.get(port.house).members.forEach((value, key) => {
          // Get player_data
          let player_data = db.get_player.get(key);

          if (!player_data) {
            player_data = {...db.default_player};
            player_data.user = key;
          }

          // Add payout
          player_data.money += port_payout;

          // Save
          db.set_player.run(player_data);

        });
      });

      db.update_tracker_by_name.run(current_time, "payout_time");
    }
  },
  "collect_loans": (guild, current_time) => {
    // Collect on all loans that are due
    const due_loans = db.get_due_loans.all(current_time);

    due_loans.forEach(loan => {
      const player_data = db.get_player.get(loan.user);
      player_data.money -= loan.amount_due;
      db.set_player.run(player_data);
      db.remove_loan.run(loan);

      guild.channels.get(assets.reply_channels.command_tent).send("<@" +
        `${player_data.user}> your loan has expired. The remaining balance ` +
        `of ${loan.amount_due} has been deducted from your account`);
    });
  },
  "old_resolve_war_votes": (guild, expiration_time) => {
    // Resolve expired war votes
    let expired_war_vote =
      db.get_expired_votes_by_type.get("war", expiration_time);

    while(expired_war_vote) {
      // Get the data for the player who made this vote
      const player_data = db.get_player.get(expired_war_vote.user);
      // Get all votes for the house
      const house_votes =
        db.get_all_house_votes_by_type.all("war", player_data.house);
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
      let regen_map = false;

      // WAR OR PEACE
      if(top_choice === "peace") {
        // Send message that vote ended in peace
        vote_reply = `<@&${player_data.house}> your war vote has resulted in ` +
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

        regen_map = true;
      }

      // Send the reply
      guild.channels.get(assets.reply_channels.battle_reports).send(vote_reply);

      // Remove the votes
      house_votes.forEach(vote => {
        db.remove_vote.run(vote);
      });

      if(regen_map) {
        module.exports.post_updated_map({guild});
      }

      // Get next vote to resolve, if exists
      expired_war_vote =
        db.get_expired_votes_by_type.get("war", expiration_time);
    }
  },
  "resolve_truce_votes": (guild, expiration_time) => {
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

      let regen_map = false;

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

          const sieges_between_houses =
            db.get_all_siege_id_between_two_houses.all({
              "house_a": player_data.house,
              "house_b": other_house
            });

          // Iterate over each siege
          sieges_between_houses.forEach(siege => {
            const pledges = db.get_all_pledges_for_siege.all(siege);

            // Iterate over each pledge. Return the men and remore the pledge
            pledges.forEach(pledge => {
              const pledger_data = db.get_player.get(pledge.user);
              pledger_data.men += pledge.units;
              db.set_player.run(pledger_data);
              db.remove_pledge.run(pledge);
            });

            // Remove the siege
            db.remove_siege.run(siege);
          });
          // Successful Truce Vote
          vote_reply += "A truce has been brokered - pray the peace lasts!";
          regen_map = true;
        } else {
          // We continue to WAR
          vote_reply += "A truce was not reached - War continues!";
        }
      } else {
        // This should indicate that the other house did not vote. War continues
        vote_reply += "The attempt failed horribly - War continues!";
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

      if(regen_map) {
        module.exports.post_updated_map({guild});
      }

      // Get next truce to try and resolve, if exists
      expired_truce_vote = db.get_expired_truce_vote.get(expiration_time);
    }
  },
  "resolve_war_votes": (guild, expiration_time) => {
    let expired_war_vote = db.get_expired_war_vote.get(expiration_time);

    while(expired_war_vote) {
      // Get the data for the player who made this vote
      const player_data = db.get_player.get(expired_war_vote.user);
      const other_house = expired_war_vote.choice;

      // Get all votes for this specific war vote
      const p_house_votes_yes = db.get_all_house_votes_by_type.all(
        "war_yes",
        player_data.house
      );
      const p_house_votes_no = db.get_all_house_votes_by_type.all(
        "war_no",
        player_data.house
      );

      // Filter all the votes by vote type and specific war vote
      const p_house_yes = p_house_votes_yes.filter(vote => vote.choice ===
        other_house);
      const p_house_no = p_house_votes_no.filter(vote => vote.choice ===
        other_house);

      // Get the votes for/against
      const p_yes_count = p_house_yes.length;
      const p_no_count = p_house_no.length;

      const p_house_vote_count = p_yes_count + p_no_count;

      let vote_reply = `A war vote by <@&${player_data.house}> against ` +
        `<@&${other_house}> has finished. `;

      let regen_map = false;

      // Determine the vote outcome
      if(p_house_vote_count > 0) {
        if(p_house_yes > p_house_no) {
          // We have a war! Remove the pact
          const pact = db.get_pact_between_houses.get({
            "house1": player_data.house,
            "house2": other_house
          });

          db.remove_pact.run(pact);

          db.add_war.run({
            "house_a": player_data.house,
            "house_b": other_house
          });

          // War Happens!
          vote_reply += "Their Pact has been broken - this betrayal means War!";
          regen_map = true;
        } else {
          // We continue to WAR
          vote_reply +=
            "The warmongers were shouted down - the Pact holds for now.";
        }
      } else {
        // This should indicate that the other house did not vote. War continues
        vote_reply += "Not very many people showed up - the Pact holds.";
      }

      vote_reply += `\n<@&${player_data.house}>: ${p_yes_count} yays ` +
        `${p_no_count} nays`;

      // Send the reply
      guild.channels.get(assets.reply_channels.battle_reports).send(vote_reply);

      // Remove all associated votes
      p_house_yes.forEach(vote => {
        db.remove_vote.run(vote);
      });

      p_house_no.forEach(vote => {
        db.remove_vote.run(vote);
      });

      if(regen_map) {
        module.exports.post_updated_map({guild});
      }

      // Get next war to try and resolve, if exists
      expired_war_vote = db.get_expired_war_vote.get(expiration_time);
    }
  },
  "resolve_pact_votes": (guild, expiration_time) => {
    let expired_pact_vote = db.get_expired_pact_vote.get(expiration_time);

    while(expired_pact_vote) {
      // Get the data for the player who made this vote
      const player_data = db.get_player.get(expired_pact_vote.user);
      const other_house = expired_pact_vote.choice;

      // Get all votes for both houses
      const p_house_votes_yes = db.get_all_house_votes_by_type.all(
        "pact_yes",
        player_data.house
      );
      const p_house_votes_no = db.get_all_house_votes_by_type.all(
        "pact_no",
        player_data.house
      );
      const o_house_votes_yes = db.get_all_house_votes_by_type.all(
        "pact_yes",
        other_house
      );
      const o_house_votes_no = db.get_all_house_votes_by_type.all(
        "pact_no",
        other_house
      );

      // Filter all the votes by vote type and specific pact vote
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

      let vote_reply = `A pact vote between <@&${player_data.house}> and ` +
        `<@&${other_house}> has finished. `;

      let regen_map = false;

      // Determine the vote outcome
      if(p_house_vote_count > 0 && o_house_vote_count > 0) {
        if(p_house_yes > p_house_no && o_house_yes > o_house_no) {
          // We have a pact! Remove the war
          const war = db.get_war_between_houses.get({
            "house1": player_data.house,
            "house2": other_house
          });

          db.remove_war.run(war);

          db.add_pact.run({
            "house_a": player_data.house,
            "house_b": other_house
          });

          /*
           * If there were any sieges between the houses, remove them
           * and return the pledged troops
           */

          const sieges_between_houses =
            db.get_all_siege_id_between_two_houses.all({
              "house_a": player_data.house,
              "house_b": other_house
            });

          // Iterate over each siege
          sieges_between_houses.forEach(siege => {
            const tile_owner = db.get_tile_owner.get(siege.tile);
            const pledges = db.get_all_pledges_for_siege.all(siege);
            const is_port = tile_owner.type === 'port';

            // Iterate over each pledge. Return the men and remore the pledge
            pledges.forEach(pledge => {
              const pledger_data = db.get_player.get(pledge.user);
              if(is_port) {
                pledger_data.ships += pledge.units;
              } else {
                pledger_data.men += pledge.units;
              }
              db.set_player.run(pledger_data);
              db.remove_pledge.run(pledge);
            });

            // Remove the siege
            db.remove_siege.run(siege);
          });
          // Pact was a success, both agreed.
          vote_reply += "A Pact has been brokered - pray the peace lasts!";
          regen_map = true;
        } else {
          // We continue to WAR
          vote_reply += "A Pact was not reached - War continues!";
        }
      } else {
        // This should indicate that the other house did not vote. War continues
        vote_reply += "The attempt failed horribly - War continues!";
      }

      vote_reply += `\n<@&${player_data.house}>: ${p_yes_count} yays ` +
        `${p_no_count} nays`;

      vote_reply += `\n<@&${other_house}>: ${o_yes_count} yays ` +
        `${o_no_count} nays`;

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

      if(regen_map) {
        module.exports.post_updated_map({guild});
      }

      // Get next pact to try and resolve, if exists
      expired_pact_vote = db.get_expired_pact_vote.get(expiration_time);
    }
  },
  "resolve_sieges": (guild, current_time) => {
    let expired_siege = db.get_expired_siege.get(current_time);

    while(expired_siege) {
      // Get pledges for the siege
      const pledges = db.get_all_pledges_for_siege.all(expired_siege);
      const attack_pledges = pledges.filter(pledge => pledge.choice ===
        "attack");
      const defend_pledges = pledges.filter(pledge => pledge.choice ===
        "defend");

      const tile_owner = db.get_tile_owner.get(expired_siege.tile);
      const is_port = tile_owner.type === 'port';
      const attacker_name = guild.roles.get(expired_siege.attacker).name;
      const defender_name = guild.roles.get(tile_owner.house).name;
      const embed = module.exports.generate_siege_embed(
        guild.roles,
        expired_siege.siege_id
      );

      const type = is_port
        ? 'blockade'
        : 'siege';
      const tile_type = is_port
        ? 'port'
        : 'castle';

      embed.title = `FINISHED ${type} on ${expired_siege.tile.toUpperCase()}`;

      let regen_map = false;

      if(attack_pledges.length || defend_pledges.length) {
        // Get men counts
        let attacker_count = 0;
        let defender_count = 0;

        const attackers = {};
        const defenders = {};
        const all_pledgers = {};

        attack_pledges.forEach(pledge => {
          attacker_count += pledge.units;
          attackers[pledge.user] = pledge.units;

          if(!(pledge.user in all_pledgers)) {
            all_pledgers[pledge.user] = db.get_player.get(pledge.user);
          }
        });

        defend_pledges.forEach(pledge => {
          defender_count += pledge.units;
          defenders[pledge.user] = pledge.units;

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

        const num_pledgers = attack_pledges.length + defend_pledges.length;
        const win_pot = is_port
          ? 0
          : 3000 * num_pledgers;
        const lose_pot = is_port
          ? 0
          : 20 * num_pledgers;
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
        let win_message = "";

        // Determine the outcome
        if(win_chance >= chance) {
          // Attacker wins!

          // Handle winnings for all attackers
          for(const att in attackers) {
            if(att in attackers && att in all_pledgers) {
              const winnings = Math.round(win_pot * attackers[att] /
                attacker_count);
              let troops_returned =
                attackers[att] - Math.round(attacker_losses *
                  attackers[att] / attacker_count);

              troops_returned = troops_returned < 0
                ? 0
                : troops_returned;
              all_pledgers[att].money += winnings;

              if(is_port) {
                all_pledgers[att].ships += troops_returned;
              } else {
                all_pledgers[att].men += troops_returned;
              }
            }
          }

          // Handle winnings for all defenders
          for(const att in defenders) {
            if(att in defenders && att in all_pledgers) {
              const winnings = Math.round(lose_pot * defenders[att] /
                defender_count);
              let troops_returned =
                defenders[att] - Math.round(defender_losses *
                  defenders[att] / defender_count);

              troops_returned = troops_returned < 0
                ? 0
                : troops_returned;

              const unit_adjust = winnings + troops_returned;
              if(is_port) {
                all_pledgers[att].ships += unit_adjust;
              } else {
                all_pledgers[att].men += unit_adjust;
              }
            }
          }

          // Reassign the tile
          db.update_tile_owner.run(expired_siege.attacker, expired_siege.tile);
          win_message = `${attacker_name} successfully captured the ` +
            `${tile_type}!`;
          regen_map = true;
        } else {
          // Defender wins!

          // Handle winnings for all defenders
          for(const att in defenders) {
            if(att in defenders && att in all_pledgers) {
              const winnings = Math.round(win_pot * defenders[att] /
                defender_count);
              let troops_returned =
                defenders[att] - Math.round(defender_losses *
                  defenders[att] / defender_count);

              troops_returned = troops_returned < 0
                ? 0
                : troops_returned;
              all_pledgers[att].money += winnings;

              if(is_port) {
                all_pledgers[att].ships += troops_returned;
              } else {
                all_pledgers[att].men += troops_returned;
              }
            }
          }

          // Handle winnings for all attackers
          for(const att in attackers) {
            if(att in attackers && att in all_pledgers) {
              const winnings = Math.round(lose_pot * attackers[att] /
                attacker_count);
              let troops_returned =
                attackers[att] - Math.round(attacker_losses *
                  attackers[att] / attacker_count);

              troops_returned = troops_returned < 0
                ? 0
                : troops_returned;

              const unit_adjust = winnings + troops_returned;
              if(is_port) {
                all_pledgers[att].ships += unit_adjust;
              } else {
                all_pledgers[att].men += unit_adjust;
              }
            }
          }

          win_message = `${defender_name} successfully defended the ` +
            `${tile_type}!`;
        }

        let message = `${num_pledgers} player(s) contributed to this ${type}. `;

        if(is_port) {
          message += `The members of the house controlling the port will ` +
            `each earn 3000 :moneybag: per day.`;
        } else {
          message += `${win_pot} :moneybag: has been distributed to the ` +
            `winners. ${lose_pot} ${assets.emojis.MenAtArms} has been ` +
            `distributed to the losers.`;
        }

        embed.fields.push({
          "name": win_message,
          "value": message
        });

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
        embed.fields.push({
          "name": `${defender_name} has kept their ${tile_type}.`,
          "value": `No one pledged to the ${type}.`
        });
      }

      const channel = guild.channels.get(assets.reply_channels.battle_reports);
      channel.fetchMessage(expired_siege.message).then(message => {
        message.edit({embed});
      });

      // Remove the siege
      db.remove_siege.run(expired_siege);

      // Get next siege to try and resolve, if exists
      expired_siege = db.get_expired_siege.get(current_time);

      if(regen_map) {
        module.exports.post_updated_map({guild});
      }
    }
  },
  "generate_siege_embed": (guild_roles, siege_id) => {

    /*
     * Embed will consist of the following:
     * Title: Siege on <tile>
     * Field1:
     *  Name: Attacker: @house #total :ManAtArms: xx%
     *  Value: # :ManAtArms: <@&house>
     * Field2:
     *  Name: Defender: @house #total :ManAtArms: xx%
     *  Value: # :ManAtArms: pledged total
     * Field3:
     *  Name: Rewards
     *  Value: Winner: money\nLoser: men
     */
    const siege = db.get_siege_by_id.get(siege_id);
    const tile_owner = db.get_tile_owner.get(siege.tile);
    const pledges = db.get_all_pledges_for_siege.all(siege);

    const attacker_counts = {};
    const defender_counts = {};
    let attacker_total = 0;
    let defender_total = 0;

    const is_port = tile_owner.type === 'port';

    pledges.forEach(pledge => {
      const player_info = db.get_player.get(pledge.user);
      if(pledge.choice === 'attack') {
        if(player_info.house in attacker_counts) {
          attacker_counts[player_info.house] += pledge.units;
        } else {
          attacker_counts[player_info.house] = pledge.units;
        }

        attacker_total += pledge.units;
      } else if(pledge.choice === 'defend') {
        if(player_info.house in defender_counts) {
          defender_counts[player_info.house] += pledge.units;
        } else {
          defender_counts[player_info.house] = pledge.units;
        }

        defender_total += pledge.units;
      }
    });

    const attacker_name = guild_roles.get(siege.attacker).name;
    const defender_name = guild_roles.get(tile_owner.house).name;

    let attacker_win_chance = 0;
    let defender_win_chance = 0;

    if(attacker_total) {
      attacker_win_chance = Math.round(attacker_total /
        (attacker_total + defender_total) * 100);
    }

    if(defender_total) {
      defender_win_chance = 100 - attacker_win_chance;
    }

    let attackers = "";
    let defenders = "";
    const emoji = is_port
      ? assets.emojis.Warship
      : assets.emojis.MenAtArms;

    for(const house in attacker_counts) {
      if(house in attacker_counts) {
        const num = attacker_counts[house];
        attackers += `<@&${house}> ${num} ${emoji}\n`;
      }
    }

    for(const house in defender_counts) {
      if(house in defender_counts) {
        const num = defender_counts[house];
        defenders += `<@&${house}> ${num} ${emoji}\n`;
      }
    }

    attackers = attackers
      ? attackers
      : "no pledges";

    defenders = defenders
      ? defenders
      : "no pledges";

    const attacker_field_name = `Attacker: ${attacker_name} ` +
      `${attacker_total} ${emoji} ` +
      `${attacker_win_chance}%`;

    const defender_field_name = `Defender: ${defender_name} ` +
      `${defender_total} ${emoji} ` +
      `${defender_win_chance}%`;

    const winner_payout = pledges.length * 3000;
    const loser_payout = pledges.length * 20;

    const rewards = `Winners: ${winner_payout} :moneybag:\n` +
      `Losers: ${loser_payout} ${assets.emojis.MenAtArms}`;
    const type = is_port
      ? 'Blockade'
      : 'Siege';

    const embed = {
      "title": `${type} on ${siege.tile.toUpperCase()}`,
      "fields": [
        {
          "name": attacker_field_name,
          "value": attackers
        },
        {
          "name": defender_field_name,
          "value": defenders
        }
      ]
    };

    if(!is_port) {
      embed.fields.push({
        "name": "Rewards",
        "value": rewards
      });
    }

    return embed;
  },
  "post_updated_map": ({guild}) => {

    /*
     * Generates a map. 8x12 (tiles are emojis). top row and left column are
     * positions (A1, etc.) outer edge all sea. inner random. 14 castles on
     * grid owned by houses are what matter
     */
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
    let port_owners = "";

    const tile_owners = db.get_all_tiles.all();
    tile_owners.forEach(tile => {
      const coords = tile.tile;
      const column = parseInt(coords.slice(0, 1).charCodeAt(0), 10) - 96;
      const row = parseInt(coords.slice(1), 10);
      const owner_tile = assets.house_tiles[tile.house];
      const owner_tile_type = tile.type === "port"
        ? "Port" + owner_tile
        : "Tile" + owner_tile;
      const tile_emoji = e[owner_tile_type];
      map_data[row][column] = tile_emoji;

      if(tile.type === "port") {
        port_owners += `${tile.tile.toUpperCase()}: <@&${tile.house}>\n`;
      } else {
        map_owners += `${tile.tile.toUpperCase()}: <@&${tile.house}>\n`;
      }
    });

    let map_tiles = "";

    map_data.forEach(row => {
      row.forEach(column => {
        map_tiles += column;
      });
      map_tiles += "\n";
    });

    let active_pacts = "";
    const all_pacts = db.get_all_pacts.all();
    all_pacts.forEach(pact => {
      const [h1_troop] = assets.game_roles[pact.house_a];
      const [h2_troop] = assets.game_roles[pact.house_b];

      active_pacts += `${h1_troop} :handshake: ${h2_troop}\n`;
    });

    active_pacts = active_pacts === ""
      ? "No active pacts"
      : active_pacts;

    let active_sieges = "";
    let active_blockades = "";
    const all_sieges = db.get_all_sieges.all();
    all_sieges.forEach(siege => {
      if(siege.type === "port") {
        active_blockades += `${siege.tile}: :crossed_swords: ` +
          `<@&${siege.attacker}>\n`;
      } else {
        active_sieges += `${siege.tile}: :crossed_swords: ` +
          `<@&${siege.attacker}>\n`;
      }
    });

    active_sieges = active_sieges
      ? active_sieges
      : "No active sieges";

    active_blockades = active_blockades
      ? active_blockades
      : "No active blockades";

    const embed = {
      "fields": [
        {
          "name": "Castles",
          "value": map_owners
        },
        {
          "name": "Ports",
          "value": port_owners
        },
        {
          "name": "Active Pacts",
          "value": active_pacts
        },
        {
          "name": "Active Sieges",
          "value": active_sieges
        },
        {
          "name": "Active Blockades",
          "value": active_blockades
        }
      ]
    };

    const channel = guild.channels.get(assets.reply_channels.overworld);
    const existing_map_messages = db.get_tracker_by_name.all("map");

    existing_map_messages.forEach(to_delete => {
      channel.fetchMessage(to_delete.text).then(message => {
        message.delete();
      });
      db.remove_tracker.run(to_delete);
    });

    channel.send(
      map_tiles,
      {
        embed,
        "split": true
      }
    ).then(messages => {
      if(Array.isArray(messages)) {
        messages.forEach(message => {
          db.add_tracker.run({
            "name": "map",
            "value": null,
            "text": message.id
          });
        });
      }
    });

    return {};
  },
  "reset_everything": ({guild, player_roles}) => {
    let reply = "";

    if(player_roles.includes("developer")) {
      // Remove everyone from game roles
      for(const role_id in assets.game_roles) {
        if(role_id in assets.game_roles && role_id !== "625905668263510017") {
          guild.roles.get(role_id).members.forEach(member => {
            member.removeRole(role_id).catch(console.error);
          });
        }
      }

      // Reset everyone's data
      db.get_all_players.all().forEach(player => {
        const new_data = {...db.default_player};
        new_data.user = player.user;
        db.set_player.run(new_data);
      });

      db.reset_everything();

      module.exports.post_updated_map({guild});

      const remake_channels = [
        "house-bear",
        "house-dragon",
        "house-falcon",
        "house-hydra",
        "house-lion",
        "house-scorpion",
        "house-wolf"
      ];

      const house_cat = guild.channels.find(channel => channel.name ===
        "The Great Houses");

      if(house_cat) {
        for(let inc = 0; inc < remake_channels.length; inc += 1) {
          const channel_to_remake =
            guild.channels.find(channel => channel.name ===
              remake_channels[inc]);

          if(channel_to_remake) {
            channel_to_remake.clone().
              then(clone => {
                clone.setParent(house_cat).catch(console.error);
                channel_to_remake.delete().catch(console.error);
              }).
              catch(console.error);
          }
        }
      }

      reply = "Done";
    } else {
      reply = "You, player_mention, dare command this of me? Be gone, before you destroy these lands.";
    }

    return {reply};
  }
};
