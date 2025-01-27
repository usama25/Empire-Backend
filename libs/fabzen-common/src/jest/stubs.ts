import { UpdateUserDto } from 'apps/user/src/infrastructure/controllers/dtos/user.transporter.dto';
import { KycResponseDto } from 'apps/rest-api/src/subroutes/user/users.dto';
import { PanUploadResponse } from 'apps/user/src/infrastructure/gateways';
import { UserEntity } from '../entities';
import {
  MobileNumber,
  Role,
  Wallet,
  Gateway,
  TxnModes,
  TxnStatus,
  TransactionType,
  PayoutType,
  Stats,
  Referral,
  KycCardType,
} from '../types';
import {
  AddressDto,
  BuildInfoDto,
  DeviceDto,
  ExternalIdsDto,
  KycDto,
  UpdateBuildInfoDto,
  WalletDto,
} from '../dtos/user.common.dto';
import { toObjectId } from '../utils/mongoose.utils';

export const testMobileNumber: MobileNumber = {
  countryCode: '91',
  number: '1234567890',
};

export const testMobileNumber1: MobileNumber = {
  countryCode: '91',
  number: '1234567891',
};

export const testOtp = '123456';

export const testObjectId = '65df102cacb4885e4cfc1d72';
export const testObjectId1 = '65cb129fb8fa51702219bd99';

export const testAccessToken =
  'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NWRmMTAyY2FjYjQ4ODVlNGNmYzFkNzIiLCJyb2xlcyI6WyJwbGF5ZXIiXSwiaWF0IjoxNzA5MTE3NDg1LCJleHAiOjE3MDkxMTc2NjV9.nNbFEudDJ7PYYI0d9Bi-QiySjB9l67LdqBNYWt8WlwLvDIjHh2mqVoKpDUMMt2uBjb2JHJ-nMOKzvMa_UIstig';

export const testAccessTokenForAdmin =
  'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NWVlOTU4MTc2ZTdiZjNjYzY2MzFhOTgiLCJyb2xlcyI6WyJwbGF5ZXIiLCJhZG1pbiJdLCJpYXQiOjE3MTAxNTk4MzcsImV4cCI6MTcxMDE2MDAxN30.UpyZFUPtmtHmeG-5GYuq4u3JhivMntkyF0VB-w4zjCLoutPppo1wzcTRFqOfIoX1csnR_RJ-OSMfdWAlCdk-7A';

export const testOrderId = 'P2V1GYR4C1FGZ01X';

export const testPaymentSessionId = 'paymentSessionId';

export const testPaymentLink = 'paymentLink';

export const testUserName = 'testUserName';

export const testEmail = 'test@gmail.com';

export const testAmount = '1.10';

export const testNewWallet: Wallet = {
  main: '0',
  win: '0',
  bonus: '0',
};

export const testStats: Stats = {
  ludo: { earnedMoney: 0, winMatches: 0, lossMatches: 0 },
  skillpatti: { earnedMoney: 0, winMatches: 0, lossMatches: 0 },
  callbreak: { earnedMoney: 0, winMatches: 0, lossMatches: 0 },
  snakesandladders: { earnedMoney: 0, winMatches: 0, lossMatches: 0 },
};

export const testReferral: Referral = {
  code: 'RANDOM',
  count: 0,
  earning: 0,
  canBeReferred: true,
};

export const testUser: UserEntity = {
  userId: testObjectId,
  username: 'User1000001',
  mobileNumber: testMobileNumber,
  avatar: 1,
  referral: testReferral,
  wallet: testNewWallet,
  isEmailVerified: false,
  rank: 0,
  stats: testStats,
  isPlayStoreUser: true,
  isKycVerified: false,
  kycModifiedCount: 0,
  isAddressValid: false,
  address: undefined,
  device: undefined,
  name: testUserName,
  email: undefined,
};

export const createDepositOrder = {
  userId: toObjectId('64f32be25f8f54927de1ed95'),
  username: 'User112233',
  amount: '1',
  orderId: 'P2V1GYR4C1FGZ01X',
  gateway: Gateway.cashfree,
  mode: TxnModes.deposit,
  status: TxnStatus.pending,
};

export const updateOrder = {
  status: TxnStatus.success,
  settledAmount: '1',
};

export const getOrder = {
  orderId: 'P2V1GYR4C1FGZ01X',
  userId: '64f32be25f8f54927de1ed95',
};

export const testAddress: AddressDto = {
  address1: 'paj',
  address2: 'raj',
  city: 'kab',
  postalCode: '29830',
  state: 'NK',
  country: 'IN',
};

export const testBuildInfo: BuildInfoDto = {
  appVersion: '0.0.1',
  appCode: '0',
  isPlayStoreBuild: true,
  isGlobalBuild: true,
  installSource: 'installSource',
  installChannel: 'installChannel',
};

