-- Run once on existing databases (before app auth). Fresh installs: use schema.sql / ReCreateDB.sql instead.

ALTER TABLE `system_users`
  ADD COLUMN `password_hash` varchar(255) NULL AFTER `phone`,
  ADD COLUMN `customer_id` varchar(10) NULL AFTER `password_hash`;

ALTER TABLE `system_users`
  ADD UNIQUE KEY `uq_system_users_customer_id` (`customer_id`),
  ADD CONSTRAINT `fk_system_users_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`);

-- Then set password_hash for admin row, e.g. bcrypt for your password (npm run hash-admin-password).
