const assets = require('../assets.js');

/*
 * Assigns player to a house w/ default money and men
 * need merc role. lose it after
 * <HOUSE>
 */
const join = ({player_data, role_mention}) => {
  const command_return = {
    "update": {
      "player_data": {...player_data},
      "roles": {
        "add": []
      }
    },
    "reply": ""
  };

  // See if the player is in a house. If they are they cannot join another one
  if(player_data.house) {
    command_return.reply = "you are already part of a house";
  } else if(role_mention && assets.houses.includes(role_mention)) {
    // Add the player to the house
    command_return.update.player_data.house = role_mention;
    command_return.update.roles.add.push(role_mention);
    command_return.reply = `you successfully joined <@&${role_mention}>!`;
  } else {
    command_return.reply = "you must @ mention a house to join";
  }

  return command_return;
};

/*
 * Pledge men to a tile to attack/defend
 * <TILE> <NUMBER> [ATTACK|DEFEND]
 *
 * deduct the men from the player's count when the pledge is made
 */
const pledge = () => null;

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
const siege = () => null;

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
const truce = () => null;

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
const war = () => null;

module.exports = {
  "dispatch": {
    "join": {
      "function": join,
      "args": [
        "player_data",
        "role_mention"
      ]
    },
    "pledge": {
      "function": pledge,
      "args": []
    },
    "siege": {
      "function": siege,
      "args": []
    },
    "truce": {
      "function": truce,
      "args": []
    },
    "war": {
      "function": war,
      "args": []
    }
  }
};
