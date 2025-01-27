import { Model } from 'mongoose';
import * as dayjs from 'dayjs';
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as PDFDocument from 'pdfkit-table';
import { PaymentEntity } from '@lib/fabzen-common/entities/payment.entity';
import {
  InvoiceInfo,
  PayoutType,
  SaveDepositOrderDto,
  SavePayoutOrderDto,
  TaxDeduction,
  TxnModes,
  TxnStatus,
  UpdateOrderDto,
} from '@lib/fabzen-common/types/payment.types';
import { ToWords } from 'to-words';

import { PaymentRepository } from 'apps/payment/src/domain/interfaces';
import { Payment, PaymentDocument } from '../models/payment.schema';
import { toObjectId } from '@lib/fabzen-common/utils/mongoose.utils';
import { HistoryParameters } from '@lib/fabzen-common/types';
import {
  DepositHistoryDto,
  DepositHistoryResponseDto,
  ConversionRateResponseDto,
} from 'apps/rest-api/src/subroutes/payment/deposit/deposit.dto';
import {
  PayoutHistoryDto,
  PayoutHistoryResponseDto,
  TdsDetailsResponse,
  VerifiedWithdrawalAccountDto,
} from 'apps/rest-api/src/subroutes/payment/payout/payout.dto';
import { getCurrentFinancialYear } from '@lib/fabzen-common/utils/time.utils';
import Big from 'big.js';
import {
  ConversionRate,
  ConversionRateDocument,
  User,
  UserDocument,
} from '../models';
import { S3Util } from '@lib/fabzen-common/utils/s3.util';
import { config } from '@lib/fabzen-common/configuration/configuration';
import {
  PayoutAccount,
  PayoutAccountDocument,
} from '../models/payout-accounts.schema';
import { CreatePayoutOrderRequestDto } from 'apps/payment/src/infrastructure/controllers/dtos/payout.transporter.dto';
@Injectable()
export class MongoosePaymentRepository implements PaymentRepository {
  constructor(
    @InjectModel(Payment.name)
    public paymentModel: Model<PaymentDocument>,
    @InjectModel(User.name)
    public userModel: Model<UserDocument>,
    @InjectModel(ConversionRate.name)
    public conversionRateModel: Model<ConversionRateDocument>,
    @InjectModel(PayoutAccount.name)
    public payoutAccountModel: Model<PayoutAccountDocument>,
  ) {}

  async createDepositOrder(
    depositOrder: SaveDepositOrderDto,
  ): Promise<PaymentEntity> {
    const { userId, orderId, gateway, amount, paymentMethod } = depositOrder;
    const paymentDocument = await this.paymentModel.create({
      userId: toObjectId(userId),
      orderId,
      mode: TxnModes.deposit,
      gateway,
      amount,
      status: TxnStatus.pending,
      paymentMethod,
    });
    return this.#convertDocumentToEntity(paymentDocument);
  }

  async getOrder(orderId: string): Promise<PaymentEntity | undefined> {
    const paymentDocument = await this.paymentModel.findOne<PaymentDocument>({
      orderId,
    });
    return paymentDocument
      ? this.#convertDocumentToEntity(paymentDocument)
      : undefined;
  }

  async getOrderById(transferId: string): Promise<PaymentEntity | undefined> {
    const paymentDocument =
      await this.paymentModel.findById<PaymentDocument>(transferId);
    if (!paymentDocument) {
      return;
    }
    return this.#convertDocumentToEntity(paymentDocument);
  }

  async updateOrder(orderId: string, updateOrderDto: UpdateOrderDto) {
    const { status, settledAmount, paymentMethod } = updateOrderDto;
    await this.paymentModel.findOneAndUpdate(
      { orderId },
      {
        $set: {
          status,
          settledAmount,
          paymentMethod,
        },
      },
    );
  }

  #convertDocumentToEntity(paymentDocument: PaymentDocument): PaymentEntity {
    const {
      _id,
      userId,
      orderId,
      mode,
      gateway,
      amount,
      status,
      settledAmount,
      accountVerificationCharges,
      account,
      payoutType,
      upiId,
      paymentMethod,
      taxdeduction,
      isPlayStoreBuild,
    } = paymentDocument;

