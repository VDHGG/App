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
