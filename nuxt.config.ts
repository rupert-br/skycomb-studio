import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-09-17',
  devtools: { enabled: true },

  modules: ['@nuxt/fonts'],

  components: {
    dirs: [
      // shadcn-vue's components/ui/*/index.ts barrels re-export things like `buttonVariants`
      // (not components) alongside the .vue file — without this, Nuxt tries to register both
      // as the same auto-imported component name and warns on every one of them.
      { path: '~/components/ui', extensions: ['vue'] },
      // Nuxt's default naming prefixes a component with its subdirectory name unless the
      // filename already starts with it (map/MapFrame and poster/PosterPanel happen to match
      // that rule by coincidence; poster/RidgelineChart and search/MountainPicker don't) —
      // pathPrefix: false keeps every component's short, own name regardless of which of
      // components/{map,search,poster}/ it organizationally lives in.
      { path: '~/components', pathPrefix: false },
    ],
  },

  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        {
          rel: 'icon',
          type: 'image/x-icon',
          href: '/favicon.ico',
          sizes: '48x48',
        },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
      // Umami analytics (self-hosted)
      script: [
        {
          src: 'https://umami.rbd-solutions.com/script.js',
          defer: true,
          'data-website-id': '0dc64b0d-d348-4494-9605-438e8c4d006a',
        },
      ],
    },
  },

  css: ['~/assets/css/main.css', 'mapbox-gl/dist/mapbox-gl.css'],

  vite: {
    plugins: [tailwindcss()],
  },

  // The studio (/studio) is a full-viewport interactive map + chart — nothing
  // there benefits from server rendering, and Mapbox GL touches `window` at import
  // time, which is a well-known SSR footgun. The landing page and About stay SSR'd
  // (the app-wide default) for fast first paint and real meta tags once they exist.
  routeRules: {
    '/studio/**': { ssr: false },
    // The legal imprint lives on the operator's own site; these just forward to it.
    // 302 (not 301) so browsers don't cache the target if it ever moves.
    '/impressum': {
      redirect: {
        to: 'https://www.rbd-solutions.com/impressum',
        statusCode: 302,
      },
    },
    '/imprint': {
      redirect: {
        to: 'https://www.rbd-solutions.com/impressum',
        statusCode: 302,
      },
    },
  },

  runtimeConfig: {
    // Server-only; overridable via NUXT_OVERPASS_URL / NUXT_NOMINATIM_URL
    overpassUrl: 'https://overpass-api.de/api/interpreter',
    nominatimUrl: 'https://nominatim.openstreetmap.org/search',
    public: {
      // NUXT_PUBLIC_MAPBOX_TOKEN
      mapboxToken: '',
    },
  },

  typescript: {
    strict: true,
    tsConfig: {
      compilerOptions: {
        // @types/geojson only augments the global `GeoJSON` namespace when explicitly
        // included — Nuxt's generated tsconfig sets its own `types` array, which otherwise
        // suppresses TypeScript's automatic @types/* pickup.
        types: ['geojson'],
      },
    },
  },
})
