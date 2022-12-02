import { PlayerData } from '../entity/PlayerData';
import { ArgTypes } from '../enums';
import {
  ArmyUnits,
  armyUnits,
  CommandDispatch,
  CommandReturn,
  Rank,
} from '../types';
import * as assets from '../assets';
import * as utils from '../utils';
import { Database } from '../data-source';
import { APIRole, Role, SlashCommandBuilder } from 'discord.js';

/*
 * Buy some item in a quantity. titles only one, cant buy more or same
 * again.  <OBJECT> <AMOUNT>
 */
const buy = async ({
  args,
  playerData,
  playerRoles,
}: {
  args: string[];
  playerData: PlayerData;
  playerRoles: string[];
}): Promise<CommandReturn> => {
  const commandReturn: CommandReturn = {
    reply: '',
    update: {
      playerData,
      roles: {
        player: {
          add: [],
          remove: [],
        },
      },
    },
    success: true,
  };

  if (Array.isArray(args) && args.length > 0) {
    // Get item and quanity. Default quantity is 1
    let possibleItem = args[0].toLowerCase();
    const quantity = args.length > 1 ? parseInt(args[1], 10) : 1;

    let itemExists = possibleItem in assets.storeItems;

    if (!itemExists && possibleItem in assets.gameRoles) {
      [possibleItem] = assets.gameRoles[possibleItem];
      itemExists = true;
    }

    const item = possibleItem;

    // Ensure the desired item is in the store
    if (itemExists) {
      // Ensure we have a valid quanity value
      if (isNaN(quantity)) {
        commandReturn.reply = 'Quantity to buy must be a number';
      } else {
        // Make sure the user has enough money for the item
        const totalCost = quantity * assets.storeItems[item].cost;

        if (playerData.money >= totalCost) {
          // Good to buy!
          const itemType = assets.storeItems[item].type;
          let deductCost = false;
          let itemRequires: Rank | undefined;

          if ('requires' in assets.storeItems[item]) {
            itemRequires = assets.storeItems[item].requires;
          }

          // If this is a title type set the roles to adjust
          switch (itemType) {
            case 'title':
            case 'income':
              if (playerRoles.includes(item)) {
                commandReturn.reply = `You already have the ${item} title`;
              } else if (
                itemRequires !== undefined &&
                !playerRoles.includes(itemRequires)
              ) {
                commandReturn.reply = `The ${item} title requires the ${itemRequires} title to buy`;
              } else {
                commandReturn?.update?.roles?.player?.add.push(item);

                if (itemRequires !== undefined) {
                  commandReturn?.update?.roles?.player?.remove.push(
                    itemRequires
                  );
                }
                commandReturn.reply = `You successfully bought the ${item} title for ${totalCost}`;
                deductCost = true;
              }
              break;
            case 'men':
            case 'ships':
              // TODO: need to improve things type wise
              (commandReturn?.update?.playerData as PlayerData)[itemType] +=
                quantity;
              commandReturn.reply = `You successfully bought ${quantity} ${item} for ${totalCost}`;
              deductCost = true;
              break;
            default:
              commandReturn.reply = `Item type ${itemType} not supported. Please contact a bot dev.`;
          }

          if (deductCost) {
            (commandReturn?.update?.playerData as PlayerData).money -=
              totalCost;
          }
        } else {
          commandReturn.reply =
            'You do not have enough money to make the purchase';
        }
      }
    } else {
      commandReturn.reply = `${item} is not a valid store item.`;
    }
  } else {
    commandReturn.reply =
      'buy requires at least 1 argument. usage: buy <item> <quantity>';
  }

  return commandReturn;
};

/*
 * Request a loan of a given amount. must repay within 24 hours.
 * no more than 50% total money. random 5-50% interest. only one at a time.
 * .loan <GET|PAY|SHOW> <amount>
 */
