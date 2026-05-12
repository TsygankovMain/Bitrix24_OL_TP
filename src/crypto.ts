import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

interface SodiumWrappers {
  ready: Promise<void>;
  crypto_box_SEEDBYTES: number;
  randombytes_buf(length: number): Uint8Array;
  crypto_box_seed_keypair(seed: Uint8Array): { publicKey: Uint8Array; privateKey: Uint8Array };
  crypto_box_seal(message: Uint8Array, publicKey: Uint8Array): Uint8Array;
  crypto_box_seal_open(
    ciphertext: Uint8Array,
    publicKey: Uint8Array,
    privateKey: Uint8Array,
  ): Uint8Array;
}

const sodium = require('libsodium-wrappers') as SodiumWrappers;

export type SecretCiphertext = Buffer;

let ready: Promise<void> | null = null;

async function ensureReady(): Promise<void> {
  ready ??= sodium.ready;
  await ready;
}

function masterSeedFromBase64(masterKeyBase64: string): Uint8Array {
  const seed = Buffer.from(masterKeyBase64, 'base64');
  if (seed.length !== sodium.crypto_box_SEEDBYTES) {
    throw new Error(
      `MASTER_ENCRYPTION_KEY_BASE64 must decode to ${sodium.crypto_box_SEEDBYTES} bytes`,
    );
  }
  return seed;
}

export async function generateMasterKeyBase64(): Promise<string> {
  await ensureReady();
  return Buffer.from(sodium.randombytes_buf(sodium.crypto_box_SEEDBYTES)).toString('base64');
}

export async function encryptSecret(
  plaintext: string,
  masterKeyBase64: string,
): Promise<SecretCiphertext> {
  await ensureReady();
  const keyPair = sodium.crypto_box_seed_keypair(masterSeedFromBase64(masterKeyBase64));
  const encrypted = sodium.crypto_box_seal(Buffer.from(plaintext, 'utf8'), keyPair.publicKey);
  return Buffer.from(encrypted);
}

export async function decryptSecret(
  ciphertext: Uint8Array,
  masterKeyBase64: string,
): Promise<string> {
  await ensureReady();
  const keyPair = sodium.crypto_box_seed_keypair(masterSeedFromBase64(masterKeyBase64));
  const decrypted = sodium.crypto_box_seal_open(ciphertext, keyPair.publicKey, keyPair.privateKey);
  return Buffer.from(decrypted).toString('utf8');
}
