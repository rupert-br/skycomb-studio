import type { CountryPeaks, Peak } from '~/types/ridgeline'

/** ISO 3166-1 alpha-2 → flag emoji, via the regional-indicator Unicode trick. */
export function countryFlag(code: string): string {
  return [...code.toUpperCase()].map((c) => String.fromCodePoint(127397 + c.charCodeAt(0))).join('')
}

// A default map zoom for a peak fly-to — close enough to read the massif's ridgelines,
// wide enough that the fixed A4 frame doesn't need repositioning before rendering.
export const ZOOM = 11.2

// Top 10 highest peaks per country, by elevation. Coordinates verified against Wikipedia's
// per-country mountain lists (see the research behind this file for source notes); summits
// exactly on a border (Mont Blanc, Matterhorn, Mount Saint Elias, ...) are listed under every
// country whose own "highest mountains" list includes them, matching how each country's
// Wikipedia page attributes it — not a claim about where the border actually runs.
export const COUNTRIES: CountryPeaks[] = [
  {
    country: 'Austria',
    code: 'AT',
    peaks: [
      { name: 'Großglockner', lat: 47.07417, lon: 12.69444, elevation: 3798, zoom: ZOOM },
      { name: 'Wildspitze', lat: 46.88528, lon: 10.86722, elevation: 3770, zoom: ZOOM },
      { name: 'Weißkugel', lat: 46.79778, lon: 10.72639, elevation: 3739, zoom: ZOOM },
      { name: 'Großvenediger', lat: 47.10917, lon: 12.34639, elevation: 3666, zoom: ZOOM },
      { name: 'Hintere Schwärze', lat: 46.77333, lon: 10.91472, elevation: 3628, zoom: ZOOM },
      { name: 'Hinterer Brochkogel', lat: 46.88611, lon: 10.84972, elevation: 3628, zoom: ZOOM },
      { name: 'Similaun', lat: 46.76361, lon: 10.88083, elevation: 3599, zoom: ZOOM },
      { name: 'Vorderer Brochkogel', lat: 46.87472, lon: 10.85083, elevation: 3565, zoom: ZOOM },
      { name: 'Großes Wiesbachhorn', lat: 47.15639, lon: 12.75528, elevation: 3564, zoom: ZOOM },
      { name: 'Rainerhorn', lat: 47.10083, lon: 12.36417, elevation: 3559, zoom: ZOOM },
    ],
  },
  {
    country: 'Switzerland',
    code: 'CH',
    peaks: [
      { name: 'Monte Rosa (Dufourspitze)', lat: 45.93694, lon: 7.86694, elevation: 4634, zoom: ZOOM },
      { name: 'Dom', lat: 46.09389, lon: 7.85889, elevation: 4546, zoom: ZOOM },
      { name: 'Lyskamm', lat: 45.92222, lon: 7.83556, elevation: 4532, zoom: ZOOM },
      { name: 'Weisshorn', lat: 46.10139, lon: 7.71583, elevation: 4505, zoom: ZOOM },
      { name: 'Matterhorn', lat: 45.97639, lon: 7.65861, elevation: 4478, zoom: ZOOM },
      { name: 'Dent Blanche', lat: 46.03417, lon: 7.61194, elevation: 4357, zoom: ZOOM },
      { name: 'Grand Combin', lat: 45.9375, lon: 7.29917, elevation: 4309, zoom: ZOOM },
      { name: 'Finsteraarhorn', lat: 46.53722, lon: 8.12611, elevation: 4274, zoom: ZOOM },
      { name: 'Zinalrothorn', lat: 46.065, lon: 7.69028, elevation: 4221, zoom: ZOOM },
      { name: 'Alphubel', lat: 46.06306, lon: 7.86389, elevation: 4206, zoom: ZOOM },
    ],
  },
  {
    country: 'Italy',
    code: 'IT',
    peaks: [
      { name: 'Mont Blanc (Monte Bianco)', lat: 45.8325, lon: 6.86444, elevation: 4808, zoom: ZOOM },
      { name: 'Grenzgipfel', lat: 45.9368, lon: 7.868, elevation: 4618, zoom: ZOOM },
      { name: 'Lyskamm', lat: 45.9225, lon: 7.8356, elevation: 4533, zoom: ZOOM },
      { name: 'Matterhorn (Cervino)', lat: 45.9764, lon: 7.6586, elevation: 4478, zoom: ZOOM },
      { name: 'Grandes Jorasses', lat: 45.8692, lon: 6.9883, elevation: 4208, zoom: ZOOM },
      { name: "Dent d'Hérens", lat: 45.97, lon: 7.6053, elevation: 4174, zoom: ZOOM },
      { name: 'Breithorn', lat: 45.9411, lon: 7.7489, elevation: 4164, zoom: ZOOM },
      { name: 'Gran Paradiso', lat: 45.5181, lon: 7.2672, elevation: 4061, zoom: ZOOM },
      { name: 'La Spedla', lat: 46.3808, lon: 9.9072, elevation: 4020, zoom: ZOOM },
      { name: 'Piz Zupò', lat: 46.3683, lon: 9.9314, elevation: 3996, zoom: ZOOM },
    ],
  },
  {
    country: 'France',
    code: 'FR',
    peaks: [
      { name: 'Mont Blanc', lat: 45.8325, lon: 6.86444, elevation: 4808, zoom: ZOOM },
      { name: "Barre des Écrins", lat: 44.9225, lon: 6.36, elevation: 4102, zoom: ZOOM },
      { name: 'Grande Casse', lat: 45.40528, lon: 6.82778, elevation: 3855, zoom: ZOOM },
      { name: 'Mont Pourri', lat: 45.52806, lon: 6.86028, elevation: 3779, zoom: ZOOM },
      { name: 'Dent Parrachée', lat: 45.28917, lon: 6.75639, elevation: 3697, zoom: ZOOM },
      { name: "Aiguilles d'Arves", lat: 45.12722, lon: 6.33694, elevation: 3514, zoom: ZOOM },
      { name: 'Aiguille de Scolette', lat: 45.16, lon: 6.76861, elevation: 3506, zoom: ZOOM },
      { name: 'Pic Bayle', lat: 45.13778, lon: 6.13583, elevation: 3465, zoom: ZOOM },
      { name: 'Pic de Rochebrune', lat: 44.8225, lon: 6.78778, elevation: 3320, zoom: ZOOM },
      { name: 'Vignemale', lat: 42.70444, lon: -0.06389, elevation: 3298, zoom: ZOOM },
    ],
  },
  {
    country: 'United States',
    code: 'US',
    peaks: [
      { name: 'Denali', lat: 63.069, lon: -151.0063, elevation: 6190, zoom: ZOOM },
      { name: 'Mount Saint Elias', lat: 60.2927, lon: -140.9307, elevation: 5489, zoom: ZOOM },
      { name: 'Mount Foraker', lat: 62.9604, lon: -151.3998, elevation: 5304, zoom: ZOOM },
      { name: 'Mount Bona', lat: 61.3856, lon: -141.7495, elevation: 5044, zoom: ZOOM },
      { name: 'Mount Blackburn', lat: 61.7305, lon: -143.4031, elevation: 4996, zoom: ZOOM },
      { name: 'Mount Sanford', lat: 62.2132, lon: -144.1292, elevation: 4949, zoom: ZOOM },
      { name: 'Mount Fairweather', lat: 58.9064, lon: -137.5265, elevation: 4653, zoom: ZOOM },
      { name: 'Mount Hubbard', lat: 60.3194, lon: -139.0726, elevation: 4557, zoom: ZOOM },
      { name: 'Mount Bear', lat: 61.2834, lon: -141.1433, elevation: 4520, zoom: ZOOM },
      { name: 'Mount Hunter', lat: 62.9504, lon: -151.0915, elevation: 4442, zoom: ZOOM },
    ],
  },
  {
    country: 'Nepal',
    code: 'NP',
    peaks: [
      { name: 'Mount Everest (Sagarmatha)', lat: 27.9881, lon: 86.925, elevation: 8849, zoom: ZOOM },
      { name: 'Kanchenjunga', lat: 27.703, lon: 88.14735, elevation: 8586, zoom: ZOOM },
      { name: 'Lhotse', lat: 27.95, lon: 86.93, elevation: 8516, zoom: ZOOM },
      { name: 'Makalu', lat: 27.8892, lon: 87.0886, elevation: 8485, zoom: ZOOM },
      { name: 'Cho Oyu', lat: 28.0942, lon: 86.6608, elevation: 8188, zoom: ZOOM },
      { name: 'Dhaulagiri I', lat: 28.6967, lon: 83.49, elevation: 8167, zoom: ZOOM },
      { name: 'Manaslu', lat: 28.55, lon: 84.5597, elevation: 8163, zoom: ZOOM },
      { name: 'Annapurna I', lat: 28.6, lon: 83.82, elevation: 8091, zoom: ZOOM },
      { name: 'Gyachung Kang', lat: 28.09806, lon: 86.74222, elevation: 7952, zoom: ZOOM },
      { name: 'Annapurna II', lat: 28.53583, lon: 84.12139, elevation: 7937, zoom: ZOOM },
    ],
  },
  {
    country: 'Norway',
    code: 'NO',
    peaks: [
      { name: 'Galdhøpiggen', lat: 61.63611, lon: 8.31222, elevation: 2469, zoom: ZOOM },
      { name: 'Glittertinden', lat: 61.65111, lon: 8.55722, elevation: 2452, zoom: ZOOM },
      { name: 'Store Skagastølstinden', lat: 61.46139, lon: 7.87139, elevation: 2405, zoom: ZOOM },
      { name: 'Skardstinden', lat: 61.63333, lon: 8.26611, elevation: 2377, zoom: ZOOM },
      { name: 'Surtningssue', lat: 61.53417, lon: 8.57222, elevation: 2368, zoom: ZOOM },
      { name: 'Jervvasstind', lat: 61.46444, lon: 7.90972, elevation: 2351, zoom: ZOOM },
      { name: 'Store Hellstugutinden', lat: 61.54417, lon: 8.42806, elevation: 2346, zoom: ZOOM },
      { name: 'Storjuvtinden', lat: 61.63028, lon: 8.29361, elevation: 2344, zoom: ZOOM },
      { name: 'Store Knutsholstinden', lat: 61.42444, lon: 8.5625, elevation: 2340, zoom: ZOOM },
      { name: 'Leirhøe', lat: 61.59111, lon: 8.46694, elevation: 2330, zoom: ZOOM },
    ],
  },
  {
    country: 'New Zealand',
    code: 'NZ',
    peaks: [
      { name: 'Aoraki / Mount Cook', lat: -43.595, lon: 170.14222, elevation: 3724, zoom: ZOOM },
      { name: 'Mount Tasman', lat: -43.56583, lon: 170.15722, elevation: 3497, zoom: ZOOM },
      { name: 'Malte Brun', lat: -43.56222, lon: 170.305, elevation: 3199, zoom: ZOOM },
      { name: 'Mount Sefton', lat: -43.6825, lon: 170.04222, elevation: 3151, zoom: ZOOM },
      { name: 'Mount Elie de Beaumont', lat: -43.48167, lon: 170.32806, elevation: 3109, zoom: ZOOM },
      { name: 'La Perouse', lat: -43.60139, lon: 170.09222, elevation: 3078, zoom: ZOOM },
      { name: 'Douglas Peak', lat: -43.54167, lon: 170.2025, elevation: 3077, zoom: ZOOM },
      { name: 'The Minarets', lat: -43.50972, lon: 170.27444, elevation: 3040, zoom: ZOOM },
      { name: 'Mount Aspiring / Tititea', lat: -44.38417, lon: 168.72806, elevation: 3033, zoom: ZOOM },
      { name: 'Mount Hamilton', lat: -43.55444, lon: 170.32944, elevation: 3025, zoom: ZOOM },
    ],
  },
  {
    country: 'Japan',
    code: 'JP',
    peaks: [
      { name: 'Mount Fuji', lat: 35.36083, lon: 138.7275, elevation: 3776, zoom: ZOOM },
      { name: 'Mount Kita (Kitadake)', lat: 35.67417, lon: 138.23667, elevation: 3193, zoom: ZOOM },
      { name: 'Mount Okuhotaka (Okuhotakadake)', lat: 36.28917, lon: 137.64806, elevation: 3190, zoom: ZOOM },
      { name: 'Mount Aino (Ainodake)', lat: 35.64611, lon: 138.22833, elevation: 3190, zoom: ZOOM },
      { name: 'Mount Yari (Yarigatake)', lat: 36.34194, lon: 137.6475, elevation: 3180, zoom: ZOOM },
      { name: 'Mount Warusawa (Warusawadake)', lat: 35.50083, lon: 138.1825, elevation: 3141, zoom: ZOOM },
      { name: 'Mount Akaishi (Akaishidake)', lat: 35.46111, lon: 138.15722, elevation: 3120, zoom: ZOOM },
      { name: 'Mount Karasawa (Karasawadake)', lat: 36.2958, lon: 137.6467, elevation: 3110, zoom: ZOOM },
      { name: 'Mount Kitahotaka (Kitahotakadake)', lat: 36.3016, lon: 137.6545, elevation: 3106, zoom: ZOOM },
      { name: 'Mount Ōbami (Ōbamidake)', lat: 36.33583, lon: 137.64611, elevation: 3101, zoom: ZOOM },
    ],
  },
  {
    country: 'Canada',
    code: 'CA',
    peaks: [
      { name: 'Mount Logan', lat: 60.56722, lon: -140.40528, elevation: 5959, zoom: ZOOM },
      { name: 'Mount Saint Elias', lat: 60.2927, lon: -140.9307, elevation: 5489, zoom: ZOOM },
      { name: 'Mount Lucania', lat: 61.02333, lon: -140.46556, elevation: 5240, zoom: ZOOM },
      { name: 'King Peak', lat: 60.58306, lon: -140.65389, elevation: 5173, zoom: ZOOM },
      { name: 'Mount Steele', lat: 61.09333, lon: -140.31083, elevation: 5073, zoom: ZOOM },
      { name: 'Mount Wood', lat: 61.23278, lon: -140.5125, elevation: 4850, zoom: ZOOM },
      { name: 'Mount Vancouver', lat: 60.33449, lon: -139.69236, elevation: 4812, zoom: ZOOM },
      { name: 'Mount Slaggard', lat: 61.17278, lon: -140.585, elevation: 4742, zoom: ZOOM },
      { name: 'Mount Fairweather', lat: 58.9064, lon: -137.5265, elevation: 4653, zoom: ZOOM },
      { name: 'Mount Hubbard', lat: 60.3194, lon: -139.0726, elevation: 4557, zoom: ZOOM },
    ],
  },
]

