import { Currency } from './payment.types';

export enum AppsflyerEventNames {
  deposit = 'af_deposit',
  withdraw = 'af_withdraw',
  convertedToPro = 'af_converted_to_pro',
}

export type AppsflyerPayload = {
  appsflyer_id: string;
  eventName: AppsflyerEventNames;
  eventValue: any;
  eventCurrency: Currency;
};
