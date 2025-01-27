export enum PawnId {
  pw1_1 = 'PW1-1',
  pw1_2 = 'PW1-2',
  pw2_1 = 'PW2-1',
  pw2_2 = 'PW2-2',
  pw3_1 = 'PW3-1',
  pw3_2 = 'PW3-2',
  pw4_1 = 'PW4-1',
  pw4_2 = 'PW4-2',
}

export enum PlayerId {
  pl1 = 'PL1',
  pl2 = 'PL2',
  pl3 = 'PL3',
  pl4 = 'PL4',
}

export enum Position {
  base = 'Base',

  c1 = '1',
  c2 = '2',
  c3 = '3',
  c4 = '4',
  c5 = '5',
  c6 = '6',
  c7 = '7',
  c8 = '8',
  c9 = '9',
  c10 = '10',
  c11 = '11',
  c12 = '12',
  c13 = '13',
  c14 = '14',
  c15 = '15',
  c16 = '16',
  c17 = '17',
  c18 = '18',
  c19 = '19',
  c20 = '20',
  c21 = '21',
  c22 = '22',
  c23 = '23',
  c24 = '24',
  c25 = '25',
  c26 = '26',
  c27 = '27',
  c28 = '28',
  c29 = '29',
  c30 = '30',
  c31 = '31',
  c32 = '32',
  c33 = '33',
  c34 = '34',
  c35 = '35',
  c36 = '36',
  c37 = '37',
  c38 = '38',
  c39 = '39',
  c40 = '40',
  c41 = '41',
  c42 = '42',
  c43 = '43',
  c44 = '44',
  c45 = '45',
  c46 = '46',
  c47 = '47',
  c48 = '48',
  c49 = '49',
  c50 = '50',
  c51 = '51',
  c52 = '52',
  c53 = '53',
  c54 = '54',
  c55 = '55',
  c56 = '56',
  c57 = '57',
  c58 = '58',
  c59 = '59',
  c60 = '60',
  c61 = '61',
  c62 = '62',
  c63 = '63',
  c64 = '64',
  c65 = '65',
  c66 = '66',
  c67 = '67',
  c68 = '68',
  c69 = '69',
  c70 = '70',
  c71 = '71',
  c72 = '72',
  c73 = '73',
  c74 = '74',
  c75 = '75',
  c76 = '76',
  c77 = '77',
  c78 = '78',
  c79 = '79',
  c80 = '80',
  c81 = '81',
  c82 = '82',
  c83 = '83',
  c84 = '84',
  c85 = '85',
  c86 = '86',
  c87 = '87',
  c88 = '88',
  c89 = '89',
  c90 = '90',
  c91 = '91',
  c92 = '92',
  c93 = '93',
  c94 = '94',
  c95 = '95',
  c96 = '96',
  c97 = '97',
  c98 = '98',
  c99 = '99',

  home = 'Home',
}

export enum GameAction {
  waiting = 'waiting',
  next = 'next',
  pawnKill = 'pawnKill',
  rollDice = 'rollDice',
  movePawn = 'movePawn',
  skipTurn = 'skipTurn',
  endGame = 'endGame',
  leaveTable = 'leaveTable',
  discardGame = 'discardGame',
}

export type PawnPosition = {
  pawn: PawnId;
  position: Position;
  bonus?: number;
  points?: number;
  usedDice?: number;
};

export type CanMovePawn = {
  pawnId: PawnId;
  dice: number;
};

export type SLGameEntry = {
  tableId: string;
  score: number;
};

export type SLGameBoard = {
  snakes: number[][];
  ladders: number[][];
};

export type PlayerInfo = {
  name: string;
  ip: string;
  avatar: number;
  rank: number;
  stats: {
    wonMatches: number;
    lostMatches: number;
  };
  isKycVerified: boolean;
  mobileNumber: {
    countryCode: string;
    number: string;
  };
};
