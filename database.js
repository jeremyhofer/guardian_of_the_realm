const SQLite = require("better-sqlite3");
const sql = new SQLite('./data/gotr_bot.sqlite');

const player_table = sql.prepare(`
  SELECT count(*) FROM sqlite_master
  WHERE type='table' AND name = 'player_data';
`).get();

if (!player_table['count(*)']) {
  // If the table isn't there, create it and setup the database correctly.
  sql.prepare(`
    CREATE TABLE player_data (
      user TEXT PRIMARY KEY,
      house TEXT,
      men INTEGER,
      ships INTEGER,
      money INTEGER,
      gift_last_time INTEGER,
      loan_last_time INTEGER,
      pirate_last_time INTEGER,
      pray_last_time INTEGER,
      raid_last_time INTEGER,
      smuggle_last_time INTEGER,
      spy_last_time INTEGER,
      subvert_last_time INTEGER,
      thief_last_time INTEGER,
      train_last_time INTEGER,
      work_last_time INTEGER
    );
  `).run();
  // Ensure that the "id" row is always unique and indexed.
  sql.prepare(`
    CREATE UNIQUE INDEX idx_player_data_id ON player_data (user);
  `).run();
}

const loan_table = sql.prepare(`
  SELECT count(*) FROM sqlite_master
  WHERE type='table' AND name = 'loans';
`).get();

if (!loan_table['count(*)']) {
  // If the table isn't there, create it and setup the database correctly.
  sql.prepare(`
    CREATE TABLE loans (
      loan_id INTEGER PRIMARY KEY,
      user TEXT,
      amount_due INTEGER,
      time_due INTEGER,
      FOREIGN KEY(user) REFERENCES player_data(user)
    );
  `).run();
  // Ensure that the "id" row is indexed.
  sql.prepare(`
    CREATE INDEX idx_loan_user_id ON loans (user);
  `).run();
}

const war_table = sql.prepare(`
  SELECT count(*) FROM sqlite_master
  WHERE type='table' AND name = 'wars';
`).get();

if (!war_table['count(*)']) {
  // If the table isn't there, create it and setup the database correctly.
  sql.prepare(`
    CREATE TABLE wars (
      war_id INTEGER PRIMARY KEY,
      house_a TEXT,
      house_b TEXT
    );
  `).run();
}

const vote_table = sql.prepare(`
  SELECT count(*) FROM sqlite_master
  WHERE type='table' AND name = 'votes';
`).get();

if (!vote_table['count(*)']) {
  // If the table isn't there, create it and setup the database correctly.
  sql.prepare(`
    CREATE TABLE votes (
      vote_id INTEGER PRIMARY KEY,
      type TEXT,
      user TEXT,
      choice TEXT,
      time INTEGER,
      FOREIGN KEY(user) REFERENCES player_data(user)
    );
  `).run();

  // Add index on type + user
  sql.prepare(`
    CREATE INDEX idx_votes_type_user ON votes (type, user);
  `).run();
}

const owners_table = sql.prepare(`
  SELECT count(*) FROM sqlite_master
  WHERE type='table' AND name = 'tile_owners';
`).get();

if (!owners_table['count(*)']) {
  // If the table isn't there, create it and setup the database correctly.
  sql.prepare(`
    CREATE TABLE tile_owners (
      tile TEXT PRIMARY KEY,
      house TEXT
    );
  `).run();

  // Add default tile owners for now
  sql.prepare(`
    INSERT INTO tile_owners VALUES
    ("c2", "572288999843168266"),
    ("b3", "572288816652484608"),
    ("g3", "572288151419355136"),
    ("d4", "572290551357898781"),
    ("f5", "572289104742580254"),
    ("g5", "572288999843168266"),
    ("b6", "572288492101435408"),
    ("d6", "572288492101435408"),
    ("e6", "572290551357898781"),
    ("d7", "572289104742580254"),
    ("g9", "572288816652484608"),
    ("b10", "572291484288548929"),
    ("c10", "572288151419355136"),
    ("d10", "572291484288548929");
  `).run();
}

const siege_table = sql.prepare(`
  SELECT count(*) FROM sqlite_master
  WHERE type='table' AND name = 'sieges';
`).get();

if (!siege_table['count(*)']) {
  // If the table isn't there, create it and setup the database correctly.
  sql.prepare(`
    CREATE TABLE sieges (
      siege_id INTEGER PRIMARY KEY,
      tile TEXT,
      attacker TEXT,
      time INTEGER,
      message TEXT,
      FOREIGN KEY(tile) REFERENCES tile_owners(tile)
    );
  `).run();

  // Add index on siege column
  sql.prepare(`
    CREATE UNIQUE INDEX idx_siege_tile ON sieges (tile);
  `).run();
}

const pledge_table = sql.prepare(`
  SELECT count(*) FROM sqlite_master
  WHERE type='table' AND name = 'pledges';
`).get();

if (!pledge_table['count(*)']) {
  // If the table isn't there, create it and setup the database correctly.
  sql.prepare(`
    CREATE TABLE pledges (
      pledge_id INTEGER PRIMARY KEY,
      siege INTEGER,
      user TEXT,
      men INTEGER,
      choice TEXT,
      FOREIGN KEY(siege) REFERENCES sieges(siege_id),
      FOREIGN KEY(user) REFERENCES player_data(user)
    );
  `).run();

  // Add index on siege column
  sql.prepare(`
    CREATE INDEX idx_pledges_siege ON pledges (siege);
  `).run();
}

const last_payout_table = sql.prepare(`
  SELECT count(*) FROM sqlite_master
  WHERE type='table' AND name = 'last_payout';
`).get();

