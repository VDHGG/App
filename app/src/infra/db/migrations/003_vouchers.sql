-- Migration 003: Vouchers table for promotional discount codes
-- ROLLBACK: DROP TABLE IF EXISTS `vouchers`;

CREATE TABLE IF NOT EXISTS `vouchers` (
  `code` varchar(32) NOT NULL,
  `discount_percent` int(11) NOT NULL,
  `description` varchar(255) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `max_uses` int(11) DEFAULT NULL,
  `used_count` int(11) NOT NULL DEFAULT 0,
  `expires_at` date DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`code`),
  CONSTRAINT `chk_voucher_discount` CHECK (`discount_percent` >= 1 AND `discount_percent` <= 50)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `vouchers` (`code`, `discount_percent`, `description`, `is_active`, `max_uses`, `used_count`, `expires_at`) VALUES
('WELCOME10', 10, 'Giảm 10% cho đơn thuê', 1, NULL, 0, NULL),
('GIAM10', 10, 'Giảm 10% cho đơn thuê', 1, NULL, 0, NULL),
('SHOE20', 20, 'Ưu đãi VIP giảm 20%', 1, NULL, 0, NULL),
('VIP20', 20, 'Ưu đãi VIP giảm 20%', 1, NULL, 0, NULL),
('GIAM5', 5, 'Giảm 5% phí thuê giày', 1, NULL, 0, NULL),
('FREESHIP5', 5, 'Giảm 5% phí thuê giày', 1, NULL, 0, NULL);

-- Verification query:
-- SELECT code, discount_percent, is_active, max_uses, used_count, expires_at FROM vouchers ORDER BY code;
