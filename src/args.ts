import * as assets from './assets';
import { Database } from './data-source';
import * as utils from './utils';
import { ArgTypes } from './enums';
import { CommandArgs, ParsedArgs } from './types';

export async function parseCommandArgs(tokens: string[]): Promise<ParsedArgs> {
  // Parse command tokens to determine types
  const args: ParsedArgs = {
    values: [],
    types: [],
  };

  for (const token of tokens) {
    const playerMention = token.match(/^<@!?(?<player_id>\d+)>$/u);
    const roleMention = token.match(/^<@&(?<role_id>\d+)>$/u);
    const channelMention = token.match(/^<#(?<channel_id>\d+)>$/u);
    const numberMatch = token.match(/^(?<number>\d+)$/u);

    if (playerMention?.groups !== undefined) {
      const playerData = await Database.playerData.getOrCreatePlayer(
        playerMention.groups.player_id
      );
      args.values.push(playerData);
      args.types.push(ArgTypes.player_mention);
    } else if (roleMention?.groups !== undefined) {
      // Check if this is a house or some other game role
      const val = roleMention.groups.role_id;
      let type = ArgTypes.role_mention;

      if (assets.houses.includes(val)) {
        type = ArgTypes.house;
      } else if (val in assets.gameRoles) {
        type = ArgTypes.game_role;
      }

      args.values.push(val);
      args.types.push(type);
    } else if (channelMention?.groups !== undefined) {
      args.values.push(channelMention.groups.channel_id);
      args.types.push(ArgTypes.channel_mention);
    } else if (numberMatch?.groups !== undefined) {
      args.values.push(parseInt(numberMatch.groups.number, 10));
      args.types.push(ArgTypes.number);
    } else {
      const gameRole = utils.findRoleIdGivenName(token, assets.gameRoles);

      if (gameRole !== '') {
        let type = ArgTypes.game_role;

        if (assets.houses.includes(gameRole)) {
          type = ArgTypes.house;
        }

        args.values.push(gameRole);
        args.types.push(type);
      } else {
        args.values.push(token);
        args.types.push(ArgTypes.string);
      }
    }
  }

  return args;
}

export function valid(parsed: ArgTypes[], expected: CommandArgs): boolean {
  let valid = false;

  expected.forEach((argList) => {
    const match =
      parsed.length === argList.length &&
      parsed.every((value, index) => value === argList[index]);
    if (match) {
      valid = true;
    }
  });

  return valid;
}
