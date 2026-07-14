const mariadb = require('mariadb');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

// Patch BigInt to serialize correctly to JSON
BigInt.prototype.toJSON = function() {
  const num = Number(this);
  return Number.isSafeInteger(num) ? num : this.toString();
};

const pool = mariadb.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'rseditz@222',
  database: process.env.DB_NAME || 'creativeart',
  timezone: process.env.DB_TIMEZONE || '+05:30',
  connectionLimit: 10,
  allowPublicKeyRetrieval: true
});

module.exports = {
  pool,
  // Helper to execute query directly
  query: async (sql, params) => {
    let conn;
    try {
      conn = await pool.getConnection();
      const res = await conn.query(sql, params);
      return res;
    } finally {
      if (conn) conn.end();
    }
  },
  // Helper to execute in transaction
  transaction: async (callback) => {
    let conn;
    try {
      conn = await pool.getConnection();
      await conn.beginTransaction();
      const result = await callback(conn);
      await conn.commit();
      return result;
    } catch (err) {
      if (conn) await conn.rollback();
      throw err;
    } finally {
      if (conn) conn.end();
    }
  }
};