    const paymentEntity = new PaymentEntity(
      _id.toString(),
      userId.toString(),
      orderId,
      mode,
      gateway,
      amount,
      status,
      paymentMethod,
      settledAmount,
      taxdeduction,
      account,
      upiId,
      payoutType,
      isPlayStoreBuild,
      accountVerificationCharges,
    );
    return paymentEntity;
  }

  async getDailyPayoutCount(userId: string): Promise<number> {
    const startTime = dayjs()
      .add(5.5, 'hours')
      .startOf('day')
      .subtract(5.5, 'hours')
      .toDate();
    return this.paymentModel
      .find({
        createdAt: {
          $gte: startTime,
        },
        userId: toObjectId(userId),
        mode: TxnModes.withdrawal,
        status: TxnStatus.success,
      })
      .countDocuments();
  }

  async createPayoutOrder(
    payoutOrder: SavePayoutOrderDto,
  ): Promise<PaymentEntity> {
    const {
      userId,
      orderId,
      amount,
      gateway,
      taxdeduction,
      account,
      upiId,
      settledAmount,
      payoutType,
      status,
      mode,
      isPlayStoreBuild,
      accountVerificationCharges,
    } = payoutOrder;

    const paymentDocument = await this.paymentModel.create({
      userId: toObjectId(userId),
      orderId,
      mode,
      gateway,
      amount,
      status,
      taxdeduction,
      account,
      upiId,
      settledAmount,
      payoutType,
      isPlayStoreBuild,
      accountVerificationCharges,
    });

    return this.#convertDocumentToEntity(paymentDocument);
  }

  async getTotalDepositAmountInRange(
    userId: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<string> {
    const [totalDepositAmount] = await this.paymentModel.aggregate([
      {
        $match: {
          userId: toObjectId(userId),
          createdAt: {
            $gte: fromDate,
            $lte: toDate,
          },
          status: TxnStatus.success,
          mode: TxnModes.deposit,
        },
      },
      {
        $group: {
          _id: undefined,
          totalAmount: {
            $sum: {
              $toDouble: '$amount',
            },
          },
        },
      },
    ]);
    return totalDepositAmount?.totalAmount ?? '0';
  }

  async getTotalPayoutAmountInRange(
    userId: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<string> {
    const [totalWithdrawalAmount] = await this.paymentModel.aggregate([
      {
        $match: {
          userId: toObjectId(userId),
          mode: TxnModes.withdrawal,
          'taxdeduction.transactionFrom': {
            $gte: fromDate,
            $lte: toDate,
          },
          'taxdeduction.isTdsDeducted': false,
        },
      },
      {
        $group: {
          _id: undefined,
          totalAmount: {
            $sum: {
              $toDouble: '$settledAmount',
            },
          },
        },
      },
    ]);
    return totalWithdrawalAmount?.totalAmount ?? '0';
  }

  async getTotalWithdrawalAmount(userId: string): Promise<string> {
    const [totalWithdrawalAmount] = await this.paymentModel.aggregate([
      {
        $match: {
          userId: toObjectId(userId),
          mode: TxnModes.withdrawal,
        },
      },
      {
        $group: {
          _id: undefined,
          totalAmount: {
            $sum: {
              $toDouble: '$settledAmount',
            },
          },
        },
      },
    ]);
    return totalWithdrawalAmount?.totalAmount ?? '0';
  }

  async getLastTdsRecord(userId: string): Promise<TaxDeduction | undefined> {
    const paymentDocument = await this.paymentModel
      .find({ userId: toObjectId(userId), mode: TxnModes.withdrawal })
      .sort({ _id: -1 })
      .limit(1)
      .lean();
    return paymentDocument[0]?.taxdeduction;
  }

  async checkRefundExists(orderId: string): Promise<boolean> {
    const existingRefund = await this.paymentModel.findOne({
      orderId,
      status: TxnStatus.refund,
    });

    return !!existingRefund;
  }

  async updatePayoutOrder(orderId: string, updateOrderDto: UpdateOrderDto) {
    const { status, settledAmount } = updateOrderDto;
    const updateQuery: any = { status, settledAmount };
    await this.paymentModel.findOneAndUpdate({ orderId }, updateQuery);
  }

  async getDepositHistory(
    historyParameters: HistoryParameters,
  ): Promise<DepositHistoryResponseDto> {
    const modes = [TxnModes.deposit, TxnModes.convert];
    const { items, meta } = await this.#getTransactions(
      historyParameters,
      modes,
    );
    const history: DepositHistoryDto[] = items.map((item) =>
      this.#toDepositHistoryItem(item),
    );

    return {
      history,
      meta,
    };
  }

  #toDepositHistoryItem(document: PaymentDocument): DepositHistoryDto {
    const {
      _id,
      orderId,
      mode,
      amount: amountInDocument,
      settledAmount: settledAmountInDocument,
      paymentMethod,
      status,
    } = document;
    const amount = Big(
      mode === TxnModes.convert ? settledAmountInDocument : amountInDocument,
    ).toFixed(2);
    const settledAmount = settledAmountInDocument
      ? Big(
          mode === TxnModes.convert
            ? amountInDocument
            : settledAmountInDocument,
        ).toFixed(2)
      : '0';
    let gstReward: string | undefined = undefined;
    if (mode !== TxnModes.convert) {
      gstReward = Big(amount)
        .minus(Big(settledAmount || amount))
        .toFixed(2);
    }
    let conversionReward: string | undefined = undefined;
    if (mode === TxnModes.convert) {
      conversionReward = Big(amount).minus(Big(settledAmount)).toFixed(2);
    }
    const depositHistoryItem: DepositHistoryDto = {
      orderId,
      mode,
      amount,
      settledAmount,
      createdAt: _id.getTimestamp().toISOString(),
      status,
      gstReward,
      paymentMethod,
      conversionReward,
    };
    return depositHistoryItem;
  }

  async getPayoutHistory(
    historyParameters: HistoryParameters,
  ): Promise<PayoutHistoryResponseDto> {
    const modes = [TxnModes.withdrawal, TxnModes.convert];
    const { items, meta } = await this.#getTransactions(
      historyParameters,
      modes,
    );
    const history: PayoutHistoryDto[] = [];
    items.map((item) => {
      const historyItem: PayoutHistoryDto = {
        orderId: item.orderId,
        mode: item.mode,
        amount: Big(item.amount)
          .minus(item.accountVerificationCharges ?? 0)
          .toFixed(2),
        createdAt: item._id.getTimestamp()?.toISOString(),
        status: item.status,
        settledAmount: item.settledAmount
          ? Big(item.settledAmount).toFixed(2)
          : '0',
        tdsReward: item.settledAmount
          ? Big(item.amount)
              .minus(item.settledAmount)
              .minus(item.accountVerificationCharges ?? 0)
              .toFixed(2)
          : '0',
        payoutType: item.payoutType as PayoutType,
        accountVerificationCharges: item.accountVerificationCharges,
      };

      if (item.taxdeduction) {
        historyItem.taxDeduction = {
          financialYear: item.taxdeduction.financialYear,
          isTdsDeducted: item.taxdeduction.isTdsDeducted,
          tdsAmount: item.taxdeduction.totalTdsAmountDeducted,
        };
      }
      history.push(historyItem);
    });

    return {
      history,
      meta,
    };
  }

  async #getTransactions(
    historyParameters: HistoryParameters,
    modes: TxnModes[],
  ) {
    const { userId, skip, limit } = historyParameters;

    const projection = {
      _id: 1,
      orderId: 1,
      amount: 1,
      createdAt: 1,
      status: 1,
      settledAmount: 1,
      taxdeduction: 1,
      payoutType: 1,
      paymentMethod: 1,
      mode: 1,
      accountVerificationCharges: 1,
    };

    const [items, totalCount] = await Promise.all([
      this.paymentModel.find(
        { userId: toObjectId(userId), mode: { $in: modes } },
        projection,
        {
          skip,
          limit,
          sort: { _id: -1 },
        },
      ),
      this.paymentModel.countDocuments({
        userId: toObjectId(userId),
        mode: { $in: modes },
      }),
    ]);
    return {
      items,
      meta: {
        totalCount,
        skip,
        limit: Math.min(totalCount, limit),
      },
    };
  }

  async deleteTdsRecord(orderId: string): Promise<void> {
    await this.paymentModel.updateOne(
      { orderId },
      { $unset: { taxdeduction: '' } },
    );
  }

  async getTaxDetails(userId: string): Promise<TdsDetailsResponse> {
    const taxDetails = await this.paymentModel.aggregate([
      {
        $match: {
          userId: toObjectId(userId),
          'taxdeduction.financialYear': getCurrentFinancialYear(),
        },
      },
      {
        $group: {
          _id: '$userId',
          totalTdsSum: {
            $sum: {
              $toDouble: '$taxdeduction.totalTdsAmountDeducted',
            },
          },
        },
      },
    ]);
    const totalTdsDeducted = taxDetails[0]?.totalTdsSum ?? 0;
    return {
      paidTds: totalTdsDeducted.toFixed(2),
      tdsLiability: totalTdsDeducted.toFixed(2),
      financialYear: getCurrentFinancialYear(),
    };
  }

  async getConversionRate(userId: string): Promise<ConversionRateResponseDto> {
    const user = await this.userModel
      .findOne({ _id: toObjectId(userId) }, { address: 1 })
      .lean();
    if (!user || !user.address || !user.address.country) {
      throw new NotFoundException('No Country in Address');
    }
    const rateInfo = await this.conversionRateModel.findOne({
      country: user.address.country,
    });
    if (!rateInfo) {
      throw new NotFoundException('Country Not Found in Database');
    }
    const { conversionRate, currencyCode, currencySymbol } = rateInfo;
    return {
      conversionRate,
      currencyCode,
      currencySymbol,
    };
  }

  async generateInvoice(orderId: string, overwrite: boolean): Promise<string> {
    const paymentDocument = await this.paymentModel.findOne({
      orderId,
      mode: TxnModes.deposit,
    });
    if (!paymentDocument) {
      throw new NotFoundException(
        `Deposit history with ${orderId} does not exist`,
      );
    }
    const { userId, invoiceUrl, amount, settledAmount, createdAt } =
      paymentDocument;
    if (invoiceUrl && !overwrite) {
      return invoiceUrl;
    }
    const user = await this.userModel.findOne({ _id: userId }).lean();
    if (!user) {
      throw new NotFoundException('User Not Found for the orderId');
    }
    const { username, email, mobileNumber, address } = user;

    const invoiceDate = dayjs(createdAt).add(5, 'hours').add(30, 'minutes');
    const year: number = invoiceDate.isBefore(
      dayjs(createdAt).startOf('year').add(3, 'month'),
    )
      ? Number(invoiceDate.subtract(1, 'year').format('YYYY'))
      : Number(invoiceDate.format('YYYY'));
    const twoDigitYearForm = year % 100;
    const billNoPrefix = `FAB${twoDigitYearForm}${twoDigitYearForm + 1}`;
    const finantialYearStart = dayjs(`${year}-04-01T00:00:00.000+00:00`)
      .subtract(5, 'hours')
      .subtract(30, 'minutes')
      .toDate();
    const depositCount = await this.paymentModel.countDocuments({
      mode: TxnModes.deposit,
      createdAt: {
        $gt: finantialYearStart,
        $lt: createdAt,
      },
    });

    const pdfData = await this.generateInvoicePDFfile({
      username,
      mobileNumber,
      email: email as string,
      state: address.state,
      amount,
      settledAmount,
      transactionRefNo: orderId,
      date: invoiceDate,
      billNo: `${billNoPrefix}-${(depositCount + 1)
        .toString()
        .padStart(8, '0')}`,
    });

    const s3Util = new S3Util();
    const uploadResult = await s3Util.upload({
      Bucket: config.payment.invoiceBucket,
      Key: `${orderId}.pdf`,
      ContentType: 'multipart/form-data',
      Body: pdfData,
    });
    const generatedFileName = uploadResult.Key;
    if (generatedFileName) {
      const invoiceUrl = `${config.payment.invoiceCloudFrontUrl}/${generatedFileName}`;
      await this.paymentModel.updateOne(
        { orderId, mode: TxnModes.deposit },
        { invoiceUrl },
      );
      return invoiceUrl;
    } else {
      throw new InternalServerErrorException(`Generating Invoice Failed`);
    }
  }

  private async generateInvoicePDFfile({
    username,
    mobileNumber,
    email,
    state,
    transactionRefNo,
    billNo,
    date,
    amount,
    settledAmount,
  }: InvoiceInfo): Promise<Buffer> {
    const document = new (PDFDocument as any)();
    const gstAmount = Big(amount).minus(settledAmount).toString();

    return new Promise(async (resolve, reject) => {
      const buffers: Buffer[] = [];
      document.on('data', buffers.push.bind(buffers));
      document.on('end', async () => {
        resolve(Buffer.concat(buffers));
      });
      document.on('error', (error: any) => {
        console.error(error);
        reject(error);
      });

      document.image('./assets/ludo.png', 253, 25, {
        width: 100,
        height: 100,
      });

      document.moveDown(5);
      document.font('Times-Bold').fontSize(10).text('TAX INVOICE', {
        align: 'center',
        underline: true,
      });

      document.moveDown(1);

      document
        .font('Times-Bold')
        .fontSize(14)
        .text('Fabzen Technologies Private Limited', {
          underline: true,
        });

      document
        .font('Times-Roman')
        .fontSize(14)
        .text(
          '5th Floor, Plot No. 77, EPIP Layout, Sy No. 150, 6th Cross Road, Whitefield,',
        );

      document
        .font('Times-Roman')
        .fontSize(13)
        .text('Bengaluru, Bengaluru Urban, Karnataka, 560066');

      document
        .font('Times-Roman')
        .fontSize(13)
        .text('GST No.: 29AADCF0666M1Z9');

      document.fillColor('blue').text('Email: support@ludoempire.com', {
        link: 'mailto:support@ludoempire.com',
      });

      document.fillColor('blue').text('Web: https://ludoempire.com', {
        link: 'https://ludoempire.com',
      });
      document.moveDown(1);

      document.fillColor('black').text('BILL TO', {
        underline: true,
      });

      const address = state;
      const gstAmountData =
        state === 'Karnataka'
          ? [
              {
                description: 'CGST @ 14%',
                sac: ' ',
                amount: `${Big(gstAmount).div(2).toFixed(2)}`,
              },
              {
                description: 'SGST @ 14%',
                sac: ' ',
                amount: `${Big(gstAmount).div(2).toFixed(2)}`,
              },
            ]
          : [
              {
                description: 'IGST @ 28%',
                sac: ' ',
                amount: `${Big(gstAmount).toFixed(2)}`,
              },
            ];

      const billingInfo = [
        `User Name: ${username}`,
        `Phone No: +${mobileNumber.countryCode} ${mobileNumber.number}`,
        email ? `Email ID: ${email}` : undefined,
        `Transaction Ref. No.: ${transactionRefNo}`,
        `Bill No.: ${billNo}`,
        `Invoice Date: ${date.format('DD/MM/YYYY')}`,
        `Place of Supply: ${address}`,
      ].filter(Boolean);

      document.fontSize(11).text(billingInfo.join('\n'), {
        columns: 2,
        columnGaps: 100,
        height: billingInfo.length === 7 ? 60 : 45,
      });

      document.moveDown(2);

      const table = {
        headers: [
          {
            label: 'Description',
            property: 'description',
            width: 270,
            headerAlign: 'center',
            headerColor: 'red',
            headerOpacity: 1,
          },
          {
            label: 'SAC',
            property: 'sac',
            width: 100,
            headerAlign: 'center',
            align: 'center',
            headerColor: 'red',
            headerOpacity: 1,
          },
          {
            label: 'Amount (in Rupee)',
            property: 'amount',
            width: 100,
            headerAlign: 'center',
            align: 'right',
            headerColor: 'red',
            headerOpacity: 1,
          },
        ],
        datas: [
          {
            description: {
              label: 'Amount Deposited by User for Ludo Empire (Inc. GST)',
              padding: [50, 50],
              options: {
                padding: [50, 50],
              },
            },
            sac: '998439',
            amount: `${Big(amount).toFixed(2)}`,
          },
          {
            description: 'Less: Discount',
            sac: ' ',
            amount: '-0.00',
          },
          {
            description: 'Net Deposit Received',
            sac: ' ',
            amount: `${Big(amount).toFixed(2)}`,
          },
          {
            description: ' ',
            sac: ' ',
            amount: ' ',
          },
          {
            description: ' ',
            sac: ' ',
            amount: ' ',
          },
          {
            description: 'Taxable Value',
            sac: ' ',
            amount: `${Big(settledAmount).toFixed(2)}`,
          },
          ...gstAmountData,
          {
            description: {
              label: 'bold:Total',
              options: { fontSize: 12 },
            },
            sac: ' ',
            amount: {
              label: `bold:${Big(amount).toFixed(2)}`,
              options: { fontSize: 12 },
            },
          },
        ],
      };

      await document.table(table, {
        padding: 5,
        columnsSize: [250, 100, 100],
        divider: {
          header: { disabled: false, width: 1, opacity: 0.5 },
        },
        prepareHeader: () => document.fillColor('white').fontSize(10),
      });
      document.moveDown(1);

      document
        .fontSize(13)
        .text(
          `Amount in Words: Rupees ${new ToWords().convert(
            Number(amount),
          )} only`,
        );

      document.moveDown(5);
      document.fontSize(13).text('For Fabzen Technologies Private Limited');
      document.moveDown(5);

      document
        .fontSize(12)
        .font('Times-Italic')
        .text('**This is System generated invoice, Signature not required**', {
          align: 'center',
        });

      document.end();
    });
  }

  async checkIfPayoutAccountAlreadyValidated({
    userId,
    accountNumber,
    ifscCode,
    upiId,
  }: CreatePayoutOrderRequestDto): Promise<{
    isAccountAlreadyValidated: boolean;
    isEverManuallyApproved: boolean;
    accountHolderName: string;
  }> {
    const payoutAccount = await this.payoutAccountModel.findOne(
      {
        userId: toObjectId(userId),
        accountNumber,
        ifsc: ifscCode,
        upiId,
      },
      {
        _id: -1,
        approved: 1,
        accountHolderName: 1,
      },
    );
    return {
      isAccountAlreadyValidated: !!payoutAccount,
      isEverManuallyApproved: !!payoutAccount && payoutAccount.approved,
      accountHolderName: payoutAccount?.accountHolderName ?? '',
    };
  }

  async savePayoutAccount({
    userId,
    accountHolderName,
    accountNumber,
    ifsc,
    upiId,
  }: {
    userId: string;
    accountHolderName: string;
    accountNumber?: string;
    ifsc?: string;
    upiId?: string;
  }): Promise<void> {
    await this.payoutAccountModel.create({
      userId: toObjectId(userId),
      accountHolderName,
      accountNumber,
      ifsc,
      upiId,
    });
  }

  async approvePayoutAccount({
    userId,
    accountNumber,
    ifsc,
    upiId,
  }: {
    userId: string;
    accountNumber?: string;
    ifsc?: string;
    upiId?: string;
  }): Promise<void> {
    await this.payoutAccountModel.updateOne(
      {
        userId: toObjectId(userId),
        accountNumber,
        ifsc,
        upiId,
      },
      {
        $set: {
          approved: true,
        },
      },
    );
  }

  async getVerifiedWithdrawalAccounts(
    userId: string,
  ): Promise<VerifiedWithdrawalAccountDto[]> {
    const userAccounts = await this.payoutAccountModel
      .find(
        { userId: toObjectId(userId) },
        { accountNumber: 1, ifsc: 1, upiId: 1, accountHolderName: 1 },
      )
      .lean();

    if (!userAccounts || userAccounts.length === 0) {
      return [];
    }

    return userAccounts.map((account) => ({
      accountNumber: account.accountNumber ?? undefined,
      ifsc: account.ifsc ?? undefined,
      upiId: account.upiId ?? undefined,
      accountHolderName: account.accountHolderName ?? undefined,
    }));
  }
}
