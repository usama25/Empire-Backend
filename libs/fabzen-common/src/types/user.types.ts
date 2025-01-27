import { Types } from 'mongoose';
import { Games, GameOutcome, MobileNumber } from './';
export type Address = {
  address1: string;
  address2?: string;
  city: string;
  postalCode: string;
  state: string;
  country: string;
};

export type Device = {
  deviceId: string;
  model: string;
  os: string;
  ram: string;
  graphicsDeviceName: string;
  graphicsDeviceID: number;
};

export type Referral = {
  code: string;
  count: number;
  earning: number;
  canBeReferred: boolean;
  user?: Types.ObjectId;
};

export type ReferralBonusDto = {
  userId: string;
  referredUserId: string;
  amount: string;
};

export type ExternalIds = {
  googleAdvertisingId: string;
  oneSignalId: string;
  afId: string;
  baseAfId: string;
  proAfId: string;
};

export type Kyc = {
  status: boolean;
  modifiedCount: number;
  data: KycData;
};

export type KycData = {
  imageUrl: string;
  cardNumber: string;
  cardType: string;
  dob: string;
};

export type Wallet = {
  main: string;
  win: string;
  bonus: string;
};

export type KycResponse = {
  status: boolean;
  message: string | null;
};

export type UserID = string;

export type UserNameProfilePic = {
  userId: string;
  username: string;
  name: string;
  avatar: number;
};

export type Stat = {
  earnedMoney: number;
  winMatches: number;
  lossMatches: number;
};

export type UserProfile = {
  userId: string;
  username: string;
  name: string;
  avatar: number;
};

export type UpdateStatsDto = {
  userId: string;
  winLoseAmount: number;
  game: Games;
  outcome: GameOutcome;
};

export enum Country {
  India = 'India',
}

export type Stats = Partial<Record<Games, Stat>>;

export type UserGameDetails = {
  userId: string;
  name?: string;
  username: string;
  ip: string;
  avatar: number;
  rank: number;
  matches: number;
  isKycVerified: boolean;
  mobileNumber: MobileNumber;
  address: Address;
  stats?: Stat;
};

export enum KycCardType {
  aadhaar = 'aadhaar',
  pan = 'pan',
}

export type AppsflyerUrls = {
  requestUrlForBase: string;
  requestUrlForPro: string;
};

export type UserGameInfo = {
  userId: string;
  username: string;
  ip: string;
  avatar: number;
  rank: number;
  matches: number;
  isKycVerified: boolean;
  mobileNumber: MobileNumber;
  address: Address;
  isReady: boolean;
};

// //

// // New enum for game actions
// export enum GameAction {
//   bat = 'bat',
//   bowl = 'bowl',
// }

// // New enum for player roles
// export enum PlayerRole {
//   batsman = 'batsman',
//   bowler = 'bowler',
// }

// // Update UserEPLGameInfo to include these new properties
// export type UserEPLGameInfo = {
//   // ... existing properties
//   role: PlayerRole;
//   currentRuns: number;
//   totalScore: number;
//   scores: number[];
//   wickets: number;
// };

// // Update EPLGameTableData to include these new properties
// export type EPLGameTableData = {
//   // ... existing properties
//   innings?: number;
//   turnNo?: number;
//   targetScore?: number | null;
// };

// // New interface for game board state
// export interface EPLGameBoard {
//   currentInnings: number;
//   currentOver: number;
//   currentBall: number;
//   scores: {
//     [playerId: string]: number;
//   };
//   wickets: {
//     [playerId: string]: number;
//   };
// }

// // New interface for ball result
// export interface BallResult {
//   batsmanRuns: number;
//   bowlerRuns: number;
//   isWicket: boolean;
// }

// // New interface for game result
// export interface GameResult {
//   winner: PlayerId | null;  // null in case of a draw
//   outcomes: {
//     [playerId: string]: EPLGameOutCome;
//   };
//   finalScores: {
//     [playerId: string]: number;
//   };
// }

// // New interface for next action event
// export interface NextActionEvent {
//   tableId: string;
//   playerId: PlayerId | undefined;
//   action: GameAction;
//   turnTimeout: string;
// }
