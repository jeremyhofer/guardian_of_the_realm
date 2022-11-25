import { PlayerData } from '../entity/PlayerData';
import { ArgTypes } from '../enums';
import { AttackTypes, CommandDispatch, CommandReturn } from '../types';
import * as assets from '../assets';
import { Database } from '../data-source';
import * as utils from '../utils';

/*
 * Assigns player to a house w/ default money and men
 * need merc role. lose it after
 * <HOUSE>
 */
const join = async({ playerData }: { playerData: PlayerData }): Promise<CommandReturn> => {
  const commandReturn: CommandReturn = {
    update: {
      playerData,
      roles: {
        player: {
          add: [],
          remove: []
        }
      }
    },
    reply: '',
    success: true
  };

  // See if the player is in a house. If they are they cannot join another one
  if(playerData.house !== '') {
    commandReturn.reply = 'You are already part of a house';
  } else {
    // Add the player to a house with an opening
    const houseCounts: { [key: string]: number } = await Database.playerData.getPlayerCountsInAllHouses();

    assets.houses.forEach(house => {
      if(house !== '625905668263510017' && !(house in houseCounts)) {
        houseCounts[house] = 0;
      }
    });

    const sortedHouses = [];

    for(const key in houseCounts) {
      if(key in houseCounts) {
        sortedHouses.push({
          id: key,
          count: houseCounts[key]
        });
      }
    }

    sortedHouses.sort((first, second) => first.count - second.count);

    const selectedHouse = sortedHouses[0].id;

    (commandReturn.update?.playerData as PlayerData).house = selectedHouse;
    commandReturn.update?.roles?.player?.add.push(selectedHouse);
    commandReturn.reply = `You successfully joined <@&${selectedHouse}>!`;
  }

  return commandReturn;
};

/*
 * Pledge units to a tile to attack/defend
 * <TILE> <NUMBER> [ATTACK|DEFEND]
 *
 * deduct the units from the player's count when the pledge is made
 */
const pledge = async({ args, playerData, playerRoles }: { args: any[], playerData: PlayerData, playerRoles: string[] }): Promise<CommandReturn> => {
  const commandReturn: CommandReturn = {
    sieges: {},
    update: {
      playerData
    },
    pledges: {},
    reply: '',
    success: true
  };

  // Validate args
  const selectedTile: string = args[0].toLowerCase();
  const numUnits: number = parseInt(args[1], 10);
  const action: string = args[2].toLowerCase();

  const tileOwner = await Database.tileOwner.getTileOwner(selectedTile);

  if(tileOwner !== null) {
    const isPort = tileOwner.type === 'port';
    const pUnits: number = isPort ? playerData.ships : playerData.men;

    let roleLimit = isPort
      ? assets.roleShipLimits.unsworn
      : assets.roleTroopLimits.unsworn;

    if(playerRoles.includes('duke')) {
      roleLimit = isPort
        ? assets.roleShipLimits.duke
        : assets.roleTroopLimits.duke;
    } else if (playerRoles.includes('earl')) {
      roleLimit = isPort
        ? assets.roleShipLimits.earl
        : assets.roleTroopLimits.earl;
    } else if (playerRoles.includes('baron')) {
      roleLimit = isPort
        ? assets.roleShipLimits.baron
        : assets.roleTroopLimits.baron;
    }

    if(isNaN(numUnits) || numUnits < 1) {
      commandReturn.reply = 'The number of units must be a positive number';
    } else if (numUnits > roleLimit) {
      commandReturn.reply = `You may only send at most ${roleLimit} units`;
    } else if(action !== 'attack' && action !== 'defend') {
      commandReturn.reply = 'The action must be ATTACK or DEFEND';
    } else {
      // Ensure a siege exists on the tile
      const existingSiege = await Database.siege.getSiegeOnTile(selectedTile);

      if(existingSiege !== null) {
        // See if the player already has a pledge on the siege.
        const existingPledge = await Database.pledge.getPlayerPledgeForSiege(
          playerData,
          existingSiege
        );

        let valid = false;
        let unitsToDeduct = 0;

        if(existingPledge !== null) {
          if(numUnits > pUnits + existingPledge.units) {
            commandReturn.reply = `You do not have ${numUnits} units`;
          } else {
            unitsToDeduct = existingPledge.units;
            (commandReturn.pledges as any).remove = existingPledge;
            valid = true;
          }
        } else if(numUnits > pUnits) {
          commandReturn.reply = `You do not have ${numUnits} units`;
        } else {
          valid = true;
        }

        if(valid) {
          // Add the pledge
          (commandReturn.pledges as any).add = {
            siege: existingSiege.siege_id,
            user: playerData.user,
            units: numUnits,
            choice: action
          };

          if(isPort) {
            (commandReturn.update?.playerData as PlayerData).ships -= numUnits - unitsToDeduct;
          } else {
            (commandReturn.update?.playerData as PlayerData).men -= numUnits - unitsToDeduct;
          }

          commandReturn.reply = `You successfully pledged ${numUnits} to ${action} ${selectedTile.toUpperCase()}`;
          (commandReturn.sieges as any).update = existingSiege;
        }
      } else {
        commandReturn.reply = `There is no active attack on ${selectedTile}`;
      }
    }
  } else {
    commandReturn.reply =
      `${selectedTile.toUpperCase()} is not a castle or port`;
  }

  return commandReturn;
};

