import { Guild, Message, TextChannel } from 'discord.js';
import { Database } from './data-source';
import * as args from './args';
import * as admin from './commands/admin';
import * as clan_interact from './commands/clan_interact';
import * as economy from './commands/economy';
import * as general from './commands/general';
import * as player_interact from './commands/player_interact';
import * as assets from './assets';
import * as game_tasks from './game_tasks';
import * as tasks from './commands/tasks';
import * as utils from './utils';
import { CommandDispatch } from './types';
import { PlayerData } from './entity/PlayerData';
import { Loan } from './entity/Loan';
import { Vote } from './entity/Vote';
import { Siege } from './entity/Siege';

const PREFIX = '.';
const commandDispatch: CommandDispatch = {
  ...admin.dispatch,
  ...clan_interact.dispatch,
  ...economy.dispatch,
  ...general.dispatch,
  ...player_interact.dispatch,
  ...tasks.dispatch,
  map: {
    function: async(cmdArgs) => await game_tasks.postUpdatedMap(cmdArgs),
    args: ['guild'],
    command_args: [[]],
    usage: []
  },
  reset: {
    function: async cmdArgs => await game_tasks.resetEverything(cmdArgs),
    args: [
      'guild',
      'playerRoles',
      'currentTime'
    ],
    command_args: [[]],
    usage: []
  }
};

