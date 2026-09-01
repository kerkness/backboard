/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly MUI_X_KEY?: string
  readonly VITE_MYLAR_API_KEY?: string
  readonly VITE_MYLAR_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