/*
 * Start a siege on a tile. must be with a house you are at war with
 * <TILE>
 *
 * Any player in a house may start a siege on a castle at any time.
 *
 * Lasts 6 hours.
 *
 * Winner chance is attacking / (attacking + defending).
 *
 * Resolution will occur when the siege time ends. All pledges will be counted
 * and included at the time. If a player made a pledge and does not have
 * that many troops the number of troops will be reduced to what they have
 * at the time the resolution occurs.
 *
 * Defender losses = attackers * (10-30%)
 * Attacker losses = defenders * (10-30%)
 *
 * Losses are proportional by pledge amount from each person, so
 * pledger / total attacker or defender.
 *
 * Winning house gets (or keeps) the castle.
 *
 * Winning cash pot of 6000 * num pledges, distributed proportionately
 * among the winners by pledge amount.
 *
 * Losing men pot of 20 * num pledges, distributed proportionately among
 * the losers by pledge amount.
 *
 */
const handleAttack = async({ args, playerData }: { args: any[], playerData: PlayerData }, type: AttackTypes): Promise<CommandReturn> => {
  const commandReturn: CommandReturn = {
    sieges: {},
    reply: '',
    success: true
  };

  // Check tile
  const selectedTile: string = args[0].toLowerCase();
  const tileOwner = await Database.tileOwner.getTileOwner(selectedTile);
  const houseSieges = await Database.siege.countHouseSieges(playerData.house);
  const validBlockade: boolean = tileOwner !== null && tileOwner.type === 'port' && type === 'blockade';
  const validSiege: boolean = tileOwner !== null && tileOwner.type === 'castle' && type === 'siege';

  if(tileOwner !== null && (validBlockade || validSiege)) {
    // Tile is good. Make sure it is owned by a house at war with
    if(playerData.house === tileOwner.house) {
      commandReturn.reply = type === 'blockade'
        ? 'Your house owns this port'
        : 'Your house owns this castle';
    } else if(houseSieges >= 3) {
      commandReturn.reply = 'Your house already has 3 declared attacks';
    } else {
      const war = await Database.war.getWarBetweenHouses(
        playerData.house,
        tileOwner.house
      );

      if(war !== null) {
        // Make sure a siege does not already exist on this tile
        const existingSiege = await Database.siege.getSiegeOnTile(selectedTile);

        if(existingSiege !== null) {
          commandReturn.reply = type === 'blockade'
            ? 'A blockade is in progress on that port'
            : 'A siege is in progress on that castle';
        } else {
          // Good to go! Add the siege
          (commandReturn.sieges as any).add = {
            tile: selectedTile,
            attacker: playerData.house,
            time: Date.now() + utils.hoursToMs(8)
          };
          commandReturn.reply = type === 'blockade'
            ? 'A blockade has been started on the port'
            : 'A siege has been started on the castle';
        }
      } else {
        commandReturn.reply = 'Your house is not at war with ' +
          `<@&${tileOwner.house}>`;
      }
    }
  } else {
    commandReturn.reply = type === 'blockade'
      ? `${selectedTile} is not a port`
      : `${selectedTile} is not a castle`;
  }

  return commandReturn;
};

