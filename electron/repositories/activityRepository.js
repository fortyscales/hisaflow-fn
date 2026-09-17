function createActivityRepository(db) {
  const insert = db.prepare(`INSERT INTO activity_log(id, action, details, actor_name, date, updated_at, version)
    VALUES (?, ?, ?, ?, ?, ?, 1)`);
  return { append({ id, action, details, actorName = null, date }) { insert.run(id, action, details, actorName, date, date); } };
}
module.exports = { createActivityRepository };
