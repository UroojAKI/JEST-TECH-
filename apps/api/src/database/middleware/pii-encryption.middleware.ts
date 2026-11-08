import { EncryptionUtil } from '../../common/utils/encryption.util';

const PII_KEYS = /^(pan(number)?|aadhaar(number)?|proposerpan|proposeraadhaar)$/i;
const HASHED_MODELS = new Set(['Contact', 'Customer', 'Account']);
const WRITE_ACTIONS = ['create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'updateManyAndReturn', 'upsert'];
const READ_ACTIONS = ['findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany'];

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
    result[key] = typeof item === 'string' && PII_KEYS.test(key)
      ? EncryptionUtil.encryptIfNeeded(item)
      : encryptNestedPii(item);
  }
  return result;
}

function prepareModelData(model: string, value: any): any {
  if (Array.isArray(value)) return value.map((item) => prepareModelData(model, item));
  if (!isPlainObject(value)) return value;
  const encrypted = encryptNestedPii(value);
  if (HASHED_MODELS.has(model) && typeof value.panNumber === 'string' && value.panNumber.trim()) {
    encrypted.panNumberHash = EncryptionUtil.hashPan(value.panNumber);
  } else if (HASHED_MODELS.has(model) && value.panNumber === null) {
    encrypted.panNumberHash = null;
  }
  return encrypted;
}

function decryptNestedPii(value: any): any {
  if (Array.isArray(value)) return value.map(decryptNestedPii);
  if (!isPlainObject(value)) return value;
  const result: Record<string, any> = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] = typeof item === 'string' && PII_KEYS.test(key)
      ? EncryptionUtil.decryptIfEncrypted(item)
      : decryptNestedPii(item);
  }
  return result;
}

/**
 * Wrap Prisma model delegates rather than relying on Prisma middleware ($use),
 * which is unavailable in the Prisma Client version used by this repository.
 * Delegate wrapping preserves the existing service APIs and catches nested JSON PII.
 */
export function wrapPiiDelegate(delegate: any, model: string): void {
  for (const action of WRITE_ACTIONS) {
    if (typeof delegate?.[action] !== 'function') continue;
    const original = delegate[action].bind(delegate);
    delegate[action] = async (args: any) => {
      const nextArgs = { ...(args || {}) };
      if (nextArgs.data !== undefined) nextArgs.data = prepareModelData(model, nextArgs.data);
      if (nextArgs.create !== undefined) nextArgs.create = prepareModelData(model, nextArgs.create);
      if (nextArgs.update !== undefined) nextArgs.update = prepareModelData(model, nextArgs.update);
      return decryptNestedPii(await original(nextArgs));
    };
  }

  for (const action of READ_ACTIONS) {
    if (typeof delegate?.[action] !== 'function') continue;
    const original = delegate[action].bind(delegate);
    delegate[action] = async (args: any) => decryptNestedPii(await original(args));
  }
}

export function installPiiEncryption(client: any, modelNames: string[]): void {
  for (const model of modelNames) {
    const delegateName = model.charAt(0).toLowerCase() + model.slice(1);
    const delegate = client[delegateName];
    if (delegate) wrapPiiDelegate(delegate, model);
  }
}