const loan = async ({
  args,
  playerData,
}: {
  args: string[];
  playerData: PlayerData;
}): Promise<CommandReturn> => {
  const commandReturn: CommandReturn = {
    update: {
      playerData,
    },
    loans: {},
    reply: '',
    success: true,
  };

  let [action, value] = args;

  action = action.toLowerCase();

  if (action === 'get') {
    // See if player has a loan
    if (Array.isArray(playerData.loans) && playerData.loans.length > 0) {
      commandReturn.reply = 'You already have an outstanding loan';
    } else {
      // Ensure a value was specified and that it is valid
      const loanAmount = args.length === 2 ? parseInt(value) : NaN;
      const maxLoanAmount = Math.floor(playerData.money / 2);

      if (isNaN(loanAmount) || loanAmount < 1) {
        commandReturn.reply = 'Loan amount must be a positive number';
      } else if (playerData.money < 0) {
        commandReturn.reply = 'You are in debt and may not buy a loan';
      } else if (loanAmount > maxLoanAmount) {
        commandReturn.reply = `The maximum loan amount you may get is ${maxLoanAmount}`;
      } else {
        // Good to go! Grant player loan amount. Determine interest
        const interest = utils.getPercentOfValueGivenRange(loanAmount, 5, 50);
        (commandReturn?.update?.playerData as PlayerData).money += loanAmount;
        (commandReturn.loans as any).add = Database.loan.createLoan({
          user: playerData,
          amount_due: loanAmount + interest,
          time_due: Date.now() + utils.hoursToMs(24),
        });
        commandReturn.reply = `You successfully received a loan of ${loanAmount}. You have been charged ${interest} in interest. The loan is due in 24 hours`;
      }
    }
  } else if (action === 'pay') {
    // See if player has a loan
    if (Array.isArray(playerData.loans) && playerData.loans.length > 0) {
      const [loanInfo] = playerData.loans;
      // Ensure a value was specified and that it is valid.
      let payAmount = 0;

      // Adjust amount accordingly
      if (args.length === 2) {
        if (value === 'all') {
          payAmount = loanInfo.amount_due;
        } else {
          payAmount = parseInt(value);
          if (!isNaN(payAmount)) {
            payAmount =
              payAmount > loanInfo.amount_due ? loanInfo.amount_due : payAmount;
          }
        }
      }

      if (isNaN(payAmount) || payAmount < 1) {
        commandReturn.reply = 'Pay amount must be a positive number';
      } else if (payAmount > playerData.money) {
        commandReturn.reply = 'You do not have enough money';
      } else {
        // Good to go! Adjust amount due. If paid off, delete the loan
        loanInfo.amount_due -= payAmount;

        if (loanInfo.amount_due <= 0) {
          // Loan is paid! Delete it
          (commandReturn.loans as any).remove = loanInfo;
          commandReturn.reply = 'You have paid off your loan!';
        } else {
          // Still have money due
          (commandReturn.loans as any).update = loanInfo;
          commandReturn.reply = `You paid ${payAmount} toward your loan. You still owe ${loanInfo.amount_due}`;
        }

        (commandReturn.update?.playerData as PlayerData).money -= payAmount;
      }
    } else {
      commandReturn.reply = 'You do not have an outstanding loan';
    }
  } else if (action === 'show') {
    if (Array.isArray(playerData.loans) && playerData.loans.length > 0) {
      // Output loan info
      playerData.loans.forEach((thisLoan) => {
        const timeUntilDue = thisLoan.time_due - Date.now();
        const dueString =
          timeUntilDue > 0
            ? `due in ${utils.getTimeUntilString(timeUntilDue)}`
            : 'past due';
        commandReturn.reply = `You owe ${thisLoan.amount_due} on your loan. The loan is ${dueString}`;
      });
    } else {
      commandReturn.reply = 'You do not have any loans';
    }
  } else {
    commandReturn.reply = `${action} is not a valid loan action`;
  }

  return commandReturn;
};

