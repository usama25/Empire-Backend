import { Gateway } from '@lib/fabzen-common/types/payment.types';

import { PaymentGateway } from '../../domain/interfaces';
import { CashfreePaymentGateway, JuspayPaymentGateway } from './';
import { HttpClientService } from '@lib/fabzen-common/http-client/src';

export class PaymentGatewayFactory {
  public static make(
    gatewayName: Gateway,
    httpClientService: HttpClientService,
  ): PaymentGateway {
    return gatewayName === Gateway.cashfree
      ? new CashfreePaymentGateway(httpClientService)
      : new JuspayPaymentGateway(httpClientService);
  }
}
