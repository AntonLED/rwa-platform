/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USDT_MINT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
