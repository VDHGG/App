-- Migration: 002_shoe_reviews.sql
-- UP:
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `shoe_reviews` (
  `review_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `shoe_id` varchar(10) NOT NULL,
  `customer_id` varchar(10) NOT NULL,
  `customer_name` varchar(100) NOT NULL,
  `rating` tinyint(3) UNSIGNED NOT NULL,
  `comment` varchar(500) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`review_id`),
  UNIQUE KEY `uq_shoe_reviews_shoe_customer` (`shoe_id`, `customer_id`),
  KEY `idx_shoe_reviews_shoe_created` (`shoe_id`, `created_at`),
  CONSTRAINT `fk_shoe_reviews_shoe` FOREIGN KEY (`shoe_id`) REFERENCES `shoes` (`shoe_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_shoe_reviews_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ROLLBACK: DROP TABLE IF EXISTS shoe_reviews;
-- VERIFY: SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shoe_reviews';