const siege = async({ args, playerData }: { args: any[], playerData: PlayerData }): Promise<CommandReturn> => await handleAttack(
  {
    args,
    playerData
  },
  'siege'
);

const blockade = async({ args, playerData }: { args: any[], playerData: PlayerData }): Promise<CommandReturn> => await handleAttack(
  {
    args,
    playerData
  },
  'blockade'
);

/*
 * Open a vote between two waring houses to stop the war. majority of each
 * house must agree <HOUSE> [YES|NO]
 *
 * When a player uses this command pull all current votes in the votes table
 * of type "truce" for all people in the player's house and the other house
 * in the truce vote. This is the set of all votes for the truce.
 *
 * Once the set is retrieved, see if the player already has a vote in place.
 * If the player has voted there is nothing for them to do. If the player does
 * not have a vote validate and record their vote in the pool.
 *
 * Before saving check to see if all players in both houses have voted on the
 * truce. If so, check the votes in both houses. See if at least half of both
 * houses agree on the truce. If so, remove the war. If not the war remains.
 *
 * After a vote finishes delete all the votes for the truce in the database.
 * Announce the outcome in channels.
 *
 * If a vote is not finished add the player's vote to the database.
 *
 * Vote also ends in a majority after 6 hours time.
 */
const pact = async({ args, playerData }: { args: any[], playerData: PlayerData }): Promise<CommandReturn> => {
  const commandReturn: CommandReturn = {
    votes: {},
    reply: '',
    success: true
  };

  // Figure it out
  const houseVote: string = args[0];
  const playerChoice: string = args[1].toLowerCase();

  // See if the player has already voted for this
  const existingVote = await Database.vote.getPlayerHasVoteAgainstHouseByTypes(playerData, houseVote, ['pact_yes', 'pact_no']);

  if(existingVote.length > 0) {
    // Already voted in this pact vote
    const [vote] = existingVote;
    const choice = vote.type === 'pact_yes'
      ? 'YES'
      : 'NO';

    commandReturn.reply = `You have already voted ${choice} to a pact ` +
      `with <@&${vote.choice}>`;
  } else {
    // Ensure a war exists between the houses
    const existingWar = await Database.war.getWarBetweenHouses(
      playerData.house,
      houseVote
    );

    if(existingWar !== null) {
      // Check yes/no choice
      let pactType = '';

      if(playerChoice === 'yes') {
        pactType = 'pact_yes';
      } else if(playerChoice === 'no') {
        pactType = 'pact_no';
      }

      if(pactType !== '') {
        // Truce vote is good. Add it
        (commandReturn.votes as any).add = {
          type: pactType,
          user: playerData.user,
          choice: houseVote,
          time: Date.now()
        };
        commandReturn.reply = `Your choice of ${playerChoice} was ` +
          'recorded';
      } else {
        commandReturn.reply = 'You must vote YES or NO';
      }
    } else {
      commandReturn.reply = 'Your house is not at war with ' +
        `<@&${houseVote}>`;
    }
  }

  return commandReturn;
};