export const testDevice: DeviceDto = {
  deviceId: '9101ecc90451110aa8224be7166919815d147bcf',
  model: 'OMEN by HP Gaming Laptop 16-n0xxx (HP)',
  os: 'Windows 11  (10.0.22631) 64bit',
  processor: 'AMD Ryzen 9 6900HX with Radeon Graphics ',
  ram: '31957',
  graphicsDeviceName: 'AMD Radeon RX 6650M',
  graphicsDeviceID: 29_679,
};

export const testKyc: KycDto = {
  status: true,
  modifiedCount: 0,
  data: {
    imageUrl: 'https://aws/1.png',
    cardNumber: '2',
    cardType: KycCardType.aadhaar,
    dob: '2/9/1993',
  },
};

export const testExternalIds: ExternalIdsDto = {
  googleAdvertisingId: 'googleAdvertisingId',
  oneSignalId: 'oneSignalId',
  afId: 'afId',
};

export const testUpdateUserDto: UpdateUserDto = {
  userId: testObjectId,
  name: 'balana',
  email: 'test@email.com',
  address: testAddress,
  device: testDevice,
  externalIds: testExternalIds,
};

export const testUpdateBuildInfo: UpdateBuildInfoDto = {
  installSource: 'installSource',
  installChannel: 'installChannel',
  isPlayStoreBuild: true,
};

export const testWallet: WalletDto = {
  main: '10',
  win: '10',
  bonus: '0',
};

export const paymentDocument = {
  orderId: testOrderId,
  userId: testObjectId,
  username: testUserName,
  status: TxnStatus.pending,
  amount: testAmount,
  gateway: Gateway.cashfree,
  mode: TxnModes.deposit,
};

export const juspayDocument = {
  orderId: testOrderId,
  userId: testObjectId,
  username: testUserName,
  status: TxnStatus.pending,
  amount: testAmount,
  gateway: Gateway.juspay,
  mode: TxnModes.deposit,
};

export const userDocument = {
  _id: toObjectId(testObjectId),
  username: testUserName,
  roles: [Role.player],
  mobileNumber: testMobileNumber,
  wallet: {
    main: '0',
    win: '1000',
    bonus: '0',
  },
  referral: testReferral,
  email: testEmail,
  avatar: 1,
  isEmailVerified: false,
  device: {},
};

export const transactionDocument = {
  userId: toObjectId(testObjectId),
  username: testUserName,
  orderId: testOrderId,
  amount: testAmount,
  type: TransactionType.deposit,
};

export const testPanUploadResponse: PanUploadResponse = {
  data: {
    client_id: 'pan_photo_qunZQbkjwLzbrRPIiDrs',
    ocr_fields: [
      {
        document_type: 'pan',
        pan_number: {
          value: 'DQOPM4788L',
          confidence: 98,
        },
        full_name: {
          value: 'Abundel Mahaha',
          confidence: 97,
        },
        father_name: {
          value: 'Abundel Kumar',
          confidence: 97,
        },
        dob: {
          value: '13/02/1998',
          confidence: 97,
        },
      },
    ],
  },
  status_code: 200,
  message_code: 'success',
  message: 'success',
  success: true,
};

export const testKycResponseDto: KycResponseDto = {
  status: true,
  message: 'success',
};

export const payoutLimit = {
  autoTransferLimit: '10',
  upiWithdrawalLimit: '2',
  bankWithdrawalLimit: '1',
  kycWithdrawalLimit: '3',
  maxWithdrawalsPerDay: '2',
};

export const payoutDocument = {
  username: testUserName,
  status: TxnStatus.success,
  amount: testAmount,
  gateway: Gateway.cashfree,
  mode: TxnModes.withdrawal,
};

export const createPayoutRequest = {
  amount: '1',
  userId: testObjectId,
  upiId: 'test@ybl',
  payoutType: PayoutType.UPI,
};

export const userInfoForPayout = {
  userId: testObjectId,
  name: 'John Doe',
  username: 'johndoe123',
  email: 'john.doe@example.com',
  mobileNumber: testMobileNumber,
  wallet: {
    main: '10',
    win: '10',
    bonus: '0',
  },
  kycStatus: false,
  address: {
    address1: 'SJR LAYOUT',
    city: 'Bangalore',
    postalCode: '560048',
    state: 'Karnataka',
    country: 'India',
  },
};

export const testGenerateOtpResponse = {
  data: {
    client_id: 'aadhaar_v2_hcVqkjAFkGycZCdwxSge',
    otp_sent: true,
    if_number: true,
    valid_aadhaar: true,
    status: 'generate_otp_success',
  },
  status_code: 200,
  message_code: 'success',
  message: 'OTP Sent.',
  success: true,
};

