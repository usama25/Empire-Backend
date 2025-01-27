export enum BonusType {
  percentage = 'percentage',
  rupees = 'rupees',
}

export enum WalletTypes {
  mainWallet = 'mainWallet',
  winningWallet = 'winningWallet',
  bonusWallet = 'bonusWallet',
  freeWallet = 'freeWallet',
}

export type CouponUsers = {
  userId?: string;
  appliedAt?: Date;
  orderId?: string;
  status?: string;
};

export type CouponDto = {
  promoCode: string;
  description: string;
  minAmount: string;
  maxAmount: string;
  expireAt: Date;
  bonusAmount: string;
  bonusType: BonusType;
  wallet: WalletTypes;
  isDeleted: boolean;
};
