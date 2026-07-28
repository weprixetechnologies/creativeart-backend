const db = require('../config/db');

class ProductModel {
  static async ensureStockQtyColumn() {
    try {
      const cols = await db.query('SHOW COLUMNS FROM products LIKE "stock_qty"');
      if (cols.length === 0) {
        await db.query('ALTER TABLE products ADD COLUMN stock_qty INT UNSIGNED NOT NULL DEFAULT 100 AFTER base_price');
      }
    } catch (e) {
      console.error('Failed to auto-migrate products stock_qty column:', e.message);
    }
  }

  static async create({
    categoryId,
    itemType,
    productType,
    name,
    slug,
    description,
    basePrice,
    stockQty,
    advanceAmount,
    finalAmount,
    totalAmount,
    materialInstructions,
    status
  }) {
    const runQuery = async () => {
      const sql = `
        INSERT INTO products (
          category_id, item_type, product_type, name, slug, description, base_price, stock_qty,
          advance_amount, final_amount, total_amount, material_instructions, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      return db.query(sql, [
        categoryId,
        itemType,
        itemType === 'PRODUCT' ? productType : null,
        name,
        slug,
        description,
        basePrice,
        stockQty !== undefined && stockQty !== null ? parseInt(stockQty, 10) : 100,
        itemType === 'PROJECT' ? advanceAmount : null,
        itemType === 'PROJECT' ? finalAmount : null,
        itemType === 'PROJECT' ? totalAmount : null,
        itemType === 'PROJECT' ? materialInstructions : null,
        status || 'DRAFT'
      ]);
    };

    try {
      const res = await runQuery();
      return this.findById(res.insertId);
    } catch (err) {
      if (err.code === 'ER_BAD_FIELD_ERROR' || err.errno === 1054) {
        await this.ensureStockQtyColumn();
        const res = await runQuery();
        return this.findById(res.insertId);
      }
      throw err;
    }
  }

  static async findById(id) {
    const rows = await db.query('SELECT * FROM products WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async findBySlug(slug) {
    const rows = await db.query('SELECT * FROM products WHERE slug = ?', [slug]);
    return rows[0] || null;
  }

  static async findAll({ itemType, status, categoryId, search, page = 1, limit = 10 } = {}) {
    const conditions = [];
    const params = [];

    if (itemType) {
      conditions.push('item_type = ?');
      params.push(itemType);
    }
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    if (categoryId) {
      conditions.push('category_id = ?');
      params.push(categoryId);
    }
    if (search) {
      const terms = search.split(/\s+/).filter(t => t.trim().length > 0);
      if (terms.length > 0) {
        // Try strict multi-term match (AND) first
        const andConditions = [];
        const strictParams = [];
        terms.forEach(term => {
          andConditions.push('(name LIKE ? OR description LIKE ?)');
          strictParams.push(`%${term}%`, `%${term}%`);
        });

        // Run a quick count query to see if strict match returns anything
        const tempConditions = [...conditions, `(${andConditions.join(' AND ')})`].join(' AND ');
        const tempWhere = tempConditions ? `WHERE ${tempConditions}` : '';
        const checkCount = await db.query(`SELECT COUNT(*) as count FROM products ${tempWhere}`, [...params, ...strictParams]);
        const strictCount = parseInt(checkCount[0]?.count || 0, 10);

        if (strictCount > 0) {
          conditions.push(`(${andConditions.join(' AND ')})`);
          params.push(...strictParams);
        } else {
          // Fall back to fuzzy match (OR)
          const orConditions = [];
          terms.forEach(term => {
            orConditions.push('(name LIKE ? OR description LIKE ?)');
            params.push(`%${term}%`, `%${term}%`);
          });
          conditions.push(`(${orConditions.join(' OR ')})`);
        }
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Count total query
    const countSql = `SELECT COUNT(*) as count FROM products ${whereClause}`;
    const countRows = await db.query(countSql, params);
    const total = parseInt(countRows[0]?.count || 0, 10);

    // Fetch paginated rows
    const offset = (page - 1) * limit;
    const selectSql = `
      SELECT * FROM products 
      ${whereClause} 
      ORDER BY id DESC 
      LIMIT ? OFFSET ?
    `;
    // Express / MariaDB driver requires numeric limit/offset values, pass directly or cast
    const rows = await db.query(selectSql, [...params, parseInt(limit, 10), parseInt(offset, 10)]);

    return {
      data: rows,
      meta: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
      }
    };
  }

  static async update(id, updates) {
    const fields = [];
    const values = [];

    // Fields that can be updated
    const allowedFields = [
      'category_id',
      'name',
      'slug',
      'description',
      'base_price',
      'stock_qty',
      'advance_amount',
      'final_amount',
      'total_amount',
      'material_instructions',
      'status'
    ];

    allowedFields.forEach((field) => {
      // Map camelCase to snake_case if necessary, or just keep matching updates keys
      const jsKey = field.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      if (updates[jsKey] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(updates[jsKey]);
      } else if (updates[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(updates[field]);
      }
    });

    // Handle product_type and item_type safety check, but generally they shouldn't change
    if (updates.itemType !== undefined) {
      fields.push('item_type = ?');
      values.push(updates.itemType);
    }
    if (updates.productType !== undefined) {
      fields.push('product_type = ?');
      values.push(updates.productType);
    }

    if (fields.length === 0) return null;

    values.push(id);
    const sql = `UPDATE products SET ${fields.join(', ')} WHERE id = ?`;
    
    try {
      await db.query(sql, values);
    } catch (err) {
      if (err.code === 'ER_BAD_FIELD_ERROR' || err.errno === 1054) {
        await this.ensureStockQtyColumn();
        await db.query(sql, values);
      } else {
        throw err;
      }
    }
    return this.findById(id);
  }

  static async delete(id) {
    const sql = 'DELETE FROM products WHERE id = ?';
    await db.query(sql, [id]);
  }
}

module.exports = ProductModel;
