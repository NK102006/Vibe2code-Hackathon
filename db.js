const path = require('path');

const isProduction = !!process.env.POSTGRES_URL;
let dbInstance;

if (isProduction) {
  const { Pool } = require('pg');
  dbInstance = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
  });
  console.log('Using Vercel Postgres database.');
} else {
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = path.join(__dirname, 'nudgeai.db');
  const sqliteDb = new sqlite3.Database(dbPath);
  
  // Wrap SQLite calls to match PG Pool API: dbInstance.query(text, params) -> Promise<{ rows }>
  dbInstance = {
    query: (text, params = []) => {
      return new Promise((resolve, reject) => {
        // Convert PG placeholders ($1, $2, etc.) to SQLite (?)
        let sqliteText = text.replace(/\$(\d+)/g, '?');
        
        // Remove RETURNING clause for SQLite if present (older versions don't support it well)
        // If RETURNING is present, we strip it out for SQLite execution
        let hasReturning = false;
        if (sqliteText.toUpperCase().includes('RETURNING')) {
          hasReturning = true;
          sqliteText = sqliteText.replace(/RETURNING\s+\w+/gi, '');
        }

        // SQLite uses INTEGER for BOOLEAN (true/false)
        const mappedParams = params.map(p => {
          if (typeof p === 'boolean') return p ? 1 : 0;
          return p;
        });

        const upperText = sqliteText.trim().toUpperCase();
        if (upperText.startsWith('SELECT')) {
          sqliteDb.all(sqliteText, mappedParams, (err, rows) => {
            if (err) reject(err);
            else resolve({ rows });
          });
        } else {
          sqliteDb.run(sqliteText, mappedParams, function(err) {
            if (err) reject(err);
            else {
              // If we stripped RETURNING id, construct fake rows with the insert ID to match PG's RETURNING
              const resultRows = hasReturning ? [{ id: this.lastID }] : [];
              resolve({ 
                rows: resultRows, 
                insertId: this.lastID, 
                changes: this.changes 
              });
            }
          });
        }
      });
    }
  };
  console.log('Using local SQLite database.');
}

// Helper to initialize table schemas
async function initializeSchema() {
  const queries = [
    // Users Table
    `CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE,
      password VARCHAR(255),
      full_name VARCHAR(255),
      role VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    // Tasks Table
    `CREATE TABLE IF NOT EXISTS tasks (
      id VARCHAR(255) PRIMARY KEY,
      user_id INTEGER,
      title VARCHAR(255),
      deadline_hours INTEGER,
      duration REAL,
      dependency VARCHAR(255),
      goal_category VARCHAR(255),
      auto_execute INTEGER,
      completed INTEGER,
      score INTEGER,
      progress INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    // Calendar Blocks
    `CREATE TABLE IF NOT EXISTS calendar_blocks (
      id VARCHAR(255) PRIMARY KEY,
      user_id INTEGER,
      title VARCHAR(255),
      start_hour REAL,
      duration REAL,
      day VARCHAR(255),
      type VARCHAR(255),
      completed INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    // Goals Table
    `CREATE TABLE IF NOT EXISTS goals (
      id VARCHAR(255) PRIMARY KEY,
      user_id INTEGER,
      title VARCHAR(255),
      type VARCHAR(255),
      target VARCHAR(255),
      streak INTEGER,
      subtasks TEXT, -- JSON string
      progress INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    // User Activities Table
    `CREATE TABLE IF NOT EXISTS user_activities (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      activity_type VARCHAR(255),
      description TEXT,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  // Adjust SQL types for SQLite if not production
  for (let q of queries) {
    let finalQuery = q;
    if (!isProduction) {
      // Replace SERIAL with INTEGER PRIMARY KEY AUTOINCREMENT
      finalQuery = finalQuery.replace(/SERIAL PRIMARY KEY/g, 'INTEGER PRIMARY KEY AUTOINCREMENT');
      // Replace TIMESTAMP with DATETIME
      finalQuery = finalQuery.replace(/TIMESTAMP/g, 'DATETIME');
    }
    await dbInstance.query(finalQuery);
  }
}

module.exports = {
  query: (text, params) => dbInstance.query(text, params),
  initializeSchema,
  isProduction
};