export const testAadhaarKycResponseDto = {
  clientId: 'aadhaar_v2_hcVqkjAFkGycZCdwxSge',
};

export const testSubmitOtpResponse = {
  data: {
    client_id: 'aadhaar_v2_hcVqkjAFkGycZCdwxSge',
    full_name: 'Abundel Mit',
    aadhaar_number: '123456',
    dob: '1998-02-13',
    gender: 'M',
    address: {
      country: 'India',
      dist: 'Hoshangabad',
      state: 'Madhya Pradesh',
      po: 'Hoshangabad',
      loc: '',
      vtc: 'Hoshangabad',
      subdist: 'Hoshangabad',
      street: '',
      house: '',
      landmark: 'makan no 169-1 shakti marg kothi bazar',
    },
    face_status: false,
    face_score: -1,
    zip: '461001',
    profile_image:
      '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',
    has_image: true,
    email_hash: '',
    mobile_hash:
      '13ea6cdfe7433f21366e45c66b04a2ca90b49ef40fb0999d06169cb7471dd8da',
    raw_xml:
      'https://aadhaar-kyc-docs.s3.amazonaws.com/fabzen/aadhaar_xml/230820240212151957864/230820240212151957864-2024-02-12-094957965995.xml?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAY5K3QRM5FYWPQJEB%2F20240212%2Fap-south-1%2Fs3%2Faws4_request&X-Amz-Date=20240212T094958Z&X-Amz-Expires=432000&X-Amz-SignedHeaders=host&X-Amz-Signature=b8f9e645f4b9fb4aefa6d79975b1a11e1cac304766f335a8bbec1635c6428d51',
    zip_data:
      'https://aadhaar-kyc-docs.s3.amazonaws.com/fabzen/aadhaar_xml/230820240212151957864/230820240212151957864-2024-02-12-094957905831.zip?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAY5K3QRM5FYWPQJEB%2F20240212%2Fap-south-1%2Fs3%2Faws4_request&X-Amz-Date=20240212T094958Z&X-Amz-Expires=432000&X-Amz-SignedHeaders=host&X-Amz-Signature=6d0f341a29f7b3e985d2916bbdb4af75398acf6e9f45e73dfea5bbfbd593c6e8',
    care_of: 'S/O Abundel Haha',
    share_code: '7374',
    mobile_verified: false,
    reference_id: '230820240212151957864',
    aadhaar_pdf: undefined,
    status: 'success_aadhaar',
    uniqueness_id:
      'dbc3180e2192686dbcbe07e43b1c6f32cfa68afca06c6a3dda03f96ec549b2c1',
  },
  status_code: 200,
  success: true,
  message: undefined,
  message_code: 'success',
};

export const lastTdsRecord = {
  transactionFrom: '2023-04-01T00:00:00.000Z',
  transactionTo: '2024-02-20T06:46:04.836Z',
  totalDepositAmount: '0',
  totalWithdrawalAmount: '10',
  withdrawalAmountAfterTaxDeduction: '2',
  netWithdrawalAmount: '10',
  totalTdsAmountDeducted: '0',
  isTdsDeducted: true,
  financialYear: '2023-2024',
};

export const testReferralHistoryResponseDto = {
  history: [
    {
      userName: testUserName,
      amount: '10',
      createAt: '2023-04-01T00:00:00.000Z',
    },
  ],
  meta: {
    totalCount: 1,
    skip: 0,
    limit: 1,
  },
};

export const testDepositHistoryResponseDto = {
  history: [
    {
      orderId: '84NUZPKWSBI3M3CJ',
      amount: '1',
      createdAt: '2024-02-23T05:53:53.000Z',
      status: 'pending',
      gstReward: '0',
    },
  ],
  meta: {
    totalCount: 1,
    skip: 0,
    limit: 1,
  },
};

export const testConversionRateResponseDto = {
  conversionRate: 1,
  currencyCode: 'INR',
  currencySymbol: '₹',
};

export const testPayoutHistoryResponseDto = {
  history: [
    {
      orderId: '84NUZPKWSBI3M3CJ',
      amount: '1.00',
      createdAt: '2024-02-23T05:53:53.000Z',
      status: 'pending',
      settledAmount: '1.00',
      tdsReward: '0.00',
      taxdeduction: {
        financialYear: '2023-2024',
        isTdsDeducted: true,
        tdsAmount: '1.5',
      },
    },
  ],
  meta: {
    totalCount: 1,
    skip: 0,
    limit: 1,
  },
};

