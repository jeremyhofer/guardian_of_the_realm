import {
  APIEmbed,
  ChatInputCommandInteraction,
  Collection,
  Guild,
  GuildMember,
  RoleManager,
  Snowflake,
  User,
} from 'discord.js';
import * as assets from './assets';
import { Database } from './data-source';
import { PlayerData } from './entity/PlayerData';
import { TileOwner } from './entity/TileOwner';
import { buildings, CommandReturn, Rank, StoreItemTypes } from './types';
import * as utils from './utils';

export const rolePayouts = async (
  guild: Guild,
  currentTime: number
): Promise<void> => {
  const hoursBetweenPayout = assets.timeoutLengths.payout_interval;
  const payoutPercent = hoursBetweenPayout / 24;
  const lastPayout = await Database.tracker.getTrackerByName('payout_time');

  if (
    lastPayout !== null &&
    lastPayout.value + utils.hoursToMs(hoursBetweenPayout) <= currentTime
  ) {
    // Payout roles
    for (const [title, titleDailyPayout] of Object.entries(
      assets.dailyPayouts
    )) {
      const payout = Math.round(titleDailyPayout * payoutPercent);
      const roleId = utils.findRoleIdGivenName(title, assets.gameRoles);
      const players =
        guild.roles.cache.get(roleId)?.members.map((member) => member.id) ?? [];

      if (players.length > 0) {
        await Database.playerData.grantRolePayoutToAllPlayers(players, payout);
      }
    }

    // Deduct troop prices
    await Database.playerData.deductTroopCosts(
      Math.round(assets.dailyCosts.men * payoutPercent),
      Math.round(assets.dailyCosts.ships * payoutPercent)
    );

    // Pay port ownership
    const portPayout = Math.round(
      assets.rewardPayoutsPenalties.port_daily * payoutPercent
    );

    // TODO: test this out
    const ports = await Database.tileOwner.getPorts();

    for (const port of ports) {
      // TODO: should do this just based on the house set in the DB?
      const players =
        guild.roles.cache.get(port.house)?.members.map((member) => member.id) ??
        [];

      if (players.length > 0) {
        await Database.playerData.grantRolePayoutToAllPlayers(
          guild.roles.cache
            .get(port.house)
            ?.members.map((member) => member.id) ?? [],
          portPayout
        );
      }
    }

    await Database.tracker.updateTrackerByName('payout_time', currentTime);
  }
};

export const collectLoans = async (
  guild: Guild,
  currentTime: number
): Promise<void> => {
  // TODO: select loans by user, so that we only need to retrieve and update once per user
  // Collect on all loans that are due
  const dueLoans = await Database.loan.getDueLoans(currentTime);

  for (const loan of dueLoans) {
    loan.user.money -= loan.amount_due;
    await Database.playerData.setPlayer(loan.user);
    await Database.loan.removeLoan(loan);
    const channel = utils.getGuildTextChannel(
      guild,
      assets.replyChannels.command_tent
    );

    if (channel !== null) {
      await channel.send(
        `<@${loan.user.user}> your loan has expired. The remaining balance of ${loan.amount_due} has been deducted from your account`
      );
    } else {
      console.error('Could not find channel for guild');
    }
  }
};

