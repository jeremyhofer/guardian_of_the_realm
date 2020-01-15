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
      arson_last_time INTEGER,
      pirate_last_time INTEGER,
      pray_last_time INTEGER,
      raid_last_time INTEGER,
      smuggle_last_time INTEGER,
      scandal_last_time INTEGER,
      spy_last_time INTEGER,
      subvert_last_time INTEGER,
      thief_last_time INTEGER,
      train_last_time INTEGER,
      trade_last_time INTEGER,
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

const reset_wars = () => {
  sql.prepare(`
    DELETE FROM wars;
  `).run();

  sql.prepare(`
    INSERT INTO wars (house_a, house_b) VALUES
      ("572290551357898781","572288816652484608"),
      ("572290551357898781","572291484288548929"),
      ("572290551357898781","572288999843168266"),
      ("572290551357898781","572288151419355136"),
      ("572290551357898781","572289104742580254"),
      ("572290551357898781","572288492101435408"),
      ("572288816652484608","572291484288548929"),
      ("572288816652484608","572288999843168266"),
      ("572288816652484608","572288151419355136"),
      ("572288816652484608","572289104742580254"),
      ("572288816652484608","572288492101435408"),
      ("572291484288548929","572288999843168266"),
      ("572291484288548929","572288151419355136"),
      ("572291484288548929","572289104742580254"),
      ("572291484288548929","572288492101435408"),
      ("572288999843168266","572288151419355136"),
      ("572288999843168266","572289104742580254"),
      ("572288999843168266","572288492101435408"),
      ("572288151419355136","572289104742580254"),
      ("572288151419355136","572288492101435408"),
      ("572289104742580254","572288492101435408"),
      ("572290551357898781","625905668263510017"),
      ("572288816652484608","625905668263510017"),
      ("572288816652484608","625905668263510017"),
      ("572291484288548929","625905668263510017"),
      ("572288999843168266","625905668263510017"),
      ("572288151419355136","625905668263510017"),
      ("572289104742580254","625905668263510017")
    `).run();
};

if (!war_table['count(*)']) {
  // If the table isn't there, create it and setup the database correctly.
  sql.prepare(`
    CREATE TABLE wars (
      war_id INTEGER PRIMARY KEY,
      house_a TEXT,
      house_b TEXT
    );
  `).run();

  reset_wars();
}

const pact_table = sql.prepare(`
  SELECT count(*) FROM sqlite_master
  WHERE type='table' AND name = 'pacts';
`).get();

