-- Up
CREATE TABLE IF NOT EXISTS `banners` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `image_url` VARCHAR(500) NOT NULL,
  `link_url` VARCHAR(500) NULL,
  `is_active` BOOLEAN DEFAULT TRUE,
  `sort_order` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `categories`
ADD COLUMN `photo_url` VARCHAR(500) NULL AFTER `slug`;

ALTER TABLE `shipments`
ADD COLUMN `expected_delivery_date` TIMESTAMP NULL AFTER `delivered_at`;

-- Default COD setting
INSERT IGNORE INTO `settings` (`key`, `value`) VALUES ('is_cod_enabled', 'true');
