import bs58 from 'bs58';

export function bytesToBs58(bytes: Uint8Array): string {
    return bs58.encode(bytes);
}

export function bs58ToBytes(str: string): Uint8Array {
    return bs58.decode(str);
}
