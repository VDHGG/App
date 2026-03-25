import { BusinessRuleError } from './BusinessRuleError';

export function ensureVariantDeactivationAllowed(params: {
  variantId: string;
  totalStock: number;
  alreadyDeactivatedQuantity: number;
  requestedDeactivationQuantity: number;
}): void {
  const {
    variantId,
    totalStock,
    alreadyDeactivatedQuantity,
    requestedDeactivationQuantity,
  } = params;
  const stillActive = totalStock - alreadyDeactivatedQuantity;

  if (stillActive < requestedDeactivationQuantity) {
    throw new BusinessRuleError(
      'INSUFFICIENT_STOCK',
      `Variant ${variantId} is not available for the requested period. ` +
        `Available: ${stillActive}, requested: ${requestedDeactivationQuantity}.`
    );
  }
}
