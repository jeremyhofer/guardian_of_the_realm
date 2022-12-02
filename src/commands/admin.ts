// import { Database } from '../data-source';
import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { CommandDispatch } from '../types';

/*
 * Edit player data. will take flags i.e. --house. will hard set to the
 * value given @player --house <HOUSE> --money <MONEY> --men <MEN> --ships
 * <SHIPS> --title <array>
 */
const edit = async (): Promise<null> => null;

/*
 * Take person title, men, ships, money
 * @player [TITLE|MEN|SHIPS|MONEY] <VALUE>
 */
const take = async (): Promise<null> => null;

// VIEW ALL THE STUFF!!!!!!!!!!
const view = async (): Promise<null> => null;

export const dispatch: CommandDispatch = {
  edit: {
    type: 'message',
    function: edit,
    args: [],
    command_args: [[]],
    usage: [],
    slashCommandBuilder: new SlashCommandBuilder()
      .setName('edit')
      .setDescription('edit the things')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  },
  take: {
    type: 'message',
    function: take,
    args: [],
    command_args: [[]],
    usage: [],
    slashCommandBuilder: new SlashCommandBuilder()
      .setName('take')
      .setDescription('take the things')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  },
  view: {
    type: 'message',
    function: view,
    args: [],
    command_args: [[]],
    usage: [],
    slashCommandBuilder: new SlashCommandBuilder()
      .setName('view')
      .setDescription('view the things')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  },
};
