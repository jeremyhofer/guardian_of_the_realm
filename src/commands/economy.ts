import { PlayerData } from '../entity/PlayerData';
import { ArgTypes } from '../enums';
import {
  ArgParserFn,
  ArmyUnits,
  armyUnits,
  CommandDispatch,
  CommandReturn,
  Rank,
} from '../types';
import * as assets from '../assets';
import * as utils from '../utils';
import * as game_tasks from '../game_tasks';
import { Database } from '../data-source';
import {
  APIRole,
  ChatInputCommandInteraction,
  Role,
  SlashCommandBuilder,
  User,
} from 'discord.js';

/*
 * Buy some item in a quantity. titles only one, cant buy more or same
 * again.  <OBJECT> <AMOUNT>
 */
const buy = async (
  interaction: ChatInputCommandInteraction
): Promise<CommandReturn> => {
  const argParser: ArgParserFn<
    { role: Role | APIRole } | { troopType: ArmyUnits; amount: number }
  > = (options) => {
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
  };

  const parsedArgs = argParser(interaction.options);

  if (parsedArgs === null) {
    return {
      reply: 'Issue with arguments. Contact a Developer.',
      success: true,
    };
  }

  const playerData = await Database.playerData.getOrCreatePlayer(
    interaction.user.id
  );

  const playerRoles: string[] = await game_tasks.getAllPlayerRoleNames(
    interaction,
    interaction.user
  );

  // Get item and quanity. Default quantity is 1
  let possibleItem =
    'role' in parsedArgs
      ? parsedArgs.role.name.toLowerCase()
      : parsedArgs.troopType;
  const quantity = 'amount' in parsedArgs ? parsedArgs.amount : 1;

  let itemExists = possibleItem in assets.storeItems;

  if (!itemExists && possibleItem in assets.gameRoles) {
    [possibleItem] = assets.gameRoles[possibleItem];
    itemExists = true;
  }

  const item = possibleItem;

  // Ensure the desired item is in the store
  if (!itemExists) {
    return { reply: `${item} is not a valid store item.`, success: true };
  }
  // Make sure the user has enough money for the item
  const totalCost = quantity * assets.storeItems[item].cost;

  if (playerData.money < totalCost) {
    return {
      reply: 'You do not have enough money to make the purchase',
      success: true,
    };
  }
  // Good to buy!
  const itemType = assets.storeItems[item].type;
  let deductCost = false;
  let itemRequires: Rank | undefined;

  if ('requires' in assets.storeItems[item]) {
    itemRequires = assets.storeItems[item].requires;
  }

  let reply = '';

  // If this is a title type set the roles to adjust
  switch (itemType) {
    case 'title':
    case 'income':
      if (playerRoles.includes(item)) {
        return { reply: `You already have the ${item} title`, success: true };
      }

      if (itemRequires !== undefined && !playerRoles.includes(itemRequires)) {
        return {
          reply: `The ${item} title requires the ${itemRequires} title to buy`,
          success: true,
        };
      }
      await game_tasks.alterRole(interaction, interaction.user, item, 'add');

      if (itemRequires !== undefined) {
        await game_tasks.alterRole(
          interaction,
          interaction.user,
          itemRequires,
          'remove'
        );
      }
      reply = `You successfully bought the ${item} title for ${totalCost}`;
      deductCost = true;
      break;
    case 'men':
    case 'ships':
      playerData[itemType] += quantity;
      reply = `You successfully bought ${quantity} ${item} for ${totalCost}`;
      deductCost = true;
      break;
    default:
      reply = `Item type ${itemType} not supported. Please contact a bot dev.`;
  }

  if (deductCost) {
    playerData.money -= totalCost;
  }

  await Database.playerData.setPlayer(playerData);

  return { reply, success: true };
};

/*
 * Request a loan of a given amount. must repay within 24 hours.
 * no more than 50% total money. random 5-50% interest. only one at a time.
 * .loan <GET|PAY|SHOW> <amount>
 */
