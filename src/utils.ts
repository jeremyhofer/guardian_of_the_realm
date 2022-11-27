import {
  CategoryChannel,
  ChannelType,
  Emoji,
  Guild,
  GuildBasedChannel,
  TextChannel,
} from 'discord.js';
import {
  availableStoreItems,
  AvailableStoreItems,
  EmojiNames,
  Emojis,
  GameRoles,
} from './types';

/**
 * Convert milliseconds to a countdown-like string.
 * @param {number} ms milliseconds .
 * @returns {string} Countdown-like string of milliseconds provided.
 */
export function getTimeUntilString(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);
  let message = '';

  if (hours !== 0) {
    message = `${hours} hours ${minutes} minutes ${seconds} seconds`;
  } else if (minutes !== 0) {
    message = `${minutes} minutes ${seconds} seconds`;
  } else {
    message = `${seconds} seconds`;
  }

  return message;
}

/**
 * Return a random number in the range between min and max, inclusive.
 * @param {number} min minimum value in range.
 * @param {number} max maximum value in range.
 * @returns {number} random value in range.
 */
export function getRandomValueInRange(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// Return a percent of value between p_min and p_max, inclusively
export function getPercentOfValueGivenRange(
  value: number,
  pMin: number,
  pMax: number
): number {
  return Math.round((value * getRandomValueInRange(pMin, pMax)) / 100);
}

// Covert hours to milliseconds
export function hoursToMs(hours: number): number {
  return hours * 60 * 60 * 1000;
}

/*
 * This is specific for searching the game roles asset for a role
 * ID containing a valid identifier matching the name argument.
 * All items in the role_obj are in the form role_id: [identifier list]
 */
export function findRoleIdGivenName(name: string, roleObj: GameRoles): string {
  let roleId = '';

  if (name !== '') {
    for (const key in roleObj) {
      if (roleObj[key].includes(name.toLowerCase())) {
        roleId = key;
        break;
      }
    }
  }

  return roleId;
}

// Replaces {key} with value in mapping for each key in mapping
export function templateReplace(
  template: string,
  mappings: { [key: string]: string | number }
): string {
  let filledTemplate = template;

  for (const key in mappings) {
    const re = new RegExp(`\\{${key}\\}`, 'gu');
    filledTemplate = filledTemplate.replace(re, `${mappings[key]}`);
  }

  return filledTemplate;
}

export function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

export function winChance(
  attackerTotal: number,
  defenderTotal: number
): number {
  return Math.round((attackerTotal / (attackerTotal + defenderTotal)) * 100);
}

export function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}

export function chanceThreshold(
  instigatorTotal: number,
  otherTotal: number
): { threshold: number; chance: number } {
  const threshold = clamp(winChance(instigatorTotal, otherTotal), 0, 100);

  const chance = getRandomValueInRange(1, 100);

  return {
    threshold,
    chance,
  };
}

export function riskSuccess(
  instigatorTotal: number,
  otherTotal: number
): boolean {
  const { threshold, chance } = chanceThreshold(instigatorTotal, otherTotal);

  return chance >= threshold;
}

export function isAWin(instigatorTotal: number, otherTotal: number): boolean {
  const { threshold, chance } = chanceThreshold(instigatorTotal, otherTotal);

  return threshold >= chance;
}

function isTextChannel(
  channel: GuildBasedChannel | undefined
): channel is TextChannel {
  return channel?.isTextBased() === true;
}

export function getGuildTextChannel(
  guild: Guild | null,
  channelId: string
): TextChannel | null {
  if (guild === null) {
    return null;
  }

  const channel = guild.channels.cache.get(channelId);
  return isTextChannel(channel) ? channel : null;
}

export function findGuildTextChannelByName(
  guild: Guild | null,
  channelName: string
): TextChannel | null {
  if (guild === null) {
    return null;
  }

  const channel = guild.channels.cache.find((c) => c.name === channelName);
  return isTextChannel(channel) ? channel : null;
}

function isCategoryChannel(
  channel: GuildBasedChannel | undefined
): channel is CategoryChannel {
  return channel?.type === ChannelType.GuildCategory;
}

export function findGuildCategoryChannelByName(
  guild: Guild | null,
  channelName: string
): CategoryChannel | null {
  if (guild === null) {
    return null;
  }

  const channel = guild.channels.cache.find((c) => c.name === channelName);
  return isCategoryChannel(channel) ? channel : null;
}

export function isEmojiName(name: string): name is EmojiNames {
  return Emojis.includes(name);
}

export function isAvailableStoreItem(
  name: string
): name is AvailableStoreItems {
  return availableStoreItems.includes(name);
}