if (!pact_table['count(*)']) {
  // If the table isn't there, create it and setup the database correctly.
  sql.prepare(`
    CREATE TABLE pacts (
      pact_id INTEGER PRIMARY KEY,
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

const reset_owners = () => {
  sql.prepare(`
    DELETE FROM tile_owners
  `).run();

  // Add default tile owners for now
  sql.prepare(`
    INSERT INTO tile_owners VALUES
    ("c2", "572288999843168266", "castle"),
    ("b3", "572288816652484608", "castle"),
    ("g3", "572288151419355136", "castle"),
    ("d4", "572290551357898781", "castle"),
    ("f5", "572289104742580254", "castle"),
    ("g5", "572288999843168266", "castle"),
    ("b6", "572288492101435408", "castle"),
    ("d6", "572288492101435408", "castle"),
    ("e6", "572290551357898781", "castle"),
    ("d7", "572289104742580254", "castle"),
    ("g9", "572288816652484608", "castle"),
    ("b10", "572291484288548929", "castle"),
    ("c10", "572288151419355136", "castle"),
    ("d10", "572291484288548929", "castle"),
    ("h1", "625905668263510017", "port"),
    ("a12", "625905668263510017", "port"),
    ("h12", "625905668263510017", "port");
  `).run();
};

if (!owners_table['count(*)']) {
  // If the table isn't there, create it and setup the database correctly.
  sql.prepare(`
    CREATE TABLE tile_owners (
      tile TEXT PRIMARY KEY,
      house TEXT,
      type TEXT
    );
  `).run();

  reset_owners();
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
      units INTEGER,
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

const tracker_table = sql.prepare(`
  SELECT count(*) FROM sqlite_master
  WHERE type='table' AND name = 'tracker';
`).get();

if (!tracker_table['count(*)']) {
  // If the table isn't there, create it and setup the database correctly.
  sql.prepare(`
    CREATE TABLE tracker (
      tracker_id INTEGER PRIMARY KEY,
      name TEXT,
      value INTEGER,
      text TEXT
    );
  `).run();

  sql.prepare(`
    INSERT INTO tracker
      (name, value)
    VALUES
      ("payout_time", 0),
      ("game_active", 1);
  `).run();
}

sql.pragma("synchronous = 1");
sql.pragma("journal_mode = wal");

module.exports = {
  "get_player": sql.prepare("SELECT * FROM player_data WHERE user = ?"),
  "set_player": sql.prepare(`
    INSERT OR REPLACE INTO player_data (
      user, house, men, ships, money, pray_last_time, arson_last_time,
      pirate_last_time, pray_last_time, raid_last_time, smuggle_last_time,
      scandal_last_time, spy_last_time, subvert_last_time, thief_last_time,
      train_last_time, trade_last_time, work_last_time)
    VALUES (
      @user, @house, @men, @ships, @money, @pray_last_time, @arson_last_time,
      @pirate_last_time, @pray_last_time, @raid_last_time, @smuggle_last_time,
      @scandal_last_time, @spy_last_time, @subvert_last_time, @thief_last_time,
      @train_last_time, @trade_last_time, @work_last_time);
  `),
  "get_all_players": sql.prepare("SELECT * FROM player_data"),
  "count_all_players_in_house": sql.prepare(`
    SELECT house, count(*) as num_members from player_data
    WHERE house != "" group by house
  `),
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
  "get_expired_pact_vote": sql.prepare(`
    SELECT * FROM votes WHERE type like "pact%" and time <= ?
  `),
  "get_expired_war_vote": sql.prepare(`
    SELECT * FROM votes WHERE type like "war%" and time <= ?
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
  "add_pact": sql.prepare(`
    INSERT INTO pacts (
      house_a, house_b)
    VALUES (
      @house_a, @house_b);
  `),
  "get_all_pacts": sql.prepare(`
    SELECT * from pacts
  `),
  "get_pact_between_houses": sql.prepare(`
    SELECT * from pacts WHERE (house_a = @house1 and house_b = @house2)
      or (house_a = @house2 and house_b = @house1)
  `),
  "remove_pact": sql.prepare(`
    DELETE FROM pacts WHERE pact_id = @pact_id
  `),
  "get_all_tiles": sql.prepare(`
    SELECT * from tile_owners
  `),
  "get_tile_owner": sql.prepare(`
    SELECT * from tile_owners where tile = ?
  `),
  "get_ports": sql.prepare(`
    SELECT * from tile_owners where type = "port"
  `),
  "get_siege_by_id": sql.prepare(`
    SELECT * from sieges where siege_id = ?
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
  "update_siege_message": sql.prepare(`
    UPDATE sieges SET message = ? where siege_id = ?
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
  "get_all_sieges": sql.prepare(`
    SELECT * from sieges, tile_owners where sieges.tile = tile_owners.tile
  `),
  "remove_siege": sql.prepare(`
    DELETE FROM sieges WHERE siege_id = @siege_id
  `),
  "count_house_sieges": sql.prepare(`
    SELECT count(*) as num_sieges FROM sieges where sieges.attacker = ?
  `),
  "add_pledge": sql.prepare(`
    INSERT INTO pledges (
      siege, user, units, choice)
    VALUES (
      @siege, @user, @units, @choice);
  `),
  "get_player_pledge_for_siege": sql.prepare(`
    SELECT * FROM pledges WHERE user = @user and siege = @siege
  `),
  "get_all_pledges_for_siege": sql.prepare(`
    SELECT * FROM pledges WHERE siege = @siege_id
  `),
  "get_all_player_pledges": sql.prepare(`
    SELECT * FROM pledges, sieges, tile_owners
    WHERE sieges.siege_id = pledges.siege and sieges.tile = tile_owners.tile
    and pledges.user = @user
  `),
  "remove_pledge": sql.prepare(`
    DELETE FROM pledges WHERE pledge_id = @pledge_id
  `),
  "update_tile_owner": sql.prepare(`
    UPDATE tile_owners SET house = ? WHERE tile = ?
  `),
  "get_tracker_by_name": sql.prepare(`
    SELECT * FROM tracker WHERE name = ?
  `),
  "add_tracker": sql.prepare(`
    INSERT INTO tracker
      (name, value, text)
    VALUES
      (@name, @value, @text);
  `),
  "update_tracker_by_name": sql.prepare(`
    UPDATE tracker SET value = ? WHERE name = ?
  `),
  "remove_tracker": sql.prepare(`
    DELETE FROM tracker WHERE tracker_id = @tracker_id
  `),
  "default_player": {
    "user": '',
    "house": '',
    "men": 20,
    "ships": 2,
    "money": 2000,
    "arson_last_time": 0,
    "pirate_last_time": 0,
    "pray_last_time": 0,
    "raid_last_time": 0,
    "smuggle_last_time": 0,
    "scandal_last_time": 0,
    "spy_last_time": 0,
    "subvert_last_time": 0,
    "thief_last_time": 0,
    "train_last_time": 0,
    "trade_last_time": 0,
    "work_last_time": 0
  },
  "reset_everything": () => {
    sql.prepare(`
      DELETE FROM pledges
    `).run();
    sql.prepare(`
      DELETE FROM sieges
    `).run();
    sql.prepare(`
      DELETE FROM votes
    `).run();
    reset_wars();
    reset_owners();
    sql.prepare(`
      DELETE FROM loans
    `).run();
    sql.prepare(`
      DELETE FROM pacts
    `).run();
    sql.prepare(`
      UPDATE tracker SET value = 0 WHERE name = "payout_time"
    `).run();
    sql.prepare(`
      UPDATE tracker SET value = 1 WHERE name = "game_active"
    `).run();
  }
};
