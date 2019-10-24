/*
 * Give person title, men, ships, money
 * @player [TITLE|MEN|SHIPS|MONEY] <VALUE>
 */
const gift = () => null;

/*
 * Destroy ships! fail_risk = yours / (theirs + 2*yours)
 * fail lose 5-15, other 1-9. win lose 1-9, other 10-20
 * <PLAYER>
 */
const pirate = () => null;

/*
 * Destroy men! fail_risk = yours / (theirs + 2*yours)
 * fail lose 50-150, other 10-90. win lose 10-90, other 100-150
 * <PLAYER>.
 */
const raid = () => null;

/*
 * View money, ships, men of a player. costs 400
 * <PLAYER>
 */
const spy = () => null;

/*
 * Steal money from someone. fail_risk = yours / (theirs + yours)
 * on succeed, take 2-10%. fail pay 100-1000 to player
 * <PLAYER>
 */
const thief = () => null;

module.exports = {
  "dispatch": {
    "gift": {
      "function": gift,
      "args": []
    },
    "pirate": {
      "function": pirate,
      "args": []
    },
    "raid": {
      "function": raid,
      "args": []
    },
    "spy": {
      "function": spy,
      "args": []
    },
    "thief": {
      "function": thief,
      "args": []
    }
  }
};
