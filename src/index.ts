import { Client, GatewayIntentBits } from 'discord.js';
import { AppDataSource } from './data-source';
import * as game_tasks from './game_tasks';
import * as auth from './auth.json';
import * as botHandlers from './bot';
import * as utils from './utils';
import * as assets from './assets';
import * as database from './database';

database.operations.reset_everything();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

let clientReady = false;
let gameActive = false;
let tickProcessing = false;

AppDataSource.initialize()
  .then(async () => await game_tasks.configureTrackers())
  .then(async () => {
    await client.login(auth.token).catch((err) => {
      console.error('issue logging in to discord api');
      console.error(err);
    });

    client.on('ready', async () => {
      console.log(`Logged in as ${client.user?.tag ?? 'BOT NAME ISSUE'}!`);
      clientReady = true;
      gameActive = await game_tasks.isGameActive();
    });

    client.on('messageCreate', async (message) => {
      await botHandlers.messageHandler(message, gameActive);
    });
  })
  .catch((error) => {
    console.error('app init error');
    console.error(error);
    process.exit(1);
  });

setInterval(() => {
  /*
   * Give role payouts if it is time. Payout part every 12 hours
   * Charge 1 money per men every 12 hours
   * Charge 100 money per ship every 12 hours
   * Check to see if a war vote should be finalized and finalize it
   * Check to see if a truce vote should be finalized and finalize it
   * Check to see if a siege should be resolved
   * ST guild ID: 572263893729017893
   */
  if (clientReady && gameActive && !tickProcessing) {
    const guild = client.guilds.cache.get('572263893729017893');
    if (guild !== undefined) {
      tickProcessing = true;
      const now = Date.now();
      const expirationTime =
        now - utils.hoursToMs(assets.timeoutLengths.vote_expiration);
      // TODO: determine how to better loop game tick to avoid conflicts
      game_tasks
        .rolePayouts(guild, now)
        .then(async () => await game_tasks.collectLoans(guild, now))
        .then(
          async () => await game_tasks.resolveWarVotes(guild, expirationTime)
        )
        .then(
          async () => await game_tasks.resolvePactVotes(guild, expirationTime)
        )
        .then(async () => await game_tasks.resolveSieges(guild, now))
        .then(async () => {
          gameActive = await game_tasks.isGameActive();
          tickProcessing = false;
        })
        .catch((error) => {
          console.error('issue processing game tick');
          console.error(error);
        });
    }
  }
}, 100000);
