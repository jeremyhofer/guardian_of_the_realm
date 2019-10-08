const Discord = require('discord.js');
const client = new Discord.Client();
const auth = require('./auth.json');
const PREFIX = '.';
var economy = require('./commands/economy.js');
var tasks = require('./commands/tasks.js');
var admin = require('./commands/admin.js');
var player_interact = require('./commands/player_interact.js');
var clan_interact = require('./commands/clan_interact.js');
var general = require('./commands/general.js');
const command_dispatch = {
  "add": admin.add,
  "buy": economy.buy,
  "give": admin.give,
  "help": general.help,
  "join": clan_interact.join,
  "loan": economy.loan,
  "map": admin.map,
  "market": economy.market,
  "pirate": player_interact.pirate,
  "pledge": clan_interact.pledge,
  "pray": tasks.pray,
  "raid": player_interact.raid,
  "siege": clan_interact.siege,
  "slut": tasks.slut,
  "smuggle": player_interact.smuggle,
  "spy": player_interact.spy,
  "take": admin.take,
  "thief": player_interact.thief,
  "train": tasks.train,
  "view": admin.view,
  "war": clan_interact.war,
  "work": tasks.work
};


client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.login(auth.token);

client.on('message', msg => {
  var tokens = msg.content.split(" ");
  if (tokens[0].startsWith(PREFIX)) {
    var command = tokens[0].substring(1);
    if(command in command_dispatch) {
      command_dispatch[command](tokens.slice(1));
      msg.reply(command + ' is not yet implemented');
    } else{
      msg.reply(command + ' is not a recognized command');
    }
  }
});