/** A predefined peak's marker properties, as read back off a Mapbox GL feature click. */
export interface PeakMarkerProperties {
  name: string
  country: string
  elevation: number
  zoom: number
}

/**
 * All predefined peaks, one marker per unique coordinate — summits listed under several
 * countries (Mont Blanc, Matterhorn, Mount Saint Elias, ...) collapse to a single feature,
 * keyed by whichever country lists them first above.
 */
export function peaksGeoJSON(): GeoJSON.FeatureCollection<GeoJSON.Point, PeakMarkerProperties> {
  const byCoordinate = new Map<string, GeoJSON.Feature<GeoJSON.Point, PeakMarkerProperties>>()
  for (const { country, peaks } of COUNTRIES) {
    for (const peak of peaks) {
      const key = `${peak.lat.toFixed(3)},${peak.lon.toFixed(3)}`
      if (byCoordinate.has(key)) continue
      byCoordinate.set(key, {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [peak.lon, peak.lat] },
        properties: { name: peak.name, country, elevation: peak.elevation, zoom: peak.zoom },
      })
    }
  }
  return { type: 'FeatureCollection', features: [...byCoordinate.values()] }
}

/** Rebuilds a Peak from a clicked marker's GeoJSON feature (its geometry carries lat/lon). */
export function peakFromFeature(feature: GeoJSON.Feature): { country: string; peak: Peak } | null {
  const props = feature.properties as PeakMarkerProperties | null
  if (!props || feature.geometry.type !== 'Point') return null
  const [lon, lat] = feature.geometry.coordinates as [number, number]
  return {
    country: props.country,
    peak: { name: props.name, lat, lon, elevation: props.elevation, zoom: props.zoom },
  }
}
