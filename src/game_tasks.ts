import { CategoryChannel, Guild, RoleManager, TextChannel } from 'discord.js';
import * as assets from './assets';
import { Database } from './data-source';
import { PlayerData } from './entity/PlayerData';
import { Siege } from './entity/Siege';
import { Buildings, Rank } from './types';
import * as utils from './utils';

export const rolePayouts = async(guild: Guild, currentTime: number): Promise<void> => {
  const hoursBetweenPayout = assets.timeoutLengths.payout_interval;
  const payoutPercent = hoursBetweenPayout / 24;
  const lastPayout = await Database.tracker.getTrackerByName('payout_time');

  if(lastPayout !== null && lastPayout.value + utils.hoursToMs(hoursBetweenPayout) <= currentTime) {
    // Payout roles
    for(const title in assets.dailyPayouts) {
      const payout = Math.round(assets.dailyPayouts[title as Buildings] * payoutPercent);
      const roleId = utils.findRoleIdGivenName(title, assets.gameRoles);
      // TODO: test this out
      await Database.playerData.grantRolePayoutToAllPlayers(
        guild.roles.cache.get(roleId)?.members.map((member) => member.id) ?? [],
        payout
      );
    }

    // Deduct troop prices
    await Database.playerData.deductTroopCosts(
      Math.round(assets.dailyCosts.men * payoutPercent),
      Math.round(assets.dailyCosts.ships * payoutPercent)
    );

    // Pay port ownership
    const portPayout = Math.round(assets.rewardPayoutsPenalties.port_daily * payoutPercent);

    // TODO: test this out
    const ports = await Database.tileOwner.getPorts();

    for(const port of ports) {
      // TODO: should do this just based on the house set in the DB?
      await Database.playerData.grantRolePayoutToAllPlayers(
        guild.roles.cache.get(port.house)?.members.map((member) => member.id) ?? [],
        portPayout
      );
    }

    await Database.tracker.updateTrackerByName('payout_time', currentTime);
  }
};

export const collectLoans = async(guild: Guild, currentTime: number): Promise<void> => {
  // TODO: select loans by user, so that we only need to retrieve and update once per user
  // Collect on all loans that are due
  const dueLoans = await Database.loan.getDueLoans(currentTime);

  for(const loan of dueLoans) {
    loan.user.money -= loan.amount_due;
    await Database.playerData.setPlayer(loan.user);
    await Database.loan.removeLoan(loan);
    await (guild.channels.cache.get(assets.replyChannels.command_tent) as TextChannel)?.send(
      `<@${loan.user.user}> your loan has expired. The remaining balance of ${loan.amount_due} has been deducted from your account`
    );
  };
};

export const resolveWarVotes = async(guild: Guild, expirationTime: number): Promise<void> => {
  let expiredWarVote = await Database.vote.getExpiredWarVote(expirationTime);

  while(expiredWarVote !== null) {
    // Get the data for the player who made this vote
    const playerData = expiredWarVote.user;
    const otherHouse = expiredWarVote.choice;

    // Get all votes for this specific war vote
    const pHouseVoteResults = await Database.vote.getVotesForHouseAgainstHouseByTypes(
      playerData.house,
      otherHouse,
      ['war_yes', 'war_no']
    );

    // Get the votes for/against
    const pYesCount = pHouseVoteResults.filter((r) => r.type === 'war_yes').length;
    const pNoCount = pHouseVoteResults.filter((r) => r.type === 'war_no').length;

    const pHouseVoteCount = pYesCount + pNoCount;

    let voteReply = `A war vote by <@&${playerData.house}> against <@&${otherHouse}> has finished. `;

    let regenMap = false;

    // Determine the vote outcome
    if(pHouseVoteCount > 0) {
      if(pYesCount > pNoCount) {
        // We have a war! Remove the pact
        await Database.pact.removePactBetweenHouses(
          playerData.house,
          otherHouse
        );

        await Database.war.createWar({ house_a: playerData.house, house_b: otherHouse });

        // War Happens!
        voteReply += 'Their Pact has been broken - this betrayal means War!';
        regenMap = true;
      } else {
        // We continue to WAR
        voteReply += 'The warmongers were shouted down - the Pact holds for now.';
      }
    } else {
      // This should indicate that the other house did not vote. War continues
      voteReply += 'Not very many people showed up - the Pact holds.';
    }

    voteReply += `\n<@&${playerData.house}>: ${pYesCount} yays ${pNoCount} nays`;

    // Send the reply
    // TODO: figure out how to send
    await (guild.channels.cache.get(assets.replyChannels.battle_reports) as TextChannel)?.send(voteReply);

    // Remove all associated votes
    await Database.vote.removeMultiple(pHouseVoteResults.map((r) => r.vote_id));

    if(regenMap) {
      await postUpdatedMap({ guild });
    }

    // Get next war to try and resolve, if exists
    expiredWarVote = await Database.vote.getExpiredWarVote(expirationTime);
  }
};

