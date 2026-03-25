
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `brands` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_brands_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `categories` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_categories_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `colors` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_colors_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ranks` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `max_shoes` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ranks_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Core tables

CREATE TABLE IF NOT EXISTS `customers` (
  `customer_id` varchar(10) NOT NULL,
  `full_name` varchar(100) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(15) DEFAULT NULL,
  `rank_id` int(11) NOT NULL DEFAULT 1,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`customer_id`),
  UNIQUE KEY `uq_customers_email` (`email`),
  KEY `idx_customers_rank_id` (`rank_id`),
  CONSTRAINT `fk_customers_rank` FOREIGN KEY (`rank_id`) REFERENCES `ranks` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `shoes` (
  `shoe_id` varchar(10) NOT NULL,
  `name` varchar(100) NOT NULL,
  `brand_id` int(11) NOT NULL,
  `category_id` int(11) NOT NULL,
  `description` varchar(500) DEFAULT NULL,
  `image_public_id` varchar(512) DEFAULT NULL,
  `price_per_day` decimal(10,2) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`shoe_id`),
  KEY `idx_shoes_brand_id` (`brand_id`),
  KEY `idx_shoes_category_id` (`category_id`),
  CONSTRAINT `fk_shoes_brand` FOREIGN KEY (`brand_id`) REFERENCES `brands` (`id`),
  CONSTRAINT `fk_shoes_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `shoe_variants` (
  `variant_id` varchar(10) NOT NULL,
  `shoe_id` varchar(10) NOT NULL,
  `size` int(11) NOT NULL,
  `color_id` int(11) NOT NULL,
  `on_hand_quantity` int(11) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`variant_id`),
  UNIQUE KEY `uq_shoe_variants_identity` (`shoe_id`,`size`,`color_id`),
  KEY `idx_shoe_variants_shoe_id` (`shoe_id`),
  KEY `idx_shoe_variants_color_id` (`color_id`),
  CONSTRAINT `fk_shoe_variants_shoe` FOREIGN KEY (`shoe_id`) REFERENCES `shoes` (`shoe_id`),
  CONSTRAINT `fk_shoe_variants_color` FOREIGN KEY (`color_id`) REFERENCES `colors` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `rentals` (
  `rental_id` varchar(10) NOT NULL,
  `customer_id` varchar(10) NOT NULL,
  `start_date` date NOT NULL,
  `expected_return_date` date NOT NULL,
  `actual_return_date` date DEFAULT NULL,
  `status` enum('RESERVED','ACTIVE','RETURNED','CANCELLED') NOT NULL DEFAULT 'RESERVED',
  `late_fee` decimal(10,2) NOT NULL DEFAULT 0.00,
  `note` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `activated_at` datetime DEFAULT NULL,
  `cancelled_at` datetime DEFAULT NULL,
  PRIMARY KEY (`rental_id`),
  KEY `idx_rentals_customer_id` (`customer_id`),
  KEY `idx_rentals_status` (`status`),
  KEY `idx_rentals_expected_return_date` (`expected_return_date`),
  CONSTRAINT `fk_rentals_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `rental_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `rental_id` varchar(10) NOT NULL,
  `variant_id` varchar(10) NOT NULL,
  `shoe_id` varchar(10) NOT NULL,
  `shoe_name` varchar(100) NOT NULL,
  `size` int(11) NOT NULL,
  `color` varchar(100) NOT NULL,
  `quantity` int(11) NOT NULL,
  `price_per_day` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_rental_items_rental_variant` (`rental_id`,`variant_id`),
  KEY `idx_rental_items_variant_id` (`variant_id`),
  CONSTRAINT `fk_rental_items_rental` FOREIGN KEY (`rental_id`) REFERENCES `rentals` (`rental_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rental_items_variant` FOREIGN KEY (`variant_id`) REFERENCES `shoe_variants` (`variant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `roles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_roles_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `system_users` (
  `user_id` varchar(10) NOT NULL,
  `full_name` varchar(100) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(15) DEFAULT NULL,
  `role_id` int(11) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `uq_system_users_email` (`email`),
  KEY `idx_system_users_role_id` (`role_id`),
  CONSTRAINT `fk_system_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Views

DROP VIEW IF EXISTS `customer_active_rental_load`;
CREATE VIEW `customer_active_rental_load` AS
SELECT c.customer_id, c.full_name,
       COALESCE(SUM(ri.quantity), 0) AS current_rental_items
FROM customers c
LEFT JOIN rentals r ON r.customer_id = c.customer_id AND r.status IN ('RESERVED', 'ACTIVE')
LEFT JOIN rental_items ri ON ri.rental_id = r.rental_id
GROUP BY c.customer_id, c.full_name;

DROP VIEW IF EXISTS `overdue_rentals`;
CREATE VIEW `overdue_rentals` AS
SELECT r.rental_id, r.customer_id, c.full_name AS customer_name,
       r.start_date, r.expected_return_date,
       TO_DAYS(CURDATE()) - TO_DAYS(r.expected_return_date) AS overdue_days
FROM rentals r
JOIN customers c ON c.customer_id = r.customer_id
WHERE r.status IN ('RESERVED', 'ACTIVE') AND r.expected_return_date < CURDATE();


INSERT IGNORE INTO `ranks` (`id`, `name`, `max_shoes`) VALUES
(1, 'BRONZE', 5), (2, 'SILVER', 10), (3, 'GOLD', 15), (4, 'DIAMOND', NULL);

INSERT IGNORE INTO `brands` (`id`, `name`) VALUES
(1, 'Nike'), (2, 'Adidas'), (3, 'Puma');

INSERT IGNORE INTO `categories` (`id`, `name`) VALUES
(1, 'Running'), (2, 'Football'), (3, 'Basketball'), (4, 'Sport');

INSERT IGNORE INTO `colors` (`id`, `name`) VALUES
(1, 'Red'), (2, 'Green'), (3, 'Blue'), (4, 'Yellow'), (5, 'Orange'),
(6, 'Purple'), (7, 'Pink'), (8, 'Brown'), (9, 'White'), (10, 'Black'),
(11, 'Emerald'), (12, 'Quartz');

INSERT IGNORE INTO `roles` (`id`, `name`) VALUES (1, 'user'), (2, 'admin');