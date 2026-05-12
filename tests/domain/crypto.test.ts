import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret, generateMasterKeyBase64 } from '../../src/crypto.js';

describe('crypto', () => {
  it('encrypts and decrypts secrets with sealed box', async () => {
    const key = await generateMasterKeyBase64();
    const ciphertext = await encryptSecret('secret-value', key);

    expect(ciphertext.toString('utf8')).not.toContain('secret-value');
    await expect(decryptSecret(ciphertext, key)).resolves.toBe('secret-value');
  });
});
