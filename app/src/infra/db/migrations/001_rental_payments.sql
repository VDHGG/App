SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `rental_payments` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `rental_id` varchar(10) NOT NULL,
  `customer_id` varchar(10) NOT NULL,
  `provider` varchar(20) NOT NULL DEFAULT 'momo',
  `gateway_order_id` varchar(64) NOT NULL,
  `gateway_request_id` varchar(64) DEFAULT NULL,
  `amount_vnd` int(10) UNSIGNED NOT NULL,
  `currency` char(3) NOT NULL DEFAULT 'VND',
  `status` enum('PENDING','PAID','FAILED','EXPIRED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  `expires_at` datetime NOT NULL,
  `paid_at` datetime DEFAULT NULL,
  `gateway_trans_id` varchar(64) DEFAULT NULL,
  `gateway_result_code` varchar(32) DEFAULT NULL,
  `gateway_message` varchar(512) DEFAULT NULL,
  `raw_ipn_json` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_rental_payments_gateway_order` (`gateway_order_id`),
  KEY `idx_rental_payments_rental` (`rental_id`),
  KEY `idx_rental_payments_customer_created` (`customer_id`,`created_at`),
  KEY `idx_rental_payments_pending_expires` (`status`,`expires_at`),
  CONSTRAINT `fk_rental_payments_rental` FOREIGN KEY (`rental_id`) REFERENCES `rentals` (`rental_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rental_payments_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
