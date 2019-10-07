const Discord = require('discord.js');
const client = new Discord.Client();
const auth = require('./auth.json');
const PREFIX = '.';
const command_dispatch = {
  "add": null,
  "arms": null,
  "buy": null,
  "give": null,
  "help": null,
  "loan": null,
  "map": null,
  "market": null,
  "pirate": null,
  "pledge": null,
  "pray": null,
  "raid": null,
  "siege": null,
  "slut": null,
  "smuggle": null,
  "spy": null,
  "take": null,
  "thief": null,
  "train": null,
  "war": null,
  "work": null
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
      msg.reply(command + ' is not yet implemented');
    } else{
      msg.reply(command + ' is not a recognized command');
    }
  }
});