export async function messageHandler(msg: Message, gameActive: boolean): Promise<void> {
  const tokens: string[] = msg.content.split(' ');

  if (tokens[0].startsWith(PREFIX) && msg.member !== null) {
    const command = tokens[0].substring(1);

    if(command in commandDispatch) {
      if(!gameActive && command !== 'reset') {
        await msg.reply('The game is over! A new round will begin soon!');

        return;
      }

      if(assets.blockedChannels.includes(msg.channel.id) &&
        msg.member.roles.cache.has(assets.developerRole)) {
        await msg.reply('commands are not allowed in this channel');
      } else if(!('allowed_channels' in commandDispatch[command]) ||
        commandDispatch[command].allowed_channels?.includes(msg.channel.id) === true ||
        msg.member.roles.cache.has(assets.developerRole)) {
        const callFunction = commandDispatch[command].function;
        const callArgs: {
          args?: any[]
          playerData?: PlayerData
          loans?: Loan[]
          playerRoles?: string[]
          commandDispatch?: CommandDispatch
          guild?: Guild | null
          currentTime?: number
        } = {
        };
        const otherTokens = tokens.slice(1);

        // Get playerData
        const playerData = await Database.playerData.getOrCreatePlayer(msg.member.id);

        let cooldown = false;
        let cooldownPassed = false;
        let cooldownField: string = '';
        let cooldownFailMessage = null;
        const currentTime = Date.now();

        if('cooldown' in commandDispatch[command]) {
          // Check to see if the cooldown for the command has passed
          cooldown = true;
          cooldownField = commandDispatch[command].cooldown?.field ?? '';
          // TODO: need to improve data access
          const lastTime: number = (playerData as any)[cooldownField] ?? 0;
          const cooldownTime = commandDispatch[command].cooldown?.time ?? 0;
          const baseReply: string = commandDispatch[command].cooldown?.reply ?? '';
          const timeUntil = utils.getTimeUntilString(lastTime + cooldownTime - currentTime);

          cooldownPassed = currentTime - lastTime >= cooldownTime;
          cooldownFailMessage = cooldownPassed ? '' : baseReply + ' ' + timeUntil;
        }

        if('cooldown_from_start' in commandDispatch[command]) {
          // Check to see if the cooldown for the command has passed
          cooldown = true;
          const gameStartTracker = await Database.tracker.getTrackerByName('gameStart');
          const gameStart: number = gameStartTracker === null ? 0 : gameStartTracker.value;
          const cooldownTime: number = commandDispatch[command].cooldown_from_start ?? 0;
          const baseReply = `You cannot perform a ${command} for`;
          const timeUntil = utils.getTimeUntilString(gameStart + cooldownTime - currentTime);

          cooldownPassed = currentTime - gameStart >= cooldownTime;
          cooldownFailMessage = cooldownPassed ? '' : baseReply + ' ' + timeUntil;
        }

        // If we do not have a cooldown or the cooldown is passed, continue
        if(!cooldown || cooldownPassed) {
          // Parse and validate the arguments for the command
          const parsedArgs = await args.parseCommandArgs(otherTokens);
          const expectedArgs = commandDispatch[command].command_args;
          if(args.valid(parsedArgs.types, expectedArgs)) {
            const playerRoles: string[] = [];

            msg.member.roles.cache.forEach(value => {
              playerRoles.push(value.name.toLowerCase());
            });

            const loans = await Database.loan.getLoansForUser(playerData);

            commandDispatch[command].args.forEach(requiredArg => {
              switch(requiredArg) {
                case 'args':
                  callArgs.args = parsedArgs.values;
                  break;
                case 'playerData':
                  callArgs.playerData = playerData;
                  break;
                case 'loans':
                  callArgs.loans = loans;
                  break;
                case 'playerRoles':
                  callArgs.playerRoles = playerRoles;
                  break;
                case 'guild':
                  callArgs.guild = msg.guild;
                  break;
                case 'commandDispatch':
                  callArgs.commandDispatch = commandDispatch;
                  break;
                case 'currentTime':
                  callArgs.currentTime = currentTime;
                  break;
                default:
                  break;
              }
            });

            const commandReturn = await callFunction(callArgs);

            if(commandReturn != null) {
              if('update' in commandReturn && commandReturn.update !== undefined) {
                if('playerData' in commandReturn.update && commandReturn.update.playerData !== undefined) {
                  // If there was a cooldown, update the last time
                  if(cooldown && 'success' in
                    commandReturn && commandReturn.success) {
                    (commandReturn.update.playerData as any)[cooldownField] = currentTime;
                  }
                  await Database.playerData.setPlayer(commandReturn.update.playerData);
                }

                if('playerMention' in commandReturn.update && commandReturn.update.playerMention !== undefined) {
                  await Database.playerData.setPlayer(commandReturn.update.playerMention);
                }

                if('roles' in commandReturn.update && commandReturn.update.roles !== undefined) {
                  if('player' in commandReturn.update.roles && commandReturn.update.roles.player !== undefined) {
                    if('add' in commandReturn.update.roles.player) {
                      // Adjust player roles as necessary
                      for(const addRole of commandReturn.update.roles.player.add) {
                        // See if this is an ID. If so, use it, otherwise get ID
                        const serverRole = addRole in assets.gameRoles
                          ? addRole
                          : utils.findRoleIdGivenName(
                              addRole,
                              assets.gameRoles
                            );
                        if(serverRole !== '') {
                          // Add role to player
                          msg.member.roles.add(serverRole).catch(console.error);
                        } else {
                          await msg.reply(`${addRole} is not defined. Contact a dev`);
                        }
                      };
                    }

                    if('remove' in commandReturn.update.roles.player) {
                      // Adjust the player's roles
                      for(const removeRole of commandReturn.update.roles.player.remove) {
                        const serverRole = removeRole in assets.gameRoles
                          ? removeRole
                          : utils.findRoleIdGivenName(
                              removeRole,
                              assets.gameRoles
                            );
                        if(serverRole !== '') {
                          // Add role to player
                          msg.member.roles.remove(serverRole).catch(console.error);
                        }
                      };
                    }
                  }

                  if('other_player' in commandReturn.update.roles && commandReturn.update.roles.other_player !== undefined) {
                    const otherId = commandReturn.update.roles.other_player.id;
                    if('add' in commandReturn.update.roles.other_player) {
                      // Adjust other_player roles as necessary
                      for(const addRole of commandReturn.update.roles.other_player.add) {
                        // See if this is an ID. If so, use it, otherwise get ID
                        const serverRole = addRole in assets.gameRoles
                          ? addRole
                          : utils.findRoleIdGivenName(
                              addRole,
                              assets.gameRoles
                            );
                        if(serverRole !== '') {
                          // Add role to other_player
                          msg.guild?.members.cache.get(otherId)?.roles.add(serverRole).catch(console.error);
                        } else {
                          await msg.reply(`${addRole} is not defined. Contact a dev`);
                        }
                      };
                    }

                    if('remove' in commandReturn.update.roles.other_player) {
                      // Adjust the other_player's roles
                      commandReturn
                        .update
                          .roles.other_player.remove.forEach(removeRole => {
                        const serverRole = removeRole in assets.gameRoles
                          ? removeRole
                          : utils.findRoleIdGivenName(
                              removeRole,
                              assets.gameRoles
                            );
                        if(serverRole !== '') {
                          // Add role to other_player
                          msg.guild?.members.cache.get(otherId)?.roles.remove(serverRole).catch(console.error);
                        }
                      });
                    }
                  }
                }
              } else if(cooldown && 'success' in
                commandReturn && commandReturn.success) {
                /*
                 * If the command had a cooldown and playerData was not
                 * returned As part of an update for the command, update the
                 * cooldown here
                 */
                (playerData as any)[cooldownField] = currentTime;
                await Database.playerData.setPlayer(playerData);
              }

              if('reply' in commandReturn) {
                // Form an embed and have the reply as the description
                const embed = {
                  description: commandReturn.reply
                };
                await msg.channel.send({
                  embeds: [embed]
                });
              }

              if('send' in commandReturn && commandReturn.send !== undefined) {
                if('message' in commandReturn.send && commandReturn.send.message !== undefined) {
                  if('channel' in commandReturn.send && commandReturn.send.channel !== undefined) {
                    await (msg.guild?.channels.cache.get(commandReturn.send.channel) as TextChannel)?.send({
                      content: commandReturn.send.message
                    });
                  } else {
                    await msg.channel.send(commandReturn.send.message);
                  }
                }
              }

              if('map' in commandReturn && commandReturn.map !== undefined) {
                await msg.channel.send({
                  content: commandReturn.map.message,
                  embeds: [commandReturn.map.embed]
                });
              }

              if('loans' in commandReturn && commandReturn.loans !== undefined) {
                if('add' in commandReturn.loans && commandReturn.loans.add !== undefined) {
                  // Add the new loan to the database
                  await Database.loan.saveLoan(commandReturn.loans.add);
                } else if ('update' in commandReturn.loans && commandReturn.loans.update !== undefined) {
                  await Database.loan.saveLoan(commandReturn.loans.update);
                } else if ('remove' in commandReturn.loans && commandReturn.loans.remove !== undefined) {
                  await Database.loan.removeLoan(commandReturn.loans.remove);
                }
              }

              if('votes' in commandReturn && commandReturn.votes !== undefined) {
                if('add' in commandReturn.votes && commandReturn.votes.add !== undefined) {
                  // Add the vote to the database
                  await Database.vote.saveVote(commandReturn.votes.add);
                }
              }

              if('pledges' in commandReturn && commandReturn.pledges !== undefined) {
                if('add' in commandReturn.pledges && commandReturn.pledges.add !== undefined) {
                  // Add the pledge to the database
                  await Database.pledge.savePledge(commandReturn.pledges.add);
                }

                if('remove' in commandReturn.pledges && commandReturn.pledges.remove !== undefined) {
                  // Remove the pledge
                  await Database.pledge.removePledge(commandReturn.pledges.remove);
                }
              }

              if('sieges' in commandReturn && commandReturn.sieges !== undefined) {
                if('add' in commandReturn.sieges && commandReturn.sieges.add !== undefined) {
                  // Add the siege to the database
                  const info = await Database.siege.saveSiege(commandReturn.sieges.add);
                  // TODO: better handle guild being null
                  const siegeEmbed = game_tasks.generateSiegeEmbed(
                    msg.guild?.roles ?? null,
                    info
                  );
                  const brChannel = assets.replyChannels.battle_reports;
                  const channel = msg.guild?.channels.cache.get(brChannel);
                  await (channel as TextChannel)?.send({ embeds: [siegeEmbed] }).then(async(message) => {
                    await Database.siege.updateSiegeMessage(
                      info.siege_id,
                      message.id
                    );
                  });

                  await game_tasks.postUpdatedMap({ guild: msg.guild });
                }
                if('update' in commandReturn.sieges && commandReturn.sieges.update !== undefined) {
                  const siege = commandReturn.sieges.update;
                  // TODO: improve handling of guild/roles being undefined/null
                  const siegeEmbed = game_tasks.generateSiegeEmbed(
                    msg.guild?.roles ?? null,
                    siege
                  );
                  const brChannel = assets.replyChannels.battle_reports;
                  const channel = msg.guild?.channels.cache.get(brChannel);
                  await (channel as TextChannel)?.messages.fetch(siege.message).then(async(message) => {
                    await message.edit({ embeds: [siegeEmbed] });
                  });
                }
              }

              if('enable_game' in commandReturn &&
                 commandReturn.enable_game !== undefined) {
                gameActive = true;
              }
            } else {
              await msg.reply(command + ' is not yet implemented');
            }
          } else {
            // Incorrect arguments supplied. Print usage information
            const commandUsage = commandDispatch[command].usage;
            const usageInfo = ['Usage:'];
            if(commandUsage.length > 0) {
              commandUsage.forEach(use => {
                usageInfo.push(`${PREFIX}${command} ${use}`);
              });
            } else {
              usageInfo.push(`${PREFIX}${command}`);
            }
            await msg.reply(usageInfo.join('\n'));
          }
        } else {
          // Cooldown failed. Reply.
          await msg.reply(cooldownFailMessage ?? 'Cooldown in effect.');
        }
      } else {
        await msg.reply(command + ' may not be used in this channel');
      }
    } else{
      await msg.reply(command + ' is not a recognized command');
    }
  }
};