export const resolveWarVotes = async (
  guild: Guild,
  expirationTime: number
): Promise<void> => {
  let expiredWarVote = await Database.vote.getExpiredWarVote(expirationTime);

  while (expiredWarVote !== null) {
    // Get the data for the player who made this vote
    const playerData = expiredWarVote.user;
    const otherHouse = expiredWarVote.choice;

    // Get all votes for this specific war vote
    const pHouseVoteResults =
      await Database.vote.getVotesForHouseAgainstHouseByTypes(
        playerData.house,
        otherHouse,
        ['war_yes', 'war_no']
      );

    // Get the votes for/against
    const pYesCount = pHouseVoteResults.filter(
      (r) => r.type === 'war_yes'
    ).length;
    const pNoCount = pHouseVoteResults.filter(
      (r) => r.type === 'war_no'
    ).length;

    const pHouseVoteCount = pYesCount + pNoCount;

    let voteReply = `A war vote by <@&${playerData.house}> against <@&${otherHouse}> has finished. `;

    let regenMap = false;

    // Determine the vote outcome
    if (pHouseVoteCount > 0) {
      if (pYesCount > pNoCount) {
        // We have a war! Remove the pact
        await Database.pact.removePactBetweenHouses(
          playerData.house,
          otherHouse
        );

        await Database.war.createWar({
          house_a: playerData.house,
          house_b: otherHouse,
        });

        // War Happens!
        voteReply += 'Their Pact has been broken - this betrayal means War!';
        regenMap = true;
      } else {
        // We continue to WAR
        voteReply +=
          'The warmongers were shouted down - the Pact holds for now.';
      }
    } else {
      // This should indicate that the other house did not vote. War continues
      voteReply += 'Not very many people showed up - the Pact holds.';
    }

    voteReply += `\n<@&${playerData.house}>: ${pYesCount} yays ${pNoCount} nays`;

    // Send the reply
    const channel = utils.getGuildTextChannel(
      guild,
      assets.replyChannels.battle_reports
    );

    if (channel !== null) {
      await channel.send(voteReply);
    } else {
      console.error('Could not find text channel for guild');
    }

    // Remove all associated votes
    await Database.vote.removeMultiple(pHouseVoteResults.map((r) => r.vote_id));

    if (regenMap) {
      await postUpdatedMap(guild);
    }

    // Get next war to try and resolve, if exists
    expiredWarVote = await Database.vote.getExpiredWarVote(expirationTime);
  }
};