if (!last_payout_table['count(*)']) {
  // If the table isn't there, create it and setup the database correctly.
  sql.prepare(`
    CREATE TABLE last_payout (
      payout_type TEXT,
      time INTEGER
    );
  `).run();

  sql.prepare(`
    INSERT INTO last_payout (
      payout_type, time)
    VALUES
      ("all", 0);
  `).run();
}

sql.pragma("synchronous = 1");
sql.pragma("journal_mode = wal");

module.exports = {
  "get_player": sql.prepare("SELECT * FROM player_data WHERE user = ?"),
  "set_player": sql.prepare(`
    INSERT OR REPLACE INTO player_data (
      user, house, men, ships, money, pray_last_time,
      gift_last_time, loan_last_time, pirate_last_time,
      pray_last_time, raid_last_time, smuggle_last_time,
      spy_last_time, subvert_last_time, thief_last_time,
      train_last_time, work_last_time)
    VALUES (
      @user, @house, @men, @ships, @money, @pray_last_time,
      @gift_last_time, @loan_last_time, @pirate_last_time,
      @pray_last_time, @raid_last_time, @smuggle_last_time,
      @spy_last_time, @subvert_last_time, @thief_last_time,
      @train_last_time, @work_last_time);
  `),
  "get_all_players": sql.prepare("SELECT * FROM player_data"),
  "get_loan": sql.prepare("SELECT * FROM loans WHERE user = ?"),
  "add_loan": sql.prepare(`
    INSERT INTO loans (
      user, amount_due, time_due)
    VALUES (
      @user, @amount_due, @time_due);
  `),
  "update_loan": sql.prepare(`
    UPDATE loans SET amount_due = @amount_due WHERE loan_id = @loan_id;
  `),
  "remove_loan": sql.prepare(`
    DELETE FROM loans WHERE loan_id = @loan_id;
  `),
  "get_due_loans": sql.prepare(`
    SELECT * FROM loans WHERE time_due <= ?
  `),
  "get_player_vote_by_type": sql.prepare(`
    SELECT * FROM votes WHERE user = ? and type = ?
  `),
  "add_vote": sql.prepare(`
    INSERT INTO votes (
      type, user, choice, time)
    VALUES (
      @type, @user, @choice, @time);
  `),
  "get_expired_votes_by_type": sql.prepare(`
    SELECT * FROM votes WHERE type = ? and time <= ?
  `),
  "get_expired_truce_vote": sql.prepare(`
    SELECT * FROM votes WHERE type like "truce%" and time <= ?
  `),
  "get_all_house_votes_by_type": sql.prepare(`
    SELECT * FROM votes WHERE type = ? and user in (
      SELECT user FROM player_data WHERE house = ?)
  `),
  "remove_vote": sql.prepare(`
    DELETE FROM votes WHERE vote_id = @vote_id
  `),
  "add_war": sql.prepare(`
    INSERT INTO wars (
      house_a, house_b)
    VALUES (
      @house_a, @house_b);
  `),
  "get_all_wars": sql.prepare(`
    SELECT * from wars
  `),
  "get_war_between_houses": sql.prepare(`
    SELECT * from wars WHERE (house_a = @house1 and house_b = @house2)
      or (house_a = @house2 and house_b = @house1)
  `),
  "remove_war": sql.prepare(`
    DELETE FROM wars WHERE war_id = @war_id
  `),
  "get_all_tiles": sql.prepare(`
    SELECT * from tile_owners
  `),
  "get_tile_owner": sql.prepare(`
    SELECT * from tile_owners where tile = ?
  `),
  "get_siege_on_tile": sql.prepare(`
    SELECT * from sieges where tile = ?
  `),
  "add_siege": sql.prepare(`
    INSERT INTO sieges (
      tile, attacker, time)
    VALUES (
      @tile, @attacker, @time);
  `),
  "get_all_siege_id_between_two_houses": sql.prepare(`
    SELECT siege_id FROM sieges, tile_owners
    WHERE
      tile_owners.tile = sieges.tile
      AND (
        (attacker = @house_a
         AND tile_owners.house = @house_b
        )
        OR
        (attacker = @house_b
         AND tile_owners.house = @house_a
        )
      )
  `),
  "get_expired_siege": sql.prepare(`
    SELECT * from sieges WHERE time <= ?
  `),
  "remove_siege": sql.prepare(`
    DELETE FROM sieges WHERE siege_id = @siege_id
  `),
  "add_pledge": sql.prepare(`
    INSERT INTO pledges (
      siege, user, men, choice)
    VALUES (
      @siege, @user, @men, @choice);
  `),
  "get_player_pledge_for_siege": sql.prepare(`
    SELECT * FROM pledges WHERE user = @user and siege = @siege
  `),
  "get_all_pledges_for_siege": sql.prepare(`
    SELECT * FROM pledges WHERE siege = @siege_id
  `),
  "remove_pledge": sql.prepare(`
    DELETE FROM pledges WHERE pledge_id = @pledge_id
  `),
  "update_tile_owner": sql.prepare(`
    UPDATE tile_owners SET house = ? WHERE tile = ?
  `),
  "get_last_payout": sql.prepare(`
    SELECT * FROM last_payout WHERE payout_type = "all"
  `),
  "update_last_payout": sql.prepare(`
    UPDATE last_payout SET time = ? WHERE payout_type = "all"
  `),
  "default_player": {
    "user": '',
    "house": '',
    "men": 20,
    "ships": 2,
    "money": 2000,
    "gift_last_time": 0,
    "loan_last_time": 0,
    "pirate_last_time": 0,
    "pray_last_time": 0,
    "raid_last_time": 0,
    "smuggle_last_time": 0,
    "spy_last_time": 0,
    "subvert_last_time": 0,
    "thief_last_time": 0,
    "train_last_time": 0,
    "work_last_time": 0
  }
};
