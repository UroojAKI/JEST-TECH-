import { EncryptionUtil } from '../../common/utils/encryption.util';

const PII_KEYS = /^(pan(number)?|aadhaar(number)?|proposerpan|proposeraadhaar)$/i;
const HASHED_MODELS = new Set(['Contact', 'Customer', 'Account']);
const WRITE_ACTIONS = new Set(['create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'updateManyAndReturn', 'upsert']);

function isPlainObject(value: unknown): value is Record<string, any> {
  if (!value || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function encryptNestedPii(value: any): any {
  if (Array.isArray(value)) return value.map(encryptNestedPii);
  if (!isPlainObject(value)) return value;
  const result: Record<string, any> = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] = typeof item === 'string' && PII_KEYS.test(key) ? EncryptionUtil.encryptIfNeeded(item) : encryptNestedPii(item);
  }
  return result;
}

function prepareModelData(model: string | undefined, value: any): any {
  if (Array.isArray(value)) return value.map((item) => prepareModelData(model, item));
  if (!isPlainObject(value)) return value;
  const encrypted = encryptNestedPii(value);
  if (HASHED_MODELS.has(model || '') && typeof value.panNumber === 'string' && value.panNumber.trim()) {
    encrypted.panNumberHash = EncryptionUtil.hashPan(value.panNumber);
  } else if (HASHED_MODELS.has(model || '') && value.panNumber === null) {
    encrypted.panNumberHash = null;
  }
  return encrypted;
}

function decryptNestedPii(value: any): any {
  if (Array.isArray(value)) return value.map(decryptNestedPii);
  if (!isPlainObject(value)) return value;
  const result: Record<string, any> = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] = typeof item === 'string' && PII_KEYS.test(key) ? EncryptionUtil.decryptIfEncrypted(item) : decryptNestedPii(item);
  }
  return result;
}

export const piiEncryptionMiddleware = async (params: any, next: (params: any) => Promise<any>) => {
  if (WRITE_ACTIONS.has(params.action) && params.args) {
    const args = { ...params.args };
    if (args.data !== undefined) args.data = prepareModelData(params.model, args.data);
    if (args.create !== undefined) args.create = prepareModelData(params.model, args.create);
    if (args.update !== undefined) args.update = prepareModelData(params.model, args.update);
    params = { ...params, args };
  }
  return decryptNestedPii(await next(params));
}