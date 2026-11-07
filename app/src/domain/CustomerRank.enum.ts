export const CustomerRank = {
  BRONZE: 'BRONZE',
  SILVER: 'SILVER',
  GOLD: 'GOLD',
  DIAMOND: 'DIAMOND',
} as const;

export type CustomerRank = (typeof CustomerRank)[keyof typeof CustomerRank];

export function getMaxRentalItemsByRank(rank: CustomerRank): number | null {
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

export function getDiscountPercentByRank(rank: CustomerRank): number {
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

export function resolveRankByTotalSpentVnd(totalSpentVnd: number): CustomerRank {
  if (totalSpentVnd >= 10_000_000) return CustomerRank.DIAMOND;
  if (totalSpentVnd >= 5_000_000) return CustomerRank.GOLD;
  if (totalSpentVnd >= 2_000_000) return CustomerRank.SILVER;
  return CustomerRank.BRONZE;
}

const RANK_WEIGHT: Record<CustomerRank, number> = {
  [CustomerRank.BRONZE]: 0,
  [CustomerRank.SILVER]: 1,
  [CustomerRank.GOLD]: 2,
  [CustomerRank.DIAMOND]: 3,
};

export function upgradeRankIfHigher(current: CustomerRank, candidate: CustomerRank): CustomerRank {
  return RANK_WEIGHT[candidate] > RANK_WEIGHT[current] ? candidate : current;
}