/*
 * Start vote in house to begin a war. choose other houses, or no war.
 * majority wins [HOUSE|PEACE]
 *
 * When a player uses this command pull all current votes in the votes table
 * of type "war" for all people in the player's house. This is the set of
 * current war votes for the house (each house has at most 1 active war vote
 * at a time and last until all have voted).
 *
 * Once the set is retrieved, see if the player already has a vote in place.
 * If the player has voted there is nothing for them to do. If the player
 * does not have a vote see if their vote is for a house and, if so, whether
 * a war already exists between the player's house and the house they vote
 * on. If so, do nothing. If a war does not exist add the player's vote to
 * the vote pool.
 *
 * Before saving to the database see if all players in the house have voted.
 * If all players have voted determine the outcome of the vote, based on the
 * majority. Ties always lead to peace. If a war is the outcome add a new war
 * between the two houses.
 *
 * After a vote finishes delete all of the houses' votes in the database. If a
 * war was the result also delete all existing votes for the other house that
 * are against this house if they exist, allowing those players to choose a
 * different house to vote against. Annouce in channels about the new war.
 *
 * If a vote is not finished add the player's vote to the database.
 *
 * Vote also ends in a majority after 6 hours time.
 */
const war = async({ args, playerData }: { args: any[], playerData: PlayerData }): Promise<CommandReturn> => {
  const commandReturn: CommandReturn = {
    votes: {},
    reply: '',
    success: true
  };

  // Figure it out
  const houseVote: string = args[0];
  const playerChoice: string = args[1].toLowerCase();

  // See if the player has already voted for this
  const existingVote = await Database.vote.getPlayerHasVoteAgainstHouseByTypes(playerData, houseVote, ['war_yes', 'war_no']);

  if(existingVote.length > 0) {
    // Already voted in this war vote
    const [vote] = existingVote;
    const choice = vote.type === 'war_yes'
      ? 'YES'
      : 'NO';

    commandReturn.reply = `You have already voted ${choice} to a war ` +
      `with <@&${vote.choice}>`;
  } else {
    // Ensure a war exists between the houses
    const existingPact = await Database.pact.getPactBetweenHouses(
      playerData.house,
      houseVote
    );

    if(existingPact !== null) {
      // Check yes/no choice
      let warType = '';

      if(playerChoice === 'yes') {
        warType = 'war_yes';
      } else if(playerChoice === 'no') {
        warType = 'war_no';
      }

      if(warType !== '') {
        // Truce vote is good. Add it
        (commandReturn.votes as any).add = {
          type: warType,
          user: playerData.user,
          choice: houseVote,
          time: Date.now()
        };
        commandReturn.reply = `Your choice of ${playerChoice} was ` +
          'recorded';
      } else {
        commandReturn.reply = 'You must vote YES or NO';
      }
    } else {
      commandReturn.reply = 'Your house does not have a pact with ' +
        `<@&${houseVote}>`;
    }
  }

  return commandReturn;
};

export const dispatch: CommandDispatch = {
  join: {
    function: join,
    args: ['playerData'],
    command_args: [[]],
    usage: []
  },
  pledge: {
    function: pledge,
    args: [
      'args',
      'playerData',
      'playerRoles'
    ],
    command_args: [
      [
        ArgTypes.string,
        ArgTypes.number,
        ArgTypes.string
      ]
    ],
    usage: ['TILE NUMBER attack|defend']
  },
  siege: {
    function: siege,
    args: [
      'args',
      'playerData'
    ],
    command_args: [[ArgTypes.string]],
    usage: ['TILE'],
    cooldown_from_start: utils.hoursToMs(assets.timeoutLengths.siege_blockade)
  },
  blockade: {
    function: blockade,
    args: [
      'args',
      'playerData'
    ],
    command_args: [[ArgTypes.string]],
    usage: ['TILE'],
    cooldown_from_start: utils.hoursToMs(assets.timeoutLengths.siege_blockade)
  },
  pact: {
    function: pact,
    args: [
      'args',
      'playerData'
    ],
    command_args: [
      [
        ArgTypes.house,
        ArgTypes.string
      ]
    ],
    usage: ['HOUSE yes|no']
  },
  war: {
    function: war,
    args: [
      'args',
      'playerData'
    ],
    command_args: [
      [
        ArgTypes.house,
        ArgTypes.string
      ]
    ],
    usage: ['HOUSE yes|no']
  }
};
