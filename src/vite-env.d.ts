/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_REALTIME_CORE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
