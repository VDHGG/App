import { existsSync, readFileSync } from "node:fs";
import { config } from "dotenv";
import path, { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import express, { Router } from "express";
import { AsyncLocalStorage } from "node:async_hooks";
import crypto, { randomUUID } from "node:crypto";
import { v2 } from "cloudinary";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";
import { z, ZodError } from "zod";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { SchemaType, GoogleGenerativeAI, FunctionCallingMode } from "@google/generative-ai";
const infraDir = path.dirname(fileURLToPath(import.meta.url));
const envNextToPackageJson = path.resolve(infraDir, "../../.env");
const candidates = [
  envNextToPackageJson,
  path.join(process.cwd(), ".env"),
  path.join(process.cwd(), "app", ".env")
];
const envPath = candidates.find((p) => existsSync(p));
if (envPath) {
  config({ path: envPath, override: true });
  if (process.env.NODE_ENV !== "production") {
    console.log(`[env] Loaded variables from: ${envPath}`);
  }
} else {
  config();
}
class DomainError extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }
}
class ValidationError extends DomainError {
  constructor(message) {
    super("VALIDATION_ERROR", message);
  }
}
class BusinessRuleError extends DomainError {
  constructor(code, message) {
    super(code, message);
  }
}
function ensureVariantDeactivationAllowed(params) {
  const {
    variantId,
    totalStock,
    alreadyDeactivatedQuantity,
    requestedDeactivationQuantity
  } = params;
  const stillActive = totalStock - alreadyDeactivatedQuantity;
  if (stillActive < requestedDeactivationQuantity) {
    throw new BusinessRuleError(
      "INSUFFICIENT_STOCK",
      `Variant ${variantId} is not available for the requested period. Available: ${stillActive}, requested: ${requestedDeactivationQuantity}.`
    );
  }
}
function ensureValidEntityId(id, entityLabel) {
  if (!id || id.trim().length === 0 || id.trim().length > 10) {
    throw new ValidationError(`${entityLabel} id must be between 1 and 10 characters.`);
  }
}
function ensureValidRentalItemReferenceId(id, partLabel) {
  if (!id || id.trim().length === 0 || id.trim().length > 10) {
    throw new ValidationError(`Rental item ${partLabel} is invalid.`);
  }
}
function ensureValidDate(value, fieldName) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new ValidationError(`${fieldName} is invalid.`);
  }
}
function normalizeDateToCalendarTime(value) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}
function ensureValidNonNegativeNumber(value, message) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new ValidationError(message);
  }
}
function ensureValidPositiveNumber(value, message) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new ValidationError(message);
  }
}
function ensureValidPositiveInteger(value, message) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ValidationError(message);
  }
}
function ensureValidNonNegativeInteger(value, message) {
  if (!Number.isInteger(value) || value < 0) {
    throw new ValidationError(message);
  }
}
function ensureValidBoundedString(value, minTrimmedLength, maxLength, message) {
  const t = value?.trim() ?? "";
  if (t.length < minTrimmedLength || t.length > maxLength) {
    throw new ValidationError(message);
  }
}
function ensureValidRentalNote(note) {
  if (note !== null && note.trim().length > 255) {
    throw new ValidationError("Note must be 255 characters or fewer.");
  }
}
function ensureValidCustomerEmail(email) {
  if (!email || email.trim().length === 0 || email.trim().length > 255 || !/^[^\s@]+@[^\s@]+$/.test(email.trim())) {
    throw new ValidationError("Customer email is invalid.");
  }
}
function ensureValidCustomerPhone(phone) {
  const digits = phone.replace(/[\s().-]/g, "");
  if (digits.length < 8 || digits.length > 15 || !/^\d+$/.test(digits)) {
    throw new ValidationError("Phone must be 8–15 digits.");
  }
}
function ensureValidShoeDescription(description) {
  if (description && description.trim().length > 500) {
    throw new ValidationError("Shoe description must be 500 characters or fewer.");
  }
}
function ensureValidIntegerInRange(value, min, max, message) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new ValidationError(message);
  }
}
function ensureValidAvailableQuantityNotAboveTotal(availableQuantity, totalQuantity) {
  if (!Number.isInteger(availableQuantity) || availableQuantity < 0 || availableQuantity > totalQuantity) {
    throw new ValidationError("Available quantity must be between 0 and total quantity.");
  }
}
function ensureValidShoeImagePublicId(value) {
  if (value.length < 1 || value.length > 512) {
    throw new ValidationError("Shoe image public id is invalid.");
  }
  if (!/^[a-zA-Z0-9/_-]+$/.test(value)) {
    throw new ValidationError("Shoe image public id contains invalid characters.");
  }
}
function ensureValidVariantColor(color) {
  if (!color || color.trim().length === 0 || color.trim().length > 100) {
    throw new ValidationError("Variant color must be between 1 and 100 characters.");
  }
}
function ensureValidTotalQuantity(quantity) {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new ValidationError("Total quantity must be a non-negative integer.");
  }
}
class ShoeVariant {
  idValue;
  sizeValue;
  colorValue;
  totalQuantityValue;
  availableQuantityValue;
  constructor(props) {
    const availableQuantity = props.availableQuantity ?? props.totalQuantity;
    ensureValidEntityId(props.id, "Variant");
    ensureValidIntegerInRange(
      props.size,
      1,
      60,
      "Variant size must be an integer between 1 and 60."
    );
    ensureValidVariantColor(props.color);
    ensureValidTotalQuantity(props.totalQuantity);
    ensureValidAvailableQuantityNotAboveTotal(availableQuantity, props.totalQuantity);
    this.idValue = props.id.trim();
    this.sizeValue = props.size;
    this.colorValue = props.color.trim();
    this.totalQuantityValue = props.totalQuantity;
    this.availableQuantityValue = availableQuantity;
  }
  get id() {
    return this.idValue;
  }
  get size() {
    return this.sizeValue;
  }
  get color() {
    return this.colorValue;
  }
  get totalQuantity() {
    return this.totalQuantityValue;
  }
  get availableQuantity() {
    return this.availableQuantityValue;
  }
  changeOnHandQuantity(newTotal) {
    ensureValidTotalQuantity(newTotal);
    const reserved = this.totalQuantityValue - this.availableQuantityValue;
    if (newTotal < reserved) {
      throw new BusinessRuleError(
        "STOCK_REDUCTION_BLOCKED",
        `Cannot set on-hand to ${newTotal}: at least ${reserved} units are tied to active rentals.`
      );
    }
    this.totalQuantityValue = newTotal;
    this.availableQuantityValue = newTotal - reserved;
  }
  ensureDeactivateForRental(alreadyDeactivatedQuantity, requestedDeactivationQuantity) {
    ensureVariantDeactivationAllowed({
      variantId: this.idValue,
      totalStock: this.totalQuantityValue,
      alreadyDeactivatedQuantity,
      requestedDeactivationQuantity
    });
  }
}
class VariantDeactivationPolicy {
  ensureDeactivateForRental(variantId, totalStock, alreadyDeactivatedQuantity, requestedDeactivationQuantity) {
    ensureVariantDeactivationAllowed({
      variantId,
      totalStock,
      alreadyDeactivatedQuantity,
      requestedDeactivationQuantity
    });
  }
}
const CustomerRank = {
  BRONZE: "BRONZE",
  SILVER: "SILVER",
  GOLD: "GOLD",
  DIAMOND: "DIAMOND"
};
function getMaxRentalItemsByRank(rank) {
  switch (rank) {
    case CustomerRank.BRONZE:
      return 5;
    case CustomerRank.SILVER:
      return 10;
    case CustomerRank.GOLD:
      return 15;
    case CustomerRank.DIAMOND:
      return null;
  }
}
function getDiscountPercentByRank(rank) {
  switch (rank) {
    case CustomerRank.BRONZE:
      return 0;
    case CustomerRank.SILVER:
      return 5;
    case CustomerRank.GOLD:
      return 10;
    case CustomerRank.DIAMOND:
      return 15;
  }
}
function resolveRankByTotalSpentVnd(totalSpentVnd) {
  if (totalSpentVnd >= 1e7) return CustomerRank.DIAMOND;
  if (totalSpentVnd >= 5e6) return CustomerRank.GOLD;
  if (totalSpentVnd >= 2e6) return CustomerRank.SILVER;
  return CustomerRank.BRONZE;
}
const RANK_WEIGHT = {
  [CustomerRank.BRONZE]: 0,
  [CustomerRank.SILVER]: 1,
  [CustomerRank.GOLD]: 2,
  [CustomerRank.DIAMOND]: 3
};
function upgradeRankIfHigher(current, candidate) {
  return RANK_WEIGHT[candidate] > RANK_WEIGHT[current] ? candidate : current;
}
function ensureCurrentItemsWithinRankLimit(rank, currentItems) {
  const maxItems = getMaxRentalItemsByRank(rank);
  if (maxItems !== null && currentItems > maxItems) {
    throw new BusinessRuleError(
      "RENTAL_LIMIT_EXCEEDED",
      `Current rented items (${currentItems}) exceed rank limit (${maxItems}) for ${rank}.`
    );
  }
}
class Customer {
  idValue;
  fullNameValue;
  emailValue;
  phoneValue;
  rankValue;
  activeValue;
  currentRentedItemsValue;
  constructor(props) {
    const rank = props.rank ?? CustomerRank.BRONZE;
    const isActive = props.isActive ?? true;
    const currentRentedItems = props.currentRentedItems ?? 0;
    const rawPhone = props.phone?.trim() ?? "";
    const phoneNorm = rawPhone.length > 0 ? rawPhone.replace(/[\s().-]/g, "") : null;
    ensureValidEntityId(props.id, "Customer");
    ensureValidBoundedString(
      props.fullName,
      1,
      100,
      "Customer full name must be between 1 and 100 characters."
    );
    ensureValidCustomerEmail(props.email);
    if (phoneNorm !== null) {
      ensureValidCustomerPhone(phoneNorm);
    }
    ensureValidNonNegativeInteger(
      currentRentedItems,
      "Current rented items must be a non-negative integer."
    );
    ensureCurrentItemsWithinRankLimit(rank, currentRentedItems);
    this.idValue = props.id.trim();
    this.fullNameValue = props.fullName.trim();
    this.emailValue = props.email.trim().toLowerCase();
    this.phoneValue = phoneNorm;
    this.rankValue = rank;
    this.activeValue = isActive;
    this.currentRentedItemsValue = currentRentedItems;
  }
  get id() {
    return this.idValue;
  }
  get fullName() {
    return this.fullNameValue;
  }
  get email() {
    return this.emailValue;
  }
  get phone() {
    return this.phoneValue;
  }
  get rank() {
    return this.rankValue;
  }
  get isActive() {
    return this.activeValue;
  }
  get currentRentedItems() {
    return this.currentRentedItemsValue;
  }
  canRent(quantity) {
    if (!this.activeValue) {
      return false;
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return false;
    }
    const maxItems = getMaxRentalItemsByRank(this.rankValue);
    if (maxItems === null) {
      return true;
    }
    return this.currentRentedItemsValue + quantity <= maxItems;
  }
  registerRental(quantity) {
    ensureValidPositiveInteger(quantity, "Rental quantity must be a positive integer.");
    if (!this.activeValue) {
      throw new BusinessRuleError("CUSTOMER_INACTIVE", "Inactive customer cannot rent shoes.");
    }
    if (!this.canRent(quantity)) {
      const maxItems = getMaxRentalItemsByRank(this.rankValue);
      throw new BusinessRuleError(
        "RENTAL_LIMIT_EXCEEDED",
        `Customer cannot rent ${quantity} more item(s). Current: ${this.currentRentedItemsValue}, limit: ${maxItems ?? "unlimited"}.`
      );
    }
    this.currentRentedItemsValue += quantity;
  }
  completeRental(quantity) {
    ensureValidPositiveInteger(quantity, "Returned quantity must be a positive integer.");
    if (quantity > this.currentRentedItemsValue) {
      throw new BusinessRuleError(
        "STOCK_OVERFLOW",
        "Returned quantity cannot exceed current rented items."
      );
    }
    this.currentRentedItemsValue -= quantity;
  }
  changeRank(newRank) {
    ensureCurrentItemsWithinRankLimit(newRank, this.currentRentedItemsValue);
    this.rankValue = newRank;
  }
  upgradeRankForTotalSpent(totalSpentVnd) {
    const candidate = resolveRankByTotalSpentVnd(totalSpentVnd);
    const nextRank = upgradeRankIfHigher(this.rankValue, candidate);
    if (nextRank !== this.rankValue) {
      this.changeRank(nextRank);
      return true;
    }
    return false;
  }
  activate() {
    this.activeValue = true;
  }
  deactivate() {
    this.activeValue = false;
  }
  rename(fullName) {
    ensureValidBoundedString(
      fullName,
      1,
      100,
      "Customer full name must be between 1 and 100 characters."
    );
    this.fullNameValue = fullName.trim();
  }
  changeEmail(email) {
    ensureValidCustomerEmail(email);
    this.emailValue = email.trim().toLowerCase();
  }
  changePhone(phone) {
    const rawPhone = phone?.trim() ?? "";
    const phoneNorm = rawPhone.length > 0 ? rawPhone.replace(/[\s().-]/g, "") : null;
    if (phoneNorm !== null) {
      ensureValidCustomerPhone(phoneNorm);
    }
    this.phoneValue = phoneNorm;
  }
}
const transactionContext = new AsyncLocalStorage();
const RANK_TO_ID = {
  BRONZE: 1,
  SILVER: 2,
  GOLD: 3,
  DIAMOND: 4
};
const LOAD_SQL = `
  SELECT
    c.customer_id,
    c.full_name,
    c.email,
    c.phone,
    c.is_active,
    r.name          AS rank_name,
    COALESCE(SUM(ri.quantity), 0) AS current_rented_items
  FROM customers c
  JOIN ranks r ON r.id = c.rank_id
  LEFT JOIN rentals ren
    ON ren.customer_id = c.customer_id
    AND ren.status IN ('RESERVED', 'ACTIVE')
  LEFT JOIN rental_items ri ON ri.rental_id = ren.rental_id
  WHERE c.customer_id = ?
  GROUP BY c.customer_id, c.full_name, c.email, c.phone, c.is_active, r.name
`;
const LOAD_BY_EMAIL_SQL = LOAD_SQL.replace("WHERE c.customer_id = ?", "WHERE c.email = ?");
const CUSTOMER_LIST_FROM = `
  FROM customers c
  JOIN ranks r ON r.id = c.rank_id
  LEFT JOIN rentals ren
    ON ren.customer_id = c.customer_id
    AND ren.status IN ('RESERVED', 'ACTIVE')
  LEFT JOIN rental_items ri ON ri.rental_id = ren.rental_id
  GROUP BY c.customer_id, c.full_name, c.email, c.phone, c.is_active, r.name
`;
function toCustomer(row) {
  return new Customer({
    id: row.customer_id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    isActive: Number(row.is_active) === 1,
    rank: row.rank_name,
    currentRentedItems: Number(row.current_rented_items)
  });
}
class MysqlCustomerRepository {
  pool;
  constructor(pool) {
    this.pool = pool;
  }
  conn() {
    return transactionContext.getStore() ?? this.pool;
  }
  async findById(id) {
    const conn = this.conn();
    if (transactionContext.getStore()) {
      await conn.query("SELECT customer_id FROM customers WHERE customer_id = ? FOR UPDATE", [id]);
    }
    const [rows] = await conn.query(LOAD_SQL, [id]);
    return rows.length > 0 ? toCustomer(rows[0]) : null;
  }
  async findAll(options) {
    const conn = this.conn();
    const rawSearch = options?.search?.trim() ?? "";
    const hasSearch = rawSearch.length > 0;
    const like = hasSearch ? `%${rawSearch}%` : "";
    const searchClause = hasSearch ? " AND (c.email LIKE ? OR c.full_name LIKE ?)" : "";
    const searchParams = hasSearch ? [like, like] : [];
    const fromFiltered = CUSTOMER_LIST_FROM.replace(
      "GROUP BY",
      `WHERE 1=1${searchClause} GROUP BY`
    );
    const countSql = `
      SELECT COUNT(*) AS cnt FROM (
        SELECT c.customer_id
        ${fromFiltered}
      ) t
    `;
    const [countRows] = await conn.query(countSql, searchParams);
    const total = Number(countRows[0]?.["cnt"] ?? 0);
    const listSql = `
      SELECT
        c.customer_id,
        c.full_name,
        c.email,
        c.phone,
        c.is_active,
        r.name          AS rank_name,
        COALESCE(SUM(ri.quantity), 0) AS current_rented_items
      ${fromFiltered}
      ORDER BY c.customer_id
    `;
    const params = [...searchParams];
    if (options?.limit !== void 0) {
      const listSqlPaged = `${listSql} LIMIT ? OFFSET ?`;
      params.push(options.limit, options.offset ?? 0);
      const [rows2] = await conn.query(listSqlPaged, params);
      return { items: rows2.map((row) => toCustomer(row)), total };
    }
    const [rows] = await conn.query(listSql, searchParams);
    return { items: rows.map((row) => toCustomer(row)), total };
  }
  async findByEmail(email) {
    const [rows] = await this.conn().query(LOAD_BY_EMAIL_SQL, [
      email.trim().toLowerCase()
    ]);
    return rows.length > 0 ? toCustomer(rows[0]) : null;
  }
  async save(customer) {
    const rankId = RANK_TO_ID[customer.rank];
    await this.conn().query(
      `INSERT INTO customers (customer_id, full_name, email, phone, rank_id, is_active, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         full_name  = VALUES(full_name),
         email      = VALUES(email),
         phone      = VALUES(phone),
         rank_id    = VALUES(rank_id),
         is_active  = VALUES(is_active),
         updated_at = NOW()`,
      [
        customer.id,
        customer.fullName,
        customer.email,
        customer.phone,
        rankId,
        customer.isActive ? 1 : 0
      ]
    );
  }
  async deleteById(customerId) {
    await this.conn().query("DELETE FROM customers WHERE customer_id = ?", [customerId]);
  }
}
function toRecord(row) {
  return {
    userId: row.user_id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    roleId: Number(row.role_id),
    passwordHash: row.password_hash,
    customerId: row.customer_id,
    isActive: Number(row.is_active) === 1
  };
}
const FROM_USERS = `SELECT user_id, full_name, email, phone, role_id, password_hash, customer_id, is_active, created_at FROM system_users`;
class MysqlSystemUserRepository {
  pool;
  constructor(pool) {
    this.pool = pool;
  }
  conn() {
    return transactionContext.getStore() ?? this.pool;
  }
  async findByEmail(email) {
    const [rows] = await this.conn().query(
      `${FROM_USERS} WHERE email = ? LIMIT 1`,
      [email.trim().toLowerCase()]
    );
    return rows.length > 0 ? toRecord(rows[0]) : null;
  }
  async findByEmailExcluding(email, excludeUserId) {
    const [rows] = await this.conn().query(
      `${FROM_USERS} WHERE email = ? AND user_id <> ? LIMIT 1`,
      [email.trim().toLowerCase(), excludeUserId]
    );
    return rows.length > 0 ? toRecord(rows[0]) : null;
  }
  async findByCustomerId(customerId) {
    const [rows] = await this.conn().query(
      `${FROM_USERS} WHERE customer_id = ? LIMIT 1`,
      [customerId]
    );
    return rows.length > 0 ? toRecord(rows[0]) : null;
  }
  async findById(userId) {
    const [rows] = await this.conn().query(
      `${FROM_USERS} WHERE user_id = ? LIMIT 1`,
      [userId]
    );
    return rows.length > 0 ? toRecord(rows[0]) : null;
  }
  async save(user) {
    await this.conn().query(
      `INSERT INTO system_users (
        user_id, full_name, email, phone, password_hash, customer_id, role_id, is_active, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        user.userId,
        user.fullName,
        user.email.trim().toLowerCase(),
        user.phone,
        user.passwordHash,
        user.customerId,
        user.roleId,
        user.isActive ? 1 : 0
      ]
    );
  }
  async updateContactFields(userId, fields) {
    await this.conn().query(
      `UPDATE system_users
       SET full_name = ?, email = ?, phone = ?, updated_at = NOW()
       WHERE user_id = ?`,
      [
        fields.fullName,
        fields.email.trim().toLowerCase(),
        fields.phone,
        userId
      ]
    );
  }
  async updatePasswordHash(userId, passwordHash) {
    await this.conn().query(
      `UPDATE system_users SET password_hash = ?, updated_at = NOW() WHERE user_id = ?`,
      [passwordHash, userId]
    );
  }
  async listForAdmin(options) {
    const conn = this.conn();
    const q = options.search?.trim() ?? "";
    const hasSearch = q.length > 0;
    const like = hasSearch ? `%${q}%` : "";
    const whereClause = hasSearch ? `WHERE (email LIKE ? OR full_name LIKE ? OR user_id LIKE ? OR IFNULL(phone,'') LIKE ?)` : "";
    const filterParams = hasSearch ? [like, like, like, like] : [];
    const [countRows] = await conn.query(
      `SELECT COUNT(*) AS cnt FROM system_users ${whereClause}`,
      filterParams
    );
    const total = Number(countRows[0]?.["cnt"] ?? 0);
    const listSql = `${FROM_USERS} ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const [rows] = await conn.query(listSql, [...filterParams, options.limit, options.offset]);
    return { items: rows.map((r) => toRecord(r)), total };
  }
  async countActiveAdminsExcluding(excludeUserId) {
    const [rows] = await this.conn().query(
      `SELECT COUNT(*) AS cnt FROM system_users WHERE role_id = 2 AND is_active = 1 AND user_id <> ?`,
      [excludeUserId]
    );
    return Number(rows[0]?.["cnt"] ?? 0);
  }
  async updateAdminFields(userId, fields) {
    await this.conn().query(
      `UPDATE system_users SET
         full_name = ?, email = ?, phone = ?, role_id = ?, is_active = ?, customer_id = ?, updated_at = NOW()
       WHERE user_id = ?`,
      [
        fields.fullName,
        fields.email.trim().toLowerCase(),
        fields.phone,
        fields.roleId,
        fields.isActive ? 1 : 0,
        fields.customerId,
        userId
      ]
    );
  }
  async updateMirrorFromCustomer(userId, fields) {
    await this.conn().query(
      `UPDATE system_users SET
         full_name = ?, email = ?, phone = ?, is_active = ?, updated_at = NOW()
       WHERE user_id = ?`,
      [
        fields.fullName,
        fields.email.trim().toLowerCase(),
        fields.phone,
        fields.isActive ? 1 : 0,
        userId
      ]
    );
  }
  async unlinkCustomerLinks(customerId) {
    await this.conn().query(
      `UPDATE system_users SET customer_id = NULL, updated_at = NOW() WHERE customer_id = ?`,
      [customerId]
    );
  }
  async deleteById(userId) {
    await this.conn().query("DELETE FROM system_users WHERE user_id = ?", [userId]);
  }
}
function ensureValidRentalItemName(shoeName) {
  if (!shoeName || shoeName.trim().length === 0 || shoeName.trim().length > 100) {
    throw new ValidationError("Rental item shoe name is invalid.");
  }
}
function ensureValidRentalItemColor(color) {
  if (!color || color.trim().length === 0 || color.trim().length > 100) {
    throw new ValidationError("Rental item color is invalid.");
  }
}
class RentalItem {
  shoeId;
  variantId;
  shoeName;
  size;
  color;
  pricePerDay;
  quantity;
  constructor(props) {
    ensureValidRentalItemReferenceId(props.shoeId, "shoe id");
    ensureValidRentalItemReferenceId(props.variantId, "variant id");
    ensureValidRentalItemName(props.shoeName);
    ensureValidIntegerInRange(
      props.size,
      1,
      60,
      "Rental item size must be an integer between 1 and 60."
    );
    ensureValidRentalItemColor(props.color);
    ensureValidPositiveNumber(
      props.pricePerDay,
      "Rental item price per day must be greater than 0."
    );
    ensureValidPositiveInteger(
      props.quantity,
      "Rental item quantity must be a positive integer."
    );
    this.shoeId = props.shoeId.trim();
    this.variantId = props.variantId.trim();
    this.shoeName = props.shoeName.trim();
    this.size = props.size;
    this.color = props.color.trim();
    this.pricePerDay = props.pricePerDay;
    this.quantity = props.quantity;
  }
  subtotalFor(days) {
    ensureValidPositiveInteger(days, "Rental days must be a positive integer.");
    return this.pricePerDay * this.quantity * days;
  }
  withDiscountPercent(discountPercent) {
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      throw new ValidationError("Discount percent must be between 0 and 100.");
    }
    if (discountPercent === 0) return this;
    const discountedPrice = Math.max(
      1,
      Math.round(this.pricePerDay * (100 - discountPercent) / 100)
    );
    return new RentalItem({
      shoeId: this.shoeId,
      variantId: this.variantId,
      shoeName: this.shoeName,
      size: this.size,
      color: this.color,
      pricePerDay: discountedPrice,
      quantity: this.quantity
    });
  }
}
function ensureValidShoeLabel(value, label) {
  if (!value || value.trim().length === 0 || value.trim().length > 100) {
    throw new ValidationError(`${label} must be between 1 and 100 characters.`);
  }
}
function buildVariantIdentity(variant) {
  return `${variant.size}:${variant.color.toLowerCase()}`;
}
function ensureUniqueVariants(variants) {
  const ids = /* @__PURE__ */ new Set();
  const identities = /* @__PURE__ */ new Set();
  for (const variant of variants) {
    if (ids.has(variant.id)) {
      throw new ValidationError(`Duplicate variant id detected: ${variant.id}.`);
    }
    const identity = buildVariantIdentity(variant);
    if (identities.has(identity)) {
      throw new ValidationError(`Duplicate variant identity detected: ${identity}.`);
    }
    ids.add(variant.id);
    identities.add(identity);
  }
}
class Shoe {
  idValue;
  nameValue;
  brandValue;
  categoryValue;
  descriptionValue;
  pricePerDayValue;
  activeValue;
  imagePublicIdValue;
  variantsValue;
  constructor(props) {
    const description = props.description ?? null;
    const isActive = props.isActive ?? true;
    const variants = props.variants ? [...props.variants] : [];
    const rawImage = props.imagePublicId;
    let imagePublicId = null;
    if (rawImage !== void 0 && rawImage !== null) {
      const t = rawImage.trim();
      if (t.length > 0) {
        ensureValidShoeImagePublicId(t);
        imagePublicId = t;
      }
    }
    ensureValidEntityId(props.id, "Shoe");
    ensureValidBoundedString(
      props.name,
      1,
      100,
      "Shoe name must be between 1 and 100 characters."
    );
    ensureValidShoeLabel(props.brand, "Brand");
    ensureValidShoeLabel(props.category, "Category");
    ensureValidShoeDescription(description);
    ensureValidPositiveNumber(props.pricePerDay, "Price per day must be greater than 0.");
    ensureUniqueVariants(variants);
    this.idValue = props.id.trim();
    this.nameValue = props.name.trim();
    this.brandValue = props.brand.trim();
    this.categoryValue = props.category.trim();
    this.descriptionValue = description ? description.trim() : null;
    this.pricePerDayValue = props.pricePerDay;
    this.activeValue = isActive;
    this.imagePublicIdValue = imagePublicId;
    this.variantsValue = variants;
  }
  get id() {
    return this.idValue;
  }
  get name() {
    return this.nameValue;
  }
  get brand() {
    return this.brandValue;
  }
  get category() {
    return this.categoryValue;
  }
  get description() {
    return this.descriptionValue;
  }
  get pricePerDay() {
    return this.pricePerDayValue;
  }
  get isActive() {
    return this.activeValue;
  }
  get imagePublicId() {
    return this.imagePublicIdValue;
  }
  get variants() {
    return Object.freeze([...this.variantsValue]);
  }
  rename(name) {
    ensureValidBoundedString(
      name,
      1,
      100,
      "Shoe name must be between 1 and 100 characters."
    );
    this.nameValue = name.trim();
  }
  changeBrand(brand) {
    ensureValidShoeLabel(brand, "Brand");
    this.brandValue = brand.trim();
  }
  changeCategory(category) {
    ensureValidShoeLabel(category, "Category");
    this.categoryValue = category.trim();
  }
  changeDescription(description) {
    ensureValidShoeDescription(description);
    this.descriptionValue = description ? description.trim() : null;
  }
  changePricePerDay(pricePerDay) {
    ensureValidPositiveNumber(pricePerDay, "Price per day must be greater than 0.");
    this.pricePerDayValue = pricePerDay;
  }
  activate() {
    this.activeValue = true;
  }
  deactivate() {
    this.activeValue = false;
  }
  changeImagePublicId(publicId) {
    if (publicId === null) {
      this.imagePublicIdValue = null;
      return;
    }
    const t = publicId.trim();
    if (t.length === 0) {
      throw new ValidationError("Shoe image public id cannot be empty.");
    }
    ensureValidShoeImagePublicId(t);
    this.imagePublicIdValue = t;
  }
  addVariant(variant) {
    if (this.findVariantById(variant.id)) {
      throw new ValidationError(`Variant ${variant.id} already exists in shoe ${this.idValue}.`);
    }
    const identity = buildVariantIdentity(variant);
    const hasSameIdentity = this.variantsValue.some(
      (currentVariant) => buildVariantIdentity(currentVariant) === identity
    );
    if (hasSameIdentity) {
      throw new ValidationError(
        `Variant with size ${variant.size} and color ${variant.color} already exists in shoe ${this.idValue}.`
      );
    }
    this.variantsValue.push(variant);
  }
  findVariantById(variantId) {
    return this.variantsValue.find((variant) => variant.id === variantId) ?? null;
  }
  changeVariantOnHandQuantity(variantId, newTotal) {
    const variant = this.findVariantById(variantId);
    if (!variant) {
      throw new BusinessRuleError(
        "VARIANT_NOT_IN_SHOE",
        `Variant ${variantId} does not exist in shoe ${this.idValue}.`
      );
    }
    variant.changeOnHandQuantity(newTotal);
  }
  createRentalItem(variantId, quantity) {
    if (!this.activeValue) {
      throw new BusinessRuleError(
        "SHOE_INACTIVE",
        `Shoe ${this.idValue} is inactive and cannot be rented.`
      );
    }
    const variant = this.getVariantOrFail(variantId);
    return new RentalItem({
      shoeId: this.idValue,
      variantId: variant.id,
      shoeName: this.nameValue,
      size: variant.size,
      color: variant.color,
      pricePerDay: this.pricePerDayValue,
      quantity
    });
  }
  getVariantOrFail(variantId) {
    const variant = this.findVariantById(variantId);
    if (!variant) {
      throw new BusinessRuleError(
        "VARIANT_NOT_IN_SHOE",
        `Variant ${variantId} does not exist in shoe ${this.idValue}.`
      );
    }
    return variant;
  }
}
const VARIANTS_SQL = `
  SELECT sv.variant_id, sv.size, col.name AS color, sv.on_hand_quantity,
         sv.on_hand_quantity - COALESCE(active.reserved_qty, 0) AS available_quantity
  FROM shoe_variants sv
  JOIN colors col ON col.id = sv.color_id
  LEFT JOIN (
    SELECT ri.variant_id, SUM(ri.quantity) AS reserved_qty
    FROM rental_items ri
    JOIN rentals r ON r.rental_id = ri.rental_id
    WHERE r.status IN ('RESERVED', 'ACTIVE')
    GROUP BY ri.variant_id
  ) AS active ON active.variant_id = sv.variant_id
  WHERE sv.shoe_id = ?
`;
class MysqlShoeRepository {
  pool;
  constructor(pool) {
    this.pool = pool;
  }
  conn() {
    return transactionContext.getStore() ?? this.pool;
  }
  async findById(shoeId) {
    const conn = this.conn();
    const [shoeRows] = await conn.query(
      `SELECT s.shoe_id, s.name, b.name AS brand, cat.name AS category,
              s.description, s.price_per_day, s.is_active, s.image_public_id
       FROM shoes s
       JOIN brands b     ON b.id = s.brand_id
       JOIN categories cat ON cat.id = s.category_id
       WHERE s.shoe_id = ?`,
      [shoeId]
    );
    if (shoeRows.length === 0) return null;
    const [variantRows] = await conn.query(VARIANTS_SQL, [shoeId]);
    const row = shoeRows[0];
    const shoe = new Shoe({
      id: row.shoe_id,
      name: row.name,
      brand: row.brand,
      category: row.category,
      description: row.description ?? null,
      pricePerDay: Number(row.price_per_day),
      isActive: Number(row.is_active) === 1,
      imagePublicId: row.image_public_id ?? null
    });
    for (const v of variantRows) {
      shoe.addVariant(
        new ShoeVariant({
          id: v.variant_id,
          size: v.size,
          color: v.color,
          totalQuantity: v.on_hand_quantity,
          availableQuantity: Math.max(0, Number(v.available_quantity))
        })
      );
    }
    return shoe;
  }
  async findByVariantId(variantId) {
    const [idRows] = await this.conn().query(
      "SELECT shoe_id FROM shoe_variants WHERE variant_id = ?",
      [variantId]
    );
    if (idRows.length === 0) return null;
    return this.findById(idRows[0]["shoe_id"]);
  }
  async findAll(filters) {
    const conditions = ["1=1"];
    const priceBucket = filters?.priceBucket ?? "all";
    if (priceBucket === "lt10") {
      conditions.push("s.price_per_day < 250000");
    } else if (priceBucket === "10to20") {
      conditions.push("s.price_per_day >= 250000 AND s.price_per_day < 350000");
    } else if (priceBucket === "20to50") {
      conditions.push("s.price_per_day >= 350000 AND s.price_per_day <= 450000");
    } else if (priceBucket === "gt50") {
      conditions.push("s.price_per_day > 450000");
    }
    const stockBucket = filters?.stockBucket ?? "all";
    const stockExpr = "COALESCE(v.stock_sum, 0)";
    if (stockBucket === "0") {
      conditions.push(`${stockExpr} = 0`);
    } else if (stockBucket === "1to5") {
      conditions.push(`${stockExpr} BETWEEN 1 AND 5`);
    } else if (stockBucket === "6plus") {
      conditions.push(`${stockExpr} >= 6`);
    }
    const whereClause = conditions.join(" AND ");
    const baseFrom = `
      FROM shoes s
      LEFT JOIN (
        SELECT shoe_id, SUM(on_hand_quantity) AS stock_sum
        FROM shoe_variants
        GROUP BY shoe_id
      ) v ON v.shoe_id = s.shoe_id
      WHERE ${whereClause}`;
    const [countRows] = await this.conn().query(
      `SELECT COUNT(s.shoe_id) AS cnt ${baseFrom}`
    );
    const total = Number(countRows[0]?.["cnt"] ?? 0);
    let listSql = `SELECT s.shoe_id ${baseFrom} ORDER BY s.shoe_id`;
    const listParams = [];
    if (filters?.limit !== void 0) {
      listSql += " LIMIT ? OFFSET ?";
      listParams.push(filters.limit, filters.offset ?? 0);
    }
    const [rows] = await this.conn().query(listSql, listParams);
    const shoes = [];
    for (const row of rows) {
      const shoe = await this.findById(row["shoe_id"]);
      if (shoe) shoes.push(shoe);
    }
    return { items: shoes, total };
  }
  async save(shoe) {
    const conn = this.conn();
    const brandId = await this.getOrCreateLookup(conn, "brands", shoe.brand);
    const categoryId = await this.getOrCreateLookup(conn, "categories", shoe.category);
    await conn.query(
      `INSERT INTO shoes (shoe_id, name, brand_id, category_id, description, price_per_day, is_active, image_public_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         name         = VALUES(name),
         brand_id     = VALUES(brand_id),
         category_id  = VALUES(category_id),
         description  = VALUES(description),
         price_per_day = VALUES(price_per_day),
         is_active    = VALUES(is_active),
         image_public_id = VALUES(image_public_id),
         updated_at   = NOW()`,
      [
        shoe.id,
        shoe.name,
        brandId,
        categoryId,
        shoe.description ?? null,
        shoe.pricePerDay,
        shoe.isActive ? 1 : 0,
        shoe.imagePublicId
      ]
    );
    for (const variant of shoe.variants) {
      const colorId = await this.getOrCreateLookup(conn, "colors", variant.color);
      await conn.query(
        `INSERT INTO shoe_variants (variant_id, shoe_id, size, color_id, on_hand_quantity, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           size             = VALUES(size),
           color_id         = VALUES(color_id),
           on_hand_quantity = VALUES(on_hand_quantity),
           updated_at       = NOW()`,
        [variant.id, shoe.id, variant.size, colorId, variant.totalQuantity]
      );
    }
  }
  async getOrCreateLookup(conn, table, name) {
    const [rows] = await conn.query(
      `SELECT id FROM \`${table}\` WHERE name = ?`,
      [name]
    );
    if (rows.length > 0) return rows[0]["id"];
    const [result] = await conn.query(
      `INSERT INTO \`${table}\` (name) VALUES (?)`,
      [name]
    );
    return result.insertId;
  }
}
class MysqlCatalogLookup {
  pool;
  constructor(pool) {
    this.pool = pool;
  }
  async listBrands() {
    const [rows] = await this.pool.query(
      "SELECT id, name FROM brands ORDER BY name ASC"
    );
    return rows.map((r) => ({ id: Number(r.id), name: r.name }));
  }
  async listCategories() {
    const [rows] = await this.pool.query(
      "SELECT id, name FROM categories ORDER BY name ASC"
    );
    return rows.map((r) => ({ id: Number(r.id), name: r.name }));
  }
  async listColors() {
    const [rows] = await this.pool.query(
      "SELECT id, name FROM colors ORDER BY name ASC"
    );
    return rows.map((r) => ({ id: Number(r.id), name: r.name }));
  }
  async getBrandNameById(id) {
    const [rows] = await this.pool.query("SELECT name FROM brands WHERE id = ?", [id]);
    return rows.length > 0 ? rows[0].name : null;
  }
  async getCategoryNameById(id) {
    const [rows] = await this.pool.query(
      "SELECT name FROM categories WHERE id = ?",
      [id]
    );
    return rows.length > 0 ? rows[0].name : null;
  }
  async getColorNameById(id) {
    const [rows] = await this.pool.query("SELECT name FROM colors WHERE id = ?", [id]);
    return rows.length > 0 ? rows[0].name : null;
  }
  async getShoeCatalogIds(shoeId) {
    const [shoeRows] = await this.pool.query(
      `SELECT b.id AS brand_id, c.id AS category_id
       FROM shoes s
       JOIN brands b ON b.id = s.brand_id
       JOIN categories c ON c.id = s.category_id
       WHERE s.shoe_id = ?`,
      [shoeId]
    );
    if (shoeRows.length === 0) return null;
    const [vRows] = await this.pool.query(
      `SELECT sv.variant_id, col.id AS color_id
       FROM shoe_variants sv
       JOIN colors col ON col.id = sv.color_id
       WHERE sv.shoe_id = ?`,
      [shoeId]
    );
    return {
      brandId: Number(shoeRows[0].brand_id),
      categoryId: Number(shoeRows[0].category_id),
      variants: vRows.map((r) => ({
        variantId: r.variant_id,
        colorId: Number(r.color_id)
      }))
    };
  }
}
class ConflictError extends DomainError {
  constructor(code, message) {
    super(code, message);
  }
}
class NotFoundError extends DomainError {
  constructor(resource, id) {
    super(`${resource.toUpperCase()}_NOT_FOUND`, `${resource} '${id}' was not found.`);
  }
}
class MysqlCatalogAdmin {
  pool;
  constructor(pool) {
    this.pool = pool;
  }
  ensureName(name) {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 100) {
      throw new ValidationError("Name must be between 1 and 100 characters.");
    }
    return trimmed;
  }
  async assertNameUnique(table, name, excludeId) {
    const sql = excludeId !== void 0 ? `SELECT id FROM ${table} WHERE LOWER(TRIM(name)) = LOWER(?) AND id <> ?` : `SELECT id FROM ${table} WHERE LOWER(TRIM(name)) = LOWER(?)`;
    const params = excludeId !== void 0 ? [name, excludeId] : [name];
    const [rows] = await this.pool.query(sql, params);
    if (rows.length > 0) {
      throw new ValidationError("A record with this name already exists.");
    }
  }
  async createBrand(name) {
    const n = this.ensureName(name);
    await this.assertNameUnique("brands", n);
    const [result] = await this.pool.query("INSERT INTO brands (name) VALUES (?)", [
      n
    ]);
    return { id: result.insertId, name: n };
  }
  async updateBrand(id, name) {
    const n = this.ensureName(name);
    await this.assertNameUnique("brands", n, id);
    const [result] = await this.pool.query(
      "UPDATE brands SET name = ? WHERE id = ?",
      [n, id]
    );
    if (result.affectedRows === 0) {
      throw new NotFoundError("Brand", String(id));
    }
  }
  async deleteBrand(id) {
    const [rows] = await this.pool.query(
      "SELECT COUNT(*) AS c FROM shoes WHERE brand_id = ?",
      [id]
    );
    const c = Number(rows[0]?.["c"] ?? 0);
    if (c > 0) {
      throw new ConflictError(
        "BRAND_IN_USE",
        `Cannot delete: ${c} shoe(s) still reference this brand.`
      );
    }
    const [result] = await this.pool.query("DELETE FROM brands WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
      throw new NotFoundError("Brand", String(id));
    }
  }
  async createCategory(name) {
    const n = this.ensureName(name);
    await this.assertNameUnique("categories", n);
    const [result] = await this.pool.query(
      "INSERT INTO categories (name) VALUES (?)",
      [n]
    );
    return { id: result.insertId, name: n };
  }
  async updateCategory(id, name) {
    const n = this.ensureName(name);
    await this.assertNameUnique("categories", n, id);
    const [result] = await this.pool.query(
      "UPDATE categories SET name = ? WHERE id = ?",
      [n, id]
    );
    if (result.affectedRows === 0) {
      throw new NotFoundError("Category", String(id));
    }
  }
  async deleteCategory(id) {
    const [rows] = await this.pool.query(
      "SELECT COUNT(*) AS c FROM shoes WHERE category_id = ?",
      [id]
    );
    const c = Number(rows[0]?.["c"] ?? 0);
    if (c > 0) {
      throw new ConflictError(
        "CATEGORY_IN_USE",
        `Cannot delete: ${c} shoe(s) still reference this category.`
      );
    }
    const [result] = await this.pool.query(
      "DELETE FROM categories WHERE id = ?",
      [id]
    );
    if (result.affectedRows === 0) {
      throw new NotFoundError("Category", String(id));
    }
  }
}
function normalizeToCalendarDate(value) {
  ensureValidDate(value, "date");
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}
class RentalPeriod {
  startDateValue;
  endDateValue;
  constructor(startDate, endDate) {
    const normalizedStartDate = normalizeToCalendarDate(startDate);
    const normalizedEndDate = normalizeToCalendarDate(endDate);
    if (normalizedEndDate < normalizedStartDate) {
      throw new ValidationError("Rental end date cannot be before start date.");
    }
    this.startDateValue = normalizedStartDate;
    this.endDateValue = normalizedEndDate;
  }
  get startDate() {
    return new Date(this.startDateValue.getTime());
  }
  get endDate() {
    return new Date(this.endDateValue.getTime());
  }
  get durationInDays() {
    const millisecondsPerDay = 24 * 60 * 60 * 1e3;
    return Math.floor(
      (this.endDateValue.getTime() - this.startDateValue.getTime()) / millisecondsPerDay
    ) + 1;
  }
  overlaps(other) {
    return this.startDateValue <= other.endDateValue && other.startDateValue <= this.endDateValue;
  }
  contains(date) {
    const normalizedDate = normalizeToCalendarDate(date);
    return normalizedDate >= this.startDateValue && normalizedDate <= this.endDateValue;
  }
}
const RentalStatus = {
  RESERVED: "RESERVED",
  ACTIVE: "ACTIVE",
  RETURNED: "RETURNED",
  CANCELLED: "CANCELLED"
};
class ForbiddenError extends DomainError {
  constructor(code = "FORBIDDEN", message = "Access denied.") {
    super(code, message);
  }
}
const MS_PER_CALENDAR_DAY = 24 * 60 * 60 * 1e3;
function mergeNotePreservingDiscountTag(existingNote, incomingNote, suffixTag) {
  const discountMatch = existingNote?.match(/\[Ưu đãi:[^\]]+\]/);
  const discountTag = discountMatch ? discountMatch[0] : "";
  let base = incomingNote !== void 0 ? incomingNote ? incomingNote.trim() : "" : existingNote ?? "";
  if (discountTag && !base.includes(discountTag)) {
    base = base.length > 0 ? `${base} ${discountTag}` : discountTag;
  }
  if (suffixTag) {
    if (base.length > 0) {
      const maxPrefix = Math.max(0, 255 - suffixTag.length - 1);
      const trimmedPrefix = base.length > maxPrefix ? base.slice(0, maxPrefix).trimEnd() : base;
      return trimmedPrefix.length > 0 ? `${trimmedPrefix} ${suffixTag}` : suffixTag;
    }
    return suffixTag.slice(0, 255);
  }
  if (base.length === 0) {
    return null;
  }
  return base.slice(0, 255);
}
function ensureValidRentalItems(items) {
  if (!items || items.length === 0) {
    throw new ValidationError("Rental must contain at least one item.");
  }
  const variantIds = /* @__PURE__ */ new Set();
  for (const item of items) {
    if (variantIds.has(item.variantId)) {
      throw new ValidationError(
        `Duplicate variant ${item.variantId} in the same rental is not allowed.`
      );
    }
    variantIds.add(item.variantId);
  }
}
class Rental {
  idValue;
  customerIdValue;
  itemsValue;
  periodValue;
  statusValue;
  lateFeeValue;
  noteValue;
  createdAtValue;
  activatedAtValue;
  returnedAtValue;
  cancelledAtValue;
  constructor(props) {
    const status = props.status ?? RentalStatus.RESERVED;
    const lateFee = props.lateFee ?? 0;
    const note = props.note ?? null;
    const createdAt = props.createdAt ?? /* @__PURE__ */ new Date();
    const activatedAt = props.activatedAt ?? null;
    const returnedAt = props.returnedAt ?? null;
    const cancelledAt = props.cancelledAt ?? null;
    ensureValidEntityId(props.id, "Rental");
    ensureValidEntityId(props.customerId, "Customer");
    ensureValidRentalItems(props.items);
    ensureValidNonNegativeNumber(lateFee, "Late fee must be a non-negative number.");
    ensureValidRentalNote(note);
    ensureValidDate(createdAt, "createdAt");
    if (activatedAt) {
      ensureValidDate(activatedAt, "activatedAt");
    }
    if (returnedAt) {
      ensureValidDate(returnedAt, "returnedAt");
    }
    if (cancelledAt) {
      ensureValidDate(cancelledAt, "cancelledAt");
    }
    this.idValue = props.id.trim();
    this.customerIdValue = props.customerId.trim();
    this.itemsValue = [...props.items];
    this.periodValue = props.period;
    this.statusValue = status;
    this.lateFeeValue = lateFee;
    this.noteValue = note ? note.trim() : null;
    this.createdAtValue = new Date(createdAt.getTime());
    this.activatedAtValue = activatedAt ? new Date(activatedAt.getTime()) : null;
    this.returnedAtValue = returnedAt ? new Date(returnedAt.getTime()) : null;
    this.cancelledAtValue = cancelledAt ? new Date(cancelledAt.getTime()) : null;
    this.ensureStateConsistency();
  }
  get id() {
    return this.idValue;
  }
  get customerId() {
    return this.customerIdValue;
  }
  get items() {
    return Object.freeze([...this.itemsValue]);
  }
  get period() {
    return this.periodValue;
  }
  get status() {
    return this.statusValue;
  }
  get lateFee() {
    return this.lateFeeValue;
  }
  get note() {
    return this.noteValue;
  }
  get createdAt() {
    return new Date(this.createdAtValue.getTime());
  }
  get activatedAt() {
    return this.activatedAtValue ? new Date(this.activatedAtValue.getTime()) : null;
  }
  get returnedAt() {
    return this.returnedAtValue ? new Date(this.returnedAtValue.getTime()) : null;
  }
  get cancelledAt() {
    return this.cancelledAtValue ? new Date(this.cancelledAtValue.getTime()) : null;
  }
  get totalItems() {
    return this.itemsValue.reduce((sum, item) => sum + item.quantity, 0);
  }
  get depositAmount() {
    return this.totalItems * 5e5;
  }
  get basePrice() {
    return this.itemsValue.reduce(
      (sum, item) => sum + item.subtotalFor(this.periodValue.durationInDays),
      0
    );
  }
  get totalAmount() {
    return this.basePrice + this.lateFeeValue;
  }
  isOverdue(at = /* @__PURE__ */ new Date()) {
    if (this.statusValue === RentalStatus.RETURNED || this.statusValue === RentalStatus.CANCELLED) {
      return false;
    }
    ensureValidDate(at, "at");
    return normalizeDateToCalendarTime(at) > normalizeDateToCalendarTime(this.periodValue.endDate);
  }
  activate(at = /* @__PURE__ */ new Date()) {
    if (this.statusValue !== RentalStatus.RESERVED) {
      throw new BusinessRuleError(
        "INVALID_RENTAL_STATE",
        `Only RESERVED rental can be activated. Current status: ${this.statusValue}.`
      );
    }
    ensureValidDate(at, "activatedAt");
    this.statusValue = RentalStatus.ACTIVE;
    this.activatedAtValue = new Date(at.getTime());
  }
  completeReturn(returnedAt = /* @__PURE__ */ new Date(), note, damageFee = 0) {
    if (this.statusValue !== RentalStatus.RESERVED && this.statusValue !== RentalStatus.ACTIVE) {
      throw new BusinessRuleError(
        "INVALID_RENTAL_STATE",
        `Only RESERVED or ACTIVE rental can be returned. Current status: ${this.statusValue}.`
      );
    }
    ensureValidDate(returnedAt, "returnedAt");
    ensureValidRentalNote(note ?? null);
    if (!Number.isFinite(damageFee) || damageFee < 0) {
      throw new ValidationError("Damage fee cannot be negative.");
    }
    const cleanDamageFee = Math.round(damageFee);
    const lateFee = this.calculateLateFeeForReturn(
      this.basePrice,
      this.periodValue.durationInDays,
      this.periodValue.endDate,
      returnedAt
    );
    this.statusValue = RentalStatus.RETURNED;
    this.returnedAtValue = new Date(returnedAt.getTime());
    this.lateFeeValue = lateFee + cleanDamageFee;
    if (cleanDamageFee > 0) {
      const tag = `[Phụ phí kiểm định/vệ sinh: +${cleanDamageFee}₫]`;
      this.noteValue = mergeNotePreservingDiscountTag(this.noteValue, note, tag);
    } else if (note !== void 0) {
      this.noteValue = mergeNotePreservingDiscountTag(this.noteValue, note);
    }
  }
  extendPeriod(newEndDate, note) {
    if (this.statusValue !== RentalStatus.RESERVED && this.statusValue !== RentalStatus.ACTIVE) {
      throw new BusinessRuleError(
        "INVALID_RENTAL_STATE",
        "Only RESERVED or ACTIVE rental can be extended."
      );
    }
    ensureValidDate(newEndDate, "newEndDate");
    ensureValidRentalNote(note ?? null);
    const oldEnd = normalizeDateToCalendarTime(this.periodValue.endDate);
    const nextEnd = normalizeDateToCalendarTime(newEndDate);
    if (nextEnd <= oldEnd) {
      throw new ValidationError("New return date must be after the current expected return date.");
    }
    this.periodValue = new RentalPeriod(this.periodValue.startDate, newEndDate);
    if (note !== void 0 && note.trim().length > 0) {
      this.noteValue = mergeNotePreservingDiscountTag(this.noteValue, note);
    }
  }
  assertOwnedBy(customerId, message = "You do not have permission to access or modify this rental.") {
    const cid = customerId?.trim() ?? "";
    if (!cid) {
      throw new ValidationError("Customer id is required for this operation.");
    }
    if (this.customerIdValue !== cid) {
      throw new ForbiddenError("FORBIDDEN", message);
    }
  }
  buildExtensionPeriod(newEndDate) {
    if (this.statusValue !== RentalStatus.RESERVED && this.statusValue !== RentalStatus.ACTIVE) {
      throw new BusinessRuleError(
        "INVALID_RENTAL_STATE",
        `Only RESERVED or ACTIVE rental can be extended. Current status: ${this.statusValue}.`
      );
    }
    ensureValidDate(newEndDate, "newEndDate");
    const oldEnd = this.periodValue.endDate;
    const oldEndNorm = new Date(oldEnd.getFullYear(), oldEnd.getMonth(), oldEnd.getDate());
    const newEndNorm = new Date(
      newEndDate.getFullYear(),
      newEndDate.getMonth(),
      newEndDate.getDate()
    );
    if (newEndNorm.getTime() <= oldEndNorm.getTime()) {
      throw new ValidationError("New return date must be after current return date.");
    }
    const extStart = new Date(
      oldEndNorm.getFullYear(),
      oldEndNorm.getMonth(),
      oldEndNorm.getDate() + 1
    );
    return new RentalPeriod(extStart, newEndNorm);
  }
  static formatDiscountNote(rawNote, customerRank, rankDiscountPercent, appliedVoucherCode, voucherDiscountPercent) {
    let noteText = rawNote?.trim() || "";
    const totalDiscount = Math.min(50, rankDiscountPercent + voucherDiscountPercent);
    if (totalDiscount > 0) {
      const tagParts = [];
      if (rankDiscountPercent > 0) {
        tagParts.push(`Hạng ${customerRank} -${rankDiscountPercent}%`);
      }
      if (appliedVoucherCode) {
        tagParts.push(`Voucher ${appliedVoucherCode} -${voucherDiscountPercent}%`);
      }
      const tag = `[Ưu đãi: ${tagParts.join(", ")}]`;
      if (noteText) {
        const maxPrefixLen = Math.max(0, 255 - tag.length - 1);
        const safePrefix = noteText.length > maxPrefixLen ? noteText.slice(0, maxPrefixLen).trimEnd() : noteText;
        noteText = safePrefix ? `${safePrefix} ${tag}` : tag;
      } else {
        noteText = tag;
      }
    }
    return noteText || null;
  }
  assertCustomerCancellationAllowed(at) {
    if (this.statusValue !== RentalStatus.RESERVED) {
      throw new BusinessRuleError(
        "INVALID_RENTAL_STATE",
        `Only RESERVED rental can be cancelled. Current status: ${this.statusValue}.`
      );
    }
    ensureValidDate(at, "at");
    const startDay = normalizeDateToCalendarTime(this.periodValue.startDate);
    const atDay = normalizeDateToCalendarTime(at);
    if (startDay - atDay < MS_PER_CALENDAR_DAY) {
      throw new BusinessRuleError(
        "CANCEL_TOO_LATE",
        "You can only cancel at least one full day before the rental start date."
      );
    }
  }
  cancel(at = /* @__PURE__ */ new Date(), note) {
    if (this.statusValue !== RentalStatus.RESERVED) {
      throw new BusinessRuleError(
        "INVALID_RENTAL_STATE",
        `Only RESERVED rental can be cancelled. Current status: ${this.statusValue}.`
      );
    }
    ensureValidDate(at, "cancelledAt");
    ensureValidRentalNote(note ?? null);
    this.statusValue = RentalStatus.CANCELLED;
    this.cancelledAtValue = new Date(at.getTime());
    if (note !== void 0) {
      this.noteValue = mergeNotePreservingDiscountTag(this.noteValue, note);
    }
  }
  hasVariant(variantId) {
    return this.itemsValue.some((item) => item.variantId === variantId);
  }
  getQuantityForVariant(variantId) {
    return this.itemsValue.filter((item) => item.variantId === variantId).reduce((sum, item) => sum + item.quantity, 0);
  }
  calculateLateFeeForReturn(basePrice, durationInDays, expectedReturnDate, actualReturnDate) {
    const expectedTime = normalizeDateToCalendarTime(expectedReturnDate);
    const actualTime = normalizeDateToCalendarTime(actualReturnDate);
    if (actualTime <= expectedTime) return 0;
    const overdueDays = Math.floor((actualTime - expectedTime) / (24 * 60 * 60 * 1e3));
    if (overdueDays <= 0) return 0;
    const dailyRate = basePrice / durationInDays;
    const lateFeePerDay = dailyRate * 0.5;
    return Math.round(overdueDays * lateFeePerDay);
  }
  ensureStateConsistency() {
    if (this.statusValue === RentalStatus.ACTIVE && this.activatedAtValue === null) {
      throw new ValidationError("ACTIVE rental must have activatedAt.");
    }
    if (this.statusValue === RentalStatus.RETURNED && this.returnedAtValue === null) {
      throw new ValidationError("RETURNED rental must have returnedAt.");
    }
    if (this.statusValue === RentalStatus.CANCELLED && this.cancelledAtValue === null) {
      throw new ValidationError("CANCELLED rental must have cancelledAt.");
    }
    if (this.statusValue !== RentalStatus.RETURNED && this.lateFeeValue !== 0) {
      throw new ValidationError("Late fee can only exist on RETURNED rental.");
    }
  }
}
const RENTAL_SQL = `
  SELECT rental_id, customer_id, start_date, expected_return_date,
         actual_return_date, status, late_fee, note, created_at,
         activated_at, cancelled_at
  FROM rentals
  WHERE rental_id = ?
`;
const ITEMS_SQL = `
  SELECT variant_id, quantity, price_per_day, shoe_id, shoe_name, size, color
  FROM rental_items
  WHERE rental_id = ?
`;
function toSqlDate$1(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function toRental(row, items) {
  const rentalItems = items.map(
    (i) => new RentalItem({
      shoeId: i.shoe_id,
      variantId: i.variant_id,
      shoeName: i.shoe_name,
      size: i.size,
      color: i.color,
      pricePerDay: Number(i.price_per_day),
      quantity: i.quantity
    })
  );
  return new Rental({
    id: row.rental_id,
    customerId: row.customer_id,
    items: rentalItems,
    period: new RentalPeriod(new Date(row.start_date), new Date(row.expected_return_date)),
    status: row.status,
    lateFee: Number(row.late_fee),
    note: row.note ?? null,
    createdAt: new Date(row.created_at),
    activatedAt: row.activated_at ? new Date(row.activated_at) : null,
    returnedAt: row.actual_return_date ? new Date(row.actual_return_date) : null,
    cancelledAt: row.cancelled_at ? new Date(row.cancelled_at) : null
  });
}
class MysqlRentalRepository {
  pool;
  constructor(pool) {
    this.pool = pool;
  }
  conn() {
    return transactionContext.getStore() ?? this.pool;
  }
  async findById(id) {
    const conn = this.conn();
    const sql = transactionContext.getStore() ? `${RENTAL_SQL} FOR UPDATE` : RENTAL_SQL;
    const [rentalRows] = await conn.query(sql, [id]);
    if (rentalRows.length === 0) return null;
    const [itemRows] = await conn.query(ITEMS_SQL, [id]);
    return toRental(rentalRows[0], itemRows);
  }
  async findList(filters) {
    const conn = this.conn();
    const conditions = ["1=1"];
    const params = [];
    if (filters?.customerId) {
      conditions.push("r.customer_id = ?");
      params.push(filters.customerId);
    }
    if (filters?.status) {
      conditions.push("r.status = ?");
      params.push(filters.status);
    }
    if (filters?.startDateFrom) {
      conditions.push("DATE(r.start_date) >= ?");
      params.push(filters.startDateFrom);
    }
    if (filters?.startDateTo) {
      conditions.push("DATE(r.start_date) <= ?");
      params.push(filters.startDateTo);
    }
    const totalExpr = `(
      COALESCE(
        (SELECT SUM(ri.quantity * ri.price_per_day) FROM rental_items ri WHERE ri.rental_id = r.rental_id),
        0
      ) * (DATEDIFF(r.expected_return_date, r.start_date) + 1)
      + COALESCE(r.late_fee, 0)
    )`;
    const bucket = filters?.amountBucket ?? "all";
    if (bucket === "lt50") {
      conditions.push(`${totalExpr} < 1000000`);
    } else if (bucket === "50to150") {
      conditions.push(`${totalExpr} >= 1000000 AND ${totalExpr} <= 2000000`);
    } else if (bucket === "150to300") {
      conditions.push(`${totalExpr} > 2000000 AND ${totalExpr} <= 3500000`);
    } else if (bucket === "gt300") {
      conditions.push(`${totalExpr} > 3500000`);
    }
    if (filters?.search?.trim()) {
      const t = `%${filters.search.trim()}%`;
      conditions.push("(r.rental_id LIKE ? OR cust.full_name LIKE ?)");
      params.push(t, t);
    }
    const whereClause = conditions.join(" AND ");
    const rentalFrom = `rentals r INNER JOIN customers cust ON cust.customer_id = r.customer_id`;
    const [countRows] = await conn.query(
      `SELECT COUNT(*) AS cnt FROM ${rentalFrom} WHERE ${whereClause}`,
      params
    );
    const total = Number(countRows[0]?.["cnt"] ?? 0);
    let listSql = `
      SELECT r.rental_id, r.customer_id, r.start_date, r.expected_return_date,
             r.actual_return_date, r.status, r.late_fee, r.note, r.created_at,
             r.activated_at, r.cancelled_at
      FROM ${rentalFrom}
      WHERE ${whereClause}
      ORDER BY r.created_at DESC`;
    const listParams = [...params];
    if (filters?.limit !== void 0) {
      listSql += " LIMIT ? OFFSET ?";
      listParams.push(filters.limit, filters.offset ?? 0);
    }
    const [rentalRows] = await conn.query(listSql, listParams);
    if (rentalRows.length === 0) {
      return { items: [], total };
    }
    const rentalIds = rentalRows.map((r) => r.rental_id);
    const placeholders = rentalIds.map(() => "?").join(", ");
    const [allItemRows] = await conn.query(
      `SELECT rental_id, variant_id, quantity, price_per_day, shoe_id, shoe_name, size, color
       FROM rental_items
       WHERE rental_id IN (${placeholders})`,
      rentalIds
    );
    const itemsByRentalId = /* @__PURE__ */ new Map();
    for (const itemRow of allItemRows) {
      const list = itemsByRentalId.get(itemRow.rental_id) ?? [];
      list.push(itemRow);
      itemsByRentalId.set(itemRow.rental_id, list);
    }
    const rentals = rentalRows.map((row) => toRental(row, itemsByRentalId.get(row.rental_id) ?? []));
    return { items: rentals, total };
  }
  async save(rental) {
    const conn = this.conn();
    await conn.query(
      `INSERT INTO rentals
         (rental_id, customer_id, start_date, expected_return_date,
          status, late_fee, note, created_at, activated_at,
          actual_return_date, cancelled_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         expected_return_date  = VALUES(expected_return_date),
         status                = VALUES(status),
         late_fee              = VALUES(late_fee),
         note                  = VALUES(note),
         activated_at          = VALUES(activated_at),
         actual_return_date    = VALUES(actual_return_date),
         cancelled_at          = VALUES(cancelled_at),
         updated_at            = NOW()`,
      [
        rental.id,
        rental.customerId,
        toSqlDate$1(rental.period.startDate),
        toSqlDate$1(rental.period.endDate),
        rental.status,
        rental.lateFee,
        rental.note ?? null,
        rental.createdAt,
        rental.activatedAt ?? null,
        rental.returnedAt ? toSqlDate$1(rental.returnedAt) : null,
        rental.cancelledAt ?? null
      ]
    );
    for (const item of rental.items) {
      await conn.query(
        `INSERT IGNORE INTO rental_items
           (rental_id, variant_id, shoe_id, shoe_name, size, color, price_per_day, quantity)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          rental.id,
          item.variantId,
          item.shoeId,
          item.shoeName,
          item.size,
          item.color,
          item.pricePerDay,
          item.quantity
        ]
      );
    }
  }
  async deleteById(rentalId) {
    await this.conn().query("DELETE FROM rentals WHERE rental_id = ?", [rentalId]);
  }
  async deleteByCustomerId(customerId) {
    await this.conn().query("DELETE FROM rentals WHERE customer_id = ?", [customerId]);
  }
}
function mapRow$1(r) {
  return {
    id: r.id,
    rentalId: r.rental_id,
    customerId: r.customer_id,
    provider: r.provider,
    gatewayOrderId: r.gateway_order_id,
    gatewayRequestId: r.gateway_request_id,
    amountVnd: r.amount_vnd,
    status: r.status,
    expiresAt: new Date(r.expires_at)
  };
}
class MysqlRentalPaymentRepository {
  pool;
  constructor(pool) {
    this.pool = pool;
  }
  conn() {
    return transactionContext.getStore() ?? this.pool;
  }
  async findLatestByRentalIds(rentalIds, customerId) {
    if (rentalIds.length === 0) return {};
    const query = customerId ? `SELECT rental_id, status, amount_vnd, gateway_order_id, paid_at
         FROM rental_payments
         WHERE rental_id IN (?) AND customer_id = ?
         ORDER BY id ASC` : `SELECT rental_id, status, amount_vnd, gateway_order_id, paid_at
         FROM rental_payments
         WHERE rental_id IN (?)
         ORDER BY id ASC`;
    const params = customerId ? [rentalIds, customerId] : [rentalIds];
    const [rows] = await this.conn().query(query, params);
    const result = {};
    for (const r of rows) {
      const rid = String(r["rental_id"]);
      const current = result[rid];
      if (current && current.status === "PAID") continue;
      result[rid] = {
        status: r["status"],
        amountVnd: Number(r["amount_vnd"]),
        gatewayOrderId: String(r["gateway_order_id"]),
        paidAt: r["paid_at"] ? new Date(r["paid_at"]) : null
      };
    }
    return result;
  }
  async countMomoAttemptsSince(customerId, since) {
    const [rows] = await this.conn().query(
      `SELECT COUNT(*) AS cnt FROM rental_payments
       WHERE customer_id = ? AND provider = 'momo' AND created_at >= ?`,
      [customerId, since]
    );
    return Number(rows[0]?.["cnt"] ?? 0);
  }
  async cancelPendingForRental(rentalId) {
    await this.conn().query(
      `UPDATE rental_payments SET status = 'CANCELLED', updated_at = NOW()
       WHERE rental_id = ? AND status = 'PENDING'`,
      [rentalId]
    );
  }
  async insertPending(row) {
    const [res] = await this.conn().query(
      `INSERT INTO rental_payments (
        rental_id, customer_id, provider, gateway_order_id, gateway_request_id,
        amount_vnd, status, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
      [
        row.rentalId,
        row.customerId,
        row.provider,
        row.gatewayOrderId,
        row.gatewayRequestId,
        row.amountVnd,
        row.expiresAt
      ]
    );
    return res.insertId;
  }
  async findByGatewayOrderId(gatewayOrderId) {
    const [rows] = await this.conn().query(
      `SELECT id, rental_id, customer_id, provider, gateway_order_id, gateway_request_id,
              amount_vnd, status, expires_at
       FROM rental_payments WHERE gateway_order_id = ? LIMIT 1`,
      [gatewayOrderId]
    );
    return rows.length > 0 ? mapRow$1(rows[0]) : null;
  }
  async updateFromIpn(id, patch) {
    await this.conn().query(
      `UPDATE rental_payments SET
        status = ?,
        paid_at = ?,
        gateway_trans_id = ?,
        gateway_result_code = ?,
        gateway_message = ?,
        raw_ipn_json = ?,
        updated_at = NOW()
       WHERE id = ? AND status = 'PENDING'`,
      [
        patch.status,
        patch.paidAt ?? null,
        patch.gatewayTransId ?? null,
        patch.gatewayResultCode ?? null,
        patch.gatewayMessage ?? null,
        patch.rawIpnJson ?? null,
        id
      ]
    );
  }
  async listPendingExpired(before, limit) {
    const [rows] = await this.conn().query(
      `SELECT id, rental_id, customer_id, provider, gateway_order_id, gateway_request_id,
              amount_vnd, status, expires_at
       FROM rental_payments
       WHERE status = 'PENDING' AND expires_at < ?
       ORDER BY expires_at ASC
       LIMIT ?`,
      [before, limit]
    );
    return rows.map(mapRow$1);
  }
  async setStatus(id, status) {
    await this.conn().query(`UPDATE rental_payments SET status = ?, updated_at = NOW() WHERE id = ?`, [
      status,
      id
    ]);
  }
}
function toYmd(val) {
  if (!val) return null;
  if (typeof val === "string") return val.slice(0, 10);
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(val).slice(0, 10);
}
function mapRow(r) {
  return {
    code: String(r["code"]),
    discountPercent: Number(r["discount_percent"]),
    description: String(r["description"]),
    isActive: Boolean(r["is_active"]),
    maxUses: r["max_uses"] !== null && r["max_uses"] !== void 0 ? Number(r["max_uses"]) : null,
    usedCount: Number(r["used_count"] || 0),
    expiresAt: toYmd(r["expires_at"]),
    createdAt: r["created_at"] ? new Date(r["created_at"]).toISOString() : (/* @__PURE__ */ new Date()).toISOString()
  };
}
class MysqlVoucherRepository {
  pool;
  constructor(pool) {
    this.pool = pool;
  }
  conn() {
    return transactionContext.getStore() ?? this.pool;
  }
  async findByCode(code) {
    const key = code.trim().toUpperCase();
    const [rows] = await this.conn().query(
      `SELECT code, discount_percent, description, is_active, max_uses, used_count, expires_at, created_at
       FROM vouchers
       WHERE code = ?
       LIMIT 1`,
      [key]
    );
    if (rows.length === 0) return null;
    return mapRow(rows[0]);
  }
  async listAll() {
    const [rows] = await this.conn().query(
      `SELECT code, discount_percent, description, is_active, max_uses, used_count, expires_at, created_at
       FROM vouchers
       ORDER BY code ASC`
    );
    return rows.map(mapRow);
  }
  async listActive(todayDateStr) {
    const [rows] = await this.conn().query(
      `SELECT code, discount_percent, description, is_active, max_uses, used_count, expires_at, created_at
       FROM vouchers
       WHERE is_active = 1
         AND (expires_at IS NULL OR expires_at >= ?)
         AND (max_uses IS NULL OR used_count < max_uses)
       ORDER BY code ASC`,
      [todayDateStr]
    );
    return rows.map(mapRow);
  }
  async save(input) {
    const code = input.code.trim().toUpperCase();
    await this.conn().query(
      `INSERT INTO vouchers (code, discount_percent, description, is_active, max_uses, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         discount_percent = VALUES(discount_percent),
         description      = VALUES(description),
         is_active        = VALUES(is_active),
         max_uses         = VALUES(max_uses),
         expires_at       = VALUES(expires_at),
         updated_at       = NOW()`,
      [
        code,
        input.discountPercent,
        input.description,
        input.isActive ? 1 : 0,
        input.maxUses,
        input.expiresAt
      ]
    );
    const saved = await this.findByCode(code);
    if (!saved) {
      throw new Error(`Failed to retrieve saved voucher ${code}`);
    }
    return saved;
  }
  async incrementUsedCount(code) {
    const key = code.trim().toUpperCase();
    const [result] = await this.conn().query(
      `UPDATE vouchers
       SET used_count = used_count + 1
       WHERE code = ?
         AND is_active = 1
         AND (max_uses IS NULL OR used_count < max_uses)`,
      [key]
    );
    if (result.affectedRows === 0) {
      throw new ValidationError("Mã giảm giá đã hết lượt sử dụng hoặc không còn hiệu lực.");
    }
  }
  async decrementUsedCount(code) {
    const key = code.trim().toUpperCase();
    await this.conn().query(
      `UPDATE vouchers SET used_count = GREATEST(0, used_count - 1) WHERE code = ?`,
      [key]
    );
  }
  async deleteByCode(code) {
    const key = code.trim().toUpperCase();
    const [result] = await this.conn().query(
      `DELETE FROM vouchers WHERE code = ?`,
      [key]
    );
    return result.affectedRows > 0;
  }
}
class MysqlWishlistRepository {
  pool;
  constructor(pool) {
    this.pool = pool;
  }
  conn() {
    return transactionContext.getStore() ?? this.pool;
  }
  async add(customerId, shoeId) {
    await this.conn().query(
      `INSERT IGNORE INTO customer_wishlist (customer_id, shoe_id) VALUES (?, ?)`,
      [customerId, shoeId]
    );
  }
  async remove(customerId, shoeId) {
    await this.conn().query(
      `DELETE FROM customer_wishlist WHERE customer_id = ? AND shoe_id = ?`,
      [customerId, shoeId]
    );
  }
  async clear(customerId) {
    await this.conn().query(`DELETE FROM customer_wishlist WHERE customer_id = ?`, [customerId]);
  }
  async listOrdered(customerId) {
    const [rows] = await this.conn().query(
      `SELECT shoe_id, created_at FROM customer_wishlist
       WHERE customer_id = ?
       ORDER BY created_at DESC`,
      [customerId]
    );
    return rows.map((r) => ({
      shoeId: r.shoe_id,
      createdAt: new Date(r.created_at)
    }));
  }
  async listShoeIds(customerId) {
    const [rows] = await this.conn().query(
      `SELECT shoe_id FROM customer_wishlist WHERE customer_id = ?`,
      [customerId]
    );
    return rows.map((r) => String(r["shoe_id"]));
  }
}
function toSqlDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
class MysqlRentalAvailabilityChecker {
  pool;
  deactivationPolicy;
  constructor(pool, deactivationPolicy) {
    this.pool = pool;
    this.deactivationPolicy = deactivationPolicy;
  }
  conn() {
    return transactionContext.getStore() ?? this.pool;
  }
  async ensureVariantAvailable(variantId, requestedQuantity, period) {
    const conn = this.conn();
    const [stockRows] = await conn.query(
      "SELECT on_hand_quantity FROM shoe_variants WHERE variant_id = ? FOR UPDATE",
      [variantId]
    );
    if (stockRows.length === 0) {
      throw new NotFoundError("Variant", variantId);
    }
    const totalStock = Number(stockRows[0]["on_hand_quantity"]);
    const alreadyDeactivatedQuantity = await this.getReservedQuantityForVariant(variantId, period);
    this.deactivationPolicy.ensureDeactivateForRental(
      variantId,
      totalStock,
      alreadyDeactivatedQuantity,
      requestedQuantity
    );
  }
  async getReservedQuantityForVariant(variantId, period) {
    const conn = this.conn();
    const [reservedRows] = await conn.query(
      `SELECT COALESCE(SUM(ri.quantity), 0) AS reserved_qty
       FROM rental_items ri
       JOIN rentals r ON r.rental_id = ri.rental_id
       WHERE ri.variant_id = ?
         AND r.status IN ('RESERVED', 'ACTIVE')
         AND r.start_date           <= ?
         AND r.expected_return_date >= ?`,
      [variantId, toSqlDate(period.endDate), toSqlDate(period.startDate)]
    );
    return Number(reservedRows[0]?.reserved_qty ?? 0);
  }
}
class MysqlTransactionManager {
  pool;
  constructor(pool) {
    this.pool = pool;
  }
  async runInTransaction(work) {
    const connection = await this.pool.getConnection();
    await connection.beginTransaction();
    return transactionContext.run(connection, async () => {
      try {
        const result = await work();
        await connection.commit();
        return result;
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }
    });
  }
}
class UuidGenerator {
  prefix;
  constructor(prefix) {
    if (!prefix || prefix.length !== 1) {
      throw new Error("UuidGenerator prefix must be exactly 1 character.");
    }
    this.prefix = prefix;
  }
  next() {
    return this.prefix + randomUUID().replace(/-/g, "").slice(0, 9);
  }
}
const FOLDER = "shoe-rental/shoes";
const CARD_TRANSFORM = { fetch_format: "auto", quality: "auto", width: 400, crop: "limit" };
const DETAIL_TRANSFORM = {
  fetch_format: "auto",
  quality: "auto",
  width: 1200,
  crop: "limit"
};
class CloudinaryShoeImageService {
  constructor() {
    v2.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME ?? "",
      api_key: process.env.CLOUDINARY_API_KEY ?? "",
      api_secret: process.env.CLOUDINARY_API_SECRET ?? "",
      secure: true
    });
  }
  ensureUploadConfigured() {
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
    if (!CLOUDINARY_CLOUD_NAME?.trim() || !CLOUDINARY_API_KEY?.trim() || !CLOUDINARY_API_SECRET?.trim()) {
      throw new BusinessRuleError(
        "CLOUDINARY_NOT_CONFIGURED",
        "Image upload requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET."
      );
    }
  }
  async uploadFromBuffer(buffer, mimeType) {
    this.ensureUploadConfigured();
    const dataUri = `data:${mimeType};base64,${buffer.toString("base64")}`;
    const result = await v2.uploader.upload(dataUri, {
      folder: FOLDER,
      resource_type: "image",
      overwrite: false
    });
    return { publicId: result.public_id };
  }
  async destroyByPublicId(publicId) {
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
    if (!CLOUDINARY_CLOUD_NAME?.trim() || !CLOUDINARY_API_KEY?.trim() || !CLOUDINARY_API_SECRET?.trim()) {
      return;
    }
    try {
      await v2.uploader.destroy(publicId, { resource_type: "image", invalidate: true });
    } catch {
    }
  }
  urlForCard(publicId) {
    if (!publicId) return null;
    if (!process.env.CLOUDINARY_CLOUD_NAME?.trim()) return null;
    return v2.url(publicId, {
      secure: true,
      transformation: [CARD_TRANSFORM]
    });
  }
  urlForDetail(publicId) {
    if (!publicId) return null;
    if (!process.env.CLOUDINARY_CLOUD_NAME?.trim()) return null;
    return v2.url(publicId, {
      secure: true,
      transformation: [DETAIL_TRANSFORM]
    });
  }
}
function isAuthRole(value) {
  return value === "admin" || value === "customer";
}
class JoseAccessTokenService {
  encodedKey;
  expiresIn;
  constructor(secret, expiresIn) {
    if (!secret || secret.length < 16) {
      throw new Error("JWT_SECRET must be set and at least 16 characters long.");
    }
    this.encodedKey = new TextEncoder().encode(secret);
    this.expiresIn = expiresIn;
  }
  async createAccessToken(payload) {
    const body = { role: payload.role };
    if (payload.customerId) {
      body.customerId = payload.customerId;
    }
    return new SignJWT(body).setProtectedHeader({ alg: "HS256" }).setSubject(payload.sub).setIssuedAt().setExpirationTime(this.expiresIn).sign(this.encodedKey);
  }
  async verifyAccessToken(token) {
    const { payload } = await jwtVerify(token, this.encodedKey);
    const sub = payload.sub;
    const role = payload.role;
    const customerIdRaw = payload.customerId;
    if (typeof sub !== "string" || !isAuthRole(role)) {
      throw new Error("Invalid access token payload.");
    }
    const out = { sub, role };
    if (typeof customerIdRaw === "string" && customerIdRaw.length > 0) {
      out.customerId = customerIdRaw;
    }
    return out;
  }
}
class ActivateRentalService {
  rentalRepository;
  constructor(rentalRepository) {
    this.rentalRepository = rentalRepository;
  }
  async execute(request) {
    if (!request.rentalId || request.rentalId.trim().length === 0) {
      throw new ValidationError("Rental id is required.");
    }
    const rental = await this.rentalRepository.findById(request.rentalId);
    if (!rental) {
      throw new NotFoundError("Rental", request.rentalId);
    }
    rental.activate(request.activatedAt ?? /* @__PURE__ */ new Date());
    await this.rentalRepository.save(rental);
    return {
      rentalId: rental.id,
      customerId: rental.customerId,
      status: rental.status,
      activatedAt: rental.activatedAt
    };
  }
}
class AddShoeService {
  shoeRepository;
  idGenerator;
  constructor(shoeRepository, idGenerator) {
    this.shoeRepository = shoeRepository;
    this.idGenerator = idGenerator;
  }
  async execute(request) {
    if (!request.variants || request.variants.length === 0) {
      throw new ValidationError("At least one variant is required.");
    }
    const shoe = new Shoe({
      id: this.idGenerator.next(),
      name: request.name,
      brand: request.brand,
      category: request.category,
      description: request.description,
      pricePerDay: request.pricePerDay,
      imagePublicId: request.imagePublicId ?? null
    });
    for (const variantRequest of request.variants) {
      shoe.addVariant(
        new ShoeVariant({
          id: this.idGenerator.next(),
          size: variantRequest.size,
          color: variantRequest.color,
          totalQuantity: variantRequest.totalQuantity
        })
      );
    }
    await this.shoeRepository.save(shoe);
    return {
      shoeId: shoe.id,
      name: shoe.name,
      brand: shoe.brand,
      category: shoe.category,
      pricePerDay: shoe.pricePerDay,
      variantCount: shoe.variants.length,
      variantIds: shoe.variants.map((v) => v.id),
      imagePublicId: shoe.imagePublicId
    };
  }
}
class DeactivateShoeService {
  shoeRepository;
  constructor(shoeRepository) {
    this.shoeRepository = shoeRepository;
  }
  async execute(request) {
    if (!request.shoeId || request.shoeId.trim().length === 0) {
      throw new ValidationError("Shoe id is required.");
    }
    const shoe = await this.shoeRepository.findById(request.shoeId);
    if (!shoe) {
      throw new NotFoundError("Shoe", request.shoeId);
    }
    shoe.deactivate();
    await this.shoeRepository.save(shoe);
    return {
      shoeId: shoe.id,
      isActive: shoe.isActive
    };
  }
}
async function buildShoeDetailResponse(shoe, images, catalog) {
  const catalogIds = await catalog.getShoeCatalogIds(shoe.id);
  return {
    shoeId: shoe.id,
    name: shoe.name,
    brand: shoe.brand,
    category: shoe.category,
    brandId: catalogIds?.brandId ?? null,
    categoryId: catalogIds?.categoryId ?? null,
    description: shoe.description,
    pricePerDay: shoe.pricePerDay,
    isActive: shoe.isActive,
    imagePublicId: shoe.imagePublicId,
    imageUrlCard: images.urlForCard(shoe.imagePublicId),
    imageUrlDetail: images.urlForDetail(shoe.imagePublicId),
    variants: shoe.variants.map((v) => {
      const colorId = catalogIds?.variants.find((x) => x.variantId === v.id)?.colorId ?? null;
      return {
        variantId: v.id,
        size: v.size,
        color: v.color,
        colorId,
        totalQuantity: v.totalQuantity,
        availableQuantity: v.availableQuantity
      };
    })
  };
}
class UpdateShoeService {
  shoeRepository;
  idGenerator;
  shoeImages;
  catalog;
  constructor(shoeRepository, idGenerator, shoeImages, catalog) {
    this.shoeRepository = shoeRepository;
    this.idGenerator = idGenerator;
    this.shoeImages = shoeImages;
    this.catalog = catalog;
  }
  async execute(request) {
    const shoe = await this.shoeRepository.findById(request.shoeId);
    if (!shoe) {
      throw new NotFoundError("Shoe", request.shoeId);
    }
    const previousImagePublicId = shoe.imagePublicId;
    const hasPatch = request.name !== void 0 || request.brand !== void 0 || request.category !== void 0 || request.description !== void 0 || request.pricePerDay !== void 0 || request.isActive !== void 0 || request.imagePublicId !== void 0 || request.variantQuantityUpdates && request.variantQuantityUpdates.length > 0 || request.newVariants && request.newVariants.length > 0;
    if (!hasPatch) {
      throw new ValidationError("No changes provided.");
    }
    if (request.imagePublicId !== void 0) {
      shoe.changeImagePublicId(request.imagePublicId);
    }
    if (request.name !== void 0) shoe.rename(request.name);
    if (request.brand !== void 0) shoe.changeBrand(request.brand);
    if (request.category !== void 0) shoe.changeCategory(request.category);
    if (request.description !== void 0) shoe.changeDescription(request.description);
    if (request.pricePerDay !== void 0) shoe.changePricePerDay(request.pricePerDay);
    if (request.isActive === true) shoe.activate();
    if (request.isActive === false) shoe.deactivate();
    for (const u of request.variantQuantityUpdates ?? []) {
      shoe.changeVariantOnHandQuantity(u.variantId, u.totalQuantity);
    }
    for (const nv of request.newVariants ?? []) {
      shoe.addVariant(
        new ShoeVariant({
          id: this.idGenerator.next(),
          size: nv.size,
          color: nv.color,
          totalQuantity: nv.totalQuantity
        })
      );
    }
    await this.shoeRepository.save(shoe);
    const reloaded = await this.shoeRepository.findById(request.shoeId);
    const finalShoe = reloaded ?? shoe;
    if (previousImagePublicId && previousImagePublicId !== finalShoe.imagePublicId) {
      await this.shoeImages.destroyByPublicId(previousImagePublicId);
    }
    return buildShoeDetailResponse(finalShoe, this.shoeImages, this.catalog);
  }
}
class GetCustomerService {
  customerRepository;
  constructor(customerRepository) {
    this.customerRepository = customerRepository;
  }
  async execute(request) {
    if (!request.customerId || request.customerId.trim().length === 0) {
      throw new ValidationError("Customer id is required.");
    }
    const customer = await this.customerRepository.findById(request.customerId);
    if (!customer) {
      throw new NotFoundError("Customer", request.customerId);
    }
    return {
      customerId: customer.id,
      fullName: customer.fullName,
      email: customer.email,
      phone: customer.phone,
      rank: customer.rank,
      isActive: customer.isActive,
      currentRentedItems: customer.currentRentedItems
    };
  }
}
function getVietnamTodayDate$1(now = /* @__PURE__ */ new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")?.value ?? now.getFullYear());
  const m = Number(parts.find((p) => p.type === "month")?.value ?? now.getMonth() + 1);
  const d = Number(parts.find((p) => p.type === "day")?.value ?? now.getDate());
  return new Date(y, m - 1, d);
}
class GetRentalService {
  rentalRepository;
  constructor(rentalRepository) {
    this.rentalRepository = rentalRepository;
  }
  async execute(request) {
    if (!request.rentalId || request.rentalId.trim().length === 0) {
      throw new ValidationError("Rental id is required.");
    }
    const rental = await this.rentalRepository.findById(request.rentalId);
    if (!rental) {
      throw new NotFoundError("Rental", request.rentalId);
    }
    if (request.requestingCustomerId !== void 0) {
      const cid = request.requestingCustomerId.trim();
      if (rental.customerId !== cid) {
        throw new NotFoundError("Rental", request.rentalId);
      }
    }
    const now = getVietnamTodayDate$1();
    const isOverdue = rental.isOverdue(now);
    const endNorm = new Date(
      rental.period.endDate.getFullYear(),
      rental.period.endDate.getMonth(),
      rental.period.endDate.getDate()
    ).getTime();
    const nowNorm = now.getTime();
    const overdueDays = isOverdue ? Math.max(0, Math.floor((nowNorm - endNorm) / 864e5)) : 0;
    const dailyRate = rental.basePrice / rental.period.durationInDays;
    const estimatedLateFee = isOverdue ? Math.round(overdueDays * dailyRate * 0.5) : rental.lateFee;
    return {
      rentalId: rental.id,
      customerId: rental.customerId,
      status: rental.status,
      totalItems: rental.totalItems,
      basePrice: rental.basePrice,
      depositAmount: rental.depositAmount,
      lateFee: rental.lateFee,
      totalAmount: rental.totalAmount,
      startDate: rental.period.startDate,
      endDate: rental.period.endDate,
      isOverdue,
      overdueDays,
      estimatedLateFee,
      items: rental.items.map((item) => ({
        shoeId: item.shoeId,
        variantId: item.variantId,
        shoeName: item.shoeName,
        size: item.size,
        color: item.color,
        pricePerDay: item.pricePerDay,
        quantity: item.quantity
      })),
      note: rental.note,
      createdAt: rental.createdAt,
      activatedAt: rental.activatedAt,
      returnedAt: rental.returnedAt,
      cancelledAt: rental.cancelledAt
    };
  }
}
class GetShoeService {
  shoeRepository;
  shoeImages;
  catalog;
  constructor(shoeRepository, shoeImages, catalog) {
    this.shoeRepository = shoeRepository;
    this.shoeImages = shoeImages;
    this.catalog = catalog;
  }
  async execute(request) {
    if (!request.shoeId || request.shoeId.trim().length === 0) {
      throw new ValidationError("Shoe id is required.");
    }
    const shoe = await this.shoeRepository.findById(request.shoeId);
    if (!shoe) {
      throw new NotFoundError("Shoe", request.shoeId);
    }
    return buildShoeDetailResponse(shoe, this.shoeImages, this.catalog);
  }
}
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;
function normalizePage(page) {
  if (page === void 0 || !Number.isFinite(page)) return 1;
  return Math.max(1, Math.floor(page));
}
function normalizePageSize(size) {
  if (size === void 0 || !Number.isFinite(size)) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(size)));
}
function totalPages(total, pageSize) {
  if (pageSize <= 0) return 0;
  return Math.max(1, Math.ceil(total / pageSize));
}
class ListCustomersService {
  customerRepository;
  constructor(customerRepository) {
    this.customerRepository = customerRepository;
  }
  async execute(request) {
    const paginate = request?.page !== void 0;
    const page = normalizePage(request?.page);
    const pageSize = normalizePageSize(request?.pageSize);
    const limit = paginate ? pageSize : void 0;
    const offset = paginate ? (page - 1) * pageSize : void 0;
    const { search } = request ?? {};
    const searchOpt = search !== void 0 && search.trim() !== "" ? { search: search.trim() } : {};
    const { items, total } = await this.customerRepository.findAll(
      limit !== void 0 ? { limit, offset, ...searchOpt } : Object.keys(searchOpt).length > 0 ? { ...searchOpt } : void 0
    );
    const effectivePageSize = paginate ? pageSize : Math.max(total, 1);
    return {
      customers: items.map((c) => ({
        customerId: c.id,
        fullName: c.fullName,
        email: c.email,
        phone: c.phone,
        rank: c.rank,
        isActive: c.isActive,
        currentRentedItems: c.currentRentedItems
      })),
      total,
      page: paginate ? page : 1,
      pageSize: effectivePageSize,
      totalPages: totalPages(total, effectivePageSize)
    };
  }
}
function getVietnamTodayDate(now = /* @__PURE__ */ new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")?.value ?? now.getFullYear());
  const m = Number(parts.find((p) => p.type === "month")?.value ?? now.getMonth() + 1);
  const d = Number(parts.find((p) => p.type === "day")?.value ?? now.getDate());
  return new Date(y, m - 1, d);
}
class ListRentalsService {
  rentalRepository;
  constructor(rentalRepository) {
    this.rentalRepository = rentalRepository;
  }
  async execute(request) {
    const paginate = request?.page !== void 0;
    const page = normalizePage(request?.page);
    const pageSize = normalizePageSize(request?.pageSize);
    const limit = paginate ? pageSize : void 0;
    const offset = paginate ? (page - 1) * pageSize : void 0;
    const { customerId, status, startDateFrom, startDateTo, amountBucket, search } = request ?? {};
    const { items, total } = await this.rentalRepository.findList({
      ...customerId ? { customerId } : {},
      ...status ? { status } : {},
      ...startDateFrom ? { startDateFrom } : {},
      ...startDateTo ? { startDateTo } : {},
      ...amountBucket ? { amountBucket } : {},
      ...search !== void 0 && search.trim() !== "" ? { search: search.trim() } : {},
      ...limit !== void 0 ? { limit, offset } : {}
    });
    const effectivePageSize = paginate ? pageSize : Math.max(total, 1);
    const now = getVietnamTodayDate();
    const nowNorm = now.getTime();
    return {
      rentals: items.map((r) => {
        const isOverdue = r.isOverdue(now);
        const endNorm = new Date(
          r.period.endDate.getFullYear(),
          r.period.endDate.getMonth(),
          r.period.endDate.getDate()
        ).getTime();
        const overdueDays = isOverdue ? Math.max(0, Math.floor((nowNorm - endNorm) / 864e5)) : 0;
        const dailyRate = r.basePrice / r.period.durationInDays;
        const estimatedLateFee = isOverdue ? Math.round(overdueDays * dailyRate * 0.5) : r.lateFee;
        return {
          rentalId: r.id,
          customerId: r.customerId,
          status: r.status,
          totalItems: r.totalItems,
          basePrice: r.basePrice,
          depositAmount: r.depositAmount,
          totalAmount: r.totalAmount,
          startDate: r.period.startDate,
          endDate: r.period.endDate,
          isOverdue,
          overdueDays,
          estimatedLateFee
        };
      }),
      total,
      page: paginate ? page : 1,
      pageSize: effectivePageSize,
      totalPages: totalPages(total, effectivePageSize)
    };
  }
}
class ListShoesService {
  shoeRepository;
  shoeImages;
  constructor(shoeRepository, shoeImages) {
    this.shoeRepository = shoeRepository;
    this.shoeImages = shoeImages;
  }
  async execute(request) {
    const paginate = request?.page !== void 0;
    const page = normalizePage(request?.page);
    const pageSize = normalizePageSize(request?.pageSize);
    const limit = paginate ? pageSize : void 0;
    const offset = paginate ? (page - 1) * pageSize : void 0;
    const { priceBucket, stockBucket } = request ?? {};
    const { items, total } = await this.shoeRepository.findAll({
      ...priceBucket !== void 0 ? { priceBucket } : {},
      ...stockBucket !== void 0 ? { stockBucket } : {},
      ...limit !== void 0 ? { limit, offset } : {}
    });
    const effectivePageSize = paginate ? pageSize : Math.max(total, 1);
    return {
      shoes: items.map((shoe) => ({
        shoeId: shoe.id,
        name: shoe.name,
        brand: shoe.brand,
        category: shoe.category,
        pricePerDay: shoe.pricePerDay,
        variantCount: shoe.variants.length,
        isActive: shoe.isActive,
        unitsInStock: shoe.variants.reduce((sum, v) => sum + v.totalQuantity, 0),
        imagePublicId: shoe.imagePublicId,
        imageUrl: this.shoeImages.urlForCard(shoe.imagePublicId),
        variants: shoe.variants.map((v) => ({
          variantId: v.id,
          size: v.size,
          color: v.color,
          totalQuantity: v.totalQuantity
        }))
      })),
      total,
      page: paginate ? page : 1,
      pageSize: effectivePageSize,
      totalPages: totalPages(total, effectivePageSize)
    };
  }
}
class CancelRentalService {
  rentalRepository;
  customerRepository;
  voucherRepository;
  constructor(rentalRepository, customerRepository, voucherRepository) {
    this.rentalRepository = rentalRepository;
    this.customerRepository = customerRepository;
    this.voucherRepository = voucherRepository;
  }
  async execute(request) {
    if (!request.rentalId || request.rentalId.trim().length === 0) {
      throw new ValidationError("Rental id is required.");
    }
    const rental = await this.rentalRepository.findById(request.rentalId);
    if (!rental) {
      throw new NotFoundError("Rental", request.rentalId);
    }
    const totalItems = rental.totalItems;
    const cancelledAt = request.cancelledAt ?? /* @__PURE__ */ new Date();
    if (request.requestingCustomerId !== void 0) {
      rental.assertOwnedBy(request.requestingCustomerId, "You cannot cancel this rental.");
      rental.assertCustomerCancellationAllowed(cancelledAt);
    }
    const originalNote = rental.note ?? "";
    rental.cancel(cancelledAt, request.note);
    const customer = await this.customerRepository.findById(rental.customerId);
    if (customer) {
      customer.completeRental(totalItems);
      await this.customerRepository.save(customer);
    }
    await this.rentalRepository.save(rental);
    if (this.voucherRepository) {
      const match = originalNote.match(/Voucher\s+([A-Za-z0-9_-]+)\s+-\d+%/i);
      if (match) {
        await this.voucherRepository.decrementUsedCount(match[1].toUpperCase());
      }
    }
    return {
      rentalId: rental.id,
      customerId: rental.customerId,
      status: rental.status,
      totalItems,
      cancelledAt: rental.cancelledAt
    };
  }
}
const VOUCHER_MAP = {
  WELCOME10: { code: "WELCOME10", discountPercent: 10, description: "Giảm 10% cho đơn thuê" },
  GIAM10: { code: "WELCOME10", discountPercent: 10, description: "Giảm 10% cho đơn thuê" },
  SHOE20: { code: "SHOE20", discountPercent: 20, description: "Ưu đãi VIP giảm 20%" },
  VIP20: { code: "SHOE20", discountPercent: 20, description: "Ưu đãi VIP giảm 20%" },
  GIAM5: { code: "GIAM5", discountPercent: 5, description: "Giảm 5% phí thuê giày" },
  FREESHIP5: { code: "GIAM5", discountPercent: 5, description: "Giảm 5% phí thuê giày" }
};
function resolveVoucher(rawCode) {
  if (!rawCode) return null;
  const normalized = rawCode.trim().toUpperCase();
  if (!normalized) return null;
  const found = VOUCHER_MAP[normalized];
  if (!found) {
    throw new ValidationError("Mã giảm giá không hợp lệ hoặc đã hết hạn.");
  }
  return found;
}
function getVietnamTodayYmd$2(now = /* @__PURE__ */ new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value ?? String(now.getFullYear());
  const m = parts.find((p) => p.type === "month")?.value ?? String(now.getMonth() + 1).padStart(2, "0");
  const d = parts.find((p) => p.type === "day")?.value ?? String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
class CreateRentalService {
  customerRepository;
  shoeRepository;
  rentalRepository;
  availabilityChecker;
  idGenerator;
  voucherRepository;
  constructor(customerRepository, shoeRepository, rentalRepository, availabilityChecker, idGenerator, voucherRepository) {
    this.customerRepository = customerRepository;
    this.shoeRepository = shoeRepository;
    this.rentalRepository = rentalRepository;
    this.availabilityChecker = availabilityChecker;
    this.idGenerator = idGenerator;
    this.voucherRepository = voucherRepository;
  }
  async execute(request) {
    const rentalPeriod = new RentalPeriod(request.startDate, request.endDate);
    const totalRequestedQuantity = request.items.reduce((sum, item) => sum + item.quantity, 0);
    const customer = await this.customerRepository.findById(request.customerId);
    if (!customer) throw new NotFoundError("Customer", request.customerId);
    const rankDiscount = getDiscountPercentByRank(customer.rank);
    let appliedVoucherCode = null;
    let voucherDiscountPercent = 0;
    const trimmedCode = request.voucherCode?.trim();
    if (trimmedCode) {
      if (this.voucherRepository) {
        const normalized = trimmedCode.toUpperCase();
        const v = await this.voucherRepository.findByCode(normalized);
        const todayStr = getVietnamTodayYmd$2();
        const isValid = v && v.isActive && (!v.expiresAt || todayStr <= v.expiresAt) && (v.maxUses === null || v.usedCount < v.maxUses);
        if (!isValid) {
          throw new ValidationError("Mã giảm giá không hợp lệ hoặc đã hết hạn.");
        }
        appliedVoucherCode = v.code;
        voucherDiscountPercent = v.discountPercent;
      } else {
        const v = resolveVoucher(trimmedCode);
        if (v) {
          appliedVoucherCode = v.code;
          voucherDiscountPercent = v.discountPercent;
        }
      }
    }
    const totalDiscountPercent = Math.min(50, rankDiscount + voucherDiscountPercent);
    const loadedShoes = /* @__PURE__ */ new Map();
    const originalRentalItems = [];
    const seenVariants = /* @__PURE__ */ new Set();
    for (const item of request.items) {
      const vid = item.variantId.trim();
      if (seenVariants.has(vid)) {
        throw new ValidationError(
          `Duplicate variant ${vid} in the same rental is not allowed.`
        );
      }
      seenVariants.add(vid);
    }
    const sortedItems = [...request.items].sort(
      (a, b) => a.variantId.trim().localeCompare(b.variantId.trim())
    );
    for (const requestedItem of sortedItems) {
      const shoe = await this.loadShoeForVariant(requestedItem.variantId, loadedShoes);
      if (!shoe) throw new NotFoundError("Variant", requestedItem.variantId);
      await this.availabilityChecker.ensureVariantAvailable(
        requestedItem.variantId,
        requestedItem.quantity,
        rentalPeriod
      );
    }
    for (const requestedItem of request.items) {
      const shoe = await this.loadShoeForVariant(requestedItem.variantId, loadedShoes);
      if (!shoe) throw new NotFoundError("Variant", requestedItem.variantId);
      originalRentalItems.push(shoe.createRentalItem(requestedItem.variantId, requestedItem.quantity));
    }
    const finalRentalItems = totalDiscountPercent > 0 ? originalRentalItems.map((item) => item.withDiscountPercent(totalDiscountPercent)) : originalRentalItems;
    const originalBasePrice = originalRentalItems.reduce((sum, item) => sum + item.pricePerDay * item.quantity, 0) * rentalPeriod.durationInDays;
    const noteText = Rental.formatDiscountNote(
      request.note,
      customer.rank,
      rankDiscount,
      appliedVoucherCode,
      voucherDiscountPercent
    );
    const rental = new Rental({
      id: this.idGenerator.next(),
      customerId: customer.id,
      items: finalRentalItems,
      period: rentalPeriod,
      note: noteText
    });
    customer.registerRental(totalRequestedQuantity);
    await this.customerRepository.save(customer);
    await this.rentalRepository.save(rental);
    if (appliedVoucherCode && this.voucherRepository) {
      await this.voucherRepository.incrementUsedCount(appliedVoucherCode);
    }
    const discountAmount = Math.max(0, originalBasePrice - rental.basePrice);
    return {
      rentalId: rental.id,
      customerId: rental.customerId,
      status: rental.status,
      totalItems: rental.totalItems,
      basePrice: rental.basePrice,
      totalAmount: rental.totalAmount,
      startDate: rental.period.startDate,
      endDate: rental.period.endDate,
      originalBasePrice,
      discountPercent: totalDiscountPercent,
      discountAmount,
      customerRank: customer.rank,
      appliedVoucher: appliedVoucherCode
    };
  }
  async loadShoeForVariant(variantId, loadedShoes) {
    for (const shoe2 of loadedShoes.values()) {
      if (shoe2 && shoe2.findVariantById(variantId)) {
        return shoe2;
      }
    }
    const shoe = await this.shoeRepository.findByVariantId(variantId);
    if (shoe) {
      loadedShoes.set(shoe.id, shoe);
    }
    return shoe;
  }
}
class RegisterCustomerService {
  customerRepository;
  idGenerator;
  constructor(customerRepository, idGenerator) {
    this.customerRepository = customerRepository;
    this.idGenerator = idGenerator;
  }
  async execute(request) {
    const existing = await this.customerRepository.findByEmail(request.email);
    if (existing) {
      throw new ConflictError(
        "EMAIL_CONFLICT",
        `Email ${request.email.trim().toLowerCase()} is already registered.`
      );
    }
    const customer = new Customer({
      id: this.idGenerator.next(),
      fullName: request.fullName,
      email: request.email,
      phone: request.phone,
      rank: request.rank
    });
    await this.customerRepository.save(customer);
    return {
      customerId: customer.id,
      fullName: customer.fullName,
      email: customer.email,
      phone: customer.phone,
      rank: customer.rank
    };
  }
}
class ReturnRentalService {
  rentalRepository;
  customerRepository;
  constructor(rentalRepository, customerRepository) {
    this.rentalRepository = rentalRepository;
    this.customerRepository = customerRepository;
  }
  async execute(request) {
    if (!request.rentalId || request.rentalId.trim().length === 0) {
      throw new ValidationError("Rental id is required.");
    }
    const rental = await this.rentalRepository.findById(request.rentalId);
    if (!rental) {
      throw new NotFoundError("Rental", request.rentalId);
    }
    const totalItems = rental.totalItems;
    const returnedAt = request.returnedAt ?? /* @__PURE__ */ new Date();
    const customer = await this.customerRepository.findById(rental.customerId);
    const cleanDamageFee = Math.round(request.damageFee ?? 0);
    rental.completeReturn(returnedAt, request.note, request.damageFee ?? 0);
    if (customer) {
      customer.completeRental(totalItems);
    }
    await this.rentalRepository.save(rental);
    if (customer) {
      const returnedList = await this.rentalRepository.findList({
        customerId: customer.id,
        status: RentalStatus.RETURNED
      });
      const totalSpent = returnedList.items.reduce((sum, r) => sum + r.totalAmount, 0);
      customer.upgradeRankForTotalSpent(totalSpent);
      await this.customerRepository.save(customer);
    }
    return {
      rentalId: rental.id,
      customerId: rental.customerId,
      status: rental.status,
      totalItems,
      basePrice: rental.basePrice,
      lateFee: rental.lateFee,
      damageFee: cleanDamageFee,
      depositAmount: rental.depositAmount,
      totalAmount: rental.totalAmount,
      returnedAt: rental.returnedAt
    };
  }
}
class WishlistService {
  shoeRepository;
  wishlistRepository;
  shoeImages;
  constructor(shoeRepository, wishlistRepository, shoeImages) {
    this.shoeRepository = shoeRepository;
    this.wishlistRepository = wishlistRepository;
    this.shoeImages = shoeImages;
  }
  async listForCustomer(customerId) {
    const ordered = await this.wishlistRepository.listOrdered(customerId);
    const items = [];
    for (const entry of ordered) {
      const shoe = await this.shoeRepository.findById(entry.shoeId);
      if (!shoe || !shoe.isActive) continue;
      items.push({
        shoeId: shoe.id,
        name: shoe.name,
        brand: shoe.brand,
        category: shoe.category,
        pricePerDay: shoe.pricePerDay,
        imagePublicId: shoe.imagePublicId,
        imageUrl: this.shoeImages.urlForCard(shoe.imagePublicId),
        addedAt: entry.createdAt.toISOString()
      });
    }
    return { items };
  }
  async getShoeIds(customerId) {
    const shoeIds = await this.wishlistRepository.listShoeIds(customerId);
    return { shoeIds };
  }
  async add(customerId, shoeId) {
    const shoe = await this.shoeRepository.findById(shoeId);
    if (!shoe || !shoe.isActive) {
      throw new NotFoundError("Shoe", shoeId);
    }
    await this.wishlistRepository.add(customerId, shoe.id);
  }
  async remove(customerId, shoeId) {
    await this.wishlistRepository.remove(customerId, shoeId);
  }
  async clear(customerId) {
    await this.wishlistRepository.clear(customerId);
  }
}
class UnauthorizedError extends DomainError {
  constructor(code = "UNAUTHORIZED", message = "Authentication failed.") {
    super(code, message);
  }
}
function roleIdToAuthRole$1(roleId) {
  if (roleId === 2) return "admin";
  return "customer";
}
class LoginUserService {
  systemUsers;
  accessTokenService;
  constructor(systemUsers, accessTokenService) {
    this.systemUsers = systemUsers;
    this.accessTokenService = accessTokenService;
  }
  async execute(request) {
    const email = request.email.trim().toLowerCase();
    const password = request.password;
    const user = await this.systemUsers.findByEmail(email);
    if (!user || !user.isActive) {
      throw new UnauthorizedError("AUTH_INVALID_CREDENTIALS", "Invalid email or password.");
    }
    const hash = user.passwordHash?.trim() ?? "";
    if (!hash || !bcrypt.compareSync(password, hash)) {
      throw new UnauthorizedError("AUTH_INVALID_CREDENTIALS", "Invalid email or password.");
    }
    const role = roleIdToAuthRole$1(user.roleId);
    const tokenPayload = {
      sub: user.userId,
      role,
      ...user.customerId ? { customerId: user.customerId } : {}
    };
    const accessToken = await this.accessTokenService.createAccessToken(tokenPayload);
    return {
      accessToken,
      tokenType: "Bearer",
      role,
      customerId: user.customerId
    };
  }
}
const USER_ROLE_ID = 1;
function normalizeFullName(raw) {
  return raw.trim().replace(/\s+/g, " ");
}
function normalizeSignupPhone(raw) {
  const t = raw.trim();
  if (!t) return null;
  const digits = t.replace(/[\s().-]/g, "");
  return digits.length > 0 ? digits : null;
}
class RegisterUserService {
  transactionManager;
  customerRepository;
  registerCustomer;
  systemUsers;
  userIdGenerator;
  accessTokenService;
  constructor(transactionManager, customerRepository, registerCustomer, systemUsers, userIdGenerator, accessTokenService) {
    this.transactionManager = transactionManager;
    this.customerRepository = customerRepository;
    this.registerCustomer = registerCustomer;
    this.systemUsers = systemUsers;
    this.userIdGenerator = userIdGenerator;
    this.accessTokenService = accessTokenService;
  }
  async execute(request) {
    const email = request.email.trim().toLowerCase();
    const fullName = normalizeFullName(request.fullName);
    const phoneForUser = normalizeSignupPhone(request.phone);
    const existingUser = await this.systemUsers.findByEmail(email);
    if (existingUser) {
      throw new ConflictError("EMAIL_CONFLICT", "An account with this email already exists.");
    }
    const passwordHash = bcrypt.hashSync(request.password, 10);
    const { customerId } = await this.transactionManager.runInTransaction(async () => {
      const existingCustomer = await this.customerRepository.findByEmail(email);
      if (existingCustomer) {
        if (!existingCustomer.isActive) {
          throw new ForbiddenError(
            "CUSTOMER_INACTIVE",
            "This customer profile has been deactivated."
          );
        }
        existingCustomer.rename(fullName);
        existingCustomer.changePhone(phoneForUser);
        await this.customerRepository.save(existingCustomer);
        await this.systemUsers.save({
          userId: this.userIdGenerator.next(),
          fullName,
          email,
          phone: phoneForUser,
          roleId: USER_ROLE_ID,
          passwordHash,
          customerId: existingCustomer.id,
          isActive: true
        });
        return { customerId: existingCustomer.id };
      }
      const cust = await this.registerCustomer.execute({
        fullName,
        email,
        phone: request.phone.trim(),
        rank: void 0
      });
      await this.systemUsers.save({
        userId: this.userIdGenerator.next(),
        fullName,
        email,
        phone: phoneForUser,
        roleId: USER_ROLE_ID,
        passwordHash,
        customerId: cust.customerId,
        isActive: true
      });
      return { customerId: cust.customerId };
    });
    const user = await this.systemUsers.findByEmail(email);
    if (!user) {
      throw new Error("Registration failed: user record missing after commit.");
    }
    const accessToken = await this.accessTokenService.createAccessToken({
      sub: user.userId,
      role: "customer",
      customerId
    });
    return {
      accessToken,
      tokenType: "Bearer",
      role: "customer",
      customerId
    };
  }
}
function roleIdToAuthRole(roleId) {
  if (roleId === 2) return "admin";
  return "customer";
}
function normalizePhone$2(raw) {
  const t = raw.trim();
  if (t.length === 0) return null;
  return t.replace(/[\s().-]/g, "") || null;
}
class UpdateProfileService {
  transactionManager;
  systemUsers;
  customers;
  constructor(transactionManager, systemUsers, customers) {
    this.transactionManager = transactionManager;
    this.systemUsers = systemUsers;
    this.customers = customers;
  }
  async execute(request) {
    const emailNorm = request.email.trim().toLowerCase();
    const phoneNorm = normalizePhone$2(request.phone);
    const current = await this.systemUsers.findById(request.userId);
    if (!current || !current.isActive) {
      throw new ValidationError("User account not found or inactive.");
    }
    const otherUser = await this.systemUsers.findByEmail(emailNorm);
    if (otherUser && otherUser.userId !== request.userId) {
      throw new ConflictError("EMAIL_CONFLICT", "An account with this email already exists.");
    }
    if (current.customerId) {
      const otherCustomer = await this.customers.findByEmail(emailNorm);
      if (otherCustomer && otherCustomer.id !== current.customerId) {
        throw new ConflictError(
          "EMAIL_CONFLICT",
          "This email is already used by another customer profile."
        );
      }
    }
    await this.transactionManager.runInTransaction(async () => {
      await this.systemUsers.updateContactFields(request.userId, {
        fullName: request.fullName.trim(),
        email: emailNorm,
        phone: phoneNorm
      });
      if (current.customerId) {
        const customer = await this.customers.findById(current.customerId);
        if (!customer) {
          throw new ValidationError("Linked customer profile was not found.");
        }
        customer.rename(request.fullName.trim());
        customer.changeEmail(emailNorm);
        customer.changePhone(phoneNorm);
        await this.customers.save(customer);
      }
    });
    const updated = await this.systemUsers.findById(request.userId);
    if (!updated) {
      throw new Error("Profile update failed: user record missing after commit.");
    }
    return {
      sub: updated.userId,
      role: roleIdToAuthRole(updated.roleId),
      customerId: updated.customerId,
      fullName: updated.fullName,
      email: updated.email,
      phone: updated.phone
    };
  }
}
class ChangePasswordService {
  systemUsers;
  constructor(systemUsers) {
    this.systemUsers = systemUsers;
  }
  async execute(request) {
    const user = await this.systemUsers.findById(request.userId);
    if (!user || !user.isActive) {
      throw new ValidationError("User account not found or inactive.");
    }
    const hash = user.passwordHash?.trim() ?? "";
    if (!hash) {
      throw new ValidationError("This account has no password. Contact support if you need access.");
    }
    if (!bcrypt.compareSync(request.currentPassword, hash)) {
      throw new ValidationError("Current password is incorrect.");
    }
    if (request.currentPassword === request.newPassword) {
      throw new ValidationError("New password must be different from your current password.");
    }
    const newHash = bcrypt.hashSync(request.newPassword, 10);
    await this.systemUsers.updatePasswordHash(request.userId, newHash);
  }
}
class UploadShoeImageService {
  images;
  constructor(images) {
    this.images = images;
  }
  async execute(input) {
    const { publicId } = await this.images.uploadFromBuffer(input.buffer, input.mimeType);
    const imageUrlCard = this.images.urlForCard(publicId);
    const imageUrlDetail = this.images.urlForDetail(publicId);
    if (!imageUrlCard || !imageUrlDetail) {
      throw new Error("Failed to build image URLs after upload.");
    }
    return { publicId, imageUrlCard, imageUrlDetail };
  }
}
class AdminListSystemUsersService {
  systemUsers;
  constructor(systemUsers) {
    this.systemUsers = systemUsers;
  }
  async execute(request) {
    const page = normalizePage(request?.page);
    const pageSize = normalizePageSize(request?.pageSize);
    const offset = (page - 1) * pageSize;
    const search = request?.search?.trim() ?? "";
    const { items, total } = await this.systemUsers.listForAdmin({
      limit: pageSize,
      offset,
      ...search ? { search } : {}
    });
    return {
      users: items.map((u) => ({
        userId: u.userId,
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        roleId: u.roleId,
        customerId: u.customerId,
        isActive: u.isActive
      })),
      total,
      page,
      pageSize,
      totalPages: totalPages(total, pageSize)
    };
  }
}
const ADMIN_ROLE_ID$1 = 2;
function normalizePhone$1(raw) {
  if (raw === null || raw === void 0) return null;
  const t = raw.trim();
  if (t.length === 0) return null;
  return t.replace(/[\s().-]/g, "") || null;
}
class AdminUpdateSystemUserService {
  transactionManager;
  systemUsers;
  customers;
  constructor(transactionManager, systemUsers, customers) {
    this.transactionManager = transactionManager;
    this.systemUsers = systemUsers;
    this.customers = customers;
  }
  async execute(request) {
    const emailNorm = request.email.trim().toLowerCase();
    const phoneNorm = normalizePhone$1(request.phone);
    const fullName = request.fullName.trim();
    const current = await this.systemUsers.findById(request.userId);
    if (!current) {
      throw new NotFoundError("User", request.userId);
    }
    const otherUser = await this.systemUsers.findByEmailExcluding(emailNorm, request.userId);
    if (otherUser) {
      throw new ConflictError("EMAIL_CONFLICT", "Another account already uses this email.");
    }
    const wasActiveAdmin = current.roleId === ADMIN_ROLE_ID$1 && current.isActive;
    const willBeActiveAdmin = request.roleId === ADMIN_ROLE_ID$1 && request.isActive;
    if (wasActiveAdmin && !willBeActiveAdmin) {
      const otherAdmins = await this.systemUsers.countActiveAdminsExcluding(request.userId);
      if (otherAdmins < 1) {
        throw new BusinessRuleError(
          "LAST_ADMIN",
          "At least one active admin account must remain in the system."
        );
      }
    }
    if (request.customerId) {
      const cust = await this.customers.findById(request.customerId);
      if (!cust) {
        throw new ValidationError("Linked customer id was not found.");
      }
      const otherCustomer = await this.customers.findByEmail(emailNorm);
      if (otherCustomer && otherCustomer.id !== request.customerId) {
        throw new ConflictError(
          "EMAIL_CONFLICT",
          "This email belongs to a different customer profile."
        );
      }
    }
    const passwordHash = request.newPassword && request.newPassword.trim().length > 0 ? bcrypt.hashSync(request.newPassword.trim(), 10) : null;
    await this.transactionManager.runInTransaction(async () => {
      await this.systemUsers.updateAdminFields(request.userId, {
        fullName,
        email: emailNorm,
        phone: phoneNorm,
        roleId: request.roleId,
        isActive: request.isActive,
        customerId: request.customerId
      });
      if (passwordHash) {
        await this.systemUsers.updatePasswordHash(request.userId, passwordHash);
      }
      if (request.customerId) {
        const customer = await this.customers.findById(request.customerId);
        if (!customer) {
          throw new ValidationError("Linked customer profile was not found.");
        }
        customer.rename(fullName);
        customer.changeEmail(emailNorm);
        customer.changePhone(phoneNorm);
        if (request.isActive) {
          customer.activate();
        } else {
          customer.deactivate();
        }
        await this.customers.save(customer);
      }
    });
    const updated = await this.systemUsers.findById(request.userId);
    if (!updated) {
      throw new Error("User missing after update.");
    }
    return {
      user: {
        userId: updated.userId,
        fullName: updated.fullName,
        email: updated.email,
        phone: updated.phone,
        roleId: updated.roleId,
        customerId: updated.customerId,
        isActive: updated.isActive
      }
    };
  }
}
function normalizePhone(raw) {
  if (raw === null || raw === void 0) return null;
  const t = raw.trim();
  if (t.length === 0) return null;
  return t.replace(/[\s().-]/g, "") || null;
}
class UpdateCustomerAdminService {
  transactionManager;
  customers;
  systemUsers;
  constructor(transactionManager, customers, systemUsers) {
    this.transactionManager = transactionManager;
    this.customers = customers;
    this.systemUsers = systemUsers;
  }
  async execute(request) {
    const emailNorm = request.email.trim().toLowerCase();
    const phoneNorm = normalizePhone(request.phone);
    const customer = await this.customers.findById(request.customerId);
    if (!customer) {
      throw new NotFoundError("Customer", request.customerId);
    }
    const other = await this.customers.findByEmail(emailNorm);
    if (other && other.id !== request.customerId) {
      throw new ConflictError("EMAIL_CONFLICT", "Another customer already uses this email.");
    }
    await this.transactionManager.runInTransaction(async () => {
      customer.rename(request.fullName.trim());
      customer.changeEmail(emailNorm);
      customer.changePhone(phoneNorm);
      customer.changeRank(request.rank);
      if (request.isActive) {
        customer.activate();
      } else {
        customer.deactivate();
      }
      await this.customers.save(customer);
      const user = await this.systemUsers.findByCustomerId(request.customerId);
      if (user) {
        await this.systemUsers.updateMirrorFromCustomer(user.userId, {
          fullName: request.fullName.trim(),
          email: emailNorm,
          phone: phoneNorm,
          isActive: request.isActive
        });
      }
    });
    const refreshed = await this.customers.findById(request.customerId);
    if (!refreshed) {
      throw new Error("Customer missing after update.");
    }
    return {
      customerId: refreshed.id,
      fullName: refreshed.fullName,
      email: refreshed.email,
      phone: refreshed.phone,
      rank: refreshed.rank,
      isActive: refreshed.isActive,
      currentRentedItems: refreshed.currentRentedItems
    };
  }
}
class DeleteRentalAdminService {
  rentals;
  voucherRepository;
  customerRepository;
  constructor(rentals, voucherRepository, customerRepository) {
    this.rentals = rentals;
    this.voucherRepository = voucherRepository;
    this.customerRepository = customerRepository;
  }
  async execute(request) {
    const rentalId = request.rentalId?.trim() ?? "";
    if (!rentalId) {
      throw new ValidationError("Rental id is required.");
    }
    const existing = await this.rentals.findById(rentalId);
    if (!existing) {
      throw new NotFoundError("Rental", rentalId);
    }
    if (existing.status === "RESERVED" || existing.status === "ACTIVE") {
      if (this.customerRepository) {
        const customer = await this.customerRepository.findById(existing.customerId);
        if (customer && customer.currentRentedItems >= existing.totalItems) {
          customer.completeRental(existing.totalItems);
          await this.customerRepository.save(customer);
        }
      }
      if (this.voucherRepository) {
        const match = (existing.note ?? "").match(/Voucher\s+([A-Za-z0-9_-]+)\s+-\d+%/i);
        if (match) {
          await this.voucherRepository.decrementUsedCount(match[1].toUpperCase());
        }
      }
    }
    await this.rentals.deleteById(rentalId);
  }
}
class DeleteCustomerAdminService {
  transactionManager;
  customers;
  rentals;
  systemUsers;
  constructor(transactionManager, customers, rentals, systemUsers) {
    this.transactionManager = transactionManager;
    this.customers = customers;
    this.rentals = rentals;
    this.systemUsers = systemUsers;
  }
  async execute(request) {
    const customerId = request.customerId?.trim() ?? "";
    if (!customerId) {
      throw new ValidationError("Customer id is required.");
    }
    const existing = await this.customers.findById(customerId);
    if (!existing) {
      throw new NotFoundError("Customer", customerId);
    }
    await this.transactionManager.runInTransaction(async () => {
      await this.rentals.deleteByCustomerId(customerId);
      await this.systemUsers.unlinkCustomerLinks(customerId);
      await this.customers.deleteById(customerId);
    });
  }
}
const ADMIN_ROLE_ID = 2;
class DeleteSystemUserAdminService {
  systemUsers;
  constructor(systemUsers) {
    this.systemUsers = systemUsers;
  }
  async execute(request) {
    const userId = request.userId?.trim() ?? "";
    const requestingUserId = request.requestingUserId?.trim() ?? "";
    if (!userId) {
      throw new ValidationError("User id is required.");
    }
    if (!requestingUserId) {
      throw new ValidationError("Requesting user id is required.");
    }
    if (userId === requestingUserId) {
      throw new ValidationError("You cannot delete your own account.");
    }
    const user = await this.systemUsers.findById(userId);
    if (!user) {
      throw new NotFoundError("User", userId);
    }
    if (user.roleId === ADMIN_ROLE_ID && user.isActive) {
      const otherActiveAdmins = await this.systemUsers.countActiveAdminsExcluding(userId);
      if (otherActiveAdmins < 1) {
        throw new BusinessRuleError(
          "LAST_ADMIN",
          "At least one active admin account must remain in the system."
        );
      }
    }
    await this.systemUsers.deleteById(userId);
  }
}
class ExpirePendingOnlinePaymentsService {
  transactionManager;
  rentalPayments;
  rentals;
  cancelRental;
  constructor(transactionManager, rentalPayments, rentals, cancelRental) {
    this.transactionManager = transactionManager;
    this.rentalPayments = rentalPayments;
    this.rentals = rentals;
    this.cancelRental = cancelRental;
  }
  async execute(now = /* @__PURE__ */ new Date()) {
    const batch = await this.rentalPayments.listPendingExpired(now, 50);
    let expired = 0;
    let errors = 0;
    const cancelledRentalIds = [];
    for (const p of batch) {
      try {
        let wasCancelled = false;
        await this.transactionManager.runInTransaction(async () => {
          const rental = await this.rentals.findById(p.rentalId);
          if (!rental) {
            await this.rentalPayments.setStatus(p.id, "EXPIRED");
            return;
          }
          if (rental.status === RentalStatus.RESERVED) {
            const latestMap = await this.rentalPayments.findLatestByRentalIds([p.rentalId]);
            const latest = latestMap[p.rentalId];
            const hasPaidOrNewerActiveAttempt = latest !== void 0 && (latest.status === "PAID" || latest.status === "PENDING" && latest.gatewayOrderId !== p.gatewayOrderId);
            if (!hasPaidOrNewerActiveAttempt) {
              await this.cancelRental.execute({
                rentalId: p.rentalId,
                cancelledAt: now,
                note: "Tự động hủy đơn do quá hạn thanh toán MoMo (15 phút).",
                requestingCustomerId: void 0
              });
              wasCancelled = true;
            }
          }
          await this.rentalPayments.setStatus(p.id, "EXPIRED");
        });
        if (wasCancelled) {
          cancelledRentalIds.push(p.rentalId);
        }
        expired += 1;
      } catch {
        errors += 1;
      }
    }
    return { expired, cancelledRentalIds, errors };
  }
}
class ExtendRentalService {
  rentalRepository;
  availabilityChecker;
  constructor(rentalRepository, availabilityChecker) {
    this.rentalRepository = rentalRepository;
    this.availabilityChecker = availabilityChecker;
  }
  async execute(req) {
    const rental = await this.rentalRepository.findById(req.rentalId);
    if (!rental) {
      throw new NotFoundError("Rental", req.rentalId);
    }
    if (req.requestingCustomerId) {
      rental.assertOwnedBy(req.requestingCustomerId, "You do not have permission to modify this rental.");
    }
    const extensionPeriod = rental.buildExtensionPeriod(req.newEndDate);
    const sortedItems = [...rental.items].sort((a, b) => a.variantId.localeCompare(b.variantId));
    for (const item of sortedItems) {
      await this.availabilityChecker.ensureVariantAvailable(item.variantId, item.quantity, extensionPeriod);
    }
    rental.extendPeriod(extensionPeriod.endDate, req.note);
    await this.rentalRepository.save(rental);
    return {
      rentalId: rental.id,
      status: rental.status,
      startDate: rental.period.startDate,
      endDate: rental.period.endDate,
      basePrice: rental.basePrice,
      totalAmount: rental.totalAmount
    };
  }
}
function createPool() {
  const port = Number(process.env.DB_PORT ?? 3306);
  const useSsl = process.env.DB_SSL === "true" || port === 4e3;
  return mysql.createPool({
    host: process.env.DB_HOST ?? "localhost",
    port,
    database: process.env.DB_NAME ?? "shoe_rental_system_v2",
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT ?? 10),
    timezone: "+00:00",
    ...useSsl ? { ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true } } : {}
  });
}
class MysqlContainer {
  pool;
  customerRepository;
  systemUserRepository;
  shoeRepository;
  rentalRepository;
  rentalPaymentRepository;
  voucherRepository;
  expirePendingOnlinePayments;
  wishlistRepository;
  transactionManager;
  accessTokenService;
  registerCustomer;
  loginUser;
  registerUser;
  updateProfile;
  changePassword;
  shoeImageService;
  catalogLookup;
  catalogAdmin;
  constructor() {
    this.pool = createPool();
    this.customerRepository = new MysqlCustomerRepository(this.pool);
    this.systemUserRepository = new MysqlSystemUserRepository(this.pool);
    this.shoeRepository = new MysqlShoeRepository(this.pool);
    this.rentalRepository = new MysqlRentalRepository(this.pool);
    this.rentalPaymentRepository = new MysqlRentalPaymentRepository(this.pool);
    this.voucherRepository = new MysqlVoucherRepository(this.pool);
    this.transactionManager = new MysqlTransactionManager(this.pool);
    this.expirePendingOnlinePayments = new ExpirePendingOnlinePaymentsService(
      this.transactionManager,
      this.rentalPaymentRepository,
      this.rentalRepository,
      new CancelRentalService(this.rentalRepository, this.customerRepository, this.voucherRepository)
    );
    this.wishlistRepository = new MysqlWishlistRepository(this.pool);
    this.accessTokenService = new JoseAccessTokenService(
      process.env.JWT_SECRET ?? "",
      process.env.JWT_EXPIRES_IN ?? "8h"
    );
    this.registerCustomer = new RegisterCustomerService(
      this.customerRepository,
      new UuidGenerator("C")
    );
    this.loginUser = new LoginUserService(this.systemUserRepository, this.accessTokenService);
    this.registerUser = new RegisterUserService(
      this.transactionManager,
      this.customerRepository,
      this.registerCustomer,
      this.systemUserRepository,
      new UuidGenerator("U"),
      this.accessTokenService
    );
    this.updateProfile = new UpdateProfileService(
      this.transactionManager,
      this.systemUserRepository,
      this.customerRepository
    );
    this.changePassword = new ChangePasswordService(this.systemUserRepository);
    this.shoeImageService = new CloudinaryShoeImageService();
    this.catalogLookup = new MysqlCatalogLookup(this.pool);
    this.catalogAdmin = new MysqlCatalogAdmin(this.pool);
  }
  getCatalogLookup() {
    return this.catalogLookup;
  }
  getCatalogAdminRepository() {
    return this.catalogAdmin;
  }
  getTransactionManager() {
    return this.transactionManager;
  }
  getAccessTokenService() {
    return this.accessTokenService;
  }
  getSystemUserRepository() {
    return this.systemUserRepository;
  }
  getLoginUserUseCase() {
    return this.loginUser;
  }
  getRegisterUserUseCase() {
    return this.registerUser;
  }
  getUpdateProfileUseCase() {
    return this.updateProfile;
  }
  getChangePasswordUseCase() {
    return this.changePassword;
  }
  getCreateRentalUseCase() {
    return new CreateRentalService(
      this.customerRepository,
      this.shoeRepository,
      this.rentalRepository,
      new MysqlRentalAvailabilityChecker(this.pool, new VariantDeactivationPolicy()),
      new UuidGenerator("R"),
      this.voucherRepository
    );
  }
  getReturnRentalUseCase() {
    return new ReturnRentalService(this.rentalRepository, this.customerRepository);
  }
  getActivateRentalUseCase() {
    return new ActivateRentalService(this.rentalRepository);
  }
  getCancelRentalUseCase() {
    return new CancelRentalService(
      this.rentalRepository,
      this.customerRepository,
      this.voucherRepository
    );
  }
  getRegisterCustomerUseCase() {
    return this.registerCustomer;
  }
  getAddShoeUseCase() {
    return new AddShoeService(this.shoeRepository, new UuidGenerator("S"));
  }
  getUpdateShoeUseCase() {
    return new UpdateShoeService(
      this.shoeRepository,
      new UuidGenerator("S"),
      this.shoeImageService,
      this.catalogLookup
    );
  }
  getDeactivateShoeUseCase() {
    return new DeactivateShoeService(this.shoeRepository);
  }
  getListShoesUseCase() {
    return new ListShoesService(this.shoeRepository, this.shoeImageService);
  }
  getGetShoeUseCase() {
    return new GetShoeService(this.shoeRepository, this.shoeImageService, this.catalogLookup);
  }
  getUploadShoeImageUseCase() {
    return new UploadShoeImageService(this.shoeImageService);
  }
  getListCustomersUseCase() {
    return new ListCustomersService(this.customerRepository);
  }
  getGetCustomerUseCase() {
    return new GetCustomerService(this.customerRepository);
  }
  getUpdateCustomerAdminUseCase() {
    return new UpdateCustomerAdminService(
      this.transactionManager,
      this.customerRepository,
      this.systemUserRepository
    );
  }
  getDeleteRentalAdminUseCase() {
    return new DeleteRentalAdminService(
      this.rentalRepository,
      this.voucherRepository,
      this.customerRepository
    );
  }
  getDeleteCustomerAdminUseCase() {
    return new DeleteCustomerAdminService(
      this.transactionManager,
      this.customerRepository,
      this.rentalRepository,
      this.systemUserRepository
    );
  }
  getDeleteSystemUserAdminUseCase() {
    return new DeleteSystemUserAdminService(this.systemUserRepository);
  }
  getAdminListSystemUsersUseCase() {
    return new AdminListSystemUsersService(this.systemUserRepository);
  }
  getAdminUpdateSystemUserUseCase() {
    return new AdminUpdateSystemUserService(
      this.transactionManager,
      this.systemUserRepository,
      this.customerRepository
    );
  }
  getListRentalsUseCase() {
    return new ListRentalsService(this.rentalRepository);
  }
  getGetRentalUseCase() {
    return new GetRentalService(this.rentalRepository);
  }
  getRentalPaymentRepository() {
    return this.rentalPaymentRepository;
  }
  getExpirePendingOnlinePaymentsService() {
    return this.expirePendingOnlinePayments;
  }
  getWishlistUseCase() {
    return new WishlistService(this.shoeRepository, this.wishlistRepository, this.shoeImageService);
  }
  getCustomerRepository() {
    return this.customerRepository;
  }
  getExtendRentalUseCase() {
    return new ExtendRentalService(
      this.rentalRepository,
      new MysqlRentalAvailabilityChecker(this.pool, new VariantDeactivationPolicy())
    );
  }
  getRentalAvailabilityChecker() {
    return new MysqlRentalAvailabilityChecker(this.pool, new VariantDeactivationPolicy());
  }
  getVoucherRepository() {
    return this.voucherRepository;
  }
  getPool() {
    return this.pool;
  }
  async pingDatabase() {
    try {
      await this.pool.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }
  async close() {
    await this.pool.end();
  }
}
const RegisterCustomerSchema = z.object({
  fullName: z.string().min(1).max(100),
  email: z.string().email().max(255).transform((v) => v.toLowerCase()),
  phone: z.string().min(8).max(15).trim(),
  rank: z.enum(["BRONZE", "SILVER", "GOLD", "DIAMOND"]).optional()
});
const ListCustomersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
  search: z.string().max(200).optional()
});
const UpdateCustomerAdminSchema = z.object({
  fullName: z.string().min(1).max(100),
  email: z.string().email().max(255).transform((v) => v.toLowerCase()),
  phone: z.string().max(15).nullable().optional(),
  rank: z.enum(["BRONZE", "SILVER", "GOLD", "DIAMOND"]),
  isActive: z.boolean()
});
function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}
function transactionalRoute(transactionManager, handler) {
  return (req, res, next) => {
    let pendingSend = null;
    const origJson = res.json.bind(res);
    const origEnd = res.end.bind(res);
    res.json = ((body) => {
      pendingSend = () => {
        origJson(body);
      };
      return res;
    });
    res.end = ((...args) => {
      pendingSend = () => {
        origEnd(...args);
      };
      return res;
    });
    transactionManager.runInTransaction(async () => {
      await handler(req, res);
    }).then(() => {
      res.json = origJson;
      res.end = origEnd;
      if (pendingSend) pendingSend();
    }).catch((err) => {
      res.json = origJson;
      res.end = origEnd;
      next(err);
    });
  };
}
class CustomerController {
  registerCustomer;
  listCustomers;
  getCustomer;
  updateCustomerAdmin;
  deleteCustomerAdmin;
  constructor(registerCustomer, listCustomers, getCustomer, updateCustomerAdmin, deleteCustomerAdmin) {
    this.registerCustomer = registerCustomer;
    this.listCustomers = listCustomers;
    this.getCustomer = getCustomer;
    this.updateCustomerAdmin = updateCustomerAdmin;
    this.deleteCustomerAdmin = deleteCustomerAdmin;
  }
  routes(transactionManager, guards) {
    const router = Router();
    const admin = guards?.admin ?? [];
    router.get("/", ...admin, asyncRoute(this.list.bind(this)));
    router.get("/:id", ...admin, asyncRoute(this.getById.bind(this)));
    router.post("/", ...admin, transactionalRoute(transactionManager, this.register.bind(this)));
    router.patch(
      "/:id",
      ...admin,
      transactionalRoute(transactionManager, this.patchAdmin.bind(this))
    );
    router.delete("/:id", ...admin, asyncRoute(this.deleteAdmin.bind(this)));
    return router;
  }
  async list(req, res) {
    const query = ListCustomersQuerySchema.parse(req.query);
    const result = await this.listCustomers.execute({
      ...query.page !== void 0 ? { page: query.page } : {},
      ...query.pageSize !== void 0 ? { pageSize: query.pageSize } : {},
      ...query.search !== void 0 && query.search.trim() !== "" ? { search: query.search.trim() } : {}
    });
    res.json(result);
  }
  async patchAdmin(req, res) {
    const body = UpdateCustomerAdminSchema.parse(req.body);
    const result = await this.updateCustomerAdmin.execute({
      customerId: req.params["id"],
      fullName: body.fullName,
      email: body.email,
      phone: body.phone ?? null,
      rank: body.rank,
      isActive: body.isActive
    });
    res.json(result);
  }
  async getById(req, res) {
    const result = await this.getCustomer.execute({ customerId: req.params["id"] });
    res.json(result);
  }
  async register(req, res) {
    const body = RegisterCustomerSchema.parse(req.body);
    const result = await this.registerCustomer.execute(body);
    res.status(201).json(result);
  }
  async deleteAdmin(req, res) {
    await this.deleteCustomerAdmin.execute({ customerId: req.params["id"] });
    res.status(204).end();
  }
}
const ListShoesQuerySchema = z.object({
  priceBucket: z.enum(["all", "lt10", "10to20", "20to50", "gt50"]).optional(),
  stockBucket: z.enum(["all", "0", "1to5", "6plus"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional()
});
const VariantSchema = z.object({
  size: z.number().int().min(1).max(60),
  colorId: z.number().int().positive(),
  totalQuantity: z.number().int().min(0)
});
const AddShoeSchema = z.object({
  name: z.string().min(1).max(100),
  brandId: z.number().int().positive(),
  categoryId: z.number().int().positive(),
  description: z.string().max(500).optional(),
  pricePerDay: z.number().positive(),
  imagePublicId: z.string().min(1).max(512).optional(),
  variants: z.array(VariantSchema).min(1)
});
const VariantQuantityUpdateSchema = z.object({
  variantId: z.string().min(1),
  totalQuantity: z.number().int().min(0)
});
const NewVariantBodySchema = z.object({
  size: z.number().int().min(1).max(60),
  colorId: z.number().int().positive(),
  totalQuantity: z.number().int().min(0)
});
const UpdateShoeBodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  brandId: z.number().int().positive().optional(),
  categoryId: z.number().int().positive().optional(),
  description: z.string().max(500).nullable().optional(),
  pricePerDay: z.number().positive().optional(),
  isActive: z.boolean().optional(),
  imagePublicId: z.string().min(1).max(512).nullable().optional(),
  variantQuantityUpdates: z.array(VariantQuantityUpdateSchema).optional(),
  newVariants: z.array(NewVariantBodySchema).optional()
}).refine(
  (d) => d.name !== void 0 || d.brandId !== void 0 || d.categoryId !== void 0 || d.description !== void 0 || d.pricePerDay !== void 0 || d.isActive !== void 0 || d.imagePublicId !== void 0 || d.variantQuantityUpdates !== void 0 && d.variantQuantityUpdates.length > 0 || d.newVariants !== void 0 && d.newVariants.length > 0,
  { message: "At least one field must be provided to update the shoe." }
);
class ShoeController {
  addShoe;
  updateShoe;
  deactivateShoe;
  listShoes;
  getShoe;
  catalog;
  availabilityChecker;
  pool;
  constructor(addShoe, updateShoe, deactivateShoe, listShoes, getShoe, catalog, availabilityChecker, pool) {
    this.addShoe = addShoe;
    this.updateShoe = updateShoe;
    this.deactivateShoe = deactivateShoe;
    this.listShoes = listShoes;
    this.getShoe = getShoe;
    this.catalog = catalog;
    this.availabilityChecker = availabilityChecker;
    this.pool = pool;
  }
  routes(transactionManager, guards) {
    const router = Router();
    const admin = guards?.admin ?? [];
    const authenticated = guards?.authenticated ?? [];
    const customer = guards?.customer ?? [];
    router.get("/catalog/shoe-lookups", ...authenticated, asyncRoute(this.shoeLookups.bind(this)));
    router.get("/reviews", ...admin, asyncRoute(this.listAllReviewsAdmin.bind(this)));
    router.delete("/reviews/:reviewId", ...admin, asyncRoute(this.deleteReviewAdmin.bind(this)));
    router.get("/shoes", ...authenticated, asyncRoute(this.list.bind(this)));
    router.post("/shoes", ...admin, transactionalRoute(transactionManager, this.add.bind(this)));
    router.get("/shoes/:id/availability", ...authenticated, asyncRoute(this.getAvailability.bind(this)));
    router.get("/shoes/:id/reviews", ...authenticated, asyncRoute(this.getReviews.bind(this)));
    router.post("/shoes/:id/reviews", ...customer, asyncRoute(this.postReview.bind(this)));
    router.patch(
      "/shoes/:id",
      ...admin,
      transactionalRoute(transactionManager, this.update.bind(this))
    );
    router.delete(
      "/shoes/:id",
      ...admin,
      transactionalRoute(transactionManager, this.deactivate.bind(this))
    );
    router.get("/shoes/:id", ...authenticated, asyncRoute(this.getById.bind(this)));
    return router;
  }
  async shoeLookups(_req, res) {
    const [brands, categories, colors] = await Promise.all([
      this.catalog.listBrands(),
      this.catalog.listCategories(),
      this.catalog.listColors()
    ]);
    res.json({ brands, categories, colors });
  }
  async list(req, res) {
    const query = ListShoesQuerySchema.parse(req.query);
    const result = await this.listShoes.execute({
      ...query.priceBucket !== void 0 ? { priceBucket: query.priceBucket } : {},
      ...query.stockBucket !== void 0 ? { stockBucket: query.stockBucket } : {},
      ...query.page !== void 0 ? { page: query.page } : {},
      ...query.pageSize !== void 0 ? { pageSize: query.pageSize } : {}
    });
    res.json(result);
  }
  async getById(req, res) {
    const result = await this.getShoe.execute({ shoeId: req.params["id"] });
    res.json(result);
  }
  async resolveAddPayload(body) {
    const brand = await this.catalog.getBrandNameById(body.brandId);
    if (!brand) {
      throw new ValidationError("Brand id is not valid.");
    }
    const category = await this.catalog.getCategoryNameById(body.categoryId);
    if (!category) {
      throw new ValidationError("Category id is not valid.");
    }
    const variants = [];
    for (const v of body.variants) {
      const color = await this.catalog.getColorNameById(v.colorId);
      if (!color) {
        throw new ValidationError("Color id is not valid.");
      }
      variants.push({ size: v.size, color, totalQuantity: v.totalQuantity });
    }
    return {
      name: body.name,
      brand,
      category,
      description: body.description,
      pricePerDay: body.pricePerDay,
      imagePublicId: body.imagePublicId,
      variants
    };
  }
  async add(req, res) {
    const body = AddShoeSchema.parse(req.body);
    const payload = await this.resolveAddPayload(body);
    const result = await this.addShoe.execute(payload);
    res.status(201).json(result);
  }
  async resolveUpdatePayload(shoeId, body) {
    let brand;
    if (body.brandId !== void 0) {
      const n = await this.catalog.getBrandNameById(body.brandId);
      if (!n) {
        throw new ValidationError("Brand id is not valid.");
      }
      brand = n;
    }
    let category;
    if (body.categoryId !== void 0) {
      const n = await this.catalog.getCategoryNameById(body.categoryId);
      if (!n) {
        throw new ValidationError("Category id is not valid.");
      }
      category = n;
    }
    let newVariants;
    if (body.newVariants !== void 0 && body.newVariants.length > 0) {
      newVariants = [];
      for (const nv of body.newVariants) {
        const color = await this.catalog.getColorNameById(nv.colorId);
        if (!color) {
          throw new ValidationError("Color id is not valid.");
        }
        newVariants.push({ size: nv.size, color, totalQuantity: nv.totalQuantity });
      }
    }
    return {
      shoeId,
      name: body.name,
      ...brand !== void 0 ? { brand } : {},
      ...category !== void 0 ? { category } : {},
      description: body.description,
      pricePerDay: body.pricePerDay,
      isActive: body.isActive,
      imagePublicId: body.imagePublicId,
      variantQuantityUpdates: body.variantQuantityUpdates,
      newVariants
    };
  }
  async update(req, res) {
    const shoeId = req.params["id"];
    const body = UpdateShoeBodySchema.parse(req.body);
    const payload = await this.resolveUpdatePayload(shoeId, body);
    const result = await this.updateShoe.execute(payload);
    res.json(result);
  }
  async deactivate(req, res) {
    const shoeId = req.params["id"];
    const result = await this.deactivateShoe.execute({ shoeId });
    res.json(result);
  }
  async getAvailability(req, res) {
    const shoeId = req.params["id"];
    const startDateStr = String(req.query["startDate"] ?? "").trim();
    const endDateStr = String(req.query["endDate"] ?? "").trim();
    if (!startDateStr || !endDateStr) {
      throw new ValidationError("startDate and endDate query parameters are required.");
    }
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    const period = new RentalPeriod(startDate, endDate);
    const shoe = await this.getShoe.execute({ shoeId });
    const variants = await Promise.all(
      shoe.variants.map(async (v) => {
        let reservedQuantity = 0;
        if (this.availabilityChecker) {
          reservedQuantity = await this.availabilityChecker.getReservedQuantityForVariant(
            v.variantId,
            period
          );
        }
        const availableQuantity = Math.max(0, v.totalQuantity - reservedQuantity);
        return {
          variantId: v.variantId,
          size: v.size,
          color: v.color,
          totalQuantity: v.totalQuantity,
          reservedQuantity,
          availableQuantity
        };
      })
    );
    res.json({
      shoeId,
      startDate: period.startDate,
      endDate: period.endDate,
      durationDays: period.durationInDays,
      variants
    });
  }
  async getReviews(req, res) {
    const shoeId = req.params["id"];
    await this.getShoe.execute({ shoeId });
    if (!this.pool) {
      res.json({ shoeId, averageRating: 5, totalReviews: 0, reviews: [] });
      return;
    }
    const [rows] = await this.pool.query(
      `SELECT review_id, shoe_id, customer_id, customer_name, rating, comment, created_at
       FROM shoe_reviews
       WHERE shoe_id = ?
       ORDER BY created_at DESC`,
      [shoeId]
    );
    const reviews = rows.map((r) => ({
      reviewId: Number(r["review_id"]),
      shoeId: String(r["shoe_id"]),
      customerId: String(r["customer_id"]),
      customerName: String(r["customer_name"]),
      rating: Number(r["rating"]),
      comment: String(r["comment"]),
      createdAt: new Date(r["created_at"]).toISOString()
    }));
    const totalReviews = reviews.length;
    const averageRating = totalReviews > 0 ? Math.round(reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews * 10) / 10 : 5;
    res.json({ shoeId, averageRating, totalReviews, reviews });
  }
  async postReview(req, res) {
    const auth = req.auth;
    if (!auth?.customerId) {
      throw new ValidationError("Account is not linked to a customer profile.");
    }
    const shoeId = req.params["id"];
    await this.getShoe.execute({ shoeId });
    const schema = z.object({
      rating: z.number().int().min(1).max(5),
      comment: z.string().trim().min(1).max(500)
    });
    const body = schema.parse(req.body);
    if (!this.pool) {
      res.status(201).json({ shoeId, customerId: auth.customerId, customerName: auth.customerId, ...body });
      return;
    }
    let customerName = auth.customerId;
    try {
      const [cRows] = await this.pool.query(
        "SELECT full_name FROM customers WHERE customer_id = ? LIMIT 1",
        [auth.customerId]
      );
      if (cRows.length > 0 && cRows[0]["full_name"]) {
        customerName = String(cRows[0]["full_name"]);
      }
    } catch {
    }
    await this.pool.query(
      `INSERT INTO shoe_reviews (shoe_id, customer_id, customer_name, rating, comment)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         rating = VALUES(rating),
         comment = VALUES(comment),
         customer_name = VALUES(customer_name),
         updated_at = NOW()`,
      [shoeId, auth.customerId, customerName, body.rating, body.comment]
    );
    res.status(201).json({
      shoeId,
      customerId: auth.customerId,
      customerName,
      rating: body.rating,
      comment: body.comment
    });
  }
  async listAllReviewsAdmin(req, res) {
    if (!this.pool) {
      res.json({
        reviews: [],
        total: 0,
        averageRating: 5,
        overallTotal: 0,
        overallAverageRating: 5,
        lowRatingCount: 0
      });
      return;
    }
    const conditions = [];
    const params = [];
    const rawRating = String(req.query["rating"] ?? "").trim();
    if (rawRating === "1" || rawRating === "2" || rawRating === "3" || rawRating === "4" || rawRating === "5") {
      conditions.push("sr.rating = ?");
      params.push(Number(rawRating));
    }
    const search = String(req.query["search"] ?? "").trim();
    if (search) {
      const escaped = search.replace(/[\\%_]/g, "\\$&");
      const like = `%${escaped}%`;
      conditions.push(
        "(sr.shoe_id LIKE ? OR s.name LIKE ? OR sr.customer_name LIKE ? OR sr.customer_id LIKE ? OR sr.comment LIKE ?)"
      );
      params.push(like, like, like, like, like);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const [rows] = await this.pool.query(
      `SELECT sr.review_id, sr.shoe_id, COALESCE(s.name, sr.shoe_id) AS shoe_name,
              sr.customer_id, sr.customer_name, sr.rating, sr.comment, sr.created_at
       FROM shoe_reviews sr
       LEFT JOIN shoes s ON s.shoe_id = sr.shoe_id
       ${whereClause}
       ORDER BY sr.created_at DESC
       LIMIT 200`,
      params
    );
    const reviews = rows.map((r) => ({
      reviewId: Number(r["review_id"]),
      shoeId: String(r["shoe_id"]),
      shoeName: String(r["shoe_name"]),
      customerId: String(r["customer_id"]),
      customerName: String(r["customer_name"]),
      rating: Number(r["rating"]),
      comment: String(r["comment"]),
      createdAt: new Date(r["created_at"]).toISOString()
    }));
    const total = reviews.length;
    const averageRating = total > 0 ? Math.round(reviews.reduce((sum, r) => sum + r.rating, 0) / total * 10) / 10 : 5;
    let overallTotal = total;
    let overallAverageRating = averageRating;
    let lowRatingCount = reviews.filter((r) => r.rating <= 2).length;
    try {
      const [summaryRows] = await this.pool.query(
        `SELECT COUNT(*) AS cnt,
                ROUND(AVG(rating), 1) AS avg_rating,
                COALESCE(SUM(CASE WHEN rating <= 2 THEN 1 ELSE 0 END), 0) AS low_cnt
         FROM shoe_reviews`
      );
      if (summaryRows.length > 0) {
        overallTotal = Number(summaryRows[0]["cnt"] ?? 0);
        overallAverageRating = summaryRows[0]["avg_rating"] !== null ? Number(summaryRows[0]["avg_rating"]) : 5;
        lowRatingCount = Number(summaryRows[0]["low_cnt"] ?? 0);
      }
    } catch {
    }
    res.json({
      reviews,
      total,
      averageRating,
      overallTotal,
      overallAverageRating,
      lowRatingCount
    });
  }
  async deleteReviewAdmin(req, res) {
    const reviewId = Number(req.params["reviewId"]);
    if (!Number.isInteger(reviewId) || reviewId <= 0) {
      throw new ValidationError("Invalid reviewId.");
    }
    if (!this.pool) {
      res.status(204).end();
      return;
    }
    const [result] = await this.pool.query(
      "DELETE FROM shoe_reviews WHERE review_id = ?",
      [reviewId]
    );
    const affected = result?.affectedRows ?? 0;
    if (affected === 0) {
      res.status(404).json({ error: "NOT_FOUND", message: "Review not found." });
      return;
    }
    res.status(204).end();
  }
}
const ALLOWED_MIMES = /* @__PURE__ */ new Set(["image/jpeg", "image/png", "image/webp"]);
const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ValidationError("Only JPEG, PNG, and WebP images are allowed."));
    }
  }
});
class ShoeImageController {
  uploadShoeImage;
  constructor(uploadShoeImage) {
    this.uploadShoeImage = uploadShoeImage;
  }
  routes(guards) {
    const router = Router();
    const admin = guards?.admin ?? [];
    router.post(
      "/upload",
      ...admin,
      uploadMiddleware.single("image"),
      asyncRoute(this.upload.bind(this))
    );
    return router;
  }
  async upload(req, res) {
    const file = req.file;
    if (!file?.buffer) {
      res.status(400).json({
        error: "NO_FILE",
        message: "Image file is required (form field name: image)."
      });
      return;
    }
    const result = await this.uploadShoeImage.execute({
      buffer: file.buffer,
      mimeType: file.mimetype
    });
    res.status(201).json(result);
  }
}
const CreateRentalItemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().positive()
});
const CreateRentalSchema = z.object({
  customerId: z.string().min(1),
  items: z.array(CreateRentalItemSchema).min(1),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  voucherCode: z.string().max(32).optional(),
  note: z.string().max(255).optional()
}).refine((d) => d.endDate >= d.startDate, {
  message: "End date cannot be before start date",
  path: ["endDate"]
});
const ReturnRentalSchema = z.object({
  returnedAt: z.coerce.date().optional(),
  note: z.string().max(255).optional(),
  damageFee: z.coerce.number().int().min(0).max(5e7).optional()
}).default({});
const CancelRentalSchema = z.object({
  cancelledAt: z.coerce.date().optional(),
  note: z.string().max(255).optional()
}).default({});
const ExtendRentalSchema = z.object({
  newEndDate: z.coerce.date(),
  note: z.string().max(255).optional()
});
const ListRentalsQuerySchema = z.object({
  status: z.enum(["RESERVED", "ACTIVE", "RETURNED", "CANCELLED"]).optional(),
  customerId: z.string().trim().min(1).max(32).optional(),
  startDateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startDateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  amountBucket: z.enum(["all", "lt50", "50to150", "150to300", "gt300"]).optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional()
}).refine(
  (q) => !q.startDateFrom || !q.startDateTo || q.startDateFrom <= q.startDateTo,
  { message: "startDateFrom must be on or before startDateTo", path: ["startDateTo"] }
);
const ListMyRentalsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional()
});
function getVietnamTodayYmd$1(now = /* @__PURE__ */ new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value ?? String(now.getFullYear());
  const m = parts.find((p) => p.type === "month")?.value ?? String(now.getMonth() + 1).padStart(2, "0");
  const d = parts.find((p) => p.type === "day")?.value ?? String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function toRentalYmd(val) {
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return getVietnamTodayYmd$1(parsed);
    }
    return trimmed.slice(0, 10);
  }
  return getVietnamTodayYmd$1(val);
}
function addDaysYmd(ymd, deltaDays) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
function formatDdMm(ymd) {
  const [, m, d] = ymd.split("-");
  return `${d}/${m}`;
}
function formatMmYyyy(ym) {
  const [y, m] = ym.split("-");
  return `${m}/${y}`;
}
class RentalController {
  createRental;
  activateRental;
  returnRental;
  cancelRental;
  listRentals;
  getRental;
  deleteRentalAdmin;
  extendRental;
  voucherRepository;
  pool;
  expirePendingOnlinePayments;
  constructor(createRental, activateRental, returnRental, cancelRental, listRentals, getRental, deleteRentalAdmin, extendRental, voucherRepository, pool, expirePendingOnlinePayments) {
    this.createRental = createRental;
    this.activateRental = activateRental;
    this.returnRental = returnRental;
    this.cancelRental = cancelRental;
    this.listRentals = listRentals;
    this.getRental = getRental;
    this.deleteRentalAdmin = deleteRentalAdmin;
    this.extendRental = extendRental;
    this.voucherRepository = voucherRepository;
    this.pool = pool;
    this.expirePendingOnlinePayments = expirePendingOnlinePayments;
  }
  routes(transactionManager, guards) {
    const router = Router();
    const admin = guards?.admin ?? [];
    const createRental = guards?.createRental ?? [];
    const customer = guards?.customer ?? [];
    router.get("/vouchers/validate", ...createRental, asyncRoute(this.validateVoucher.bind(this)));
    router.get("/vouchers/active", ...createRental, asyncRoute(this.listActiveVouchers.bind(this)));
    router.get("/notifications", ...createRental, asyncRoute(this.getNotifications.bind(this)));
    router.get("/stats/overview", ...admin, asyncRoute(this.getStatsOverview.bind(this)));
    router.get("/activity-feed", ...admin, asyncRoute(this.getActivityFeed.bind(this)));
    router.post("/sweep-expired-momo", ...admin, asyncRoute(this.sweepExpiredMomo.bind(this)));
    router.get("/me", ...customer, asyncRoute(this.listMine.bind(this)));
    router.get("/me/:id", ...customer, asyncRoute(this.getMine.bind(this)));
    router.patch(
      "/me/:id/cancel",
      ...customer,
      transactionalRoute(transactionManager, this.cancelMine.bind(this))
    );
    router.patch(
      "/me/:id/extend",
      ...customer,
      transactionalRoute(transactionManager, this.extendMine.bind(this))
    );
    router.get("/", ...admin, asyncRoute(this.list.bind(this)));
    router.get("/:id", ...admin, asyncRoute(this.getById.bind(this)));
    router.post(
      "/",
      ...createRental,
      transactionalRoute(transactionManager, this.create.bind(this))
    );
    router.patch(
      "/:id/activate",
      ...admin,
      transactionalRoute(transactionManager, this.activate.bind(this))
    );
    router.patch(
      "/:id/return",
      ...admin,
      transactionalRoute(transactionManager, this.return.bind(this))
    );
    router.patch(
      "/:id/cancel",
      ...admin,
      transactionalRoute(transactionManager, this.cancel.bind(this))
    );
    router.patch(
      "/:id/extend",
      ...admin,
      transactionalRoute(transactionManager, this.extendAdmin.bind(this))
    );
    router.delete(
      "/:id",
      ...admin,
      transactionalRoute(transactionManager, this.deleteAdmin.bind(this))
    );
    return router;
  }
  async lazySweepExpiredMomo() {
    if (this.expirePendingOnlinePayments) {
      await this.expirePendingOnlinePayments.execute().catch(() => void 0);
    }
  }
  async listMine(req, res) {
    const auth = req.auth;
    if (!auth?.customerId) {
      res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Account is not linked to a customer profile."
      });
      return;
    }
    await this.lazySweepExpiredMomo();
    const query = ListMyRentalsQuerySchema.parse(req.query);
    const result = await this.listRentals.execute({
      customerId: auth.customerId,
      ...query.page !== void 0 ? { page: query.page } : {},
      ...query.pageSize !== void 0 ? { pageSize: query.pageSize } : {}
    });
    res.json(result);
  }
  async getMine(req, res) {
    const auth = req.auth;
    if (!auth?.customerId) {
      res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Account is not linked to a customer profile."
      });
      return;
    }
    await this.lazySweepExpiredMomo();
    const result = await this.getRental.execute({
      rentalId: req.params["id"],
      requestingCustomerId: auth.customerId
    });
    res.json(result);
  }
  async cancelMine(req, res) {
    const auth = req.auth;
    if (!auth?.customerId) {
      res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Account is not linked to a customer profile."
      });
      return;
    }
    const body = CancelRentalSchema.parse(req.body ?? {});
    const result = await this.cancelRental.execute({
      rentalId: req.params["id"],
      cancelledAt: body.cancelledAt,
      note: body.note,
      requestingCustomerId: auth.customerId
    });
    res.json(result);
  }
  async list(req, res) {
    await this.lazySweepExpiredMomo();
    const query = ListRentalsQuerySchema.parse(req.query);
    const amountBucket = query.amountBucket === void 0 || query.amountBucket === "all" ? void 0 : query.amountBucket;
    const result = await this.listRentals.execute({
      ...query.status ? { status: query.status } : {},
      ...query.customerId ? { customerId: query.customerId } : {},
      ...query.startDateFrom ? { startDateFrom: query.startDateFrom } : {},
      ...query.startDateTo ? { startDateTo: query.startDateTo } : {},
      ...amountBucket ? { amountBucket } : {},
      ...query.search !== void 0 && query.search.trim() !== "" ? { search: query.search.trim() } : {},
      ...query.page !== void 0 ? { page: query.page } : {},
      ...query.pageSize !== void 0 ? { pageSize: query.pageSize } : {}
    });
    res.json(result);
  }
  async getById(req, res) {
    await this.lazySweepExpiredMomo();
    const result = await this.getRental.execute({ rentalId: req.params["id"] });
    res.json(result);
  }
  async create(req, res) {
    const body = CreateRentalSchema.parse(req.body);
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ error: "UNAUTHORIZED", message: "Authentication required." });
      return;
    }
    let customerId = body.customerId;
    if (auth.role === "customer") {
      if (!auth.customerId) {
        throw new ValidationError("Account is not linked to a customer profile.");
      }
      customerId = auth.customerId;
    }
    const result = await this.createRental.execute({ ...body, customerId });
    res.status(201).json(result);
  }
  async activate(req, res) {
    const result = await this.activateRental.execute({ rentalId: req.params["id"] });
    res.json(result);
  }
  async return(req, res) {
    const body = ReturnRentalSchema.parse(req.body ?? {});
    const result = await this.returnRental.execute({ rentalId: req.params["id"], ...body });
    res.json(result);
  }
  async cancel(req, res) {
    const body = CancelRentalSchema.parse(req.body ?? {});
    const result = await this.cancelRental.execute({ rentalId: req.params["id"], ...body });
    res.json(result);
  }
  async deleteAdmin(req, res) {
    await this.deleteRentalAdmin.execute({ rentalId: req.params["id"] });
    res.status(204).end();
  }
  async extendMine(req, res) {
    const auth = req.auth;
    if (!auth?.customerId) {
      res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Account is not linked to a customer profile."
      });
      return;
    }
    if (!this.extendRental) {
      throw new ValidationError("Extend rental service is not configured.");
    }
    const body = ExtendRentalSchema.parse(req.body);
    const result = await this.extendRental.execute({
      rentalId: req.params["id"],
      newEndDate: body.newEndDate,
      note: body.note,
      requestingCustomerId: auth.customerId
    });
    res.json(result);
  }
  async extendAdmin(req, res) {
    if (!this.extendRental) {
      throw new ValidationError("Extend rental service is not configured.");
    }
    const body = ExtendRentalSchema.parse(req.body);
    const result = await this.extendRental.execute({
      rentalId: req.params["id"],
      newEndDate: body.newEndDate,
      note: body.note
    });
    res.json(result);
  }
  async validateVoucher(req, res) {
    const code = String(req.query["code"] ?? "").trim();
    if (!code) {
      throw new ValidationError("Voucher code is required.");
    }
    if (this.voucherRepository) {
      const normalized = code.toUpperCase();
      const v = await this.voucherRepository.findByCode(normalized);
      const todayStr = getVietnamTodayYmd$1();
      const isValid = v && v.isActive && (!v.expiresAt || todayStr <= v.expiresAt) && (v.maxUses === null || v.usedCount < v.maxUses);
      if (!isValid) {
        throw new ValidationError("Mã giảm giá không hợp lệ hoặc đã hết hạn.");
      }
      res.json({
        valid: true,
        code: v.code,
        discountPercent: v.discountPercent,
        description: v.description
      });
      return;
    }
    const voucher = resolveVoucher(code);
    if (!voucher) {
      throw new ValidationError("Mã giảm giá không hợp lệ hoặc đã hết hạn.");
    }
    res.json({
      valid: true,
      code: voucher.code,
      discountPercent: voucher.discountPercent,
      description: voucher.description
    });
  }
  async listActiveVouchers(_req, res) {
    const todayStr = getVietnamTodayYmd$1();
    const vouchers = this.voucherRepository ? await this.voucherRepository.listActive(todayStr) : [];
    res.json({ vouchers });
  }
  async getNotifications(req, res) {
    const auth = req.auth;
    const todayStr = getVietnamTodayYmd$1();
    const todayMs = (/* @__PURE__ */ new Date(`${todayStr}T00:00:00Z`)).getTime();
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const notifications = [];
    if (auth?.role === "customer" && auth.customerId) {
      const myRentals = await this.listRentals.execute({
        customerId: auth.customerId,
        page: 1,
        pageSize: 30
      });
      for (const r of myRentals.rentals) {
        if (r.isOverdue) {
          notifications.push({
            id: `overdue-${r.rentalId}`,
            type: "OVERDUE",
            severity: "danger",
            title: "Đơn thuê quá hạn",
            message: `Đơn #${r.rentalId} đang quá hạn ${r.overdueDays} ngày (phí phạt dự kiến +${r.estimatedLateFee.toLocaleString("vi-VN")}₫).`,
            link: "/account",
            createdAt: nowIso
          });
        } else if (r.status === "ACTIVE" || r.status === "RESERVED") {
          const endYmd = getVietnamTodayYmd$1(new Date(r.endDate));
          const endMs = (/* @__PURE__ */ new Date(`${endYmd}T00:00:00Z`)).getTime();
          const diffDays = Math.round((endMs - todayMs) / 864e5);
          if (diffDays >= 0 && diffDays <= 2) {
            notifications.push({
              id: `due-soon-${r.rentalId}`,
              type: "DUE_SOON",
              severity: "warning",
              title: "Sắp đến hạn trả giày",
              message: `Đơn #${r.rentalId} sắp đến hạn trả vào ngày ${endYmd}.`,
              link: "/account",
              createdAt: nowIso
            });
          }
        }
      }
      const vouchers = this.voucherRepository ? await this.voucherRepository.listActive(todayStr) : [];
      if (vouchers.length > 0) {
        notifications.push({
          id: `vouchers-${todayStr}`,
          type: "VOUCHER",
          severity: "success",
          title: "Mã giảm giá đang mở",
          message: `Ưu đãi đang mở: ${vouchers.slice(0, 3).map((v) => `${v.code} (-${v.discountPercent}%)`).join(", ")}.`,
          link: "/shoes",
          createdAt: nowIso
        });
      }
    } else if (auth?.role === "admin") {
      const all = await this.listRentals.execute();
      const overdueCount = all.rentals.filter((r) => r.isOverdue).length;
      const reservedCount = all.rentals.filter((r) => r.status === "RESERVED").length;
      const activeCount = all.rentals.filter((r) => r.status === "ACTIVE").length;
      if (overdueCount > 0) {
        notifications.push({
          id: "admin-overdue",
          type: "OVERDUE",
          severity: "danger",
          title: "Cảnh báo đơn quá hạn",
          message: `Có ${overdueCount} đơn thuê đang quá hạn chưa trả cần xử lý.`,
          link: "/admin/rentals",
          createdAt: nowIso
        });
      }
      if (reservedCount > 0) {
        notifications.push({
          id: "admin-reserved",
          type: "ADMIN_ALERT",
          severity: "warning",
          title: "Đơn chờ giao giày",
          message: `Có ${reservedCount} đơn RESERVED đang chờ kích hoạt giao giày.`,
          link: "/admin/rentals",
          createdAt: nowIso
        });
      }
      notifications.push({
        id: "admin-active",
        type: "ADMIN_ALERT",
        severity: "info",
        title: "Tình trạng vận hành",
        message: `Hệ thống đang có ${activeCount} đơn ACTIVE đang thuê.`,
        link: "/admin",
        createdAt: nowIso
      });
    }
    res.json({
      notifications,
      unreadCount: notifications.length
    });
  }
  async sweepExpiredMomo(_req, res) {
    if (!this.expirePendingOnlinePayments) {
      res.json({ sweptCount: 0, cancelledRentalIds: [], errors: 0 });
      return;
    }
    const result = await this.expirePendingOnlinePayments.execute();
    res.json({
      sweptCount: result.expired,
      cancelledRentalIds: result.cancelledRentalIds,
      errors: result.errors
    });
  }
  async getStatsOverview(req, res) {
    await this.lazySweepExpiredMomo();
    const rawPeriod = String(req.query["period"] ?? "all").trim();
    const period = rawPeriod === "7d" || rawPeriod === "30d" || rawPeriod === "6m" ? rawPeriod : "all";
    const todayStr = getVietnamTodayYmd$1();
    const [ty, tm] = todayStr.split("-").map(Number);
    const sixMonthsStartDt = new Date(Date.UTC(ty, tm - 1 - 5, 1));
    const cutoff6m = `${sixMonthsStartDt.getUTCFullYear()}-${String(sixMonthsStartDt.getUTCMonth() + 1).padStart(2, "0")}-01`;
    let cutoffYmd = null;
    if (period === "7d") {
      cutoffYmd = addDaysYmd(todayStr, -6);
    } else if (period === "30d") {
      cutoffYmd = addDaysYmd(todayStr, -29);
    } else if (period === "6m") {
      cutoffYmd = cutoff6m;
    }
    const all = await this.listRentals.execute();
    const rentals = cutoffYmd !== null ? all.rentals.filter((r) => toRentalYmd(r.startDate) >= cutoffYmd) : all.rentals;
    const totalRentals = cutoffYmd !== null ? rentals.length : all.total ?? rentals.length;
    const statusCounts = {
      RESERVED: 0,
      ACTIVE: 0,
      RETURNED: 0,
      CANCELLED: 0
    };
    for (const r of rentals) {
      if (r.status in statusCounts) {
        statusCounts[r.status] += 1;
      }
    }
    const overdueCount = rentals.filter((r) => r.isOverdue).length;
    const totalRevenueReturned = rentals.filter((r) => r.status === "RETURNED").reduce((sum, r) => sum + r.totalAmount, 0);
    const activeExpectedRevenue = rentals.filter((r) => r.status === "ACTIVE" || r.status === "RESERVED").reduce((sum, r) => sum + r.totalAmount, 0);
    const totalLateFeesCollected = rentals.filter((r) => r.status === "RETURNED").reduce((sum, r) => sum + Math.max(0, r.totalAmount - r.basePrice), 0);
    const buildBucket = (label, matched) => {
      const returnedRevenue = matched.filter((r) => r.status === "RETURNED").reduce((sum, r) => sum + r.totalAmount, 0);
      const activeRevenue = matched.filter((r) => r.status === "ACTIVE" || r.status === "RESERVED").reduce((sum, r) => sum + r.totalAmount, 0);
      const rentalCount = matched.filter((r) => r.status !== "CANCELLED").length;
      return {
        label,
        returnedRevenue,
        activeRevenue,
        totalRevenue: returnedRevenue + activeRevenue,
        rentalCount
      };
    };
    let revenueSeries = [];
    if (period === "7d") {
      for (let i = 6; i >= 0; i--) {
        const dayYmd = addDaysYmd(todayStr, -i);
        const matched = rentals.filter((r) => toRentalYmd(r.startDate) === dayYmd);
        revenueSeries.push(buildBucket(formatDdMm(dayYmd), matched));
      }
    } else if (period === "30d") {
      for (let b = 0; b < 10; b++) {
        const startOffset = -29 + b * 3;
        const endOffset = startOffset + 2;
        const startYmd = addDaysYmd(todayStr, startOffset);
        const endYmd = addDaysYmd(todayStr, endOffset);
        const matched = rentals.filter((r) => {
          const ymd = toRentalYmd(r.startDate);
          return ymd >= startYmd && ymd <= endYmd;
        });
        revenueSeries.push(buildBucket(formatDdMm(endYmd), matched));
      }
    } else {
      const monthKeys = [];
      for (let i = 5; i >= 0; i--) {
        const dt = new Date(Date.UTC(ty, tm - 1 - i, 1));
        const ym = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
        monthKeys.push(ym);
      }
      revenueSeries = monthKeys.map((ym) => {
        const matched = rentals.filter((r) => toRentalYmd(r.startDate).slice(0, 7) === ym);
        return buildBucket(formatMmYyyy(ym), matched);
      });
      if (period === "all" && revenueSeries.every((b) => b.rentalCount === 0) && rentals.length > 0) {
        const distinctYms = Array.from(
          new Set(rentals.map((r) => toRentalYmd(r.startDate).slice(0, 7)))
        ).sort().slice(-6);
        revenueSeries = distinctYms.map((ym) => {
          const matched = rentals.filter((r) => toRentalYmd(r.startDate).slice(0, 7) === ym);
          return buildBucket(formatMmYyyy(ym), matched);
        });
      }
    }
    let momoPaidCount = 0;
    let momoPaidAmountVnd = 0;
    let totalCustomers = 0;
    let topShoes = [];
    let lowStockVariants = [];
    if (this.pool) {
      try {
        const [paymentRows] = cutoffYmd !== null ? await this.pool.query(
          `SELECT COUNT(*) AS cnt, COALESCE(SUM(rp.amount_vnd), 0) AS total_vnd
                 FROM rental_payments rp
                 INNER JOIN rentals r ON r.rental_id = rp.rental_id
                 WHERE rp.status = 'PAID' AND r.start_date >= ?`,
          [cutoffYmd]
        ) : await this.pool.query(
          `SELECT COUNT(*) AS cnt, COALESCE(SUM(amount_vnd), 0) AS total_vnd
                 FROM rental_payments WHERE status = 'PAID'`
        );
        if (paymentRows.length > 0) {
          momoPaidCount = Number(paymentRows[0]["cnt"] || 0);
          momoPaidAmountVnd = Number(paymentRows[0]["total_vnd"] || 0);
        }
      } catch {
      }
      try {
        const [custRows] = await this.pool.query(
          `SELECT COUNT(*) AS cnt FROM customers WHERE is_active = 1`
        );
        if (custRows.length > 0) {
          totalCustomers = Number(custRows[0]["cnt"] || 0);
        }
      } catch {
      }
      try {
        const [shoeRows] = cutoffYmd !== null ? await this.pool.query(
          `SELECT
                   ri.shoe_id AS shoeId,
                   MAX(ri.shoe_name) AS shoeName,
                   COUNT(DISTINCT ri.rental_id) AS totalRentalsCount,
                   COALESCE(SUM(ri.quantity), 0) AS totalUnitsRented,
                   (SELECT ROUND(AVG(sr.rating), 1) FROM shoe_reviews sr WHERE sr.shoe_id = ri.shoe_id) AS averageRating
                 FROM rental_items ri
                 INNER JOIN rentals r ON r.rental_id = ri.rental_id
                 WHERE r.status IN ('RESERVED', 'ACTIVE', 'RETURNED') AND r.start_date >= ?
                 GROUP BY ri.shoe_id
                 ORDER BY totalUnitsRented DESC, totalRentalsCount DESC
                 LIMIT 5`,
          [cutoffYmd]
        ) : await this.pool.query(
          `SELECT
                   ri.shoe_id AS shoeId,
                   MAX(ri.shoe_name) AS shoeName,
                   COUNT(DISTINCT ri.rental_id) AS totalRentalsCount,
                   COALESCE(SUM(ri.quantity), 0) AS totalUnitsRented,
                   (SELECT ROUND(AVG(sr.rating), 1) FROM shoe_reviews sr WHERE sr.shoe_id = ri.shoe_id) AS averageRating
                 FROM rental_items ri
                 INNER JOIN rentals r ON r.rental_id = ri.rental_id
                 WHERE r.status IN ('RESERVED', 'ACTIVE', 'RETURNED')
                 GROUP BY ri.shoe_id
                 ORDER BY totalUnitsRented DESC, totalRentalsCount DESC
                 LIMIT 5`
        );
        topShoes = shoeRows.map((row) => ({
          shoeId: String(row["shoeId"]),
          shoeName: String(row["shoeName"]),
          totalRentalsCount: Number(row["totalRentalsCount"] || 0),
          totalUnitsRented: Number(row["totalUnitsRented"] || 0),
          averageRating: row["averageRating"] !== null ? Number(row["averageRating"]) : null
        }));
      } catch {
      }
      try {
        const [lowStockRows] = await this.pool.query(
          `SELECT
             sv.variant_id AS variantId,
             sv.shoe_id AS shoeId,
             s.name AS shoeName,
             sv.size AS size,
             c.name AS color,
             sv.on_hand_quantity AS totalQuantity,
             COALESCE(SUM(CASE WHEN r.rental_id IS NOT NULL THEN ri.quantity ELSE 0 END), 0) AS reservedToday
           FROM shoe_variants sv
           INNER JOIN shoes s ON s.shoe_id = sv.shoe_id
           INNER JOIN colors c ON c.id = sv.color_id
           LEFT JOIN rental_items ri ON ri.variant_id = sv.variant_id
           LEFT JOIN rentals r ON r.rental_id = ri.rental_id
             AND (
               (r.status = 'RESERVED' AND r.start_date <= ? AND r.expected_return_date >= ?)
               OR (r.status = 'ACTIVE' AND r.start_date <= ?)
             )
           WHERE s.is_active = 1
           GROUP BY sv.variant_id, sv.shoe_id, s.name, sv.size, c.name, sv.on_hand_quantity
           HAVING sv.on_hand_quantity <= 2
              OR (sv.on_hand_quantity - COALESCE(SUM(CASE WHEN r.rental_id IS NOT NULL THEN ri.quantity ELSE 0 END), 0)) <= 1
           ORDER BY (sv.on_hand_quantity - COALESCE(SUM(CASE WHEN r.rental_id IS NOT NULL THEN ri.quantity ELSE 0 END), 0)) ASC,
                    sv.on_hand_quantity ASC,
                    s.name ASC
           LIMIT 12`,
          [todayStr, todayStr, todayStr]
        );
        lowStockVariants = lowStockRows.map((row) => {
          const totalQuantity = Number(row["totalQuantity"] || 0);
          const reservedToday = Number(row["reservedToday"] || 0);
          return {
            variantId: String(row["variantId"]),
            shoeId: String(row["shoeId"]),
            shoeName: String(row["shoeName"]),
            size: Number(row["size"] || 0),
            color: String(row["color"]),
            totalQuantity,
            reservedToday,
            availableToday: Math.max(0, totalQuantity - reservedToday)
          };
        });
      } catch {
      }
    }
    res.json({
      period,
      totalRentals,
      statusCounts,
      overdueCount,
      totalRevenueReturned,
      activeExpectedRevenue,
      totalLateFeesCollected,
      momoPaidCount,
      momoPaidAmountVnd,
      totalCustomers,
      topShoes,
      lowStockVariants,
      revenueSeries
    });
  }
  async getActivityFeed(req, res) {
    await this.lazySweepExpiredMomo();
    const rawTypeInput = String(req.query["type"] ?? "ALL").trim().toUpperCase();
    const allowedTypes = /* @__PURE__ */ new Set([
      "ALL",
      "RESERVED",
      "MOMO",
      "MOMO_PAID",
      "MOMO_EXPIRED",
      "ACTIVE",
      "RETURNED",
      "CANCELLED",
      "REVIEW"
    ]);
    const rawType = allowedTypes.has(rawTypeInput) ? rawTypeInput : "ALL";
    const parsedLimit = Number(req.query["limit"] ?? 20);
    const limit = Number.isFinite(parsedLimit) ? Math.min(50, Math.max(1, Math.trunc(parsedLimit))) : 20;
    const events = [];
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const toIso = (val, fallbackIso) => {
      if (val instanceof Date && !Number.isNaN(val.getTime())) {
        return val.toISOString();
      }
      if (typeof val === "string" && val.trim() !== "") {
        const d = new Date(val);
        if (!Number.isNaN(d.getTime())) {
          return d.toISOString();
        }
      }
      return fallbackIso;
    };
    const recentList = await this.listRentals.execute();
    const summaryById = new Map(recentList.rentals.map((r) => [r.rentalId, r]));
    if (this.pool) {
      try {
        const [rentalRows] = await this.pool.query(
          `SELECT r.*, c.full_name AS customer_name
           FROM rentals r
           LEFT JOIN customers c ON c.customer_id = r.customer_id
           ORDER BY COALESCE(r.updated_at, r.cancelled_at, r.activated_at, r.created_at) DESC
           LIMIT 40`
        );
        for (const row of rentalRows) {
          const rentalId = String(row["rental_id"]);
          const summary = summaryById.get(rentalId);
          const customerName = String(
            row["customer_name"] ?? summary?.customerId ?? row["customer_id"] ?? "Khách hàng"
          );
          const totalItems = summary?.totalItems ?? 1;
          const totalAmount = summary?.totalAmount ?? 0;
          const status = String(row["status"] ?? summary?.status ?? "RESERVED");
          const createdAtIso = toIso(row["created_at"] ?? row["start_date"], nowIso);
          events.push({
            id: `rental-reserved-${rentalId}`,
            type: "RESERVED",
            title: `Đơn thuê mới #${rentalId}`,
            subtitle: `${customerName} đặt ${totalItems} đôi giày`,
            amountVnd: totalAmount,
            rating: null,
            link: `/admin/rentals/${rentalId}`,
            timestamp: createdAtIso
          });
          if (row["activated_at"] !== null && row["activated_at"] !== void 0) {
            events.push({
              id: `rental-active-${rentalId}`,
              type: "ACTIVE",
              title: `Đã giao giày #${rentalId}`,
              subtitle: `${customerName} đang thuê (${totalItems} đôi)`,
              amountVnd: totalAmount,
              rating: null,
              link: `/admin/rentals/${rentalId}`,
              timestamp: toIso(row["activated_at"], createdAtIso)
            });
          }
          if (status === "RETURNED") {
            events.push({
              id: `rental-returned-${rentalId}`,
              type: "RETURNED",
              title: `Đã hoàn trả #${rentalId}`,
              subtitle: `${customerName} hoàn tất trả giày`,
              amountVnd: totalAmount,
              rating: null,
              link: `/admin/rentals/${rentalId}`,
              timestamp: toIso(
                row["updated_at"] ?? row["actual_return_date"] ?? row["created_at"],
                createdAtIso
              )
            });
          }
          if (status === "CANCELLED") {
            events.push({
              id: `rental-cancelled-${rentalId}`,
              type: "CANCELLED",
              title: `Đã hủy đơn #${rentalId}`,
              subtitle: `${customerName} — đơn đã hủy`,
              amountVnd: totalAmount,
              rating: null,
              link: `/admin/rentals/${rentalId}`,
              timestamp: toIso(
                row["cancelled_at"] ?? row["updated_at"] ?? row["created_at"],
                createdAtIso
              )
            });
          }
        }
      } catch {
      }
      try {
        const [paymentRows] = await this.pool.query(
          `SELECT rp.*, c.full_name AS customer_name
           FROM rental_payments rp
           LEFT JOIN customers c ON c.customer_id = rp.customer_id
           WHERE rp.status IN ('PAID', 'EXPIRED')
           ORDER BY COALESCE(rp.paid_at, rp.updated_at, rp.created_at) DESC
           LIMIT 30`
        );
        for (const row of paymentRows) {
          const paymentId = String(row["id"] ?? row["gateway_order_id"]);
          const rentalId = String(row["rental_id"]);
          const pStatus = String(row["status"]);
          const customerName = String(
            row["customer_name"] ?? row["customer_id"] ?? "Khách hàng"
          );
          const gatewayOrderId = String(row["gateway_order_id"] ?? "");
          const ts = toIso(row["paid_at"] ?? row["updated_at"] ?? row["created_at"], nowIso);
          events.push({
            id: `momo-${paymentId}`,
            type: pStatus === "PAID" ? "MOMO_PAID" : "MOMO_EXPIRED",
            title: pStatus === "PAID" ? `Thanh toán MoMo thành công #${rentalId}` : `Giao dịch MoMo hết hạn #${rentalId}`,
            subtitle: `${customerName} · Mã GD: ${gatewayOrderId}`,
            amountVnd: Number(row["amount_vnd"] || 0),
            rating: null,
            link: `/admin/rentals/${rentalId}`,
            timestamp: ts
          });
        }
      } catch {
      }
      try {
        const [reviewRows] = await this.pool.query(
          `SELECT sr.*, s.name AS shoe_name
           FROM shoe_reviews sr
           LEFT JOIN shoes s ON s.shoe_id = sr.shoe_id
           ORDER BY sr.created_at DESC
           LIMIT 30`
        );
        for (const row of reviewRows) {
          const reviewId = String(
            row["review_id"] ?? row["id"] ?? `${row["shoe_id"]}-${row["customer_id"]}`
          );
          const shoeName = String(row["shoe_name"] ?? row["shoe_id"] ?? "Giày");
          const customerName = String(row["customer_name"] ?? "Khách hàng");
          const comment = String(row["comment"] ?? "").slice(0, 80);
          const rating = Number(row["rating"] || 5);
          const ts = toIso(row["created_at"], nowIso);
          events.push({
            id: `review-${reviewId}`,
            type: "REVIEW",
            title: `Đánh giá ${rating}★ cho ${shoeName}`,
            subtitle: `${customerName}: "${comment}"`,
            amountVnd: null,
            rating,
            link: "/admin/reviews",
            timestamp: ts
          });
        }
      } catch {
      }
    }
    if (!this.pool || events.length === 0) {
      for (const r of recentList.rentals.slice(0, 30)) {
        const createdIso = toIso(r.startDate, nowIso);
        events.push({
          id: `rental-reserved-${r.rentalId}`,
          type: "RESERVED",
          title: `Đơn thuê mới #${r.rentalId}`,
          subtitle: `${r.customerId} đặt ${r.totalItems} đôi giày`,
          amountVnd: r.totalAmount,
          rating: null,
          link: `/admin/rentals/${r.rentalId}`,
          timestamp: createdIso
        });
        if (r.status === "ACTIVE") {
          events.push({
            id: `rental-active-${r.rentalId}`,
            type: "ACTIVE",
            title: `Đã giao giày #${r.rentalId}`,
            subtitle: `${r.customerId} đang thuê (${r.totalItems} đôi)`,
            amountVnd: r.totalAmount,
            rating: null,
            link: `/admin/rentals/${r.rentalId}`,
            timestamp: createdIso
          });
        } else if (r.status === "RETURNED") {
          events.push({
            id: `rental-returned-${r.rentalId}`,
            type: "RETURNED",
            title: `Đã hoàn trả #${r.rentalId}`,
            subtitle: `${r.customerId} hoàn tất trả giày`,
            amountVnd: r.totalAmount,
            rating: null,
            link: `/admin/rentals/${r.rentalId}`,
            timestamp: toIso(r.endDate, createdIso)
          });
        } else if (r.status === "CANCELLED") {
          events.push({
            id: `rental-cancelled-${r.rentalId}`,
            type: "CANCELLED",
            title: `Đã hủy đơn #${r.rentalId}`,
            subtitle: `${r.customerId} — đơn đã hủy`,
            amountVnd: r.totalAmount,
            rating: null,
            link: `/admin/rentals/${r.rentalId}`,
            timestamp: toIso(r.startDate, createdIso)
          });
        }
      }
    }
    const filtered = events.filter((e) => {
      if (rawType === "ALL") return true;
      if (rawType === "MOMO") return e.type === "MOMO_PAID" || e.type === "MOMO_EXPIRED";
      return e.type === rawType;
    });
    filtered.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const sliced = filtered.slice(0, limit);
    res.json({
      type: rawType,
      events: sliced,
      total: filtered.length
    });
  }
}
const LoginBodySchema = z.object({
  email: z.string().min(1, "Email is required.").max(255),
  password: z.string().min(1, "Password is required.").max(128)
});
const phoneSchema = z.string().min(1, "Phone is required.").max(20).transform((v) => v.trim());
const RegisterUserSchema = z.object({
  fullName: z.string().min(1).max(100).trim(),
  email: z.string().email().max(255).transform((v) => v.toLowerCase()),
  phone: phoneSchema,
  password: z.string().min(8, "Password must be at least 8 characters.").max(128)
});
const UpdateProfileSchema = z.object({
  fullName: z.string().min(1).max(100).trim(),
  email: z.string().email().max(255).transform((v) => v.toLowerCase()),
  phone: phoneSchema
});
const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required.").max(128),
  newPassword: z.string().min(8, "New password must be at least 8 characters.").max(128)
});
function createAuthRateLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1e3,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "RATE_LIMITED", message: "Too many attempts. Try again later." }
  });
}
class AuthController {
  loginUser;
  registerUser;
  systemUsers;
  transactionManager;
  updateProfile;
  changePassword;
  bearerAuth;
  customerRepository;
  constructor(loginUser, registerUser, systemUsers, transactionManager, updateProfile, changePassword, bearerAuth, customerRepository) {
    this.loginUser = loginUser;
    this.registerUser = registerUser;
    this.systemUsers = systemUsers;
    this.transactionManager = transactionManager;
    this.updateProfile = updateProfile;
    this.changePassword = changePassword;
    this.bearerAuth = bearerAuth;
    this.customerRepository = customerRepository;
  }
  routes(authLimiter) {
    const router = Router();
    router.post("/login", authLimiter, asyncRoute(this.login.bind(this)));
    router.post("/register", authLimiter, asyncRoute(this.register.bind(this)));
    router.get("/me", this.bearerAuth, asyncRoute(this.me.bind(this)));
    router.patch(
      "/me",
      this.bearerAuth,
      transactionalRoute(this.transactionManager, this.patchMe.bind(this))
    );
    router.post(
      "/change-password",
      authLimiter,
      this.bearerAuth,
      asyncRoute(this.changePasswordHandler.bind(this))
    );
    return router;
  }
  async login(req, res) {
    const body = LoginBodySchema.parse(req.body);
    const result = await this.loginUser.execute(body);
    res.json(result);
  }
  async register(req, res) {
    const body = RegisterUserSchema.parse(req.body);
    const result = await this.registerUser.execute(body);
    res.status(201).json(result);
  }
  async me(req, res) {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ error: "UNAUTHORIZED", message: "Authentication required." });
      return;
    }
    const row = await this.systemUsers.findById(auth.sub);
    if (!row || !row.isActive) {
      res.status(401).json({ error: "UNAUTHORIZED", message: "User not found or account disabled." });
      return;
    }
    const customerId = auth.customerId ?? row.customerId;
    let rank = void 0;
    let rankDiscountPercent = void 0;
    if (customerId && this.customerRepository) {
      const c = await this.customerRepository.findById(customerId);
      if (c) {
        if (!c.isActive) {
          res.status(401).json({ error: "UNAUTHORIZED", message: "Customer profile is disabled." });
          return;
        }
        rank = c.rank;
        rankDiscountPercent = getDiscountPercentByRank(c.rank);
      }
    }
    res.json({
      sub: auth.sub,
      role: auth.role,
      customerId,
      fullName: row.fullName,
      email: row.email,
      phone: row.phone,
      ...rank !== void 0 ? { rank, rankDiscountPercent } : {}
    });
  }
  async patchMe(req, res) {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ error: "UNAUTHORIZED", message: "Authentication required." });
      return;
    }
    const body = UpdateProfileSchema.parse(req.body);
    const result = await this.updateProfile.execute({
      userId: auth.sub,
      fullName: body.fullName,
      email: body.email,
      phone: body.phone
    });
    res.json(result);
  }
  async changePasswordHandler(req, res) {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ error: "UNAUTHORIZED", message: "Authentication required." });
      return;
    }
    const body = ChangePasswordSchema.parse(req.body);
    await this.changePassword.execute({
      userId: auth.sub,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword
    });
    res.status(204).send();
  }
}
const CatalogNameBodySchema = z.object({
  name: z.string().min(1).max(100)
});
const CatalogIdParamSchema = z.object({
  id: z.coerce.number().int().positive()
});
class CatalogAdminController {
  catalog;
  constructor(catalog) {
    this.catalog = catalog;
  }
  routes(guards) {
    const router = Router();
    const admin = guards?.admin ?? [];
    router.post("/catalog/brands", ...admin, asyncRoute(this.createBrand.bind(this)));
    router.patch("/catalog/brands/:id", ...admin, asyncRoute(this.updateBrand.bind(this)));
    router.delete("/catalog/brands/:id", ...admin, asyncRoute(this.deleteBrand.bind(this)));
    router.post("/catalog/categories", ...admin, asyncRoute(this.createCategory.bind(this)));
    router.patch("/catalog/categories/:id", ...admin, asyncRoute(this.updateCategory.bind(this)));
    router.delete("/catalog/categories/:id", ...admin, asyncRoute(this.deleteCategory.bind(this)));
    return router;
  }
  async createBrand(req, res) {
    const body = CatalogNameBodySchema.parse(req.body);
    const row = await this.catalog.createBrand(body.name);
    res.status(201).json(row);
  }
  async updateBrand(req, res) {
    const { id } = CatalogIdParamSchema.parse(req.params);
    const body = CatalogNameBodySchema.parse(req.body);
    await this.catalog.updateBrand(id, body.name);
    res.status(204).end();
  }
  async deleteBrand(req, res) {
    const { id } = CatalogIdParamSchema.parse(req.params);
    await this.catalog.deleteBrand(id);
    res.status(204).end();
  }
  async createCategory(req, res) {
    const body = CatalogNameBodySchema.parse(req.body);
    const row = await this.catalog.createCategory(body.name);
    res.status(201).json(row);
  }
  async updateCategory(req, res) {
    const { id } = CatalogIdParamSchema.parse(req.params);
    const body = CatalogNameBodySchema.parse(req.body);
    await this.catalog.updateCategory(id, body.name);
    res.status(204).end();
  }
  async deleteCategory(req, res) {
    const { id } = CatalogIdParamSchema.parse(req.params);
    await this.catalog.deleteCategory(id);
    res.status(204).end();
  }
}
const ListSystemUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
  search: z.string().max(200).optional()
});
const AdminUpdateSystemUserBodySchema = z.object({
  fullName: z.string().min(1).max(100),
  email: z.string().email().max(255).transform((v) => v.toLowerCase()),
  phone: z.string().max(20).nullable().optional(),
  roleId: z.coerce.number().int().min(1).max(99),
  isActive: z.boolean(),
  customerId: z.union([z.string().min(1).max(20), z.null()]),
  newPassword: z.string().min(8).max(100).optional()
});
class AdminSystemUserController {
  systemUsers;
  listUsers;
  updateUser;
  deleteUser;
  constructor(systemUsers, listUsers, updateUser, deleteUser) {
    this.systemUsers = systemUsers;
    this.listUsers = listUsers;
    this.updateUser = updateUser;
    this.deleteUser = deleteUser;
  }
  routes(transactionManager, guards) {
    const router = Router();
    const admin = guards?.admin ?? [];
    router.get("/", ...admin, asyncRoute(this.list.bind(this)));
    router.get("/:userId", ...admin, asyncRoute(this.getById.bind(this)));
    router.patch(
      "/:userId",
      ...admin,
      transactionalRoute(transactionManager, this.patch.bind(this))
    );
    router.delete("/:userId", ...admin, asyncRoute(this.deleteById.bind(this)));
    return router;
  }
  async list(req, res) {
    const query = ListSystemUsersQuerySchema.parse(req.query);
    const result = await this.listUsers.execute({
      ...query.page !== void 0 ? { page: query.page } : {},
      ...query.pageSize !== void 0 ? { pageSize: query.pageSize } : {},
      ...query.search !== void 0 && query.search.trim() !== "" ? { search: query.search.trim() } : {}
    });
    res.json(result);
  }
  async getById(req, res) {
    const userId = req.params["userId"];
    const user = await this.systemUsers.findById(userId);
    if (!user) {
      throw new NotFoundError("User", userId);
    }
    res.json({
      userId: user.userId,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      roleId: user.roleId,
      customerId: user.customerId,
      isActive: user.isActive
    });
  }
  async patch(req, res) {
    const userId = req.params["userId"];
    const body = AdminUpdateSystemUserBodySchema.parse(req.body);
    const result = await this.updateUser.execute({
      userId,
      fullName: body.fullName,
      email: body.email,
      phone: body.phone ?? null,
      roleId: body.roleId,
      isActive: body.isActive,
      customerId: body.customerId,
      ...body.newPassword !== void 0 ? { newPassword: body.newPassword } : {}
    });
    res.json(result);
  }
  async deleteById(req, res) {
    const auth = req.auth;
    if (!auth?.sub) {
      throw new ValidationError("Authenticated user id missing.");
    }
    const userId = req.params["userId"];
    await this.deleteUser.execute({ userId, requestingUserId: auth.sub });
    res.status(204).end();
  }
}
const AddWishlistBodySchema = z.object({
  shoeId: z.string().min(1).max(10)
});
class WishlistController {
  wishlist;
  constructor(wishlist) {
    this.wishlist = wishlist;
  }
  routes(guards) {
    const router = Router();
    const customer = guards.customer;
    router.get("/shoe-ids", ...customer, asyncRoute(this.getShoeIds.bind(this)));
    router.get("/", ...customer, asyncRoute(this.list.bind(this)));
    router.post("/", ...customer, asyncRoute(this.add.bind(this)));
    router.delete("/clear", ...customer, asyncRoute(this.clear.bind(this)));
    router.delete("/:shoeId", ...customer, asyncRoute(this.remove.bind(this)));
    return router;
  }
  customerId(req) {
    const id = req.auth?.customerId;
    if (!id) {
      throw new ValidationError("Account is not linked to a customer profile.");
    }
    return id;
  }
  async list(req, res) {
    const result = await this.wishlist.listForCustomer(this.customerId(req));
    res.json(result);
  }
  async getShoeIds(req, res) {
    const result = await this.wishlist.getShoeIds(this.customerId(req));
    res.json(result);
  }
  async add(req, res) {
    const body = AddWishlistBodySchema.parse(req.body);
    await this.wishlist.add(this.customerId(req), body.shoeId);
    res.status(204).send();
  }
  async remove(req, res) {
    const shoeId = req.params["shoeId"];
    await this.wishlist.remove(this.customerId(req), shoeId);
    res.status(204).send();
  }
  async clear(req, res) {
    await this.wishlist.clear(this.customerId(req));
    res.status(204).send();
  }
}
function buildSandboxFallbackPayUrl(opts, amount) {
  const transId = String(Date.now());
  const responseTime = String(Date.now());
  const orderType = "momo_wallet";
  const payType = "qr";
  const resultCode = "0";
  const message = "Successful (Sandbox Cloud Fallback)";
  const extraData = "";
  const rawSignature = "accessKey=" + opts.accessKey + "&amount=" + amount + "&extraData=" + extraData + "&message=" + message + "&orderId=" + opts.orderId + "&orderInfo=" + opts.orderInfo + "&orderType=" + orderType + "&partnerCode=" + opts.partnerCode + "&payType=" + payType + "&requestId=" + opts.requestId + "&responseTime=" + responseTime + "&resultCode=" + resultCode + "&transId=" + transId;
  const signature = crypto.createHmac("sha256", opts.secretKey).update(rawSignature).digest("hex");
  const url = new URL(opts.redirectUrl);
  url.searchParams.set("partnerCode", opts.partnerCode);
  url.searchParams.set("accessKey", opts.accessKey);
  url.searchParams.set("orderId", opts.orderId);
  url.searchParams.set("requestId", opts.requestId);
  url.searchParams.set("amount", amount);
  url.searchParams.set("orderInfo", opts.orderInfo);
  url.searchParams.set("orderType", orderType);
  url.searchParams.set("transId", transId);
  url.searchParams.set("resultCode", resultCode);
  url.searchParams.set("message", message);
  url.searchParams.set("payType", payType);
  url.searchParams.set("responseTime", responseTime);
  url.searchParams.set("extraData", extraData);
  url.searchParams.set("signature", signature);
  return url.toString();
}
async function momoCreatePayment(opts) {
  const amount = String(Math.max(0, Math.round(opts.amountVnd)));
  const extraData = "";
  const orderGroupId = "";
  const autoCapture = true;
  const lang = "vi";
  const rawSignature = "accessKey=" + opts.accessKey + "&amount=" + amount + "&extraData=" + extraData + "&ipnUrl=" + opts.ipnUrl + "&orderId=" + opts.orderId + "&orderInfo=" + opts.orderInfo + "&partnerCode=" + opts.partnerCode + "&redirectUrl=" + opts.redirectUrl + "&requestId=" + opts.requestId + "&requestType=" + opts.requestType;
  const signature = crypto.createHmac("sha256", opts.secretKey).update(rawSignature).digest("hex");
  const body = JSON.stringify({
    partnerCode: opts.partnerCode,
    partnerName: opts.partnerName,
    storeId: opts.storeId,
    requestId: opts.requestId,
    amount,
    orderId: opts.orderId,
    orderInfo: opts.orderInfo,
    redirectUrl: opts.redirectUrl,
    ipnUrl: opts.ipnUrl,
    lang,
    requestType: opts.requestType,
    autoCapture,
    extraData,
    orderGroupId,
    signature
  });
  try {
    const res = await fetch(opts.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body
    });
    const rawText = await res.text();
    if (res.status === 403 && opts.apiUrl.includes("test-payment.momo.vn")) {
      return {
        ok: true,
        payUrl: buildSandboxFallbackPayUrl(opts, amount),
        orderId: opts.orderId,
        requestId: opts.requestId
      };
    }
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      return {
        ok: false,
        resultCode: -1,
        message: `Invalid JSON from MoMo gateway: ${rawText.slice(0, 200)}`
      };
    }
    if (data.resultCode === 0 && data.payUrl) {
      return { ok: true, payUrl: data.payUrl, orderId: opts.orderId, requestId: opts.requestId };
    }
    return { ok: false, resultCode: data.resultCode ?? -1, message: data.message ?? "MoMo gateway error" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error calling MoMo gateway";
    return { ok: false, resultCode: -1, message: msg };
  }
}
function verifyMomoIpnSignature(body, secretKey) {
  const accessKey = String(body.accessKey || process.env.MOMO_ACCESS_KEY?.trim() || "");
  const amount = String(body.amount ?? "");
  const extraData = String(body.extraData ?? "");
  const message = String(body.message ?? "");
  const orderId = String(body.orderId ?? "");
  const orderInfo = String(body.orderInfo ?? "");
  const orderType = String(body.orderType ?? "");
  const partnerCode = String(body.partnerCode ?? "");
  const payType = String(body.payType ?? "");
  const requestId = String(body.requestId ?? "");
  const responseTime = String(body.responseTime ?? "");
  const resultCode = String(body.resultCode ?? "");
  const transId = String(body.transId ?? "");
  const expected = String(body.signature ?? "");
  const rawSignature = "accessKey=" + accessKey + "&amount=" + amount + "&extraData=" + extraData + "&message=" + message + "&orderId=" + orderId + "&orderInfo=" + orderInfo + "&orderType=" + orderType + "&partnerCode=" + partnerCode + "&payType=" + payType + "&requestId=" + requestId + "&responseTime=" + responseTime + "&resultCode=" + resultCode + "&transId=" + transId;
  const signature = crypto.createHmac("sha256", secretKey).update(rawSignature).digest("hex");
  return signature === expected;
}
class RateLimitError extends DomainError {
  constructor(code, message) {
    super(code, message);
  }
}
const CreateBodySchema = z.object({
  rentalId: z.string().min(1)
});
function resolveRequestOrigin(req) {
  const rawHost = req.headers["x-forwarded-host"] ?? req.headers.host;
  const host = Array.isArray(rawHost) ? rawHost[0] : rawHost;
  if (!host) return null;
  const rawProto = req.headers["x-forwarded-proto"];
  const proto = (Array.isArray(rawProto) ? rawProto[0] : rawProto) || (host.includes("localhost") ? "http" : "https");
  return `${proto.split(",")[0].trim()}://${host.split(",")[0].trim()}`;
}
function isMomoConfigured() {
  return process.env.MOMO_ENABLED === "true" && Boolean(process.env.MOMO_ACCESS_KEY?.trim()) && Boolean(process.env.MOMO_SECRET_KEY?.trim()) && Boolean(process.env.MOMO_PARTNER_CODE?.trim());
}
function usdToVnd(usd) {
  const raw = process.env.PAYMENT_USD_TO_VND_RATE?.trim();
  const rate = raw ? Number(raw) : 1;
  const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 1;
  const vnd = Math.round(usd * safeRate);
  return Math.max(1e3, vnd);
}
function paymentPendingMinutes() {
  const n = Number(process.env.PAYMENT_PENDING_MINUTES?.trim() ?? "15");
  if (!Number.isFinite(n)) return 15;
  return Math.min(1440, Math.max(1, Math.floor(n)));
}
function maxMomoAttemptsPerHour() {
  const n = Number(process.env.MOMO_MAX_PAYMENT_ATTEMPTS_PER_HOUR?.trim() ?? "5");
  if (!Number.isFinite(n)) return 5;
  return Math.max(1, Math.floor(n));
}
class MomoPaymentController {
  getRental;
  rentalPayments;
  expirePendingOnlinePayments;
  constructor(getRental, rentalPayments, expirePendingOnlinePayments) {
    this.getRental = getRental;
    this.rentalPayments = rentalPayments;
    this.expirePendingOnlinePayments = expirePendingOnlinePayments;
  }
  routes(createGuards, statusGuards = createGuards) {
    const router = Router();
    router.post("/payments/momo/create", ...createGuards, asyncRoute(this.create.bind(this)));
    router.get("/payments/momo/status", ...statusGuards, asyncRoute(this.getStatus.bind(this)));
    router.post("/payments/momo/ipn", asyncRoute(this.ipn.bind(this)));
    return router;
  }
  async getStatus(req, res) {
    const rawIds = String(req.query.rentalIds ?? "").trim();
    if (!rawIds) {
      res.json({ payments: {} });
      return;
    }
    const ids = rawIds.split(",").map((id) => id.trim()).filter((id) => id.length > 0).slice(0, 50);
    const auth = req.auth;
    let customerId;
    if (auth?.role === "customer") {
      if (!auth.customerId) {
        throw new ValidationError("Account is not linked to a customer profile.");
      }
      customerId = auth.customerId;
    }
    if (this.expirePendingOnlinePayments) {
      await this.expirePendingOnlinePayments.execute().catch(() => void 0);
    }
    const payments = await this.rentalPayments.findLatestByRentalIds(ids, customerId);
    res.json({ payments });
  }
  async create(req, res) {
    if (!isMomoConfigured()) {
      res.json({ skipped: true, payUrl: null });
      return;
    }
    const auth = req.auth;
    if (!auth?.customerId) {
      res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Account is not linked to a customer profile."
      });
      return;
    }
    const body = CreateBodySchema.parse(req.body);
    const customerId = auth.customerId;
    const rental = await this.getRental.execute({
      rentalId: body.rentalId,
      requestingCustomerId: customerId
    });
    if (rental.status !== "RESERVED") {
      throw new ValidationError("Only RESERVED rentals can be paid online.");
    }
    const since = new Date(Date.now() - 60 * 60 * 1e3);
    const attempts = await this.rentalPayments.countMomoAttemptsSince(customerId, since);
    if (attempts >= maxMomoAttemptsPerHour()) {
      throw new RateLimitError(
        "PAYMENT_RATE_LIMIT",
        "Too many online payment attempts. Please try again later."
      );
    }
    await this.rentalPayments.cancelPendingForRental(rental.rentalId);
    const partnerCode = process.env.MOMO_PARTNER_CODE.trim();
    const accessKey = process.env.MOMO_ACCESS_KEY.trim();
    const secretKey = process.env.MOMO_SECRET_KEY.trim();
    const partnerName = process.env.MOMO_PARTNER_NAME?.trim() || "Rental Shoe";
    const storeId = process.env.MOMO_STORE_ID?.trim() || "RentalShoeStore";
    const requestType = process.env.MOMO_REQUEST_TYPE?.trim() || "captureWallet";
    const apiHost = process.env.MOMO_API_HOST?.trim() || "https://test-payment.momo.vn";
    const apiPath = process.env.MOMO_API_PATH?.trim() || "/v2/gateway/api/create";
    const apiUrl = `${apiHost.replace(/\/$/, "")}${apiPath.startsWith("/") ? "" : "/"}${apiPath}`;
    const reqOrigin = resolveRequestOrigin(req);
    const frontendEnv = process.env.FRONTEND_ORIGIN?.trim();
    const useFrontendEnv = frontendEnv && !(process.env.VERCEL && frontendEnv.includes("localhost"));
    const frontend = (useFrontendEnv ? frontendEnv : reqOrigin || "http://localhost:5173").replace(/\/$/, "");
    const redirectUrl = `${frontend}/payment/momo/return`;
    const port = process.env.PORT ?? "3000";
    const apiPublicEnv = process.env.API_PUBLIC_BASE_URL?.trim();
    const useApiPublicEnv = apiPublicEnv && !(process.env.VERCEL && apiPublicEnv.includes("localhost"));
    const apiPublic = (useApiPublicEnv ? apiPublicEnv : reqOrigin || `http://localhost:${port}`).replace(/\/$/, "");
    const ipnUrl = `${apiPublic}/api/v1/payments/momo/ipn`;
    const orderId = `RS${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
    const requestId = orderId;
    const orderInfo = `Rental ${rental.rentalId}`.slice(0, 240);
    const amountVnd = usdToVnd(rental.totalAmount);
    const result = await momoCreatePayment({
      partnerCode,
      accessKey,
      secretKey,
      partnerName,
      storeId,
      orderId,
      requestId,
      amountVnd,
      orderInfo,
      redirectUrl,
      ipnUrl,
      requestType,
      apiUrl
    });
    if (!result.ok) {
      res.status(502).json({
        error: "PAYMENT_GATEWAY_ERROR",
        message: result.message,
        details: { resultCode: result.resultCode }
      });
      return;
    }
    const expiresAt = new Date(Date.now() + paymentPendingMinutes() * 60 * 1e3);
    await this.rentalPayments.insertPending({
      rentalId: rental.rentalId,
      customerId,
      provider: "momo",
      gatewayOrderId: orderId,
      gatewayRequestId: requestId,
      amountVnd,
      expiresAt
    });
    res.json({ skipped: false, payUrl: result.payUrl });
  }
  async ipn(req, res) {
    const secret = process.env.MOMO_SECRET_KEY?.trim();
    const body = req.body ?? {};
    if (!secret) {
      res.status(503).json({ message: "MoMo IPN is not configured" });
      return;
    }
    const asStrings = {};
    for (const [k, v] of Object.entries(body)) {
      asStrings[k] = v;
    }
    if (!verifyMomoIpnSignature(asStrings, secret)) {
      res.status(400).json({ message: "Invalid MoMo signature" });
      return;
    }
    const orderId = body.orderId != null ? String(body.orderId) : "";
    if (!orderId) {
      res.status(400).json({ message: "Missing orderId" });
      return;
    }
    const payment = await this.rentalPayments.findByGatewayOrderId(orderId);
    if (!payment) {
      console.warn("[momo ipn] No rental_payment for orderId", orderId);
      res.status(200).json({ resultCode: 0, message: "Success" });
      return;
    }
    if (payment.status !== "PENDING") {
      res.status(200).json({ resultCode: 0, message: "Success" });
      return;
    }
    const amountStr = body.amount != null ? String(body.amount) : "";
    const expectedAmount = String(payment.amountVnd);
    if (amountStr && amountStr !== expectedAmount) {
      console.error("[momo ipn] Amount mismatch", {
        orderId,
        expected: expectedAmount,
        got: amountStr
      });
      await this.rentalPayments.updateFromIpn(payment.id, {
        status: "FAILED",
        gatewayResultCode: String(body.resultCode ?? ""),
        gatewayMessage: "Amount mismatch",
        rawIpnJson: JSON.stringify(body)
      });
      res.status(200).json({ resultCode: 0, message: "Success" });
      return;
    }
    const rawJson = JSON.stringify(body);
    const ok = body.resultCode === 0 || body.resultCode === "0";
    if (ok) {
      await this.rentalPayments.updateFromIpn(payment.id, {
        status: "PAID",
        paidAt: /* @__PURE__ */ new Date(),
        gatewayTransId: body.transId != null ? String(body.transId) : null,
        gatewayResultCode: String(body.resultCode ?? ""),
        gatewayMessage: body.message != null ? String(body.message) : null,
        rawIpnJson: rawJson
      });
      console.log("[momo ipn] Payment success", {
        orderId,
        transId: body.transId,
        rentalId: payment.rentalId
      });
    } else {
      await this.rentalPayments.updateFromIpn(payment.id, {
        status: "FAILED",
        gatewayResultCode: String(body.resultCode ?? ""),
        gatewayMessage: body.message != null ? String(body.message) : null,
        rawIpnJson: rawJson
      });
      console.log("[momo ipn] Payment failed", {
        resultCode: body.resultCode,
        orderId,
        rentalId: payment.rentalId
      });
    }
    res.status(200).json({ resultCode: 0, message: "Success" });
  }
}
const CreateVoucherSchema = z.object({
  code: z.string().trim().min(2).max(32).regex(/^[A-Za-z0-9_-]+$/, "Mã voucher chỉ bao gồm chữ cái, số, gạch dưới và gạch nối."),
  discountPercent: z.number().int().min(1).max(50),
  description: z.string().trim().min(1).max(255),
  isActive: z.boolean().optional().default(true),
  maxUses: z.number().int().min(1).nullable().optional(),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Ngày hết hạn phải theo định dạng YYYY-MM-DD.").transform((s) => s.slice(0, 10)).nullable().optional()
});
const UpdateVoucherSchema = z.object({
  discountPercent: z.number().int().min(1).max(50).optional(),
  description: z.string().trim().min(1).max(255).optional(),
  isActive: z.boolean().optional(),
  maxUses: z.number().int().min(1).nullable().optional(),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Ngày hết hạn phải theo định dạng YYYY-MM-DD.").transform((s) => s.slice(0, 10)).nullable().optional()
});
class VoucherController {
  voucherRepo;
  constructor(voucherRepo) {
    this.voucherRepo = voucherRepo;
  }
  routes(adminGuards) {
    const router = Router();
    router.get("/", ...adminGuards, asyncRoute(this.listAll.bind(this)));
    router.post("/", ...adminGuards, asyncRoute(this.create.bind(this)));
    router.patch("/:code", ...adminGuards, asyncRoute(this.update.bind(this)));
    router.delete("/:code", ...adminGuards, asyncRoute(this.delete.bind(this)));
    return router;
  }
  async listAll(_req, res) {
    const vouchers = await this.voucherRepo.listAll();
    res.json({ vouchers });
  }
  async create(req, res) {
    const body = CreateVoucherSchema.parse(req.body);
    const code = body.code.toUpperCase();
    const existing = await this.voucherRepo.findByCode(code);
    if (existing) {
      throw new ValidationError(`Mã voucher ${code} đã tồn tại.`);
    }
    const saved = await this.voucherRepo.save({
      code,
      discountPercent: body.discountPercent,
      description: body.description,
      isActive: body.isActive ?? true,
      maxUses: body.maxUses ?? null,
      expiresAt: body.expiresAt ?? null
    });
    res.status(201).json(saved);
  }
  async update(req, res) {
    const rawCode = String(req.params["code"] ?? "").trim().toUpperCase();
    const existing = await this.voucherRepo.findByCode(rawCode);
    if (!existing) {
      throw new NotFoundError("Voucher", rawCode);
    }
    const body = UpdateVoucherSchema.parse(req.body);
    if (body.maxUses !== void 0 && body.maxUses !== null && body.maxUses < existing.usedCount) {
      throw new ValidationError(
        `Giới hạn lượt dùng (${body.maxUses}) không thể nhỏ hơn số lượt đã dùng (${existing.usedCount}).`
      );
    }
    const updated = await this.voucherRepo.save({
      code: existing.code,
      discountPercent: body.discountPercent ?? existing.discountPercent,
      description: body.description ?? existing.description,
      isActive: body.isActive !== void 0 ? body.isActive : existing.isActive,
      maxUses: body.maxUses !== void 0 ? body.maxUses : existing.maxUses,
      expiresAt: body.expiresAt !== void 0 ? body.expiresAt : existing.expiresAt
    });
    res.json(updated);
  }
  async delete(req, res) {
    const rawCode = String(req.params["code"] ?? "").trim().toUpperCase();
    const deleted = await this.voucherRepo.deleteByCode(rawCode);
    if (!deleted) {
      throw new NotFoundError("Voucher", rawCode);
    }
    res.status(204).end();
  }
}
const SHOE_RENTAL_FUNCTION_DECLARATIONS = [
  {
    name: "list_my_rentals",
    description: "List rental order IDs, overdue status, and basic info for the currently logged-in customer. Requires customer login."
  },
  {
    name: "get_rental_detail",
    description: "Get status, dates, deposit, and items for one rental by rental id. Requires customer login.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        rental_id: {
          type: SchemaType.STRING,
          description: "Rental id, e.g. Rxxxxxxxx"
        }
      },
      required: ["rental_id"]
    }
  },
  {
    name: "get_my_membership_rank",
    description: "Get current membership rank (BRONZE, SILVER, GOLD, DIAMOND) and automatic discount percent for the logged-in customer. Requires customer login."
  },
  {
    name: "list_active_vouchers",
    description: "List currently active promotional vouchers (code, discountPercent, description, expiresAt). Does not require login."
  },
  {
    name: "search_shoes",
    description: "Search shoes by maximum price per day in VND (storefront catalog, typically 180,000 to 550,000 VND/day). Does not require login.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        max_price_vnd: {
          type: SchemaType.NUMBER,
          description: "Maximum price per day in VND (e.g. pass 300000 for 300,000 VND/day)"
        },
        max_price_usd: {
          type: SchemaType.NUMBER,
          description: "Maximum price per day in VND (legacy alias, e.g. pass 300000 for 300,000 VND/day)"
        }
      }
    }
  },
  {
    name: "check_shoe_availability",
    description: "Check variant availability for a shoe_id between start_date (YYYY-MM-DD) and end_date (YYYY-MM-DD). Does not require login.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        shoe_id: {
          type: SchemaType.STRING,
          description: "Shoe id, e.g. SHOE001"
        },
        start_date: {
          type: SchemaType.STRING,
          description: "Rental start date in YYYY-MM-DD format"
        },
        end_date: {
          type: SchemaType.STRING,
          description: "Rental end date in YYYY-MM-DD format"
        }
      },
      required: ["shoe_id", "start_date", "end_date"]
    }
  }
];
function safeResponseText(response) {
  try {
    return response.text().trim();
  } catch {
    return "";
  }
}
function stripLeadingAssistantTurns(turns) {
  let i = 0;
  while (i < turns.length && turns[i].role === "assistant") {
    i += 1;
  }
  return turns.slice(i);
}
async function geminiChatWithTools(opts) {
  const { apiKey, model, systemInstruction, turns, executeTool, maxToolRounds = 8 } = opts;
  const normalized = stripLeadingAssistantTurns(turns);
  if (normalized.length === 0) {
    throw new Error("Không có tin nhắn để gửi.");
  }
  const last = normalized[normalized.length - 1];
  if (last.role !== "user") {
    throw new Error("Tin nhắn cuối phải của người dùng.");
  }
  const history = [];
  for (let i = 0; i < normalized.length - 1; i++) {
    const m = normalized[i];
    history.push({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }]
    });
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  const genModel = genAI.getGenerativeModel({
    model,
    systemInstruction,
    tools: [{ functionDeclarations: [...SHOE_RENTAL_FUNCTION_DECLARATIONS] }],
    toolConfig: {
      functionCallingConfig: { mode: FunctionCallingMode.AUTO }
    }
  });
  const chat = genModel.startChat({ history });
  let result = await chat.sendMessage(last.content);
  let response = result.response;
  let rounds = 0;
  while (rounds < maxToolRounds) {
    rounds += 1;
    const calls = response.functionCalls();
    if (!calls || calls.length === 0) {
      const text = safeResponseText(response);
      if (text) return text;
      break;
    }
    const parts = [];
    for (const call of calls) {
      const rawArgs = call.args;
      const args = rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs) ? rawArgs : {};
      const toolResult = await executeTool(call.name, args);
      const asObject = toolResult !== null && typeof toolResult === "object" && !Array.isArray(toolResult) ? toolResult : { result: toolResult };
      parts.push({
        functionResponse: {
          name: call.name,
          response: asObject
        }
      });
    }
    result = await chat.sendMessage(parts);
    response = result.response;
  }
  const fallback = safeResponseText(response);
  return fallback || "Xin lỗi, mình chưa trả lời được. Thử lại sau nhé.";
}
function getVietnamTodayYmd(now = /* @__PURE__ */ new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value ?? String(now.getFullYear());
  const m = parts.find((p) => p.type === "month")?.value ?? String(now.getMonth() + 1).padStart(2, "0");
  const d = parts.find((p) => p.type === "day")?.value ?? String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function detectSecurityViolation(text, customerId) {
  const normalized = text.trim();
  if (/ignore previous|ignore all instructions|bỏ qua hướng dẫn|system prompt|reveal prompt|select\s+\*\s+from|union\s+select|information_schema|password_hash|jwt_secret|system_users|drop\s+table|delete\s+from|doanh thu admin|báo cáo doanh thu|đơn của khách khác|thông tin khách khác|danh sách khách hàng/i.test(
    normalized
  )) {
    return "🔒 Vì lý do bảo mật (Zero-Trust Read-Only Policy), trợ lý AI chỉ được phép tra cứu thông tin công khai và dữ liệu đơn thuê/hạng thành viên của chính tài khoản bạn đang đăng nhập. Mình không thể truy cập dữ liệu của khách hàng khác, doanh thu Admin, hoặc can thiệp trực tiếp vào cơ sở dữ liệu.";
  }
  const custMatches = normalized.matchAll(/\b(CUST\d{3,})\b/gi);
  for (const m of custMatches) {
    if (m[1].toUpperCase() !== (customerId ?? "").toUpperCase()) {
      return "🔒 Vì lý do bảo mật, bạn chỉ có thể tra cứu dữ liệu thuộc tài khoản của chính mình, không thể xem thông tin của mã khách hàng khác.";
    }
  }
  return null;
}
const BodySchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().max(8e3)
    })
  ).min(1).max(24)
});
function defaultKnowledgePath() {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "../../../knowledge/gemini-context.md");
}
function loadKnowledgeText() {
  const fromEnv = process.env.GEMINI_KNOWLEDGE_PATH?.trim();
  const path2 = fromEnv && fromEnv.length > 0 ? fromEnv : defaultKnowledgePath();
  if (!existsSync(path2)) {
    return "(Knowledge file not found; answer only from tools and general safe guidance.)";
  }
  return readFileSync(path2, "utf-8");
}
function mergeShoeLists(lists) {
  const map = /* @__PURE__ */ new Map();
  for (const list of lists) {
    for (const s of list) {
      if (!map.has(s.shoeId)) map.set(s.shoeId, s);
    }
  }
  return [...map.values()];
}
class ChatController {
  listRentals;
  getRental;
  listShoes;
  getShoe;
  availabilityChecker;
  voucherRepository;
  customerRepository;
  constructor(listRentals, getRental, listShoes, getShoe, availabilityChecker, voucherRepository, customerRepository) {
    this.listRentals = listRentals;
    this.getRental = getRental;
    this.listShoes = listShoes;
    this.getShoe = getShoe;
    this.availabilityChecker = availabilityChecker;
    this.voucherRepository = voucherRepository;
    this.customerRepository = customerRepository;
  }
  routes(optionalAuth) {
    const router = Router();
    router.post("/chat", ...optionalAuth, asyncRoute(this.postChat.bind(this)));
    return router;
  }
  async postChat(req, res) {
    const body = BodySchema.parse(req.body);
    const auth = req.auth;
    const customerId = auth?.role === "customer" ? auth.customerId ?? void 0 : void 0;
    const lastUserMsg = [...body.messages].reverse().find((m) => m.role === "user");
    const lastUserText = lastUserMsg?.content ?? "";
    for (const msg of body.messages) {
      if (msg.role === "user") {
        const violation = detectSecurityViolation(msg.content, customerId);
        if (violation) {
          res.json({ reply: violation, mode: "security_guard" });
          return;
        }
      }
    }
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      const reply = await this.buildFallbackReply(lastUserText, customerId);
      res.json({ reply, mode: "fallback" });
      return;
    }
    const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
    const pendingMin = process.env.PAYMENT_PENDING_MINUTES?.trim() || "15";
    const systemText = [
      "You are the storefront assistant for a shoe rental web app.",
      "Follow GuildChatBot rules: no hallucinated data; use tool results for real data.",
      "Strict Zero-Trust Policy: 100% read-only; never expose other customers, PII (email/phone), voucher usedCount/maxUses, or Admin revenue.",
      `Static policy: unpaid MoMo checkout window is typically ~${pendingMin} minutes (then order may auto-cancel).`,
      "--- Allowed knowledge (markdown) ---",
      loadKnowledgeText()
    ].join("\n\n");
    try {
      const lastAssistant = await geminiChatWithTools({
        apiKey,
        model,
        systemInstruction: systemText,
        turns: body.messages.slice(-20),
        executeTool: (name, args) => this.runTool(name, args, customerId)
      });
      res.json({ reply: lastAssistant || "Xin lỗi, mình chưa trả lời được. Thử lại sau nhé." });
    } catch (e) {
      if (e instanceof DomainError) {
        throw e;
      }
      const reply = await this.buildFallbackReply(lastUserText, customerId);
      res.json({ reply, mode: "fallback" });
    }
  }
  async buildFallbackReply(lastUserText, customerId) {
    const violation = detectSecurityViolation(lastUserText, customerId);
    if (violation) {
      return violation;
    }
    const q = lastUserText.toLowerCase();
    if (/hủy đơn giúp|xóa đơn giúp|tạo đơn giúp|đặt thuê giúp|tự động hủy|tự động tạo|cancel order for me/i.test(q)) {
      return "🛡️ Trợ lý AI hoạt động ở chế độ **100% Read-Only (Chỉ đọc)** để bảo vệ an toàn tài khoản của bạn. Mình không trực tiếp tạo, sửa, gia hạn hoặc hủy đơn qua khung chat. Bạn vui lòng thao tác trực tiếp tại trang `/checkout` (đặt đơn) hoặc `/account` (gia hạn / hủy đơn `RESERVED`) nhé!";
    }
    const availMatch = lastUserText.match(/\b(SHOE\d{3,})\b.*?\b(\d{4}-\d{2}-\d{2})\b.*?\b(\d{4}-\d{2}-\d{2})\b/i);
    if (availMatch) {
      const availRes = await this.runTool(
        "check_shoe_availability",
        {
          shoe_id: availMatch[1].toUpperCase(),
          start_date: availMatch[2],
          end_date: availMatch[3]
        },
        customerId
      );
      if (availRes.ok && availRes.variants) {
        const lines = availRes.variants.map(
          (v) => `• Size EU ${v.size} (${v.color}): còn **${v.availableQuantity}** đôi trống`
        );
        return [
          `📅 **Tồn kho khả dụng cho ${availRes.name} (${availMatch[2]} → ${availMatch[3]}):**`,
          ...lines
        ].join("\n");
      }
    }
    if (/voucher|mã giảm|khuyến mãi|ưu đãi/.test(q)) {
      const vRes = await this.runTool("list_active_vouchers", {}, customerId);
      const vouchers = vRes.vouchers ?? [];
      if (vouchers.length === 0) {
        return "Hiện tại chưa có mã voucher khuyến mãi nào đang mở. Tuy nhiên bạn vẫn được giảm tự động theo hạng thành viên (SILVER -5%, GOLD -10%, DIAMOND -15%) khi thuê giày nhé!";
      }
      const lines = vouchers.map(
        (v) => `• **${v.code}** (-${v.discountPercent}%): ${v.description}${v.expiresAt ? ` (HSD: ${v.expiresAt})` : ""}`
      );
      return [
        "🎁 **Các mã giảm giá (Voucher) đang hoạt động:**",
        ...lines,
        "💡 *Lưu ý: Mã giảm giá được cộng dồn với ưu đãi hạng thành viên (tối đa 50%) tại trang `/checkout`.*"
      ].join("\n");
    }
    if (/hạng|rank|thành viên|đơn thuê|đơn của tôi|đơn hàng|quá hạn|trễ hạn/.test(q)) {
      if (!customerId) {
        return "🔑 Bạn cần **đăng nhập tài khoản khách hàng** để mình tra cứu hạng thành viên, mức ưu đãi và danh sách đơn thuê của bạn nhé!";
      }
      const rankRes = await this.runTool("get_my_membership_rank", {}, customerId);
      const rentalsRes = await this.runTool("list_my_rentals", {}, customerId);
      const parts = [];
      if (rankRes.ok && rankRes.rank) {
        parts.push(
          `🏅 **Hạng thành viên của bạn:** **${rankRes.rank}** (Ưu đãi tự động **-${rankRes.rankDiscountPercent ?? 0}%** trên mọi đơn thuê).`
        );
      }
      const list = rentalsRes.rentals ?? [];
      if (list.length === 0) {
        parts.push("📦 Bạn hiện chưa có đơn thuê nào. Hãy ghé `/shoes` để chọn mẫu giày yêu thích nhé!");
      } else {
        const top = list.slice(0, 5).map((r) => {
          const overdueTag = r.isOverdue ? ` ⚠️ Quá hạn ${r.overdueDays} ngày (phí phạt dự kiến +${r.estimatedLateFee.toLocaleString("vi-VN")}₫)` : "";
          return `• Đơn **#${r.rentalId}** [${r.status}] — Tiền thuê: ${r.totalAmount.toLocaleString("vi-VN")}₫ | Cọc: ${r.depositAmount.toLocaleString("vi-VN")}₫${overdueTag}`;
        });
        parts.push(`📦 **Đơn thuê gần đây (${list.length} đơn):**
${top.join("\n")}`);
        parts.push(
          "👉 Bạn có thể xem hóa đơn, tự gia hạn hoặc hủy đơn `RESERVED` trực tiếp tại trang `/account`."
        );
      }
      return parts.join("\n\n");
    }
    if (/giày|shoe|giá|tìm|mẫu|size|nike|adidas/.test(q)) {
      const shoesRes = await this.runTool(
        "search_shoes",
        { max_price_vnd: 55e4 },
        customerId
      );
      const shoes = (shoesRes.shoes ?? []).slice(0, 5);
      if (shoes.length > 0) {
        const lines = shoes.map(
          (s) => `• **${s.name}** (${s.brand}) — **${s.pricePerDay.toLocaleString("vi-VN")}₫/ngày** ${s.inStock ? "✅ Còn hàng" : "❌ Hết hàng"}`
        );
        return [
          "👟 **Gợi ý các mẫu giày nổi bật tại cửa hàng:**",
          ...lines,
          "💡 *Tiền đặt cọc bảo đảm: **500.000₫/đôi** (hoàn trả 100% khi trả giày nguyên vẹn).*"
        ].join("\n");
      }
    }
    return [
      "👋 **Chào bạn! Mình là trợ lý Rental Shoes (Zero-Trust Read-Only Assistant).**",
      "• **Giá thuê giày:** 180.000₫ – 550.000₫/ngày (Tiền cọc bảo đảm: **500.000₫/đôi**, hoàn lại khi trả giày nguyên vẹn).",
      "• **Ưu đãi hạng thành viên:** SILVER (-5%), GOLD (-10%), DIAMOND (-15%) cộng dồn cùng Voucher tối đa **50%**.",
      "• **Gia hạn & Quản lý đơn:** Bạn có thể tự gia hạn đơn `RESERVED`/`ACTIVE` hoặc in biên lai tại trang `/account`.",
      "Hãy hỏi mình về **mã giảm giá**, **tìm giày**, hoặc **đơn thuê của tôi** nhé!"
    ].join("\n");
  }
  async runTool(name, args, customerId) {
    if (name === "list_my_rentals") {
      if (!customerId) {
        return {
          ok: false,
          hint: "Bạn cần đăng nhập tài khoản khách (customer) để xem đơn thuê."
        };
      }
      const result = await this.listRentals.execute({
        customerId,
        page: 1,
        pageSize: 30
      });
      return {
        ok: true,
        rentals: result.rentals.map((r) => ({
          rentalId: r.rentalId,
          status: r.status,
          startDate: r.startDate,
          endDate: r.endDate,
          totalItems: r.totalItems,
          basePrice: r.basePrice,
          depositAmount: r.depositAmount,
          totalAmount: r.totalAmount,
          isOverdue: r.isOverdue,
          overdueDays: r.overdueDays,
          estimatedLateFee: r.estimatedLateFee
        })),
        total: result.total
      };
    }
    if (name === "get_rental_detail") {
      if (!customerId) {
        return { ok: false, hint: "Cần đăng nhập để xem chi tiết đơn." };
      }
      const rentalId = String(args["rental_id"] ?? "").trim();
      if (!rentalId) {
        return { ok: false, error: "Missing rental_id" };
      }
      try {
        const r = await this.getRental.execute({
          rentalId,
          requestingCustomerId: customerId
        });
        return {
          ok: true,
          rentalId: r.rentalId,
          status: r.status,
          startDate: r.startDate,
          endDate: r.endDate,
          totalItems: r.totalItems,
          basePrice: r.basePrice,
          depositAmount: r.depositAmount,
          lateFee: r.lateFee,
          totalAmount: r.totalAmount,
          isOverdue: r.isOverdue,
          overdueDays: r.overdueDays,
          estimatedLateFee: r.estimatedLateFee,
          items: r.items,
          note: r.note
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Not found";
        return { ok: false, error: msg };
      }
    }
    if (name === "get_my_membership_rank") {
      if (!customerId) {
        return {
          ok: false,
          hint: "Bạn cần đăng nhập tài khoản khách hàng để xem hạng thành viên."
        };
      }
      if (!this.customerRepository) {
        return { ok: false, error: "Customer repository is not configured." };
      }
      const c = await this.customerRepository.findById(customerId);
      if (!c) {
        return { ok: false, error: "Customer profile not found." };
      }
      return {
        ok: true,
        rank: c.rank,
        rankDiscountPercent: getDiscountPercentByRank(c.rank)
      };
    }
    if (name === "list_active_vouchers") {
      const todayStr = getVietnamTodayYmd();
      const list = this.voucherRepository ? await this.voucherRepository.listActive(todayStr) : [];
      return {
        ok: true,
        vouchers: list.map((v) => ({
          code: v.code,
          discountPercent: v.discountPercent,
          description: v.description,
          expiresAt: v.expiresAt
        })),
        count: list.length
      };
    }
    if (name === "search_shoes") {
      const maxInput = Number(args["max_price_vnd"] ?? args["max_price_usd"] ?? 55e4);
      if (!Number.isFinite(maxInput) || maxInput <= 0) {
        return { ok: false, error: "Invalid max_price_usd" };
      }
      const shoes = await this.searchShoesByMaxPriceUsd(maxInput);
      return {
        ok: true,
        max_price_usd: maxInput,
        shoes: shoes.map((s) => ({
          shoeId: s.shoeId,
          name: s.name,
          pricePerDay: s.pricePerDay,
          brand: s.brand,
          inStock: s.unitsInStock > 0
        })),
        count: shoes.length
      };
    }
    if (name === "check_shoe_availability") {
      const shoeId = String(args["shoe_id"] ?? "").trim();
      const startDateStr = String(args["start_date"] ?? "").trim();
      const endDateStr = String(args["end_date"] ?? "").trim();
      if (!shoeId || !startDateStr || !endDateStr) {
        return { ok: false, error: "Missing shoe_id, start_date, or end_date" };
      }
      if (!this.getShoe) {
        return { ok: false, error: "Shoe service unavailable" };
      }
      try {
        const shoe = await this.getShoe.execute({ shoeId });
        const period = new RentalPeriod(new Date(startDateStr), new Date(endDateStr));
        const variants = await Promise.all(
          shoe.variants.map(async (v) => {
            const booked = this.availabilityChecker ? await this.availabilityChecker.getReservedQuantityForVariant(v.variantId, period) : v.totalQuantity - v.availableQuantity;
            const availableQuantity = Math.max(0, v.totalQuantity - booked);
            return {
              variantId: v.variantId,
              size: v.size,
              color: v.color,
              availableQuantity,
              inStockForDates: availableQuantity > 0
            };
          })
        );
        return {
          ok: true,
          shoeId: shoe.shoeId,
          name: shoe.name,
          pricePerDay: shoe.pricePerDay,
          startDate: startDateStr,
          endDate: endDateStr,
          variants
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unable to check availability";
        return { ok: false, error: msg };
      }
    }
    return { ok: false, error: "Unknown tool" };
  }
  async searchShoesByMaxPriceUsd(maxInput) {
    const normalizedMaxVnd = maxInput > 0 && maxInput < 1e3 ? maxInput * 1e3 : maxInput;
    const cap = 25;
    let shoes;
    if (normalizedMaxVnd <= 25e4) {
      const r = await this.listShoes.execute({
        priceBucket: "lt10",
        page: 1,
        pageSize: cap
      });
      shoes = r.shoes;
    } else if (normalizedMaxVnd <= 35e4) {
      const a = await this.listShoes.execute({ priceBucket: "lt10", page: 1, pageSize: cap });
      const b = await this.listShoes.execute({ priceBucket: "10to20", page: 1, pageSize: cap });
      shoes = mergeShoeLists([a.shoes, b.shoes]).slice(0, cap);
    } else if (normalizedMaxVnd <= 45e4) {
      const a = await this.listShoes.execute({ priceBucket: "lt10", page: 1, pageSize: 20 });
      const b = await this.listShoes.execute({ priceBucket: "10to20", page: 1, pageSize: 20 });
      const c = await this.listShoes.execute({ priceBucket: "20to50", page: 1, pageSize: 20 });
      shoes = mergeShoeLists([a.shoes, b.shoes, c.shoes]).slice(0, cap);
    } else {
      const r = await this.listShoes.execute({ priceBucket: "all", page: 1, pageSize: cap });
      shoes = r.shoes;
    }
    return shoes.filter((s) => s.pricePerDay <= normalizedMaxVnd);
  }
}
function createBearerAuthMiddleware(accessTokenService) {
  return async (req, res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Missing or invalid Authorization header."
      });
      return;
    }
    const token = header.slice("Bearer ".length).trim();
    if (!token) {
      res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Missing or invalid Authorization header."
      });
      return;
    }
    try {
      const payload = await accessTokenService.verifyAccessToken(token);
      req.auth = payload;
      next();
    } catch {
      res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Invalid or expired token."
      });
    }
  };
}
function createOptionalBearerAuthMiddleware(accessTokenService) {
  return async (req, res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      next();
      return;
    }
    const token = header.slice("Bearer ".length).trim();
    if (!token) {
      next();
      return;
    }
    try {
      const payload = await accessTokenService.verifyAccessToken(token);
      req.auth = payload;
      next();
    } catch {
      res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Invalid or expired token."
      });
    }
  };
}
function createRequireRolesMiddleware(...roles) {
  return (req, res, next) => {
    if (!req.auth) {
      res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Authentication required."
      });
      return;
    }
    if (!roles.includes(req.auth.role)) {
      res.status(403).json({
        error: "FORBIDDEN",
        message: "Insufficient permissions."
      });
      return;
    }
    next();
  };
}
function createRouter(container2) {
  const router = Router();
  const writeBurstLimiter = rateLimit({
    windowMs: 6e4,
    max: 180,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS",
    message: { error: "RATE_LIMITED", message: "Too many write requests. Please slow down." }
  });
  router.use(writeBurstLimiter);
  router.get("/", (_req, res) => {
    res.json({
      ok: true,
      name: "Shoe Rental API",
      version: 1,
      hint: "Open the Vite app at http://localhost:5173 ",
      endpoints: [
        "POST /api/v1/auth/login",
        "POST /api/v1/auth/register",
        "GET /api/v1/auth/me",
        "PATCH /api/v1/auth/me",
        "POST /api/v1/auth/change-password",
        "GET /api/v1/catalog/shoe-lookups",
        "GET /api/v1/shoes (optional ?page=&pageSize=)",
        "GET /api/v1/customers (optional ?page=&pageSize=&search=)",
        "PATCH /api/v1/customers/:id (admin)",
        "DELETE /api/v1/customers/:id (admin)",
        "GET /api/v1/system-users (admin, optional ?page=&pageSize=&search=)",
        "PATCH /api/v1/system-users/:userId (admin)",
        "DELETE /api/v1/system-users/:userId (admin)",
        "DELETE /api/v1/rentals/:id (admin)",
        "GET /api/v1/rentals (optional ?page=&pageSize=&search=)",
        "GET /api/v1/rentals/me (customer)",
        "GET /api/v1/wishlist (customer)",
        "GET /health",
        "POST /api/v1/payments/momo/create (customer bearer)",
        "POST /api/v1/payments/momo/ipn (MoMo server)",
        "POST /api/v1/chat (optional Bearer; AI assistant)"
      ]
    });
  });
  const tx = container2.getTransactionManager();
  const accessTokenService = container2.getAccessTokenService();
  const bearerAuth = createBearerAuthMiddleware(accessTokenService);
  const requireAdmin = createRequireRolesMiddleware("admin");
  const adminGuard = [bearerAuth, requireAdmin];
  const requireCustomerOrAdmin = createRequireRolesMiddleware("admin", "customer");
  const storefrontAuth = [bearerAuth, requireCustomerOrAdmin];
  const requireCustomer = createRequireRolesMiddleware("customer");
  const customerOnlyAuth = [bearerAuth, requireCustomer];
  const authLimiter = createAuthRateLimiter();
  const authCtrl = new AuthController(
    container2.getLoginUserUseCase(),
    container2.getRegisterUserUseCase(),
    container2.getSystemUserRepository(),
    container2.getTransactionManager(),
    container2.getUpdateProfileUseCase(),
    container2.getChangePasswordUseCase(),
    bearerAuth,
    container2.getCustomerRepository()
  );
  router.use("/auth", authCtrl.routes(authLimiter));
  const customerCtrl = new CustomerController(
    container2.getRegisterCustomerUseCase(),
    container2.getListCustomersUseCase(),
    container2.getGetCustomerUseCase(),
    container2.getUpdateCustomerAdminUseCase(),
    container2.getDeleteCustomerAdminUseCase()
  );
  const adminSystemUserCtrl = new AdminSystemUserController(
    container2.getSystemUserRepository(),
    container2.getAdminListSystemUsersUseCase(),
    container2.getAdminUpdateSystemUserUseCase(),
    container2.getDeleteSystemUserAdminUseCase()
  );
  const catalogLookup = container2.getCatalogLookup();
  const shoeCtrl = new ShoeController(
    container2.getAddShoeUseCase(),
    container2.getUpdateShoeUseCase(),
    container2.getDeactivateShoeUseCase(),
    container2.getListShoesUseCase(),
    container2.getGetShoeUseCase(),
    catalogLookup,
    container2.getRentalAvailabilityChecker(),
    container2.getPool()
  );
  const shoeImageCtrl = new ShoeImageController(container2.getUploadShoeImageUseCase());
  const rentalCtrl = new RentalController(
    container2.getCreateRentalUseCase(),
    container2.getActivateRentalUseCase(),
    container2.getReturnRentalUseCase(),
    container2.getCancelRentalUseCase(),
    container2.getListRentalsUseCase(),
    container2.getGetRentalUseCase(),
    container2.getDeleteRentalAdminUseCase(),
    container2.getExtendRentalUseCase(),
    container2.getVoucherRepository(),
    container2.getPool(),
    container2.getExpirePendingOnlinePaymentsService()
  );
  const voucherCtrl = new VoucherController(container2.getVoucherRepository());
  const catalogAdminCtrl = new CatalogAdminController(container2.getCatalogAdminRepository());
  const wishlistCtrl = new WishlistController(container2.getWishlistUseCase());
  const momoPaymentCtrl = new MomoPaymentController(
    container2.getGetRentalUseCase(),
    container2.getRentalPaymentRepository(),
    container2.getExpirePendingOnlinePaymentsService()
  );
  const optionalBearer = createOptionalBearerAuthMiddleware(accessTokenService);
  const chatRateLimit = rateLimit({
    windowMs: 6e4,
    max: 24,
    standardHeaders: true,
    legacyHeaders: false
  });
  const chatCtrl = new ChatController(
    container2.getListRentalsUseCase(),
    container2.getGetRentalUseCase(),
    container2.getListShoesUseCase(),
    container2.getGetShoeUseCase(),
    container2.getRentalAvailabilityChecker(),
    container2.getVoucherRepository(),
    container2.getCustomerRepository()
  );
  router.use(
    "/",
    shoeCtrl.routes(tx, {
      admin: adminGuard,
      authenticated: storefrontAuth,
      customer: customerOnlyAuth
    })
  );
  router.use("/", catalogAdminCtrl.routes({ admin: adminGuard }));
  router.use("/customers", customerCtrl.routes(tx, { admin: adminGuard }));
  router.use("/system-users", adminSystemUserCtrl.routes(tx, { admin: adminGuard }));
  router.use("/shoe-images", shoeImageCtrl.routes({ admin: adminGuard }));
  router.use("/vouchers", voucherCtrl.routes(adminGuard));
  router.use(
    "/rentals",
    rentalCtrl.routes(tx, {
      admin: adminGuard,
      createRental: storefrontAuth,
      customer: customerOnlyAuth
    })
  );
  router.use("/wishlist", wishlistCtrl.routes({ customer: customerOnlyAuth }));
  router.use("/", momoPaymentCtrl.routes(customerOnlyAuth, storefrontAuth));
  router.use("/", chatCtrl.routes([chatRateLimit, optionalBearer]));
  return router;
}
function statusFor(err) {
  if (err instanceof NotFoundError) return 404;
  if (err instanceof ConflictError) return 409;
  if (err instanceof BusinessRuleError) return 422;
  if (err instanceof ValidationError) return 400;
  if (err instanceof UnauthorizedError) return 401;
  if (err instanceof ForbiddenError) return 403;
  if (err instanceof RateLimitError) return 429;
  return 400;
}
function isMulterLimitFileSize(err) {
  return typeof err === "object" && err !== null && err.name === "MulterError" && err.code === "LIMIT_FILE_SIZE";
}
function isPayloadTooLarge(err) {
  if (typeof err !== "object" || err === null) return false;
  const e = err;
  return e.type === "entity.too.large" || e.status === 413 || e.statusCode === 413;
}
function isBodyParseError(err) {
  if (typeof err !== "object" || err === null) return false;
  const e = err;
  return e.type === "entity.parse.failed" || err instanceof SyntaxError && e.status === 400;
}
function errorHandler(err, _req, res, _next) {
  if (isPayloadTooLarge(err)) {
    res.status(413).json({
      error: "PAYLOAD_TOO_LARGE",
      message: "Request payload exceeds the 64 KB limit."
    });
    return;
  }
  if (isBodyParseError(err)) {
    res.status(400).json({
      error: "INVALID_JSON",
      message: "Malformed JSON request body."
    });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Request validation failed.",
      details: err.issues.map((e) => ({ field: e.path.join("."), message: e.message }))
    });
    return;
  }
  if (isMulterLimitFileSize(err)) {
    res.status(400).json({
      error: "FILE_TOO_LARGE",
      message: "Image must be 2 MB or smaller."
    });
    return;
  }
  if (err instanceof DomainError) {
    res.status(statusFor(err)).json({
      error: err.code,
      message: err.message
    });
    return;
  }
  console.error("[Unhandled error]", err);
  res.status(500).json({
    error: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred."
  });
}
const container = new MysqlContainer();
const app = express();
app.get("/health", async (_req, res) => {
  const database = await container.pingDatabase();
  const status = database ? 200 : 503;
  res.status(status).json({
    status: database ? "ok" : "degraded",
    database: database ? "up" : "down"
  });
});
app.use(express.json({ limit: "64kb" }));
app.use("/api/v1", (_req, _res, next) => {
  void container.getExpirePendingOnlinePaymentsService().execute().catch((err) => console.error("[expire pending payments]", err));
  next();
});
app.use("/api/v1", createRouter(container));
app.use(errorHandler);
export {
  app as default
};
