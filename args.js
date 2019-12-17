const assets = require('./assets.js');
const db = require('./database.js');
const utils = require('./utils.js');

module.exports = {
  "arg_types": {
    "player_mention": 1,
    "game_role": 2,
    "house": 3,
    "role_mention": 4,
    "channel_mention": 5,
    "number": 6,
    "string": 7
  },
  parse_command_args (tokens) {
    // Parse command tokens to determine types
    const args = {
      "values": [],
      "types": []
    };

    tokens.forEach(token => {
      const player_mention = token.match(/^<@!?(?<player_id>\d+)>$/u);
      const role_mention = token.match(/^<@&(?<role_id>\d+)>$/u);
      const channel_mention = token.match(/^<#(?<channel_id>\d+)>$/u);
      const number_match = token.match(/^(?<number>\d+)$/u);

      if(player_mention) {
        let player_data = db.get_player.get(player_mention.groups.player_id);
        if(!player_data) {
          player_data = {...db.default_player};
          player_data.user = player_mention.groups.player_id;
        }

        args.values.push(player_data);
        args.types.push(module.exports.arg_types.player_mention);
      } else if(role_mention) {
        // Check if this is a house or some other game role
        const val = role_mention.groups.role_id;
        let type = module.exports.arg_types.role_mention;

        if(assets.houses.includes(val)) {
          type = module.exports.arg_types.house;
        } else if(val in assets.game_roles) {
          type = module.exports.arg_types.game_role;
        }

        args.values.push(val);
        args.types.push(type);
      } else if(channel_mention) {
        args.values.push(channel_mention.groups.channel_id);
        args.types.push(module.exports.arg_types.channel_mention);
      } else if(number_match) {
        args.values.push(parseInt(number_match.groups.number, 10));
        args.types.push(module.exports.arg_types.number);
      } else {
        const game_role =
          utils.find_role_id_given_name(token, assets.game_roles);

        if(game_role) {
          let type = module.exports.arg_types.game_role;

          if(assets.houses.includes(game_role)) {
            type = module.exports.arg_types.house;
          }

          args.values.push(game_role);
          args.types.push(type);
        } else {
          args.values.push(token);
          args.types.push(module.exports.arg_types.string);
        }
      }
    });

    return args;
  },
  valid (parsed, expected) {
    let valid = false;

    expected.forEach(arg_list => {
      const match = parsed.length ===
        arg_list.length && parsed.every((value, index) => value ===
          arg_list[index]);
      if(match) {
        valid = true;
      }
    });

    return valid;
  }
};
