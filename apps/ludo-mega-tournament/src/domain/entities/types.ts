export enum PawnId {
  pw1_1 = 'PW1-1',
  pw1_2 = 'PW1-2',
  pw1_3 = 'PW1-3',
  pw1_4 = 'PW1-4',
  pw2_1 = 'PW2-1',
  pw2_2 = 'PW2-2',
  pw2_3 = 'PW2-3',
  pw2_4 = 'PW2-4',
  pw3_1 = 'PW3-1',
  pw3_2 = 'PW3-2',
  pw3_3 = 'PW3-3',
  pw3_4 = 'PW3-4',
  pw4_1 = 'PW4-1',
  pw4_2 = 'PW4-2',
  pw4_3 = 'PW4-3',
  pw4_4 = 'PW4-4',
}

export enum Position {
  b100 = 'B100',
  b200 = 'B200',
  b300 = 'B300',
  b400 = 'B400',

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

  h101 = 'H101',
  h102 = 'H102',
  h103 = 'H103',
  h104 = 'H104',
  h105 = 'H105',
  h201 = 'H201',
  h202 = 'H202',
  h203 = 'H203',
  h204 = 'H204',
  h205 = 'H205',
  h301 = 'H301',
  h302 = 'H302',
  h303 = 'H303',
  h304 = 'H304',
  h305 = 'H305',
  h401 = 'H401',
  h402 = 'H402',
  h403 = 'H403',
  h404 = 'H404',
  h405 = 'H405',

  home = 'Home',
}

export enum GameAction {
  rollDice = 'rollDice',
  movePawn = 'movePawn',
  skipTurn = 'skipTurn',
  endGame = 'endGame',
  leaveTable = 'leaveTable',
  startGame = 'startGame',
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
  pawn: PawnId;
  dices: Array<number>;
};

export type TournamentEntry = {
  tableId: string;
  score: number;
};
