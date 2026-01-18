declare module "@netlify/neon" {
  type SqlTaggedTemplate = {
    (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]>;
  };

  export function neon(connectionString?: string): SqlTaggedTemplate;
}
