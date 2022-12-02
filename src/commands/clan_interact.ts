import { PlayerData } from '../entity/PlayerData';
import { ArgTypes } from '../enums';
import {
  AttackTypes,
  CommandDispatch,
  CommandReturn,
  ArgParserFn,
} from '../types';
import * as assets from '../assets';
import { Database } from '../data-source';
import * as utils from '../utils';
import * as game_tasks from '../game_tasks';
import {
  APIRole,
  ChatInputCommandInteraction,
  Role,
  SlashCommandBuilder,
} from 'discord.js';

/*
 * Assigns player to a house w/ default money and men
 * need merc role. lose it after
 * <HOUSE>
 */
const join = async (
  interaction: ChatInputCommandInteraction
): Promise<CommandReturn> => {
  const playerData = await Database.playerData.getOrCreatePlayer(
    interaction.user.id
  );

  // See if the player is in a house. If they are they cannot join another one
  if (playerData.house !== '') {
    return { reply: 'You are already part of a house', success: true };
  }
  // Add the player to a house with an opening
  const houseCounts: { [key: string]: number } =
    await Database.playerData.getPlayerCountsInAllHouses();

  assets.houses.forEach((house) => {
    if (house !== '625905668263510017' && !(house in houseCounts)) {
      houseCounts[house] = 0;
    }
  });

  const sortedHouses = [];

  for (const key in houseCounts) {
    sortedHouses.push({
      id: key,
      count: houseCounts[key],
    });
  }

  sortedHouses.sort((first, second) => first.count - second.count);

  const selectedHouse = sortedHouses[0].id;

  playerData.house = selectedHouse;
  await Database.playerData.setPlayer(playerData);
  await game_tasks.alterRole(
    interaction,
    interaction.user,
    selectedHouse,
    'add'
  );
  const reply = `You successfully joined <@&${selectedHouse}>!`;

  return { reply, success: true };
};

/*
 * Pledge units to a tile to attack/defend
 * <TILE> <NUMBER> [ATTACK|DEFEND]
 *
 * deduct the units from the player's count when the pledge is made
 */