export const resolvePactVotes = async(guild: Guild, expirationTime: number): Promise<void> => {
  let expiredPactVote = await Database.vote.getExpiredPactVote(expirationTime);

  while(expiredPactVote !== null) {
    // Get the data for the player who made this vote
    const playerData = expiredPactVote.user;
    const otherHouse = expiredPactVote.choice;

    // Get all votes for both houses
    // TODO: further combine these selects?
    const pHouseVoteResults = await Database.vote.getVotesForHouseAgainstHouseByTypes(
      playerData.house,
      otherHouse,
      ['pact_yes', 'pact_no']
    );
    const oHouseVoteResults = await Database.vote.getVotesForHouseAgainstHouseByTypes(
      otherHouse,
      playerData.house,
      ['pact_yes', 'pact_no']
    );

    // Get the votes for/against
    const pYesCount = pHouseVoteResults.filter((r) => r.type === 'pact_yes').length;
    const pNoCount = pHouseVoteResults.filter((r) => r.type === 'pact_no').length;
    const oYesCount = oHouseVoteResults.filter((r) => r.type === 'pact_yes').length;
    const oNoCount = oHouseVoteResults.filter((r) => r.type === 'pact_no').length;

    const pHouseVoteCount = pYesCount + pNoCount;
    const oHouseVoteCount = oYesCount + oNoCount;

    let voteReply = `A pact vote between <@&${playerData.house}> and <@&${otherHouse}> has finished. `;

    let regenMap = false;

    // Determine the vote outcome
    if(pHouseVoteCount > 0 && oHouseVoteCount > 0) {
      if(pYesCount > pNoCount && oYesCount > oNoCount) {
        // We have a pact! Remove the war
        await Database.war.removeWarBetweenHouses(
          playerData.house,
          otherHouse
        );

        await Database.pact.createPact({ house_a: playerData.house, house_b: otherHouse });

        /*
        * If there were any sieges between the houses, remove them
        * and return the pledged troops
        */

        const siegesBetweenHouses = await Database.siege.getAllSiegeIdBetweenTwoHouses(
          playerData.house,
          otherHouse
        );

        // Iterate over each siege
        for(const siege of siegesBetweenHouses) {
          const tileOwner = siege.tile;
          const pledges = siege.pledges;
          const isPort = tileOwner.type === 'port';

          // Iterate over each pledge. Return the men and remore the pledge
          for(const pledge of pledges) {
            const pledgerData = pledge.user;
            if(isPort) {
              pledgerData.ships += pledge.units;
            } else {
              pledgerData.men += pledge.units;
            }
            await Database.playerData.setPlayer(pledgerData);
            await Database.pledge.removePledge(pledge);
          };

          // Remove the siege
          await Database.siege.removeSiege(siege);
        };
        // Pact was a success, both agreed.
        voteReply += 'A Pact has been brokered - pray the peace lasts!';
        regenMap = true;
      } else {
        // We continue to WAR
        voteReply += 'A Pact was not reached - War continues!';
      }
    } else {
      // This should indicate that the other house did not vote. War continues
      voteReply += 'The attempt failed horribly - War continues!';
    }

    voteReply += `\n<@&${playerData.house}>: ${pYesCount} yays ${pNoCount} nays`;

    voteReply += `\n<@&${otherHouse}>: ${oYesCount} yays ${oNoCount} nays`;

    // Send the reply
    // TODO: figure out how to send messages to channels
    await (guild.channels.cache.get(assets.replyChannels.battle_reports) as TextChannel)?.send(voteReply);

    // Remove all associated votes
    await Database.vote.removeMultiple([
      ...pHouseVoteResults.map((r) => r.vote_id),
      ...oHouseVoteResults.map((r) => r.vote_id)
    ]);

    if(regenMap) {
      await postUpdatedMap({ guild });
    }

    // Get next pact to try and resolve, if exists
    expiredPactVote = await Database.vote.getExpiredPactVote(expirationTime);
  }
};

