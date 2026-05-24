declare module "qrcode-terminal" {
  export function generate(
    input: string,
    options: { small?: boolean },
    callback: (output: string) => void
  ): void;
}