// Lists everything in the market they may buy
const market = async (): Promise<CommandReturn> => {
  let titlesReply =
    'TITLES WILL EARN YOU MONEY EVERY DAY - BUY THEM ALL - LIMIT ONE PER HOUSEHOLD:\n';
  let nobilityReply = 'NOBILITY:\n';
  let warriorReply = 'WARRIOR:\n';

  Object.keys(assets.storeItems).forEach((value) => {
    const key = value;
    const itemCost = assets.storeItems[key].cost;
    const itemFlavor = assets.storeItems[key].flavor;
    const itemType = assets.storeItems[key].type;
    const keyCap = key[0].toUpperCase() + key.slice(1);
    const itemReplyText = `${keyCap}, ${itemCost} - ${itemFlavor}\n`;
    if (itemType === 'income') {
      titlesReply += itemReplyText;
    } else if (itemType === 'title') {
      nobilityReply += itemReplyText;
    } else {
      warriorReply += itemReplyText;
    }
  });

  const reply = `${titlesReply}\n${nobilityReply}\n${warriorReply}`;

  return {
    reply,
    success: true,
  };
};

export const dispatch: CommandDispatch = {
  buy: {
    type: 'message',
    function: buy,
    args: ['args', 'playerData', 'playerRoles'],
    command_args: [[ArgTypes.game_role], [ArgTypes.string, ArgTypes.number]],
    usage: ['ROLE', 'ITEM AMOUNT'],
    slashCommandBuilder: new SlashCommandBuilder()
      .setName('buy')
      .setDescription('buy the things')
      .addSubcommand((subcommand) =>
        subcommand
          .setName('role')
          .setDescription('Purchase a building or title')
          .addRoleOption((option) =>
            option
              .setName('role')
              .setDescription('Role to purchase')
              .setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('troops')
          .setDescription('Purchase troops')
          .addStringOption((option) =>
            option
              .setName('type')
              .setDescription('type of troop to purchase')
              .addChoices(
                ...armyUnits.map((unit) => ({ name: unit, value: unit }))
              )
              .setRequired(true)
          )
          .addNumberOption((option) =>
            option
              .setName('amount')
              .setDescription('number to purchase')
              .setRequired(true)
          )
      ),
    slashCommandOptionParser: (
      options
    ):
      | { role: Role | APIRole }
      | { troopType: ArmyUnits; amount: number }
      | null => {
      const subCommand = options.getSubcommand();

      if (subCommand === 'role') {
        const role = options.getRole('role');

        if (role === null) {
          return null;
        }

        return { role };
      }

      if (subCommand === 'troops') {
        const troopType = options.getString('type');
        const amount = options.getNumber('amount');

        if (troopType === null || amount === null) {
          return null;
        }

        return { troopType, amount };
      }

      return null;
    },
  },
  loan: {
    type: 'message',
    function: loan,
    args: ['args', 'playerData'],
    command_args: [
      [ArgTypes.string],
      [ArgTypes.string, ArgTypes.number],
      [ArgTypes.string, ArgTypes.string],
    ],
    usage: ['show', 'get AMOUNT', 'pay AMOUNT|all'],
    slashCommandBuilder: new SlashCommandBuilder()
      .setName('loan')
      .setDescription('loan the things')
      .addSubcommand((subcommand) =>
        subcommand.setName('show').setDescription('View existing loans')
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('get')
          .setDescription('Purchase a new loan')
          .addStringOption((option) =>
            option
              .setName('amount')
              .setDescription('amount desired')
              .setRequired(true)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('pay')
          .setDescription('Purchase a new loan')
          .addStringOption((option) =>
            option
              .setName('amount')
              .setDescription('amount to pay - ALL or set value')
              .setRequired(true)
          )
      ),
    slashCommandOptionParser: (
      options
    ): { action: string; amount: string | null } | null => {
      const subCommand = options.getSubcommand();

      if (!['show', 'get', 'pay'].some((command) => command === subCommand)) {
        return null;
      }

      return { action: subCommand, amount: options.getString('amount') };
    },
  },
  market: {
    type: 'slash',
    function: market,
    args: [],
    command_args: [[]],
    usage: [],
    slashCommandBuilder: new SlashCommandBuilder()
      .setName('market')
      .setDescription('market the things'),
  },
};
