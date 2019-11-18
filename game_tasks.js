const assets = require('./assets.js');
const db = require('./database.js');
const utils = require('./utils.js');

module.exports = {
  "role_payouts": (guild, current_time) => {
    const hours_between_payout = 12;
    const payout_percent = hours_between_payout / 24;
    const last_payout = db.get_tracker_by_name.get("payout_time");

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
      let regen_map = false;

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
              pledger_data.men += pledge.men;
              db.set_player.run(pledger_data);
              db.remove_pledge.run(pledge);
            });

            // Remove the siege
            db.remove_siege.run(siege);
          });

          vote_reply += "A truce has been declared - the war is over!";
          regen_map = true;
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

      if(regen_map) {
        module.exports.post_updated_map({guild});
      }

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

      const tile_owner = db.get_tile_owner.get(expired_siege.tile);
      const attacker_name = guild.roles.get(expired_siege.attacker).name;
      const defender_name = guild.roles.get(tile_owner.house).name;
      const embed = {
        "title": `FINISHED siege on ${expired_siege.tile.toUpperCase()}`,
        "fields": []
      };

      let regen_map = false;

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

        embed.fields.push(
          {
            "name": `Attacking House: ${attacker_name}`,
            "value": `${attacker_count} ${assets.emojis.MenAtArms} pledged`
          },
          {
            "name": `Defending House: ${defender_name}`,
            "value": `${defender_count} ${assets.emojis.MenAtArms} pledged`
          }
        );

        // Determine chance to win, the reward pots, and the losses
        let win_chance = Math.round(attacker_count /
          (attacker_count + defender_count) * 100);

        if(win_chance < 0) {
          win_chance = 0;
        } else if(win_chance > 100) {
          win_chance = 100;
        }

        const num_pledgers = attack_pledges.length + defend_pledges.length;
        const win_pot = 3000 * num_pledgers;
        const lose_pot = 20 * num_pledgers;
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
          win_message = `${attacker_name} successfully captured the tile!`;
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

          win_message = `${defender_name} successfully defended the tile!`;
        }

        embed.fields.push({
          "name": win_message,
          "value": `${num_pledgers} contributed to this siege. ${win_pot} ` +
          `:moneybag: has been paid to the attackers. ${lose_pot} ` +
          `${assets.emojis.MenAtArms} has been paid to the defenders.`
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
          "name": `${defender_name} has kept their tile.`,
          "value": "No one pledged to the siege."
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
     *  Name: Attaching House: @house
     *  Value: # :ManAtArms: pledged
     * Field2:
     *  Name: Defending House: @house
     *  Value: # :ManAtArms: pledged
     */
    const siege = db.get_siege_by_id.get(siege_id);
    const tile_owner = db.get_tile_owner.get(siege.tile);
    const pledges = db.get_all_pledges_for_siege.all(siege);

    let num_attackers = 0;
    let num_defenders = 0;

    pledges.forEach(pledge => {
      if(pledge.choice === 'attack') {
        num_attackers += pledge.men;
      } else if(pledge.choice === 'defend') {
        num_defenders += pledge.men;
      }
    });

    const attacker_name = guild_roles.get(siege.attacker).name;
    const defender_name = guild_roles.get(tile_owner.house).name;

    return {
      "title": `Siege on ${siege.tile.toUpperCase()}`,
      "fields": [
        {
          "name": `Attacking House: ${attacker_name}`,
          "value": `${num_attackers} ${assets.emojis.MenAtArms} pledged`
        },
        {
          "name": `Defending House: ${defender_name}`,
          "value": `${num_defenders} ${assets.emojis.MenAtArms} pledged`
        }
      ]
    };
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

    const tile_owners = db.get_all_tiles.all();
    tile_owners.forEach(tile => {
      const coords = tile.tile;
      const column = parseInt(coords.slice(0, 1).charCodeAt(0), 10) - 96;
      const row = parseInt(coords.slice(1), 10);
      const owner_tile = assets.house_tiles[tile.house];
      const tile_emoji = e[owner_tile];
      map_data[row][column] = tile_emoji;
      map_owners += `${tile.tile.toUpperCase()}: <@&${tile.house}>\n`;
    });

    let map_tiles = "";

    map_data.forEach(row => {
      row.forEach(column => {
        map_tiles += column;
      });
      map_tiles += "\n";
    });

    let active_wars = "";
    const all_wars = db.get_all_wars.all();
    all_wars.forEach(war => {
      active_wars += `<@&${war.house_a}> :crossed_swords: <@&${war.house_b}>\n`;
    });

    active_wars = active_wars === ""
      ? "No active wars"
      : active_wars;

    const embed = {
      "fields": [
        {
          "name": "Owners",
          "value": map_owners
        },
        {
          "name": "Active Wars",
          "value": active_wars
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
  }
};