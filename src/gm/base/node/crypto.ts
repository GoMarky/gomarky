import CryptoJS from 'crypto-js';

export function HmacSHA512(
  message: string | CryptoJS.LibWordArray,
  key?: string | CryptoJS.WordArray,
  ...options: any[]
): CryptoJS.WordArray {
  return CryptoJS.HmacSHA512(message, key, ...options);
}

export function SHA512(
  message: string | CryptoJS.LibWordArray,
  key?: string | CryptoJS.WordArray,
  ...options: any[]
): CryptoJS.WordArray {
  return CryptoJS.SHA512(message, key, ...options);
}