export const order = {
  userId: '65cb129fb8fa51702219bd67',
  username: 'johndoe123',
  orderId: 'k0tCCdnN2xYKHf6j',
  mode: TxnModes.withdrawal,
  gateway: 'cashfree',
  amount: '200',
  status: 'pending',
  taxdeduction: undefined,
  account: undefined,
  upiId: undefined,
  settledAmount: undefined,
  payoutType: undefined,
};

export const testuserPayoutDocument = {
  _id: toObjectId(testObjectId),
  username: testUserName,
  name: testUserName,
  mobileNumber: testMobileNumber,
  wallet: {
    main: '0',
    win: '150',
    bonus: '0',
  },
  referralCode: 'RANDOM',
  email: testEmail,
  kyc: false,
  address: {
    address1: 'SJR LAYOUT',
    city: 'Bangalore',
    postalCode: '560048',
    state: 'Karnataka',
    country: 'India',
  },
  build: testBuildInfo,
};

export const testSignupBonus = {
  main: '9',
  win: '0',
  bonus: '41',
};
export const signupDto = testObjectId;

export const TrasnactionData = {
  userId: toObjectId(testObjectId),
  amount: '1',
  expireAt: '2024-02-28T16:26:31.844+00:00',
  expired: false,
  breakDown: testSignupBonus,
  type: TransactionType.signupBonus,
};

export const testSdkPayload = {
  requestId: 'requestId',
  service: 'service',
  payload: {
    clientId: 'clientId',
    amount: 'amount',
    merchantId: 'merchantId',
    clientAuthToken: 'clientAuthToken',
    clientAuthTokenExpiry: 'clientAuthTokenExpiry',
    environment: 'environment',
    action: 'action',
    customerId: 'customerId',
    returnurl: 'returnurl',
    currency: 'currency',
    customerPhone: 'customerPhone',
    customerEmail: 'customerEmail',
    orderId: 'orderId',
    'metadata.webhookUrl': 'webhookUrl',
    description: 'description',
  },
};

export const testTransactionApiResponse = {
  order_id: 'order_id',
  status: 'status',
  payment: {
    sdk_params: {
      mcc: 'mcc',
      amount: 'amount',
      merchant_vpa: 'merchant_vpa',
      merchant_name: 'merchant_name',
    },
    authentication: [Object],
  },
  txn_uuid: 'txn_uuid',
  txn_id: 'txn_id',
};

export const testJuspayPaymentLink =
  'upi://pay?pa=merchant_vpa&pn=merchant_name&am=amount&mam=amount&cu=INR&tr=txn_id&tn=Payment%20for%20LudoEmpire&mc=mcc&mode=04&purpose=00&utm_campaign=B2B_PG&utm_source=txn_id';

export const testJuspayDepositWebhook = {
  date_created: '2023-08-10T07:17:04Z',
  event_name: 'FULFILLMENTS_SUCCESSFUL',
  content: {
    order: {
      order_id: testOrderId,
      payment_method_type: 'string',
    },
  },
};

export const juspayPayoutDocument = {
  orderId: testOrderId,
  userId: testObjectId,
  username: testUserName,
  status: TxnStatus.pending,
  amount: testAmount,
  gateway: Gateway.juspay,
  mode: TxnModes.withdrawal,
};

export const testJuspayPayoutWebhook = {
  value: 'FULFILLMENTS_SUCCESSFUL',
  label: 'ORDER',
  info: {
    updatedAt: '2023-08-10T07:17:04Z',
    status: 'FULFILLMENTS_SUCCESSFUL',
    orderType: 'FULFILL_ONLY',
    merchantOrderId: testOrderId,
    merchantCustomerId: 'User111111111',
    id: '8c249f131084d8482e92c6e2c17f9e',
    createdAt: '2023-08-10T07:17:04Z',
    amount: 1,
  },
  id: 'be056124ed84947862e1464e48505f',
  category: 'INFO',
};

export const testCashfreeDepositWebhook = {
  orderId: testOrderId,
  orderAmount: 'string',
  referenceId: 'string',
  txStatus: 'string',
  paymentMode: 'string',
  txMsg: 'string',
  txTime: 'string',
  signature: 'string',
};

export const testCashfreePayoutWebhook = {
  event: 'success',
  transferId: '65e9918e8a0d58531f58631b',
  referenceId: 'gkjhhhiuiuu9',
  signature: 'hihihkjnkjnkjkj',
};

export const paymentCashfreeDocument = {
  orderId: testOrderId,
  userId: testObjectId,
  username: testUserName,
  status: TxnStatus.pending,
  amount: testAmount,
  gateway: Gateway.cashfree,
  mode: TxnModes.withdrawal,
};

export const testTdsDetails = {
  paidTds: '0.00',
  tdsLiability: '0.00',
  financialYear: '2024-2025',
};
