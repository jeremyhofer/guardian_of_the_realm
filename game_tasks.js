const assets = require('./assets.js');
const db = require('./database.js');
const utils = require('./utils.js');

module.exports = {
  "role_payouts": (guild, current_time) => {
    const hours_between_payout = 12;
    const payout_percent = hours_between_payout / 24;
    const last_payout = db.get_last_payout.get();

    if(last_payout.time +
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
      db.update_last_payout.run(current_time);
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
  "resolve_war_votes": (guild, expiration_time) => {
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
              let troops_returned =
                attackers[att] - Math.round(attacker_losses *
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
              let troops_returned =
                defenders[att] - Math.round(defender_losses *
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
              let troops_returned =
                defenders[att] - Math.round(defender_losses *
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
              let troops_returned =
                attackers[att] - Math.round(attacker_losses *
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
      const channel = guild.channels.get(assets.reply_channels.battle_reports);
      channel.send(siege_reply);

      // Get next siege to try and resolve, if exists
      expired_siege = db.get_expired_siege.get(current_time);
    }
  }
};
