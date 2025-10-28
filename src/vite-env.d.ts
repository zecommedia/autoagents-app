/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_API_MODE?: 'local' | 'remote' | 'auto';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