export const resolvePactVotes = async (
  guild: Guild,
  expirationTime: number
): Promise<void> => {
  let expiredPactVote = await Database.vote.getExpiredPactVote(expirationTime);

  while (expiredPactVote !== null) {
    // Get the data for the player who made this vote
    const playerData = expiredPactVote.user;
    const otherHouse = expiredPactVote.choice;

    // Get all votes for both houses
    // TODO: further combine these selects?
    const pHouseVoteResults =
      await Database.vote.getVotesForHouseAgainstHouseByTypes(
        playerData.house,
        otherHouse,
        ['pact_yes', 'pact_no']
      );
    const oHouseVoteResults =
      await Database.vote.getVotesForHouseAgainstHouseByTypes(
        otherHouse,
        playerData.house,
        ['pact_yes', 'pact_no']
      );

    // Get the votes for/against
    const pYesCount = pHouseVoteResults.filter(
      (r) => r.type === 'pact_yes'
    ).length;
    const pNoCount = pHouseVoteResults.filter(
      (r) => r.type === 'pact_no'
    ).length;
    const oYesCount = oHouseVoteResults.filter(
      (r) => r.type === 'pact_yes'
    ).length;
    const oNoCount = oHouseVoteResults.filter(
      (r) => r.type === 'pact_no'
    ).length;

    const pHouseVoteCount = pYesCount + pNoCount;
    const oHouseVoteCount = oYesCount + oNoCount;

    let voteReply = `A pact vote between <@&${playerData.house}> and <@&${otherHouse}> has finished. `;

    let regenMap = false;

    // Determine the vote outcome
    if (pHouseVoteCount > 0 && oHouseVoteCount > 0) {
      if (pYesCount > pNoCount && oYesCount > oNoCount) {
        // We have a pact! Remove the war
        await Database.war.removeWarBetweenHouses(playerData.house, otherHouse);

        await Database.pact.createPact({
          house_a: playerData.house,
          house_b: otherHouse,
        });

        /*
         * If there were any sieges between the houses, remove them
         * and return the pledged troops
         */

        const siegesBetweenHouses =
          await Database.siege.getAllSiegeIdBetweenTwoHouses(
            playerData.house,
            otherHouse
          );

        // Iterate over each siege
        for (const siege of siegesBetweenHouses) {
          const tileOwner = siege.tile;
          const pledges = siege.pledges;
          const isPort = tileOwner.type === 'port';

          // Iterate over each pledge. Return the men and remore the pledge
          for (const pledge of pledges) {
            const pledgerData = pledge.user;
            if (isPort) {
              pledgerData.ships += pledge.units;
            } else {
              pledgerData.men += pledge.units;
            }
            await Database.playerData.setPlayer(pledgerData);
            await Database.pledge.removePledge(pledge);
          }

          // Remove the siege
          await Database.siege.removeSiege(siege);
        }
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
    const channel = utils.getGuildTextChannel(
      guild,
      assets.replyChannels.battle_reports
    );

    if (channel !== null) {
      await channel.send(voteReply);
    } else {
      console.error('Could not find channel for guild');
    }

    // Remove all associated votes
    await Database.vote.removeMultiple([
      ...pHouseVoteResults.map((r) => r.vote_id),
      ...oHouseVoteResults.map((r) => r.vote_id),
    ]);

    if (regenMap) {
      await postUpdatedMap(guild);
    }

    // Get next pact to try and resolve, if exists
    expiredPactVote = await Database.vote.getExpiredPactVote(expirationTime);
  }
};

export const resolveSieges = async (
  guild: Guild,
  currentTime: number
): Promise<void> => {
  let expiredSiege = await Database.siege.getExpiredSiege(currentTime);

  while (expiredSiege !== null) {
    // Get pledges for the siege
    const pledges = expiredSiege.pledges;
    const attackPledges = pledges.filter(
      (pledge) => pledge.choice === 'attack'
    );
    const defendPledges = pledges.filter(
      (pledge) => pledge.choice === 'defend'
    );

    const tileOwner = expiredSiege.tile;
    const isPort = tileOwner.type === 'port';
    const attackerName =
      guild.roles.cache.get(expiredSiege.attacker)?.name ??
      'ATTACKER NAME ISSUE';
    const defenderName =
      guild.roles.cache.get(tileOwner.house)?.name ?? 'DEFENDER NAME ISSUE';
    const generatedEmbed = await generateSiegeEmbed(
      guild.roles,
      tileOwner.tile
    );

    const embed: APIEmbed = generatedEmbed ?? {};

    const type = isPort ? 'blockade' : 'siege';
    const tileType = isPort ? 'port' : 'castle';

    embed.title = `FINISHED ${type} on ${expiredSiege.tile.tile.toUpperCase()}`;

    let regenMap = false;

    if (attackPledges.length !== 0 || defendPledges.length !== 0) {
      // Get men counts
      let attackerCount = 0;
      let defenderCount = 0;

      const attackers: Record<string, number> = {};
      const defenders: Record<string, number> = {};
      const allPledgers: Record<string, PlayerData> = {};

      attackPledges.forEach((pledge) => {
        attackerCount += pledge.units;
        attackers[pledge.user.user] = pledge.units;

        if (!(pledge.user.user in allPledgers)) {
          allPledgers[pledge.user.user] = pledge.user;
        }
      });

      defendPledges.forEach((pledge) => {
        defenderCount += pledge.units;
        defenders[pledge.user.user] = pledge.units;

        if (!(pledge.user.user in allPledgers)) {
          allPledgers[pledge.user.user] = pledge.user;
        }
      });

      // Determine chance to win, the reward pots, and the losses
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

      let winMessage = '';

      // Determine the outcome
      if (utils.isAWin(attackerCount, defenderCount)) {
        // Attacker wins!

        // Handle winnings for all attackers
        for (const att in attackers) {
          if (att in attackers && att in allPledgers) {
            const winnings = Math.round(
              (winPot * attackers[att]) / attackerCount
            );
            let troopsReturned =
              attackers[att] -
              Math.round((attackerLosses * attackers[att]) / attackerCount);

            troopsReturned = troopsReturned < 0 ? 0 : troopsReturned;
            allPledgers[att].money += winnings;

            if (isPort) {
              allPledgers[att].ships += troopsReturned;
            } else {
              allPledgers[att].men += troopsReturned;
            }
          }
        }

        // Handle winnings for all defenders
        for (const att in defenders) {
          if (att in defenders && att in allPledgers) {
            const winnings = Math.round(
              (losePot * defenders[att]) / defenderCount
            );
            let troopsReturned =
              defenders[att] -
              Math.round((defenderLosses * defenders[att]) / defenderCount);

            troopsReturned = troopsReturned < 0 ? 0 : troopsReturned;

            const unitAdjust = winnings + troopsReturned;
            if (isPort) {
              allPledgers[att].ships += unitAdjust;
            } else {
              allPledgers[att].men += unitAdjust;
            }
          }
        }

        // Reassign the tile
        await Database.tileOwner.updateTileOwner(
          expiredSiege.attacker,
          expiredSiege.tile.tile
        );
        winMessage = `${attackerName} successfully captured the ${tileType}!`;
        regenMap = true;
      } else {
        // Defender wins!

        // Handle winnings for all defenders
        for (const att in defenders) {
          if (att in defenders && att in allPledgers) {
            const winnings = Math.round(
              (winPot * defenders[att]) / defenderCount
            );
            let troopsReturned =
              defenders[att] -
              Math.round((defenderLosses * defenders[att]) / defenderCount);

            troopsReturned = troopsReturned < 0 ? 0 : troopsReturned;
            allPledgers[att].money += winnings;

            if (isPort) {
              allPledgers[att].ships += troopsReturned;
            } else {
              allPledgers[att].men += troopsReturned;
            }
          }
        }

        // Handle winnings for all attackers
        for (const att in attackers) {
          if (att in attackers && att in allPledgers) {
            const winnings = Math.round(
              (losePot * attackers[att]) / attackerCount
            );
            let troopsReturned =
              attackers[att] -
              Math.round((attackerLosses * attackers[att]) / attackerCount);

            troopsReturned = troopsReturned < 0 ? 0 : troopsReturned;

            const unitAdjust = winnings + troopsReturned;
            if (isPort) {
              allPledgers[att].ships += unitAdjust;
            } else {
              allPledgers[att].men += unitAdjust;
            }
          }
        }

        winMessage = `${defenderName} successfully defended the ${tileType}!`;
      }

      let message = `${numPledgers} player(s) contributed to this ${type}. `;

      if (isPort) {
        message +=
          'The members of the house controlling the port will ' +
          `each earn ${assets.rewardPayoutsPenalties.port_daily} ` +
          ':moneybag: per day.';
      } else {
        message +=
          `${winPot} :moneybag: has been distributed to the ` +
          `winners. ${losePot} ${assets.emojis.MenAtArms} has been ` +
          'distributed to the losers.';
      }

      embed.fields?.push({
        name: winMessage,
        value: message,
      });

      // Update all the player data
      await Database.playerData.saveMultiple(Object.values(allPledgers));

      // Iterate over each pledge and remove it
      await Database.pledge.removePledgesForSiege(expiredSiege);
    } else {
      // No one pledged
      embed.fields?.push({
        name: `${defenderName} has kept their ${tileType}.`,
        value: `No one pledged to the ${type}.`,
      });
    }

    const channel = utils.getGuildTextChannel(
      guild,
      assets.replyChannels.battle_reports
    );

    if (channel !== null) {
      await channel.messages
        .fetch(expiredSiege.message)
        .then(async (message) => {
          await message.edit({ embeds: [embed] });
        });
    } else {
      console.error('Could not find channel for guild');
    }

    // Remove the siege
    await Database.siege.removeSiege(expiredSiege);

    // Get next siege to try and resolve, if exists
    expiredSiege = await Database.siege.getExpiredSiege(currentTime);

    if (regenMap) {
      await postUpdatedMap(guild);
    }
  }
};

export const generateSiegeEmbed = async (
  guildRoles: RoleManager | null,
  tileId: string
): Promise<APIEmbed | null> => {
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
  const tileOwner = await Database.tileOwner.getTileOwner(tileId);

  if (tileOwner === null) {
    console.error('did not find tile_owner to generate siege embed');
    return null;
  }

  const siege = tileOwner.siege;

  const pledges = await Database.pledge.getAllPledgesForSiege(siege);

  const attackerCounts: Record<string, number> = {};
  const defenderCounts: Record<string, number> = {};
  let attackerTotal = 0;
  let defenderTotal = 0;

  const isPort = tileOwner.type === 'port';

  pledges.forEach((pledge) => {
    const playerInfo = pledge.user;
    if (pledge.choice === 'attack') {
      if (playerInfo.house in attackerCounts) {
        attackerCounts[playerInfo.house] += pledge.units;
      } else {
        attackerCounts[playerInfo.house] = pledge.units;
      }

      attackerTotal += pledge.units;
    } else if (pledge.choice === 'defend') {
      if (playerInfo.house in defenderCounts) {
        defenderCounts[playerInfo.house] += pledge.units;
      } else {
        defenderCounts[playerInfo.house] = pledge.units;
      }

      defenderTotal += pledge.units;
    }
  });

  const attackerName =
    guildRoles?.cache.get(siege.attacker)?.name ?? 'ATTACKER NAME ISSUE';
  const defenderName =
    guildRoles?.cache.get(tileOwner.house)?.name ?? 'DEFENDER NAME ISSUE';

  let attackerWinChance = 0;
  let defenderWinChance = 0;

  if (attackerTotal !== 0) {
    attackerWinChance = utils.winChance(attackerTotal, defenderTotal);
  }

  if (defenderTotal !== 0) {
    defenderWinChance = 100 - attackerWinChance;
  }

  let attackers = '';
  let defenders = '';
  const emoji = isPort ? assets.emojis.Warship : assets.emojis.MenAtArms;

  for (const house in attackerCounts) {
    const num = attackerCounts[house];
    attackers += `<@&${house}> ${num} ${emoji}\n`;
  }

  for (const house in defenderCounts) {
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

  const embed: APIEmbed = {
    title: `${type} on ${tileOwner.tile.toUpperCase()}`,
    fields: [
      {
        name: attackerFieldName,
        value: attackers,
      },
      {
        name: defenderFieldName,
        value: defenders,
      },
    ],
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

export const postUpdatedMap = async (guild: Guild): Promise<CommandReturn> => {
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
    [
      e.RowCompass,
      e.ColumnA,
      e.ColumnB,
      e.ColumnC,
      e.ColumnD,
      e.ColumnE,
      e.ColumnF,
      e.ColumnG,
      e.ColumnH,
    ],
    [
      e.Row1,
      e.TileSea,
      e.TileSea,
      e.TileSea,
      e.TileSea,
      e.TileSea,
      e.TileSea,
      e.TileSea,
      e.TileSea,
    ],
    [
      e.Row2,
      e.TileSea,
      e.TileField,
      e.TileLion,
      e.TileSea,
      e.TileSea,
      e.TileField,
      e.TileSea,
      e.TileSea,
    ],
    [
      e.Row3,
      e.TileSea,
      e.TileFalcon,
      e.TileForest,
      e.TileBadland,
      e.TileSea,
      e.TileBadland,
      e.TileBear,
      e.TileSea,
    ],
    [
      e.Row4,
      e.TileSea,
      e.TileMount,
      e.TileMount,
      e.TileScorpion,
      e.TileMount,
      e.TileSea,
      e.TileField,
      e.TileSea,
    ],
    [
      e.Row5,
      e.TileSea,
      e.TileField,
      e.TileBadland,
      e.TileField,
      e.TileSea,
      e.TileHydra,
      e.TileLion,
      e.TileSea,
    ],
    [
      e.Row6,
      e.TileSea,
      e.TileDragon,
      e.TileSea,
      e.TileDragon,
      e.TileScorpion,
      e.TileSea,
      e.TileForest,
      e.TileSea,
    ],
    [
      e.Row7,
      e.TileSea,
      e.TileField,
      e.TileSea,
      e.TileHydra,
      e.TileForest,
      e.TileBadland,
      e.TileBadland,
      e.TileSea,
    ],
    [
      e.Row8,
      e.TileSea,
      e.TileField,
      e.TileField,
      e.TileBadland,
      e.TileSea,
      e.TileForest,
      e.TileField,
      e.TileSea,
    ],
    [
      e.Row9,
      e.TileSea,
      e.TileMount,
      e.TileSea,
      e.TileBadland,
      e.TileSea,
      e.TileMount,
      e.TileFalcon,
      e.TileSea,
    ],
    [
      e.Row10,
      e.TileSea,
      e.TileWolf,
      e.TileBear,
      e.TileWolf,
      e.TileBadland,
      e.TileSea,
      e.TileSea,
      e.TileSea,
    ],
    [
      e.Row11,
      e.TileSea,
      e.TileField,
      e.TileMount,
      e.TileSea,
      e.TileSea,
      e.TileMount,
      e.TileSea,
      e.TileSea,
    ],
    [
      e.Row12,
      e.TileSea,
      e.TileSea,
      e.TileSea,
      e.TileSea,
      e.TileSea,
      e.TileSea,
      e.TileSea,
      e.TileSea,
    ],
  ];

  let mapOwners = '';
  let portOwners = '';

  const tileOwners = await Database.tileOwner.getAllTiles();
  tileOwners.forEach((tile) => {
    const coords = tile.tile;
    const column = parseInt(`${coords.slice(0, 1).charCodeAt(0)}`, 10) - 96;
    const row = parseInt(coords.slice(1), 10);
    const ownerTile = assets.houseTiles[tile.house];
    const ownerTileType =
      tile.type === 'port' ? 'Port' + ownerTile : 'Tile' + ownerTile;

    if (utils.isEmojiName(ownerTileType)) {
      const tileEmoji = e[ownerTileType];
      mapData[row][column] = tileEmoji;
    } else {
      console.error('Error mapping tile name');
    }

    if (tile.type === 'port') {
      portOwners += `${tile.tile.toUpperCase()}: <@&${tile.house}>\n`;
    } else {
      mapOwners += `${tile.tile.toUpperCase()}: <@&${tile.house}>\n`;
    }
  });

  const mapTiles: string[] = [];

  mapData.forEach((row) => {
    let rowMapTiles = '';
    row.forEach((column) => {
      rowMapTiles += column;
    });
    mapTiles.push(rowMapTiles);
  });

  let activePacts = '';
  const allPacts = await Database.pact.getAllPacts();
  allPacts.forEach((pact) => {
    const [h1Troop] = assets.gameRoles[pact.house_a];
    const [h2Troop] = assets.gameRoles[pact.house_b];

    activePacts += `${h1Troop} :handshake: ${h2Troop}\n`;
  });

  activePacts = activePacts === '' ? 'No active pacts' : activePacts;

  let activeSieges = '';
  let activeBlockades = '';
  const allSieges = await Database.siege.getAllSieges();
  allSieges.forEach((siege) => {
    if (siege.tile.type === 'port') {
      activeBlockades += `${siege.tile.tile}: :crossed_swords: <@&${siege.attacker}>\n`;
    } else {
      activeSieges += `${siege.tile.tile}: :crossed_swords: <@&${siege.attacker}>\n`;
    }
  });

  activeSieges = activeSieges !== '' ? activeSieges : 'No active sieges';

  activeBlockades =
    activeBlockades !== '' ? activeBlockades : 'No active blockades';

  const embed = {
    fields: [
      {
        name: 'Castles',
        value: mapOwners,
      },
      {
        name: 'Ports',
        value: portOwners,
      },
      {
        name: 'Active Pacts',
        value: activePacts,
      },
      {
        name: 'Active Sieges',
        value: activeSieges,
      },
      {
        name: 'Active Blockades',
        value: activeBlockades,
      },
    ],
  };

  const channel = utils.getGuildTextChannel(
    guild,
    assets.replyChannels.overworld
  );

  let reply = 'Updated map posted.';
  let success = true;

  if (channel !== null) {
    const existingMapMessages = await Database.tracker.getAllTrackerByName(
      'map'
    );

    for (const toDelete of existingMapMessages) {
      await channel.messages
        .fetch(toDelete.text)
        .then(async (message) => await message.delete())
        .then(async () => await Database.tracker.removeTracker(toDelete));
    }

    await channel
      .send(mapTiles.slice(0, 7).join('\n'))
      .then(
        async (message) => await Database.tracker.createMapTracker(message.id)
      )
      .then(async () => await channel.send(mapTiles.slice(7).join('\n')))
      .then(
        async (message) => await Database.tracker.createMapTracker(message.id)
      )
      .then(async () => await channel.send({ embeds: [embed] }))
      .then(
        async (message) => await Database.tracker.createMapTracker(message.id)
      );
  } else {
    console.error('Could not find overworld channel');
    success = false;
    reply = 'Overworld channel not found';
  }

  return { reply, success };
};

export const configureTrackers = async (): Promise<void> => {
  const gameActiveTracker = await Database.tracker.getTrackerByName(
    'game_active'
  );

  if (gameActiveTracker === null) {
    await Database.tracker.insertTracker({ name: 'game_active', value: 1 });
  }

  const gameStartTracker = await Database.tracker.getTrackerByName(
    'game_start'
  );

  if (gameStartTracker === null) {
    await Database.tracker.insertTracker({ name: 'game_start', value: 0 });
  }

  const payoutTimeTracker = await Database.tracker.getTrackerByName(
    'payout_time'
  );

  if (payoutTimeTracker === null) {
    await Database.tracker.insertTracker({ name: 'payout_time', value: 0 });
  }
};

export const resetEverything = async (
  guild: Guild,
  currentTime: number
): Promise<CommandReturn> => {
  const commandReturn: CommandReturn = {
    reply: '',
    enableGame: false,
    success: true,
  };

  // Remove everyone from game roles
  await guild.members.fetch();
  const gameRoleMembersCollection = guild.roles.cache.filter(
    (role) => role.id in assets.gameRoles && role.id !== '625905668263510017'
  );

  const firstRole = gameRoleMembersCollection.first();

  if (firstRole !== undefined) {
    const memberCollection: Collection<Snowflake, GuildMember> =
      firstRole.members.concat(
        ...gameRoleMembersCollection.map((role) => role.members)
      );

    if (memberCollection !== null) {
      for (const member of memberCollection.values()) {
        await member.roles.remove(gameRoleMembersCollection);
      }
    }
  }

  // Reset database data and map
  await Database.playerData
    .resetAllPlayers()
    .then(async () => await Database.pledge.deleteAll())
    .then(async () => await Database.siege.deleteAll())
    .then(async () => await Database.vote.deleteAll())
    .then(async () => await Database.war.deleteAll())
    .then(async () => {
      const defaultWars: Array<[string, string]> = [
        ['572290551357898781', '572288816652484608'],
        ['572290551357898781', '572291484288548929'],
        ['572290551357898781', '572288999843168266'],
        ['572290551357898781', '572288151419355136'],
        ['572290551357898781', '572289104742580254'],
        ['572290551357898781', '572288492101435408'],
        ['572288816652484608', '572291484288548929'],
        ['572288816652484608', '572288999843168266'],
        ['572288816652484608', '572288151419355136'],
        ['572288816652484608', '572289104742580254'],
        ['572288816652484608', '572288492101435408'],
        ['572291484288548929', '572288999843168266'],
        ['572291484288548929', '572288151419355136'],
        ['572291484288548929', '572289104742580254'],
        ['572291484288548929', '572288492101435408'],
        ['572288999843168266', '572288151419355136'],
        ['572288999843168266', '572289104742580254'],
        ['572288999843168266', '572288492101435408'],
        ['572288151419355136', '572289104742580254'],
        ['572288151419355136', '572288492101435408'],
        ['572289104742580254', '572288492101435408'],
        ['572290551357898781', '625905668263510017'],
        ['572288816652484608', '625905668263510017'],
        ['572288816652484608', '625905668263510017'],
        ['572291484288548929', '625905668263510017'],
        ['572288999843168266', '625905668263510017'],
        ['572288151419355136', '625905668263510017'],
        ['572289104742580254', '625905668263510017'],
      ];

      await Database.war.createMultipleWars(defaultWars);
    })
    .then(async () => await Database.tileOwner.deleteAll())
    .then(async () => {
      const defaultTileOwners: Array<Partial<TileOwner>> = [
        { tile: 'c2', house: '572288999843168266', type: 'castle' },
        { tile: 'b3', house: '572288816652484608', type: 'castle' },
        { tile: 'g3', house: '572288151419355136', type: 'castle' },
        { tile: 'd4', house: '572290551357898781', type: 'castle' },
        { tile: 'f5', house: '572289104742580254', type: 'castle' },
        { tile: 'g5', house: '572288999843168266', type: 'castle' },
        { tile: 'b6', house: '572288492101435408', type: 'castle' },
        { tile: 'd6', house: '572288492101435408', type: 'castle' },
        { tile: 'e6', house: '572290551357898781', type: 'castle' },
        { tile: 'd7', house: '572289104742580254', type: 'castle' },
        { tile: 'g9', house: '572288816652484608', type: 'castle' },
        { tile: 'b10', house: '572291484288548929', type: 'castle' },
        { tile: 'c10', house: '572288151419355136', type: 'castle' },
        { tile: 'd10', house: '572291484288548929', type: 'castle' },
        { tile: 'h1', house: '625905668263510017', type: 'port' },
        { tile: 'a12', house: '625905668263510017', type: 'port' },
        { tile: 'h12', house: '625905668263510017', type: 'port' },
      ];

      await Database.tileOwner.createMultipleTileOwner(defaultTileOwners);
    })
    .then(async () => await Database.loan.deleteAll())
    .then(async () => await Database.pact.deleteAll())
    .then(
      async () => await Database.tracker.updateTrackerByName('payout_time', 0)
    )
    .then(
      async () => await Database.tracker.updateTrackerByName('game_active', 1)
    )
    .then(
      async () => await Database.tracker.updateTrackerByName('game_start', 0)
    )
    .then(async () => await postUpdatedMap(guild));

  const remakeChannels = [
    'house-bear',
    'house-dragon',
    'house-falcon',
    'house-hydra',
    'house-lion',
    'house-scorpion',
    'house-wolf',
  ];

  const houseCategory = utils.findGuildCategoryChannelByName(
    guild,
    'The Great Houses'
  );

  if (houseCategory !== null) {
    for (let inc = 0; inc < remakeChannels.length; inc += 1) {
      const channelToRemake = utils.findGuildTextChannelByName(
        guild,
        remakeChannels[inc]
      );

      if (channelToRemake !== null) {
        channelToRemake
          .clone()
          .then((clone) => {
            clone.setParent(houseCategory).catch(console.error);
            channelToRemake.delete().catch(console.error);
          })
          .catch(console.error);
      }
    }
  } else {
    console.error('Could not find category channel');
  }

  await Database.tracker.updateTrackerByName('game_start', currentTime);

  commandReturn.reply = 'Done';
  commandReturn.enableGame = true;

  return commandReturn;
};

export const generateRolesReply = ({
  playerRoles,
}: {
  playerRoles: string[];
}): string => {
  const troopRoles: Rank[] = ['duke', 'earl', 'baron', 'unsworn'];

  let reply = 'Income Roles:\n';

  buildings.forEach((role) => {
    const roleCap = role[0].toUpperCase() + role.slice(1);
    const symbol = playerRoles.includes(role) ? ':white_check_mark:' : ':x:';
    reply += `${symbol} ${roleCap}: ${assets.dailyPayouts[role]} :moneybag: per Day\n`;
  });

  let roleReply = '';
  let noRole = true;

  for (let inc = 0; inc < troopRoles.length; inc += 1) {
    const role = troopRoles[inc];
    const troopLimit = assets.roleTroopLimits[role];
    const roleCap = role[0].toUpperCase() + role.slice(1);
    let roleMark = ':x:';
    if (playerRoles.includes(role) || role === 'unsworn') {
      if (noRole) {
        roleMark = ':white_check_mark:';
        noRole = false;
      } else {
        roleMark = ':arrow_down:';
      }
    } else if (!noRole) {
      roleMark = ':arrow_down:';
    }

    roleReply = `${roleMark} ${roleCap} ${troopLimit} ${assets.emojis.MenAtArms} per Siege\n${roleReply}`;
  }

  reply += `\nNobility Roles:\n${roleReply}`;

  return reply;
};

export const isGameActive = async (): Promise<boolean> => {
  // Check to see if any house has 7 castles. If so, game over!
  let gameActive = true;
  const ownerCounts: Record<string, number> = {};

  (await Database.tileOwner.getAllTiles()).forEach((tile) => {
    if (tile.type === 'castle') {
      if (tile.house in ownerCounts) {
        ownerCounts[tile.house] += 1;
      } else {
        ownerCounts[tile.house] = 1;
      }
    }
  });

  for (const house in ownerCounts) {
    if (ownerCounts[house] >= 7) {
      gameActive = false;
    }
  }

  return gameActive;
};

export const alterRole = async (
  interaction: ChatInputCommandInteraction,
  user: User,
  roleName: string,
  action: 'add' | 'remove'
): Promise<boolean> => {
  const serverRole =
    roleName in assets.gameRoles
      ? roleName
      : utils.findRoleIdGivenName(roleName, assets.gameRoles);
  if (serverRole === '') {
    return false;
  }

  const guildMember = await interaction.guild?.members.fetch(user);

  if (guildMember === undefined) {
    return false;
  }

  // Add role to player
  if (action === 'add') {
    await guildMember.roles.add(serverRole).catch(console.error);
  } else if (action === 'remove') {
    await guildMember.roles.remove(serverRole).catch(console.error);
  }
  return true;
};

export const getStoreRoleIdsGivenType = (type: StoreItemTypes): string[] => {
  return Object.entries(assets.storeItems)
    .filter(([, value]) => value.type === type)
    .map(([key]) => utils.findRoleIdGivenName(key, assets.gameRoles));
};

export const getMemberOwnedRoleIds = (
  interaction: ChatInputCommandInteraction,
  user: User,
  roles: string[]
): string[] => {
  return (
    interaction.guild?.members.cache
      .get(user.id)
      ?.roles.cache.filter((role) => roles.includes(role.id))
      .map((role) => role.id) ?? []
  );
};

export const getAllPlayerRoleNames = async (
  interaction: ChatInputCommandInteraction,
  user: User
): Promise<string[]> => {
  const guildMember = await interaction.guild?.members.fetch(user.id);

  return guildMember?.roles.cache.map((role) => role.name.toLowerCase()) ?? [];
};
