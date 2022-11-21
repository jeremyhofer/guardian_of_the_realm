import 'reflect-metadata'; // for typeorm
import { Client } from 'discord.js';
import auth from './auth.json';

console.log('Bot is starting...');

const client = new Client({
  intents: []
});
client.login(auth.token).catch((error) => {
  console.error('Error logging into discord API');
  console.error(error);
});

console.log(client);