export const resolveSieges = async(guild: Guild, currentTime: number): Promise<void> => {
  let expiredSiege = await Database.siege.getExpiredSiege(currentTime);

  while(expiredSiege !== null) {
    // Get pledges for the siege
    const pledges = expiredSiege.pledges;
    const attackPledges = pledges.filter(pledge => pledge.choice === 'attack');
    const defendPledges = pledges.filter(pledge => pledge.choice === 'defend');

    const tileOwner = expiredSiege.tile;
    const isPort = tileOwner.type === 'port';
    const attackerName = guild.roles.cache.get(expiredSiege.attacker)?.name ?? 'ATTACKER NAME ISSUE';
    const defenderName = guild.roles.cache.get(tileOwner.house)?.name ?? 'DEFENDER NAME ISSUE';
    const embed = generateSiegeEmbed(
      guild.roles,
      expiredSiege
    );

    const type = isPort ? 'blockade' : 'siege';
    const tileType = isPort ? 'port' : 'castle';

    embed.title = `FINISHED ${type} on ${expiredSiege.tile.tile.toUpperCase()}`;

    let regenMap = false;

    if(attackPledges.length !== 0 || defendPledges.length !== 0) {
      // Get men counts
      let attackerCount = 0;
      let defenderCount = 0;

      const attackers: Record<string, number> = {};
      const defenders: Record<string, number> = {};
      const allPledgers: Record<string, PlayerData> = {};

      attackPledges.forEach(pledge => {
        attackerCount += pledge.units;
        attackers[pledge.user.user] = pledge.units;

        if(!(pledge.user.user in allPledgers)) {
          allPledgers[pledge.user.user] = pledge.user;
        }
      });

      defendPledges.forEach(pledge => {
        defenderCount += pledge.units;
        defenders[pledge.user.user] = pledge.units;

        if(!(pledge.user.user in allPledgers)) {
          allPledgers[pledge.user.user] = pledge.user;
        }
      });

      // Determine chance to win, the reward pots, and the losses
      let winChance = Math.round(attackerCount / (attackerCount + defenderCount) * 100);

      if(winChance < 0) {
        winChance = 0;
      } else if(winChance > 100) {
        winChance = 100;
      }

      const numPledgers = attackPledges.length + defendPledges.length;
      const winPot = isPort ? 0 : 0 * numPledgers;
      const losePot = isPort ? 0 : 0 * numPledgers;
      const attackerLosses = utils.getPercentOfValueGivenRange(
        defenderCount,
        20,
        30
      );
      const defenderLosses = utils.getPercentOfValueGivenRange(
        attackerCount,
        20,
        30
      );

      const chance = utils.getRandomValueInRange(1, 100);
      let winMessage = '';

      // Determine the outcome
      if(winChance >= chance) {
        // Attacker wins!

        // Handle winnings for all attackers
        for(const att in attackers) {
          if(att in attackers && att in allPledgers) {
            const winnings = Math.round(winPot * attackers[att] / attackerCount);
            let troopsReturned = attackers[att] - Math.round(attackerLosses * attackers[att] / attackerCount);

            troopsReturned = troopsReturned < 0 ? 0 : troopsReturned;
            allPledgers[att].money += winnings;

            if(isPort) {
              allPledgers[att].ships += troopsReturned;
            } else {
              allPledgers[att].men += troopsReturned;
            }
          }
        }

        // Handle winnings for all defenders
        for(const att in defenders) {
          if(att in defenders && att in allPledgers) {
            const winnings = Math.round(losePot * defenders[att] / defenderCount);
            let troopsReturned = defenders[att] - Math.round(defenderLosses * defenders[att] / defenderCount);

            troopsReturned = troopsReturned < 0 ? 0 : troopsReturned;

            const unitAdjust = winnings + troopsReturned;
            if(isPort) {
              allPledgers[att].ships += unitAdjust;
            } else {
              allPledgers[att].men += unitAdjust;
            }
          }
        }

        // Reassign the tile
        await Database.tileOwner.updateTileOwner(expiredSiege.attacker, expiredSiege.tile.tile);
        winMessage = `${attackerName} successfully captured the ${tileType}!`;
        regenMap = true;
      } else {
        // Defender wins!

        // Handle winnings for all defenders
        for(const att in defenders) {
          if(att in defenders && att in allPledgers) {
            const winnings = Math.round(winPot * defenders[att] / defenderCount);
            let troopsReturned = defenders[att] - Math.round(defenderLosses * defenders[att] / defenderCount);

            troopsReturned = troopsReturned < 0 ? 0 : troopsReturned;
            allPledgers[att].money += winnings;

            if(isPort) {
              allPledgers[att].ships += troopsReturned;
            } else {
              allPledgers[att].men += troopsReturned;
            }
          }
        }

        // Handle winnings for all attackers
        for(const att in attackers) {
          if(att in attackers && att in allPledgers) {
            const winnings = Math.round(losePot * attackers[att] / attackerCount);
            let troopsReturned = attackers[att] - Math.round(attackerLosses * attackers[att] / attackerCount);

            troopsReturned = troopsReturned < 0 ? 0 : troopsReturned;

            const unitAdjust = winnings + troopsReturned;
            if(isPort) {
              allPledgers[att].ships += unitAdjust;
            } else {
              allPledgers[att].men += unitAdjust;
            }
          }
        }

        winMessage = `${defenderName} successfully defended the ${tileType}!`;
      }

      let message = `${numPledgers} player(s) contributed to this ${type}. `;

      if(isPort) {
        message += 'The members of the house controlling the port will ' +
          `each earn ${assets.rewardPayoutsPenalties.port_daily} ` +
          ':moneybag: per day.';
      } else {
        message += `${winPot} :moneybag: has been distributed to the ` +
          `winners. ${losePot} ${assets.emojis.MenAtArms} has been ` +
          'distributed to the losers.';
      }

      embed.fields.push({
        name: winMessage,
        value: message
      });

      // Update all the player data
      await Database.playerData.saveMultiple(Object.values(allPledgers));

      // Iterate over each pledge and remove it
      await Database.pledge.removePledgesForSiege(expiredSiege);
    } else {
      // No one pledged
      embed.fields.push({
        name: `${defenderName} has kept their ${tileType}.`,
        value: `No one pledged to the ${type}.`
      });
    }

    const channel = guild.channels.cache.get(assets.replyChannels.battle_reports);
    // TODO: figure out how to edit message
    await (channel as TextChannel)?.messages.fetch(expiredSiege.message).then(async(message) => {
      await message.edit({ embeds: [embed] });
    });

    // Remove the siege
    await Database.siege.removeSiege(expiredSiege);

    // Get next siege to try and resolve, if exists
    expiredSiege = await Database.siege.getExpiredSiege(currentTime);

    if(regenMap) {
      await postUpdatedMap({ guild });
    }
  }
};

