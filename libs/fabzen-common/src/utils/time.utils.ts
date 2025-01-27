import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getCurrentFinancialYear(): string {
  const now = dayjs();
  const currentYear = now.year();
  const currentMonth = now.month() + 1;
  let financialYear = '';
  financialYear =
    currentMonth <= 3
      ? `${currentYear - 1}-${currentYear.toString()}`
      : `${currentYear}-${(currentYear + 1).toString()}`;

  return financialYear;
}

export function convertUtcToIst(utcTime: string | Date): string {
  const utcFormat = 'YYYY-MM-DD HH:mm:ss';
  const istFormat = 'DD-MM-YYYY HH:mm:ss';

  // Set UTC time zone
  const utc = dayjs.utc(utcTime, utcFormat);

  // Set IST time zone (Indian Standard Time - UTC+5:30)
  const ist = utc.add(5, 'hours').add(30, 'minutes');

  return ist.format(istFormat);
}
