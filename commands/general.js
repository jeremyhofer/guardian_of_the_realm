const assets = require('../assets.js');
const db = require('../database.js');
const game_tasks = require('../game_tasks.js');
const utils = require('../utils.js');

// Show help text. optional specific command
const help = () => null;

/*
 * Lists the players money, men, and ships with
 * the unique faction name for each.
 */
const bal = ({player_data}) => {
  let reply = `Your account: ${player_data.money} :moneybag: ` +
    `${player_data.men} ${assets.emojis.MenAtArms} ${player_data.ships} ` +
    `${assets.emojis.Warship}`;

  reply += "\n\nSiege Contributions:\n";

  let siege_contributions = "";
  let blockade_contributions = "";
  const player_pledges = db.get_all_player_pledges.all(player_data);

  player_pledges.forEach(pledge => {
    if(pledge.type === "port") {
      blockade_contributions += `${pledge.tile} ${pledge.units} ` +
        `${assets.emojis.Warship} ${pledge.choice}\n`;
    } else {
      siege_contributions += `${pledge.tile} ${pledge.units} ` +
        `${assets.emojis.MenAtArms} ${pledge.choice}\n`;
    }
  });

  siege_contributions = siege_contributions
    ? siege_contributions
    : "none";

  blockade_contributions = blockade_contributions
    ? blockade_contributions
    : "none";

  reply += siege_contributions;
  reply += "\nBlockade Contributions:\n";
  reply += blockade_contributions;

  return {reply};
};

const cooldown = ({player_data, command_dispatch}) => {
  const now = Date.now();

  const cooldown_map = {
    'arson_last_time': 'arson',
    'pirate_last_time': 'pirate',
    'pray_last_time': 'pray',
    'raid_last_time': 'raid',
    'scandal_last_time': 'scandal',
    'spy_last_time': 'spy',
    'subvert_last_time': 'subvert',
    'thief_last_time': 'thief',
    'train_last_time': 'train',
    'trade_last_time': 'trade',
    'work_last_time': 'work'

  };

  let reply = "";

  for(const key in cooldown_map) {
    if(key in cooldown_map) {
      const command_cooldown =
        command_dispatch[cooldown_map[key]].cooldown.time;
      let time_left = player_data[key] - now + command_cooldown;
      const key_cap =
        cooldown_map[key][0].toUpperCase() + cooldown_map[key].slice(1);
      time_left = time_left < 0
        ? 0
        : time_left;
      const time_until_string = utils.get_time_until_string(time_left);
      reply += `${key_cap} ${time_until_string}\n`;
    }
  }

  return {reply};
};

const roles = ({player_roles}) => {
  const reply = game_tasks.generate_roles_reply({player_roles});

  return {reply};
};

module.exports = {
  "dispatch": {
    "help": {
      "function": help,
      "args": [],
      "command_args": [[]],
      "usage": []
    },
    "bal": {
      "function": bal,
      "args": ["player_data"],
      "command_args": [[]],
      "usage": []
    },
    "cooldown": {
      "function": cooldown,
      "args": [
        "player_data",
        "command_dispatch"
      ],
      "command_args": [[]],
      "usage": []
    },
    "roles": {
      "function": roles,
      "args": ["player_roles"],
      "command_args": [[]],
      "usage": []
    }
  }
};
