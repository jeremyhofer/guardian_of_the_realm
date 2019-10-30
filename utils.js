module.exports = {
  get_time_until_string (ms) {

    /**
     * Convert milliseconds to a countdown-like string.
     * @param {number} ms milliseconds .
     * @returns {string} Countdown-like string of milliseconds provided.
     */
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor(ms % (1000 * 60 * 60) / (1000 * 60));
    const seconds = Math.floor(ms % (1000 * 60) / 1000);
    let message = "";

    if(hours) {
      message = `${hours} hours ${minutes} minutes ${seconds} seconds`;
    } else if (minutes) {
      message = `${minutes} minutes ${seconds} seconds`;
    } else {
      message = `${seconds} seconds`;
    }

    return message;
  },
  get_random_value_in_range (min, max) {

    /**
     * Return a random number in the range between min and max, inclusive.
     * @param {number} min minimum value in range.
     * @param {number} max maximum value in range.
     * @returns {number} random value in range.
     */
    return min + Math.floor(Math.random() * (max - min + 1));
  },
  get_percent_of_value_given_range (value, p_min, p_max) {
    // Return a percent of value between p_min and p_max, inclusively
    return Math.round(value *
        (module.exports.get_random_value_in_range(p_min, p_max) / 100));
  },
  hours_to_ms (hours) {
    // Covert hours to milliseconds
    return hours * 60 * 60 * 1000;
  },
  find_role_id_given_name (name, role_obj) {

    /*
     * This is specific for searching the game roles asset for a role
     * ID containing a valid identifier matching the name argument.
     * All items in the role_obj are in the form role_id: [identifier list]
     */
    let role_id = "";

    for(const key in role_obj) {
      if(key in role_obj && role_obj[key].includes(name.toLowerCase())) {
        role_id = key;
        break;
      }
    }

    return role_id;
  }
};
