import parsePhoneNumber from 'libphonenumber-js';

import { Country, MobileNumber } from '../types';

export function getCountryFromMobileNumber(
  mobileNumber: MobileNumber,
): Country {
  const phoneNumber = parsePhoneNumber(
    '+' + mobileNumber.countryCode + mobileNumber.number,
  );

  return normalizeCountryName(phoneNumber?.country);
}

function normalizeCountryName(twoLetterForm: string | undefined): Country {
  switch (twoLetterForm) {
    case 'IN': {
      return Country.India;
    }
    default: {
      console.warn(`Unknown country ${twoLetterForm}`);
      return Country.India;
    }
  }
}

export function maskMobileNumber(mobileNumber: MobileNumber): MobileNumber {
  const { countryCode, number } = mobileNumber;
  return {
    countryCode,
    number: number.slice(0, 3) + '****' + number.slice(-3),
  };
}
