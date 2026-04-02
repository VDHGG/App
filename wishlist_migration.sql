-- Run once on existing databases that predate `customer_wishlist`.

CREATE TABLE IF NOT EXISTS `customer_wishlist` (
  `customer_id` varchar(10) NOT NULL,
  `shoe_id` varchar(10) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`customer_id`, `shoe_id`),
  KEY `idx_customer_wishlist_shoe_id` (`shoe_id`),
  CONSTRAINT `fk_wishlist_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wishlist_shoe` FOREIGN KEY (`shoe_id`) REFERENCES `shoes` (`shoe_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
