import { ShoeVariant } from './ShoeVariant.entity';
import { RentalItem } from './RentalItem.vo';
import { ValidationError } from './errors/ValidationError';
import { BusinessRuleError } from './errors/BusinessRuleError';

export type ShoeProps = {
  id: string;
  name: string;
  brand: string;
  category: string;
  description?: string | null;
  pricePerDay: number;
  isActive?: boolean;
  variants?: ShoeVariant[];
};

function ensureValidShoeId(id: string): void {
  if (!id || id.trim().length === 0 || id.length > 10) {
    throw new ValidationError('Shoe id must be between 1 and 10 characters.');
  }
}

function ensureValidShoeName(name: string): void {
  if (!name || name.trim().length === 0 || name.trim().length > 100) {
    throw new ValidationError('Shoe name must be between 1 and 100 characters.');
  }
}

function ensureValidShoeLabel(value: string, label: string): void {
  if (!value || value.trim().length === 0 || value.trim().length > 100) {
    throw new ValidationError(`${label} must be between 1 and 100 characters.`);
  }
}

function ensureValidShoeDescription(description?: string | null): void {
  if (description && description.trim().length > 500) {
    throw new ValidationError('Shoe description must be 500 characters or fewer.');
  }
}

function ensureValidPricePerDay(pricePerDay: number): void {
  if (typeof pricePerDay !== 'number' || Number.isNaN(pricePerDay) || pricePerDay <= 0) {
    throw new ValidationError('Price per day must be greater than 0.');
  }
}

function buildVariantIdentity(variant: ShoeVariant): string {
  return `${variant.size}:${variant.color.toLowerCase()}`;
}

function ensureUniqueVariants(variants: ShoeVariant[]): void {
  const ids = new Set<string>();
  const identities = new Set<string>();

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

export class Shoe {
  private readonly idValue: string;
  private nameValue: string;
  private brandValue: string;
  private categoryValue: string;
  private descriptionValue: string | null;
  private pricePerDayValue: number;
  private activeValue: boolean;
  private variantsValue: ShoeVariant[];

  constructor(props: ShoeProps) {
    const description = props.description ?? null;
    const isActive = props.isActive ?? true;
    const variants = props.variants ? [...props.variants] : [];

    ensureValidShoeId(props.id);
    ensureValidShoeName(props.name);
    ensureValidShoeLabel(props.brand, 'Brand');
    ensureValidShoeLabel(props.category, 'Category');
    ensureValidShoeDescription(description);
    ensureValidPricePerDay(props.pricePerDay);
    ensureUniqueVariants(variants);

    this.idValue = props.id.trim();
    this.nameValue = props.name.trim();
    this.brandValue = props.brand.trim();
    this.categoryValue = props.category.trim();
    this.descriptionValue = description ? description.trim() : null;
    this.pricePerDayValue = props.pricePerDay;
    this.activeValue = isActive;
    this.variantsValue = variants;
  }

  get id(): string {
    return this.idValue;
  }

  get name(): string {
    return this.nameValue;
  }

  get brand(): string {
    return this.brandValue;
  }

  get category(): string {
    return this.categoryValue;
  }

  get description(): string | null {
    return this.descriptionValue;
  }

  get pricePerDay(): number {
    return this.pricePerDayValue;
  }

  get isActive(): boolean {
    return this.activeValue;
  }

  get variants(): ReadonlyArray<ShoeVariant> {
    return Object.freeze([...this.variantsValue]);
  }

  rename(name: string): void {
    ensureValidShoeName(name);
    this.nameValue = name.trim();
  }

  changeBrand(brand: string): void {
    ensureValidShoeLabel(brand, 'Brand');
    this.brandValue = brand.trim();
  }

  changeCategory(category: string): void {
    ensureValidShoeLabel(category, 'Category');
    this.categoryValue = category.trim();
  }

  changeDescription(description: string | null): void {
    ensureValidShoeDescription(description);
    this.descriptionValue = description ? description.trim() : null;
  }

  changePricePerDay(pricePerDay: number): void {
    ensureValidPricePerDay(pricePerDay);
    this.pricePerDayValue = pricePerDay;
  }

  activate(): void {
    this.activeValue = true;
  }

  deactivate(): void {
    this.activeValue = false;
  }

  addVariant(variant: ShoeVariant): void {
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

  findVariantById(variantId: string): ShoeVariant | null {
    return this.variantsValue.find((variant) => variant.id === variantId) ?? null;
  }

  createRentalItem(variantId: string, quantity: number): RentalItem {
    if (!this.activeValue) {
      throw new BusinessRuleError('SHOE_INACTIVE', `Shoe ${this.idValue} is inactive and cannot be rented.`);
    }

    const variant = this.getVariantOrFail(variantId);

    return new RentalItem({
      shoeId: this.idValue,
      variantId: variant.id,
      shoeName: this.nameValue,
      size: variant.size,
      color: variant.color,
      pricePerDay: this.pricePerDayValue,
      quantity,
    });
  }

  private getVariantOrFail(variantId: string): ShoeVariant {
    const variant = this.findVariantById(variantId);

    if (!variant) {
      throw new BusinessRuleError(
        'VARIANT_NOT_IN_SHOE',
        `Variant ${variantId} does not exist in shoe ${this.idValue}.`
      );
    }

    return variant;
  }
}
