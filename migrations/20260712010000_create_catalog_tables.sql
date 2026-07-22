CREATE TABLE categories (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  parent_id BIGINT UNSIGNED NULL,
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(150) UNIQUE NOT NULL,
  photo_url VARCHAR(500) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status ENUM('ACTIVE','ARCHIVED') DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_categories_parent_id FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE products (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id BIGINT UNSIGNED NOT NULL,
  item_type ENUM('PRODUCT','PROJECT') NOT NULL,
  product_type ENUM('SIMPLE','VARIABLE','CUSTOMISABLE') NULL,
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(220) UNIQUE NOT NULL,
  description TEXT NOT NULL,
  base_price DECIMAL(10,2) NOT NULL,
  advance_amount DECIMAL(10,2) NULL,
  final_amount DECIMAL(10,2) NULL,
  total_amount DECIMAL(10,2) NULL,
  material_instructions TEXT NULL,
  status ENUM('DRAFT','ACTIVE','ARCHIVED') DEFAULT 'DRAFT',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_products_category_id FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
  CONSTRAINT chk_product_types CHECK (
    (item_type = 'PRODUCT' AND product_type IS NOT NULL AND advance_amount IS NULL AND final_amount IS NULL AND total_amount IS NULL)
    OR
    (item_type = 'PROJECT' AND product_type IS NULL AND advance_amount IS NOT NULL AND final_amount IS NOT NULL AND total_amount IS NOT NULL)
  ),
  CONSTRAINT chk_total_reconcile CHECK (item_type = 'PRODUCT' OR total_amount = advance_amount + final_amount),
  INDEX idx_products_catalog (item_type, product_type, status),
  INDEX idx_products_category_id (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE product_images (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  url VARCHAR(500) NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_product_images_product_id FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_product_images_product_id (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE product_variants (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  sku VARCHAR(100) UNIQUE NOT NULL,
  attributes JSON NOT NULL,
  price_override DECIMAL(10,2) NULL,
  stock_qty INT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('ACTIVE','ARCHIVED') DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_product_variants_product_id FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_product_variants_product_id (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE product_custom_fields (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  field_key VARCHAR(100) NOT NULL,
  label VARCHAR(200) NOT NULL,
  type ENUM('TEXT','NUMBER','DROPDOWN','DATE','FILE','TEXTAREA') NOT NULL,
  required BOOLEAN DEFAULT FALSE,
  help_text VARCHAR(500) NULL,
  options JSON NULL,
  max_file_size_kb INT NULL,
  allowed_mime_types JSON NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_product_custom_fields_product_id FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT uq_product_custom_fields_key UNIQUE (product_id, field_key),
  INDEX idx_product_custom_fields_product_id (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