const loan = async (
  interaction: ChatInputCommandInteraction
): Promise<CommandReturn> => {
  const argParser: ArgParserFn<
    { show: boolean } | { payAmount: string } | { getAmount: number }
  > = (options) => {
    const subCommand = options.getSubcommand();

    if (subCommand === 'show') {
      return { show: true };
    }

    if (subCommand === 'pay') {
      return { payAmount: options.getString('pay-amount') ?? '' };
    }

    if (subCommand === 'get') {
      return { getAmount: options.getNumber('get-amount') ?? 0 };
    }

    return null;
  };

  const parsedArgs = argParser(interaction.options);

  if (parsedArgs === null) {
    return {
      reply: 'Issue with arguments. Contact a Developer.',
      success: true,
    };
  }

  const playerData = await Database.playerData.getOrCreatePlayer(
    interaction.user.id
  );

  if ('getAmount' in parsedArgs) {
    // See if player has a loan
    if (Array.isArray(playerData.loans) && playerData.loans.length > 0) {
      return { reply: 'You already have an outstanding loan', success: true };
    }
    // Ensure a value was specified and that it is valid
    const loanAmount = parsedArgs.getAmount;
    const maxLoanAmount = Math.floor(playerData.money / 2);

    if (isNaN(loanAmount) || loanAmount < 1) {
      return { reply: 'Loan amount must be a positive number', success: true };
    } else if (playerData.money < 0) {
      return { reply: 'You are in debt and may not buy a loan', success: true };
    } else if (loanAmount > maxLoanAmount) {
      return {
        reply: `The maximum loan amount you may get is ${maxLoanAmount}`,
        success: true,
      };
    }

    // Good to go! Grant player loan amount. Determine interest
    const interest = utils.getPercentOfValueGivenRange(loanAmount, 5, 50);
    playerData.money += loanAmount;
    await Database.playerData.setPlayer(playerData);
    await Database.loan.insertLoan({
      user: playerData.user as any,
      amount_due: loanAmount + interest,
      time_due: Date.now() + utils.hoursToMs(24),
    });
    return {
      reply: `You successfully received a loan of ${loanAmount}. You have been charged ${interest} in interest. The loan is due in 24 hours`,
      success: true,
    };
  } else if ('payAmount' in parsedArgs) {
    // See if player has a loan
    if (!Array.isArray(playerData.loans) || playerData.loans.length === 0) {
      return { reply: 'You do not have an outstanding loan', success: true };
    }

    const [loanInfo] = playerData.loans;
    // Ensure a value was specified and that it is valid.
    let payAmount = 0;

    const value = parsedArgs.payAmount;

    if (value === 'all') {
      payAmount = loanInfo.amount_due;
    } else {
      payAmount = parseInt(value);
      if (!isNaN(payAmount)) {
        payAmount =
          payAmount > loanInfo.amount_due ? loanInfo.amount_due : payAmount;
      }
    }

    if (isNaN(payAmount) || payAmount < 1) {
      return { reply: 'Pay amount must be a positive number', success: true };
    } else if (payAmount > playerData.money) {
      return { reply: 'You do not have enough money', success: true };
    }

    // Good to go! Adjust amount due. If paid off, delete the loan
    loanInfo.amount_due -= payAmount;

    let reply = '';

    playerData.money -= payAmount;
    await Database.playerData.setPlayer(playerData);

    if (loanInfo.amount_due <= 0) {
      // Loan is paid! Delete it
      await Database.loan.removeLoan(loanInfo);
      reply = 'You have paid off your loan!';
    } else {
      // Still have money due
      await Database.loan.saveLoan(loanInfo);
      reply = `You paid ${payAmount} toward your loan. You still owe ${loanInfo.amount_due}`;
    }

    return { reply, success: true };
  } else if ('show' in parsedArgs) {
    if (!Array.isArray(playerData.loans) || playerData.loans.length === 0) {
      return { reply: 'You do not have any loans', success: true };
    }
    let reply = '';
    // Output loan info
    for (const thisLoan of playerData.loans) {
      const timeUntilDue = thisLoan.time_due - Date.now();
      const dueString =
        timeUntilDue > 0
          ? `due in ${utils.getTimeUntilString(timeUntilDue)}`
          : 'past due';
      reply = `You owe ${thisLoan.amount_due} on your loan. The loan is ${dueString}`;
    }

    return { reply, success: true };
  } else {
    return { reply: 'Unknown loan action', success: true };
  }
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
    type: 'slash',
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
          .addNumberOption((option) =>
            option
              .setName('get-amount')
              .setDescription('amount desired')
              .setRequired(true)
              .setMinValue(1)
          )
      )
      .addSubcommand((subcommand) =>
        subcommand
          .setName('pay')
          .setDescription('Purchase a new loan')
          .addStringOption((option) =>
            option
              .setName('pay-amount')
              .setDescription('amount to pay - ALL or set value')
              .setRequired(true)
          )
      ),
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
