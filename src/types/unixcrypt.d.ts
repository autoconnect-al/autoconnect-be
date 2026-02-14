declare module 'unixcrypt' {
  export function encrypt(plaintext: string, salt?: string): string;
  export function verify(plaintext: string, pwHash: string): boolean;
}
