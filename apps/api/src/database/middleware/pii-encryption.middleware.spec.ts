import { wrapPiiDelegate } from './pii-encryption.middleware';
import { EncryptionUtil } from '../../common/utils/encryption.util';

describe('PII Prisma delegate wrappers', () => {
  const originalEnv = process.env.PII_ENCRYPTION_KEY;
  beforeAll(() => { process.env.PII_ENCRYPTION_KEY = 'unit_test_pii_encryption_key_32_chars_minimum'; });
  afterAll(() => {
    if (originalEnv === undefined) delete process.env.PII_ENCRYPTION_KEY;
    else process.env.PII_ENCRYPTION_KEY = originalEnv;
  });

  it('encrypts direct and nested PII writes and adds the PAN blind index', async () => {
    let persisted: any;
    const delegate: any = {
      create: async (args: any) => { persisted = args.data; return args.data; },
    };
    wrapPiiDelegate(delegate, 'Contact');

    const result = await delegate.create({
      data: {
        panNumber: 'ABCDE1234F',
        aadhaarNumber: '123456789012',
        healthMetadata: { proposerPan: 'ABCDE1234F' },
      },
    });

    expect(EncryptionUtil.isEncrypted(persisted.panNumber)).toBe(true);
    expect(EncryptionUtil.isEncrypted(persisted.aadhaarNumber)).toBe(true);
    expect(EncryptionUtil.isEncrypted(persisted.healthMetadata.proposerPan)).toBe(true);
    expect(persisted.panNumberHash).toBe(EncryptionUtil.hashPan('ABCDE1234F'));
    expect(result.panNumber).toBe('ABCDE1234F');
    expect(result.aadhaarNumber).toBe('123456789012');
    expect(result.healthMetadata.proposerPan).toBe('ABCDE1234F');
  });

  it('wraps Prisma interactive transaction delegates as well as root delegates', async () => {
    let persisted: any;
    const tx: any = {
      contact: {
        create: async (args: any) => { persisted = args.data; return args.data; },
      },
    };
    const client: any = {
      $transaction: async (operation: any) => operation(tx),
      contact: {
        create: async (args: any) => args.data,
      },
    };
    const { installPiiEncryption } = await import('./pii-encryption.middleware');
    installPiiEncryption(client, ['Contact']);

    const result = await client.$transaction(async (transaction: any) =>
      transaction.contact.create({ data: { panNumber: 'ABCDE1234F' } }),
    );
    expect(result.panNumber).toBe('ABCDE1234F');
    expect(EncryptionUtil.isEncrypted(persisted.panNumber)).toBe(true);
  });

  it('decrypts nested PII returned by read operations', async () => {
    const encryptedPan = EncryptionUtil.encrypt('ABCDE1234F');
    const delegate: any = {
      findUnique: async () => ({ motorMetadata: { proposerDetails: { panNumber: encryptedPan } } }),
    };
    wrapPiiDelegate(delegate, 'Quotation');
    const result = await delegate.findUnique({ where: { id: 'q-1' } });
    expect(result.motorMetadata.proposerDetails.panNumber).toBe('ABCDE1234F');
  });
});