const pledge = async (
  interaction: ChatInputCommandInteraction
): Promise<CommandReturn> => {
  const argParser: ArgParserFn<{
    tile: string;
    number: number;
    action: string;
  }> = (options) => {
    const tile = options.getString('tile');
    const number = options.getNumber('number');
    const action = options.getString('action');

    if (tile === null || number === null || action === null) {
      return null;
    }

    return { tile, number, action };
  };

  const parsedArgs = argParser(interaction.options);

  if (parsedArgs === null) {
    return {
      reply: 'Issue with arguments. Contact a Developer.',
      success: true,
    };
  }

  const playerData = await Database.playerData.getOrCreatePlayer(
    interaction.user.id
  );
  const playerRoles: string[] = await game_tasks.getAllPlayerRoleNames(
    interaction,
    interaction.user
  );

  // Validate args
  const selectedTile: string = parsedArgs.tile.toLowerCase();
  const numUnits: number = parsedArgs.number;
  const action: string = parsedArgs.action.toLowerCase();

  const tileOwner = await Database.tileOwner.getTileOwner(selectedTile);

  if (tileOwner === null) {
    return {
      reply: `${selectedTile.toUpperCase()} is not a castle or port`,
      success: true,
    };
  }

  const isPort = tileOwner.type === 'port';
  const pUnits: number = isPort ? playerData.ships : playerData.men;

  let roleLimit = isPort
    ? assets.roleShipLimits.unsworn
    : assets.roleTroopLimits.unsworn;

  if (playerRoles.includes('duke')) {
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

  if (numUnits > roleLimit) {
    return {
      reply: `You may only send at most ${roleLimit} units`,
      success: true,
    };
  } else if (action !== 'attack' && action !== 'defend') {
    return { reply: 'The action must be ATTACK or DEFEND', success: true };
  }
  // Ensure a siege exists on the tile
  const existingSiege = tileOwner.siege;

  if (existingSiege === null) {
    return {
      reply: `There is no active attack on ${selectedTile}`,
      success: true,
    };
  }
  // See if the player already has a pledge on the siege.
  const existingPledge = await Database.pledge.getPlayerPledgeForSiege(
    playerData,
    existingSiege
  );

  let valid = false;
  let unitsToDeduct = 0;
  let reply = '';

  if (existingPledge !== null) {
    if (numUnits > pUnits + existingPledge.units) {
      reply = `You do not have ${numUnits} units`;
    } else {
      unitsToDeduct = existingPledge.units;
      await Database.pledge.removePledge(existingPledge);
      valid = true;
    }
  } else if (numUnits > pUnits) {
    reply = `You do not have ${numUnits} units`;
  } else {
    valid = true;
  }

  if (valid) {
    // Add the pledge
    if (isPort) {
      playerData.ships -= numUnits - unitsToDeduct;
    } else {
      playerData.men -= numUnits - unitsToDeduct;
    }

    await Database.playerData.setPlayer(playerData);
    await Database.pledge.insertPledge({
      siege: existingSiege.siege_id as any,
      user: playerData.user as any,
      units: numUnits,
      choice: action,
    });

    reply = `You successfully pledged ${numUnits} to ${action} ${selectedTile.toUpperCase()}`;
    // TODO: jank is here for regenerating the siege embed. can probably clean this up long term
    // TODO: this is jank, setting the tileOwner here. need to determine better mappings tile<->siege
    existingSiege.tile = tileOwner;
    await Database.siege.saveSiege(existingSiege);
  }

  return { reply, success: true };
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
const handleAttack = async (
  interaction: ChatInputCommandInteraction,
  type: AttackTypes
): Promise<CommandReturn> => {
  const argParser: ArgParserFn<{ tile: string }> = (options) => {
    const tile = options.getString('tile');

    if (tile === null) {
      return null;
    }

    return { tile };
  };

  const parsedArgs = argParser(interaction.options);

  if (parsedArgs === null) {
    return {
      reply: 'Issue with arguments. Contact a Developer.',
      success: true,
    };
  }

  const playerData = await Database.playerData.getOrCreatePlayer(
    interaction.user.id
  );

  // Check tile
  const selectedTile: string = parsedArgs.tile.toLowerCase();
  const tileOwner = await Database.tileOwner.getTileOwner(selectedTile);
  const houseSieges = await Database.siege.countHouseSieges(playerData.house);
  const validBlockade: boolean =
    tileOwner !== null && tileOwner.type === 'port' && type === 'blockade';
  const validSiege: boolean =
    tileOwner !== null && tileOwner.type === 'castle' && type === 'siege';

  if (tileOwner === null || !(validBlockade || validSiege)) {
    const reply =
      type === 'blockade'
        ? `${selectedTile} is not a port`
        : `${selectedTile} is not a castle`;
    return { reply, success: true };
  }
  // Tile is good. Make sure it is owned by a house at war with
  if (playerData.house === tileOwner.house) {
    const reply =
      type === 'blockade'
        ? 'Your house owns this port'
        : 'Your house owns this castle';
    return { reply, success: true };
  } else if (houseSieges >= 3) {
    return {
      reply: 'Your house already has 3 declared attacks',
      success: true,
    };
  }
  const war = await Database.war.getWarBetweenHouses(
    playerData.house,
    tileOwner.house
  );

  if (war === null) {
    return {
      reply: 'Your house is not at war with ' + `<@&${tileOwner.house}>`,
      success: true,
    };
  }
  // Make sure a siege does not already exist on this tile
  const existingSiege = tileOwner.siege;

  if (existingSiege !== null) {
    const reply =
      type === 'blockade'
        ? 'A blockade is in progress on that port'
        : 'A siege is in progress on that castle';
    return { reply, success: true };
  }
  // Good to go! Add the siege
  await Database.siege.insertSiege({
    tile: tileOwner.tile as any,
    attacker: playerData.house,
    time: Date.now() + utils.hoursToMs(8),
  });
  // TODO: generate and post siege embed
  const reply =
    type === 'blockade'
      ? 'A blockade has been started on the port'
      : 'A siege has been started on the castle';

  return { reply, success: true };
};

const siege = async (
  interaction: ChatInputCommandInteraction
): Promise<CommandReturn> => await handleAttack(interaction, 'siege');

const blockade = async (
  interaction: ChatInputCommandInteraction
): Promise<CommandReturn> => await handleAttack(interaction, 'blockade');

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
const pact = async (
  interaction: ChatInputCommandInteraction
): Promise<CommandReturn> => {
  const argParser: ArgParserFn<{ house: Role | APIRole; vote: string }> = (
    options
  ) => {
    const house = options.getRole('house');
    const vote = options.getString('vote');

    if (house === null || vote === null) {
      return null;
    }

    return { house, vote };
  };

  const parsedArgs = argParser(interaction.options);

  if (parsedArgs === null) {
    return {
      reply: 'Issue with arguments. Contact a Developer.',
      success: true,
    };
  }

  const playerData = await Database.playerData.getOrCreatePlayer(
    interaction.user.id
  );

  const houseVote: string = parsedArgs.house.id;
  const playerChoice: string = parsedArgs.vote.toLowerCase();

  // See if the player has already voted for this
  const existingVote = await Database.vote.getPlayerVotesAgainstHouseByTypes(
    playerData,
    houseVote,
    ['pact_yes', 'pact_no']
  );

  if (existingVote.length > 0) {
    // Already voted in this pact vote
    const [vote] = existingVote;
    const choice = vote.type === 'pact_yes' ? 'YES' : 'NO';

    return {
      reply:
        `You have already voted ${choice} to a pact ` +
        `with <@&${vote.choice}>`,
      success: true,
    };
  }
  // Ensure a war exists between the houses
  const existingWar = await Database.war.getWarBetweenHouses(
    playerData.house,
    houseVote
  );

  if (existingWar === null) {
    return {
      reply: 'Your house is not at war with ' + `<@&${houseVote}>`,
      success: true,
    };
  }

  // Check yes/no choice
  let pactType = '';

  if (playerChoice === 'yes') {
    pactType = 'pact_yes';
  } else if (playerChoice === 'no') {
    pactType = 'pact_no';
  }

  if (pactType === '') {
    return { reply: 'You must vote YES or NO', success: true };
  }
  // Truce vote is good. Add it
  await Database.vote.insertVote({
    type: pactType,
    user: playerData,
    choice: houseVote,
    time: Date.now(),
  });
  return {
    reply: `Your choice of ${playerChoice} was ` + 'recorded',
    success: true,
  };
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
const war = async (
  interaction: ChatInputCommandInteraction
): Promise<CommandReturn> => {
  const argParser: ArgParserFn<{ house: Role | APIRole; vote: string }> = (
    options
  ) => {
    const house = options.getRole('house');
    const vote = options.getString('vote');

    if (house === null || vote === null) {
      return null;
    }

    return { house, vote };
  };

  const parsedArgs = argParser(interaction.options);

  if (parsedArgs === null) {
    return {
      reply: 'Issue with arguments. Contact a Developer.',
      success: true,
    };
  }

  const playerData = await Database.playerData.getOrCreatePlayer(
    interaction.user.id
  );
  const houseVote: string = parsedArgs.house.id;
  const playerChoice: string = parsedArgs.vote.toLowerCase();

  // See if the player has already voted for this
  const existingVote = await Database.vote.getPlayerVotesAgainstHouseByTypes(
    playerData,
    houseVote,
    ['war_yes', 'war_no']
  );

  if (existingVote.length > 0) {
    // Already voted in this war vote
    const [vote] = existingVote;
    const choice = vote.type === 'war_yes' ? 'YES' : 'NO';

    return {
      reply:
        `You have already voted ${choice} to a war ` +
        `with <@&${vote.choice}>`,
      success: true,
    };
  }
  // Ensure a war exists between the houses
  const existingPact = await Database.pact.getPactBetweenHouses(
    playerData.house,
    houseVote
  );

  if (existingPact === null) {
    return {
      reply: 'Your house does not have a pact with ' + `<@&${houseVote}>`,
      success: true,
    };
  }
  // Check yes/no choice
  let warType = '';

  if (playerChoice === 'yes') {
    warType = 'war_yes';
  } else if (playerChoice === 'no') {
    warType = 'war_no';
  }

  if (warType === '') {
    return { reply: 'You must vote YES or NO', success: true };
  }
  // Truce vote is good. Add it
  await Database.vote.insertVote({
    type: warType,
    user: playerData,
    choice: houseVote,
    time: Date.now(),
  });
  return {
    reply: `Your choice of ${playerChoice} was recorded`,
    success: true,
  };
};

export const dispatch: CommandDispatch = {
  join: {
    type: 'slash',
    function: join,
    args: ['playerData'],
    command_args: [[]],
    usage: [],
    slashCommandBuilder: new SlashCommandBuilder()
      .setName('join')
      .setDescription('join the things'),
  },
  pledge: {
    type: 'slash',
    function: pledge,
    args: ['args', 'playerData', 'playerRoles'],
    command_args: [[ArgTypes.string, ArgTypes.number, ArgTypes.string]],
    usage: ['TILE NUMBER attack|defend'],
    slashCommandBuilder: new SlashCommandBuilder()
      .setName('pledge')
      .setDescription('pledge the things')
      .addStringOption((option) =>
        option
          .setName('tile')
          .setDescription('Tile to pledge troops to')
          .setRequired(true)
      )
      .addNumberOption((option) =>
        option
          .setName('number')
          .setDescription('Number of troops to pledge')
          .setRequired(true)
          .setMinValue(1)
      )
      .addStringOption((option) =>
        option
          .setName('action')
          .setDescription('Whether to attack or defend')
          .setRequired(true)
          .setChoices(
            { name: 'Attack', value: 'attack' },
            { name: 'Defend', value: 'defend' }
          )
      ),
  },
  siege: {
    type: 'slash',
    function: siege,
    args: ['args', 'playerData'],
    command_args: [[ArgTypes.string]],
    usage: ['TILE'],
    cooldown_from_start: utils.hoursToMs(assets.timeoutLengths.siege_blockade),
    slashCommandBuilder: new SlashCommandBuilder()
      .setName('siege')
      .setDescription('siege the things')
      .addStringOption((option) =>
        option
          .setName('tile')
          .setDescription('Tile to begin a siege on')
          .setRequired(true)
      ),
  },
  blockade: {
    type: 'slash',
    function: blockade,
    args: ['args', 'playerData'],
    command_args: [[ArgTypes.string]],
    usage: ['TILE'],
    cooldown_from_start: utils.hoursToMs(assets.timeoutLengths.siege_blockade),
    slashCommandBuilder: new SlashCommandBuilder()
      .setName('blockade')
      .setDescription('blockade the things')
      .addStringOption((option) =>
        option
          .setName('tile')
          .setDescription('Tile to befin a blockade on')
          .setRequired(true)
      ),
  },
  pact: {
    type: 'slash',
    function: pact,
    args: ['args', 'playerData'],
    command_args: [[ArgTypes.house, ArgTypes.string]],
    usage: ['HOUSE yes|no'],
    slashCommandBuilder: new SlashCommandBuilder()
      .setName('pact')
      .setDescription('pact the things')
      .addRoleOption((option) =>
        option
          .setName('house')
          .setDescription('house to begin a pact with')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('vote')
          .setDescription('yes or no to the pact')
          .setRequired(true)
          .setChoices(
            { name: 'Yes', value: 'yes' },
            { name: 'No', value: 'no' }
          )
      ),
  },
  war: {
    type: 'slash',
    function: war,
    args: ['args', 'playerData'],
    command_args: [[ArgTypes.house, ArgTypes.string]],
    usage: ['HOUSE yes|no'],
    slashCommandBuilder: new SlashCommandBuilder()
      .setName('war')
      .setDescription('war the things')
      .addRoleOption((option) =>
        option
          .setName('house')
          .setDescription('house to begin a war with')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('vote')
          .setDescription('yes or no to the war')
          .setRequired(true)
          .setChoices(
            { name: 'Yes', value: 'yes' },
            { name: 'No', value: 'no' }
          )
      ),
  },
};
