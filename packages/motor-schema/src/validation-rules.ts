export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
export const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;
export const REGISTRATION_NUMBER_REGEX = /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$/;

export function isValidPan(pan: string): boolean {
  if (!pan) return false;
  return PAN_REGEX.test(pan.trim().toUpperCase());
}

export function isValidIndianMobile(mobile: string): boolean {
  if (!mobile) return false;
  return INDIAN_MOBILE_REGEX.test(mobile.trim().replace(/\D/g, ''));
}

export function isValidRegistrationNumber(regNo: string): boolean {
  if (!regNo) return false;
  const clean = regNo.toUpperCase().replace(/[\s\-\.]/g, '');
  return REGISTRATION_NUMBER_REGEX.test(clean);
}
