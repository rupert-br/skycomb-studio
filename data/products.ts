export type ProductId = 'poster' | 'tshirt' | 'hoodie' | 'totebag' | 'mug'

export interface ProductColor {
  name: string
  hex: string
}

export interface Product {
  id: ProductId
  name: string
  tagline: string
  priceFrom: number
  sizes: string[]
  colors: ProductColor[]
}

export const CURRENCY = '€'

// Placeholder catalog for the UI-only "buy" flow — no fulfilment provider wired up yet
// (see CONCEPT.md roadmap: real checkout/POD is a later phase). Prices are indicative.
export const PRODUCTS: Product[] = [
  {
    id: 'poster',
    name: 'Poster',
    tagline: 'Matte fine-art print, ready to frame',
    priceFrom: 24,
    sizes: ['A3', 'A2', '50×70 cm'],
    colors: [],
  },
  {
    id: 'tshirt',
    name: 'T-Shirt',
    tagline: 'Organic cotton, centre-chest print',
    priceFrom: 29,
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colors: [
      { name: 'Black', hex: '#111214' },
      { name: 'White', hex: '#f5f5f0' },
      { name: 'Stone', hex: '#cbc0ac' },
    ],
  },
  {
    id: 'hoodie',
    name: 'Hoodie',
    tagline: 'Heavyweight fleece, kangaroo pocket',
    priceFrom: 54,
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colors: [
      { name: 'Black', hex: '#111214' },
      { name: 'Heather grey', hex: '#8b8b8d' },
    ],
  },
  {
    id: 'totebag',
    name: 'Tote bag',
    tagline: 'Heavy canvas, front-panel print',
    priceFrom: 22,
    sizes: ['One size'],
    colors: [
      { name: 'Natural', hex: '#e4ddca' },
      { name: 'Black', hex: '#111214' },
    ],
  },
  {
    id: 'mug',
    name: 'Mug',
    tagline: 'Ceramic, 330 ml, wraparound print',
    priceFrom: 19,
    sizes: ['330 ml'],
    colors: [
      { name: 'White', hex: '#f5f5f0' },
      { name: 'Black', hex: '#111214' },
    ],
  },
]

export function productById(id: ProductId): Product {
  return PRODUCTS.find((p) => p.id === id) ?? PRODUCTS[0]!
}
