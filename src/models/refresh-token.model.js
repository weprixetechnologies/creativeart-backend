const db = require('../config/db');

class RefreshTokenModel {
  static async create({ userId, tokenHash, expiresAt, replacedByTokenId }) {
    const sql = `
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at, replaced_by_token_id)
      VALUES (?, ?, ?, ?)
    `;
    const res = await db.query(sql, [userId, tokenHash, expiresAt, replacedByTokenId || null]);
    return {
      id: res.insertId,
      userId,
      tokenHash,
      expiresAt,
      replacedByTokenId
    };
  }

  static async findByTokenHash(tokenHash) {
    const rows = await db.query('SELECT * FROM refresh_tokens WHERE token_hash = ?', [tokenHash]);
    return rows[0] || null;
  }

  static async revoke(id) {
    const sql = 'UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?';
    await db.query(sql, [id]);
  }

  static async revokeAllForUser(userId) {
    const sql = 'UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL';
    await db.query(sql, [userId]);
  }

  static async update(id, updates) {
    const fields = [];
    const values = [];

    if (updates.revoked_at !== undefined) {
      fields.push('revoked_at = ?');
      values.push(updates.revoked_at);
    }
    if (updates.replaced_by_token_id !== undefined) {
      fields.push('replaced_by_token_id = ?');
      values.push(updates.replaced_by_token_id);
    }

    if (fields.length === 0) return null;

    values.push(id);
    const sql = `UPDATE refresh_tokens SET ${fields.join(', ')} WHERE id = ?`;
    await db.query(sql, values);
  }
}

module.exports = RefreshTokenModel;
