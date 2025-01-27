import { gunzipSync, gzipSync } from 'node:zlib';

export function camelCaseToParameterCase(camelCase: string): string {
  return camelCase.replaceAll(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

export function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function compressString(inputString: string): string {
  const compressed = gzipSync(inputString).toString('base64');
  return compressed;
}

export function decompressString(inputString: string): string {
  return gunzipSync(Buffer.from(inputString, 'base64')).toString();
}

export function maskIP(ipAddress: string | undefined): string {
  if (!ipAddress) {
    return '';
  }
  const parts = ipAddress.split('.');
  return parts[0] + '.***.***.' + parts[3];
}
