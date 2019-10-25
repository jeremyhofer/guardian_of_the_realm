const assets = require('../assets.js');

/*
 * Buy some item in a quantity. titles only one, cant buy more or same
 * again.  <OBJECT> <AMOUNT>
 */
const buy = ({args, player_data}) => {
  const command_return = {
    "reply": "",
    "update": {
      "player_data": {...player_data},
      "roles": {
        "add": [],
        "remove": []
      }
    }
  };

  if(Array.isArray(args) && args.length) {
    // Get item and quanity. Default quantity is 1
    const item = args[0].toLowerCase();
    const quantity = args.length > 1
      ? parseInt(args[1], 10)
      : 1;

    // Ensure the desired item is in the store
    if(item in assets.store_items) {
      // Ensure we have a valid quanity value
      if(isNaN(quantity)) {
        command_return.reply = "quantity to buy must be a number";
      } else {
        // Make sure the user has enough money for the item
        const total_cost = quantity * assets.store_items[item].cost;

        if(player_data.money >= total_cost) {
          // Good to buy!
          const item_type = assets.store_items[item].type;
          let deduct_cost = false;

          // If this is a title type set the roles to adjust
          switch(item_type) {
            case "title":
              command_return.update.roles.add.push(item);
              command_return.reply = `you successfully bought the ${item} ` +
                `title for ${total_cost}`;
              deduct_cost = true;
              break;
            case "men":
            case "ships":
              command_return.update.player_data[item_type] += quantity;
              command_return.reply = `you successfully bought ${quantity} ` +
                `${item} for ${total_cost}`;
              deduct_cost = true;
              break;
            default:
              command_return.reply = `item type ${item_type} not ` +
                "supported. Please contact a bot dev.";
          }

          if(deduct_cost) {
            command_return.update.player_data.money -= total_cost;
          }
        } else {
          command_return.reply = "you do not have enough money to make " +
            "the purchase";
        }
      }
    } else {
      command_return.reply = `${item} is not a valid store item.`;
    }
  } else {
    command_return.reply = "buy requires at least 1 argument. usage: buy " +
      "<item> <quantity>";
  }

  return command_return;
};

/*
 * Request a loan of a given amount. must repay within 24 hours.
 * no more than 50% total money. random 5-50% interest. only one at a time
 */
const loan = () => null;

// Lists everything in the market they may buy
const market = () => {
  let reply = "The items available in the market are:\n";

  for(var key in assets.store_items) {
    if(key in assets.store_items && 'cost' in assets.store_items[key]) {
      const item_cost = assets.store_items[key].cost;
      reply += `${key} ${item_cost}\n`;
    }
  }

  return {
    reply
  };
};

module.exports = {
  "dispatch": {
    "buy": {
      "function": buy,
      "args": [
        "args",
        "player_data"
      ]
    },
    "loan": {
      "function": loan,
      "args": []
    },
    "market": {
      "function": market,
      "args": []
    }
  }
};
