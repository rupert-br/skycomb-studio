/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public Mapbox access token — see .env.local.example */
  readonly VITE_MAPBOX_TOKEN: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
