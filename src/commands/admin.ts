// import { Database } from '../data-source';
import { CommandDispatch } from '../types';

/*
 * Edit player data. will take flags i.e. --house. will hard set to the
 * value given @player --house <HOUSE> --money <MONEY> --men <MEN> --ships
 * <SHIPS> --title <array>
 */
const edit = async(): Promise<null> => null;

/*
 * Take person title, men, ships, money
 * @player [TITLE|MEN|SHIPS|MONEY] <VALUE>
 */
const take = async(): Promise<null> => null;

// VIEW ALL THE STUFF!!!!!!!!!!
const view = async(): Promise<null> => null;

export const dispatch: CommandDispatch = {
  edit: {
    function: edit,
    args: [],
    command_args: [[]],
    usage: []
  },
  take: {
    function: take,
    args: [],
    command_args: [[]],
    usage: []
  },
  view: {
    function: view,
    args: [],
    command_args: [[]],
    usage: []
  }
};
