import * as FormData from 'form-data';
import { Injectable, BadRequestException, Logger } from '@nestjs/common';

import { HttpClientService } from '@lib/fabzen-common/http-client/src';
import { config } from '@lib/fabzen-common/configuration';
import { File } from '@lib/fabzen-common/types';

import { SurepassGateway } from '../../domain/interfaces';

export interface PanUploadResponse {
  data: {
    client_id: string;
    ocr_fields: {
      document_type: string;
      pan_number: {
        value: string;
        confidence: number;
      };
      full_name: {
        value: string;
        confidence: number;
      };
      father_name: {
        value: string;
        confidence: number;
      };
      dob: {
        value: string;
        confidence: number;
      };
    }[];
  };
  status_code: number;
  message_code: string;
  message: null | string;
  success: boolean;
}

export interface GenerateOtpResponse {
  data: {
    client_id: string;
    otp_sent: boolean;
    if_number: boolean;
    valid_aadhaar: boolean;
    status: string;
  };
  status_code: number;
  message_code: string;
  message: string;
  success: boolean;
}

export interface SubmitOtpResponse {
  data: {
    client_id: string;
    full_name: string;
    aadhaar_number: string;
    dob: string;
    gender: string;
    address: {
      country: string;
      dist: string;
      state: string;
      po: string;
      loc: string;
      vtc: string;
      subdist: string;
      street: string;
      house: string;
      landmark: string;
    };
    face_status: boolean;
    face_score: number;
    zip: string;
    profile_image: string;
    has_image: boolean;
    email_hash: string;
    mobile_hash: string;
    raw_xml: string;
    zip_data: string;
    care_of: string;
    share_code: string;
    mobile_verified: boolean;
    reference_id: string;
    aadhaar_pdf: any; // You can update this to a specific type if needed
    status: string;
    uniqueness_id: string;
  };
  status_code: number;
  success: boolean;
  message: null; // You can update this if the message can have a specific type
  message_code: string;
}

@Injectable()
export class SurepassAPIGateway implements SurepassGateway {
  private readonly logger = new Logger(SurepassAPIGateway.name);
  constructor(private readonly httpClientService: HttpClientService) {}

  async uploadKyc(files: File[]): Promise<PanUploadResponse> {
    const baseUrl = config.user.surepass.baseUrl;
    const url = this.#constructPanUploadUrl(baseUrl);
    const response = await this.#requestDataToService(url, files);
    return response;
  }

  async generateOtp(aadhaarId: string): Promise<GenerateOtpResponse> {
    const baseUrl = config.user.surepass.baseUrl;
    const url = this.#constructGenerateOptRequestUrl(baseUrl);

    const response: GenerateOtpResponse = await this.#requestGenerateOtp(
      url,
      aadhaarId,
    );
    return response;
  }

  async submitOtp(clientId: string, otp: string): Promise<SubmitOtpResponse> {
    const baseUrl = config.user.surepass.baseUrl;
    const url = this.#constructSubmitOptRequestUrl(baseUrl);
    const response: SubmitOtpResponse = await this.#requestSubmitOtp(
      url,
      clientId,
      otp,
    );
    return response;
  }

  #constructPanUploadUrl(baseUrl: string): string {
    return `${baseUrl}/ocr/pan`;
  }

  #constructGenerateOptRequestUrl(baseUrl: string): string {
    return `${baseUrl}/aadhaar-v2/generate-otp`;
  }

  #constructSubmitOptRequestUrl(baseUrl: string): string {
    return `${baseUrl}/aadhaar-v2/submit-otp`;
  }

  async #requestDataToService(
    requestUrl: string,
    files: File[],
  ): Promise<PanUploadResponse> {
    const headers = config.user.surepass.headers;
    try {
      const formData = new FormData();
      formData.append('file', Buffer.from(files[0].data), {
        filename: files[0].filename,
        contentType: files[0].contentType,
      });
      const response = await this.httpClientService.post<PanUploadResponse>(
        requestUrl,
        formData,
        {
          headers,
        },
      );
      const { status_code, message, success } = response;
      if (status_code === 200 && success) {
        return response;
      } else {
        throw new BadRequestException({ message });
      }
    } catch (error) {
      this.logger.error('SurePass API Error');
      this.logger.error(error);
      throw new BadRequestException('Wrong Image');
    }
  }

  async #requestGenerateOtp(
    url: string,
    aadhaarId: string,
  ): Promise<GenerateOtpResponse> {
    try {
      const headers = config.user.surepass.headers;
      const response = await this.httpClientService.post<GenerateOtpResponse>(
        url,
        { id_number: aadhaarId },
        { headers },
      );
      const { status_code, message, success } = response;
      if (status_code === 200 && success) {
        return response;
      } else {
        throw new BadRequestException(message);
      }
    } catch (error) {
      let message = 'Invalid AadhaarId';
      if (
        error.response &&
        error.response.data &&
        error.response.data.status_code
      ) {
        const statusCode = error.response.data.status_code;
        if (statusCode === 422) {
          message = 'Unprocessable Entity. Invalid AadhaarId.';
        } else if (statusCode === 429) {
          message = 'Too Many Requests. Rate limit reached. Try again later.';
        }
      }
      throw new BadRequestException(message);
    }
  }

  async #requestSubmitOtp(
    url: string,
    clientId: string,
    otp: string,
  ): Promise<SubmitOtpResponse> {
    try {
      const headers = config.user.surepass.headers;
      this.logger.log('OtpSubmit: ', clientId, otp);
      const response: SubmitOtpResponse =
        await this.httpClientService.post<SubmitOtpResponse>(
          url,
          {
            client_id: clientId,
            otp,
          },
          { headers },
        );
      this.logger.log('SubmitOtpResponse: ', { response });
      const { status_code, message, success } = response;
      if (status_code === 200 && success) {
        return response;
      } else {
        throw new BadRequestException(message);
      }
    } catch (error) {
      this.logger.log(error.response.response.data.message);
      throw new BadRequestException(error.response.response.data.message);
    }
  }
}