// TODO: give proper return
export const generateSiegeEmbed = (guildRoles: RoleManager | null, siege: Siege): any => {
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
  const tileOwner = siege.tile;
  const pledges = siege.pledges;

  const attackerCounts: Record<string, number> = {};
  const defenderCounts: Record<string, number> = {};
  let attackerTotal = 0;
  let defenderTotal = 0;

  const isPort = tileOwner.type === 'port';

  pledges.forEach(pledge => {
    const playerInfo = pledge.user;
    if(pledge.choice === 'attack') {
      if(playerInfo.house in attackerCounts) {
        attackerCounts[playerInfo.house] += pledge.units;
      } else {
        attackerCounts[playerInfo.house] = pledge.units;
      }

      attackerTotal += pledge.units;
    } else if(pledge.choice === 'defend') {
      if(playerInfo.house in defenderCounts) {
        defenderCounts[playerInfo.house] += pledge.units;
      } else {
        defenderCounts[playerInfo.house] = pledge.units;
      }

      defenderTotal += pledge.units;
    }
  });

  const attackerName = guildRoles?.cache.get(siege.attacker)?.name ?? 'ATTACKER NAME ISSUE';
  const defenderName = guildRoles?.cache.get(tileOwner.house)?.name ?? 'DEFENDER NAME ISSUE';

  let attackerWinChance = 0;
  let defenderWinChance = 0;

  if(attackerTotal !== 0) {
    // TODO: move win chance to a util method
    attackerWinChance = Math.round(attackerTotal / (attackerTotal + defenderTotal) * 100);
  }

  if(defenderTotal !== 0) {
    defenderWinChance = 100 - attackerWinChance;
  }

  let attackers = '';
  let defenders = '';
  const emoji = isPort ? assets.emojis.Warship : assets.emojis.MenAtArms;

  for(const house in attackerCounts) {
    const num = attackerCounts[house];
    attackers += `<@&${house}> ${num} ${emoji}\n`;
  }

  for(const house in defenderCounts) {
    const num = defenderCounts[house];
    defenders += `<@&${house}> ${num} ${emoji}\n`;
  }

  attackers = attackers !== '' ? attackers : 'no pledges';

  defenders = defenders !== '' ? defenders : 'no pledges';

  const attackerFieldName = `Attacker: ${attackerName} ${attackerTotal} ${emoji} ${attackerWinChance}%`;

  const defenderFieldName = `Defender: ${defenderName} ${defenderTotal} ${emoji} ${defenderWinChance}%`;

  /*
  const winner_payout = pledges.length * 3000;
  const loser_payout = pledges.length * 20;

  const rewards = `Winners: ${winner_payout} :moneybag:\n` +
  `Losers: ${loser_payout} ${assets.emojis.MenAtArms}`;
  */
  const type = isPort ? 'Blockade' : 'Siege';

  const embed = {
    title: `${type} on ${siege.tile.tile.toUpperCase()}`,
    fields: [
      {
        name: attackerFieldName,
        value: attackers
      },
      {
        name: defenderFieldName,
        value: defenders
      }
    ]
  };

  /*
  if(!isPort) {
  embed.fields.push({
  "name": "Rewards",
  "value": rewards
  });
  }
  */

  return embed;
};

