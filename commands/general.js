const assets = require('../assets.js');
const db = require('../database.js');
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
  const player_pledges = db.get_all_player_pledges.all(player_data);

  player_pledges.forEach(pledge => {
    siege_contributions += `${pledge.tile} ${pledge.men} ` +
      `${assets.emojis.MenAtArms} ${pledge.choice}`;
  });

  siege_contributions = siege_contributions
    ? siege_contributions
    : "none";

  reply += siege_contributions;

  return {reply};
};

const cooldown = ({player_data, command_dispatch}) => {
  const now = Date.now();

  const cooldown_map = {
    'pirate_last_time': 'pirate',
    'pray_last_time': 'pray',
    'raid_last_time': 'raid',
    'smuggle_last_time': 'smuggle',
    'spy_last_time': 'spy',
    'subvert_last_time': 'subvert',
    'thief_last_time': 'thief',
    'train_last_time': 'train',
    'work_last_time': 'work'

  };

  let reply = "";

  for(const key in cooldown_map) {
    if(key in cooldown_map) {
      const command_cooldown =
        command_dispatch[cooldown_map[key]].cooldown.time;
      let time_left = player_data[key] - now + command_cooldown;
      time_left = time_left < 0
        ? 0
        : time_left;

      const time_until_string = utils.get_time_until_string(time_left);
      reply += `${cooldown_map[key]} ${time_until_string}\n`;
    }
  }

  return {reply};
};

const roles = ({player_roles}) => {
  const money_roles = [
    "apothecary",
    "blacksmith",
    "mill",
    "mine",
    "quarry",
    "stable",
    "tavern",
    "workshop"
  ];

  const troop_roles = [
    "duke",
    "earl",
    "baron",
    "unsworn"
  ];

  let reply = "Income Roles:\n";

  money_roles.forEach(role => {
    const symbol = player_roles.includes(role)
      ? ":white_check_mark:"
      : ":x:";

    reply += `${symbol} ${role}: ${assets.daily_payouts[role]} :moneybag: ` +
      `per Day\n`;
  });

  let role_reply = "";
  let no_role = true;

  for(let inc = 0; inc < troop_roles.length; inc += 1) {
    const role = troop_roles[inc];
    const troop_limit = assets.role_troop_limits[role];
    let role_mark = ":x:";
    if(player_roles.includes(role) || role === "unsworn") {
      if(no_role) {
        role_mark = ":white_check_mark:";
        no_role = false;
      } else {
        role_mark = ":arrow_down:";
      }
    } else if(!no_role) {
      role_mark = ":arrow_down:";
    }

    role_reply = `${role_mark} ${role} ${troop_limit} ` +
          `${assets.emojis.MenAtArms} per Siege\n${role_reply}`;
  }

  reply += `\nNobility Roles:\n${role_reply}`;

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
