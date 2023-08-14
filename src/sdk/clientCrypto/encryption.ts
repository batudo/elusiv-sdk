import aesjs from 'aes-js';
import { generateSeededSaltedAES256Key, generateSeededSaltedIV } from './keyDerivation.js';

export type EncryptedValue = {
    cipherText: Uint8Array;
    iv: Uint8Array;
}

export function encryptSeededSaltedAES256(toEncrypt: Uint8Array, rootViewingKey: Uint8Array, salt: number): Promise<EncryptedValue> {
    const iv = generateSeededSaltedIV(rootViewingKey, salt);
    const key = generateSeededSaltedAES256Key(rootViewingKey, salt);

    return encryptAES256CTRWithKey(toEncrypt, iv, key);
}

export function decryptSeededSaltedAES256(toDecrypt: EncryptedValue, rootViewingKey: Uint8Array, salt: number): Promise<Uint8Array> {
    const key = generateSeededSaltedAES256Key(rootViewingKey, salt);

    return decryptAES256CTRWithKey(toDecrypt, key);
}

export function encryptAES256CTRWithKey(toEncrypt: Uint8Array, iv: Uint8Array, key: Uint8Array): Promise<EncryptedValue> {
    // eslint-disable-next-line new-cap
    const aesCtr = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(iv));
    return Promise.resolve({ cipherText: aesCtr.encrypt(toEncrypt), iv });
}

export function decryptAES256CTRWithKey(toDecrypt: EncryptedValue, key: Uint8Array): Promise<Uint8Array> {
    // eslint-disable-next-line new-cap
    const aesCtr = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(toDecrypt.iv));
    return Promise.resolve(aesCtr.decrypt(toDecrypt.cipherText));
}