export const postUpdatedMap = async({ guild }: { guild: Guild | null }): Promise<void> => {
  /*
  * Generates a map. 8x12 (tiles are emojis). top row and left column are
  * positions (A1, etc.) outer edge all sea. inner random. 14 castles on
  * grid owned by houses are what matter
  */
  const e = assets.emojis;
  /* const castles = [
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
  ]; */
  const mapData = [
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

  let mapOwners = '';
  let portOwners = '';

  const tileOwners = await Database.tileOwner.getAllTiles();
  tileOwners.forEach(tile => {
    const coords = tile.tile;
    const column = parseInt(`${coords.slice(0, 1).charCodeAt(0)}`, 10) - 96;
    const row = parseInt(coords.slice(1), 10);
    const ownerTile = assets.houseTiles[tile.house];
    const ownerTileType = tile.type === 'port' ? 'Port' + ownerTile : 'Tile' + ownerTile;
    const tileEmoji = e[ownerTileType];
    mapData[row][column] = tileEmoji;

    if(tile.type === 'port') {
      portOwners += `${tile.tile.toUpperCase()}: <@&${tile.house}>\n`;
    } else {
      mapOwners += `${tile.tile.toUpperCase()}: <@&${tile.house}>\n`;
    }
  });

  let mapTiles = '';

  mapData.forEach(row => {
    row.forEach(column => {
      mapTiles += column;
    });
    mapTiles += '\n';
  });

  let activePacts = '';
  const allPacts = await Database.pact.getAllPacts();
  allPacts.forEach(pact => {
    const [h1Troop] = assets.gameRoles[pact.house_a];
    const [h2Troop] = assets.gameRoles[pact.house_b];

    activePacts += `${h1Troop} :handshake: ${h2Troop}\n`;
  });

  activePacts = activePacts === '' ? 'No active pacts' : activePacts;

  let activeSieges = '';
  let activeBlockades = '';
  const allSieges = await Database.siege.getAllSieges();
  allSieges.forEach(siege => {
    if(siege.tile.type === 'port') {
      activeBlockades += `${siege.tile.tile}: :crossed_swords: <@&${siege.attacker}>\n`;
    } else {
      activeSieges += `${siege.tile.tile}: :crossed_swords: <@&${siege.attacker}>\n`;
    }
  });

  activeSieges = activeSieges !== '' ? activeSieges : 'No active sieges';

  activeBlockades = activeBlockades !== '' ? activeBlockades : 'No active blockades';

  const embed = {
    fields: [
      {
        name: 'Castles',
        value: mapOwners
      },
      {
        name: 'Ports',
        value: portOwners
      },
      {
        name: 'Active Pacts',
        value: activePacts
      },
      {
        name: 'Active Sieges',
        value: activeSieges
      },
      {
        name: 'Active Blockades',
        value: activeBlockades
      }
    ]
  };

  const channel = guild?.channels.cache.get(assets.replyChannels.overworld);
  const existingMapMessages = await Database.tracker.getAllTrackerByName('map');

  for(const toDelete of existingMapMessages) {
    // TODO: figure out how to delete message
    await (channel as TextChannel)?.messages.fetch(toDelete.text)
      .then(async(message) => await message.delete())
      .then(async() => await Database.tracker.removeTracker(toDelete));
  };

  // TODO: figure out how to send message
  await (channel as TextChannel)?.send({
    content: mapTiles,
    embeds: [embed]
  }).then(async(messages) => {
    if(Array.isArray(messages)) {
      await Database.tracker.createMapTrackers(messages.map((m) => m.id));
    }
  });
};

export const resetEverything = async({ guild, playerRoles, currentTime }: { guild: Guild, playerRoles: string[], currentTime: number }): Promise<{ reply: string, enableGame: boolean }> => {
  const commandReturn = {
    reply: '',
    enableGame: false
  };

  if(playerRoles.includes('developer')) {
    // Remove everyone from game roles
    for(const roleId in assets.gameRoles) {
      if(roleId !== '625905668263510017') {
        guild.roles.cache.get(roleId)?.members.forEach(member => {
          member.roles.remove(roleId).catch(console.error);
        });
      }
    }

    // Reset everyone's data
    await Database.playerData.resetAllPlayers();

    // TODO: reimpl reset_everything
    // db.reset_everything();

    await postUpdatedMap({ guild });

    const remakeChannels = [
      'house-bear',
      'house-dragon',
      'house-falcon',
      'house-hydra',
      'house-lion',
      'house-scorpion',
      'house-wolf'
    ];

    const houseCategory: CategoryChannel = guild.channels.cache.find(channel => channel.name === 'The Great Houses') as CategoryChannel;

    if(houseCategory !== undefined) {
      for(let inc = 0; inc < remakeChannels.length; inc += 1) {
        const channelToRemake = guild.channels.cache.find(channel => channel.name === remakeChannels[inc]);

        if(channelToRemake !== undefined) {
          (channelToRemake as TextChannel).clone().then(clone => {
            clone.setParent(houseCategory).catch(console.error);
            channelToRemake.delete().catch(console.error);
          }).catch(console.error);
        }
      }
    }

    await Database.tracker.updateTrackerByName('game_start', currentTime);

    commandReturn.reply = 'Done';
    commandReturn.enableGame = true;
  } else {
    commandReturn.reply = 'You dare command this of me? Be gone, before you destroy these lands.';
  }

  return commandReturn;
};

export const generateRolesReply = ({ playerRoles }: { playerRoles: string[] }): string => {
  const moneyRoles: Buildings[] = [
    'apothecary',
    'armory',
    'barrack',
    'blacksmith',
    'bordello',
    'haunt',
    'monastery',
    'weavery'
  ];

  const troopRoles: Rank[] = [
    'duke',
    'earl',
    'baron',
    'unsworn'
  ];

  let reply = 'Income Roles:\n';

  moneyRoles.forEach(role => {
    const roleCap = role[0].toUpperCase() + role.slice(1);
    const symbol = playerRoles.includes(role) ? ':white_check_mark:' : ':x:';
    reply += `${symbol} ${roleCap}: ${assets.dailyPayouts[role]} :moneybag: per Day\n`;
  });

  let roleReply = '';
  let noRole = true;

  for(let inc = 0; inc < troopRoles.length; inc += 1) {
    const role = troopRoles[inc];
    const troopLimit = assets.roleTroopLimits[role];
    const roleCap = role[0].toUpperCase() + role.slice(1);
    let roleMark = ':x:';
    if(playerRoles.includes(role) || role === 'unsworn') {
      if(noRole) {
        roleMark = ':white_check_mark:';
        noRole = false;
      } else {
        roleMark = ':arrow_down:';
      }
    } else if(!noRole) {
      roleMark = ':arrow_down:';
    }

    roleReply = `${roleMark} ${roleCap} ${troopLimit} ${assets.emojis.MenAtArms} per Siege\n${roleReply}`;
  }

  reply += `\nNobility Roles:\n${roleReply}`;

  return reply;
};

export const isGameActive = async(): Promise<boolean> => {
  // Check to see if any house has 7 castles. If so, game over!
  let gameActive = true;
  const ownerCounts: Record<string, number> = {};

  (await Database.tileOwner.getAllTiles()).forEach(tile => {
    if(tile.type === 'castle') {
      if(tile.house in ownerCounts) {
        ownerCounts[tile.house] += 1;
      } else {
        ownerCounts[tile.house] = 1;
      }
    }
  });

  for(const house in ownerCounts) {
    if(ownerCounts[house] >= 7) {
      gameActive = false;
    }
  }

  return gameActive;
};
