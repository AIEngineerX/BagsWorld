declare module "tweetnacl" {
  const sign: {
    detached: {
      verify(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean;
    };
  };

  const nacl: { sign: typeof sign };
  export { sign };
  export default nacl;
}
