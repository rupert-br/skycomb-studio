import { useStorage } from '@vueuse/core'
import type { ProductId } from '~/data/products'

export interface CartItem {
  id: string
  productId: ProductId
  productName: string
  size: string
  color?: string
  price: number
  title: string
  image: string
}

// Module-level (not per-call) so every component sharing this composable reads/writes the
// same cart — a singleton, the same pattern as a Pinia store but without pulling one in for
// a single small list. Persisted via VueUse's useStorage so a page refresh doesn't lose it;
// this is still just a UI mockup of a cart, nothing here talks to a real order backend.
const cart = useStorage<CartItem[]>('ridgeline-cart', [])

export function useCart() {
  function add(item: Omit<CartItem, 'id'>) {
    cart.value.push({ ...item, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` })
  }
  function remove(id: string) {
    cart.value = cart.value.filter((i) => i.id !== id)
  }
  function clear() {
    cart.value = []
  }
  const count = computed(() => cart.value.length)
  const total = computed(() => cart.value.reduce((sum, i) => sum + i.price, 0))
  return { cart, add, remove, clear, count, total }
}
