/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_VOTE_API_URL?: string;
  readonly VITE_RANKING_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
