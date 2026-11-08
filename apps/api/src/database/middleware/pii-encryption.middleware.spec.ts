import { piiEncryptionMiddleware } from './pii-encryption.middleware';
import { EncryptionUtil } from '../../common/utils/encryption.util';

describe('PII Prisma middleware', () => {
  const originalEnv = process.env.PII_ENCRYPTION_KEY;
  beforeAll(() => { process.env.PII_ENCRYPTION_KEY = 'unit_test_pii_encryption_key_32_chars_minimum'; });
  afterAll(() => {
    if (originalEnv === undefined) delete process.env.PII_ENCRYPTION_KEY;
    else process.env.PII_ENCRYPTION_KEY = originalEnv;
  });

  it('encrypts direct and nested PII writes and adds the PAN blind index', async () => {
    let persisted: any;
    const result = await piiEncryptionMiddleware({
      model: 'Contact',
      action: 'create',
      args: { data: { panNumber: 'ABCDE1234F', aadhaarNumber: '123456789012', healthMetadata: { proposerPan: 'ABCDE1234F' } } },
    }, async (params) => {
      persisted = params.args.data;
      return params.args.data;
    });

    expect(EncryptionUtil.isEncrypted(persisted.panNumber)).toBe(true);
    expect(EncryptionUtil.isEncrypted(persisted.aadhaarNumber)).toBe(true);
    expect(EncryptionUtil.isEncrypted(persisted.healthMetadata.proposerPan)).toBe(true);
    expect(persisted.panNumberHash).toBe(EncryptionUtil.hashPan('ABCDE1234F'));
    expect(result.panNumber).toBe('ABCDE1234F');
    expect(result.aadhaarNumber).toBe('123456789012');
    expect(result.healthMetadata.proposerPan).toBe('ABCDE1234F');
  });

  it('decrypts nested PII returned by read operations', async () => {
    const encryptedPan = EncryptionUtil.encrypt('ABCDE1234F');
    const result = await piiEncryptionMiddleware(
      { model: 'Quotation', action: 'findUnique', args: { where: { id: 'q-1' } } },
      async () => ({ motorMetadata: { proposerDetails: { panNumber: encryptedPan } } }),
    );
    expect(result.motorMetadata.proposerDetails.panNumber).toBe('ABCDE1234F');
  });
});
