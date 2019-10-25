const utils = require("../utils.js");

/*
 * Give person title, men, ships, money
 * @player [TITLE|MEN|SHIPS|MONEY] <VALUE>
 */
const gift = () => null;

/*
 * Destroy ships! fail_risk = yours / (theirs + 2*yours)
 * fail lose 5-15, other 1-9. win lose 1-9, other 10-20
 * <PLAYER>
 */
const pirate = ({player_data, player_mention}) => {
  const command_return = {
    "update": {
      "player_data": {...player_data},
      "player_mention": {...player_mention}
    },
    "reply": ""
  };

  if(player_mention) {
    // Make sure both have enough ships
    const p_ships = player_data.ships;
    const m_ships = player_mention.ships;
    if(p_ships > 0) {
      if(m_ships > 0) {
        // Both have at least 1 ship. Figure out who wins!
        let fail_risk = Math.round(p_ships /
          (m_ships + (2 * p_ships)) * 100);

        if(fail_risk < 0) {
          fail_risk = 0;
        } else if(fail_risk > 100) {
          fail_risk = 100;
        }

        const chance = utils.get_random_value_in_range(1, 100);

        let player_lose = 0;
        let mention_lose = 0;
        let winner = 'player';

        if(chance >= fail_risk) {
          // Player wins! Adjust ships
          player_lose = utils.get_random_value_in_range(1, 9);
          mention_lose = utils.get_random_value_in_range(10, 20);
        } else {
          // Mention wins! Adjust ships
          player_lose = utils.get_random_value_in_range(5, 15);
          mention_lose = utils.get_random_value_in_range(1, 9);
          winner = 'mention';
        }

        player_lose = player_lose > p_ships
          ? p_ships
          : player_lose;

        mention_lose = mention_lose > m_ships
          ? m_ships
          : mention_lose;

        command_return.update.player_data.ships -= player_lose;
        command_return.update.player_mention.ships -= mention_lose;
        command_return.reply = winner === 'player'
          ? `your pirate adventures were successful! You lost ${player_lose} ` +
            `ships. <@${player_mention.user}> lost ${mention_lose} ships.`
          : `your pirate adventures were thwarted. You lost ${player_lose} ` +
            `ships. <@${player_mention.user}> lost ${mention_lose} ships.`;
      } else {
        command_return.reply = "the other player does not have any ships";
      }
    } else {
      command_return.reply = "you do not have any ships";
    }
  } else {
    command_return.reply = "you must @ mention another player";
  }

  return command_return;
};

/*
 * Destroy men! fail_risk = yours / (theirs + 2*yours)
 * fail lose 50-150, other 10-90. win lose 10-90, other 100-150
 * <PLAYER>.
 */
const raid = () => null;

/*
 * View money, ships, men of a player. costs 400
 * <PLAYER>
 */
const spy = () => null;

/*
 * Steal money from someone. fail_risk = yours / (theirs + yours)
 * on succeed, take 2-10%. fail pay 100-1000 to player
 * <PLAYER>
 */
const thief = () => null;

module.exports = {
  "dispatch": {
    "gift": {
      "function": gift,
      "args": []
    },
    "pirate": {
      "function": pirate,
      "args": [
        "player_data",
        "player_mention"
      ]
    },
    "raid": {
      "function": raid,
      "args": []
    },
    "spy": {
      "function": spy,
      "args": []
    },
    "thief": {
      "function": thief,
      "args": []
    }
  }
};
