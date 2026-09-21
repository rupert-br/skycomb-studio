// Morphs the minimized tab into the poster panel (and back) instead of the two swapping
// instantly: both share `view-transition-name: ridgeline-panel` (assets/css/main.css), so the
// browser interpolates position/size/radius between the outgoing and incoming element itself.
// Port of App.tsx's toggleCardCollapsed; flushSync's job (forcing the DOM to update inside the
// callback, which the View Transitions API needs to snapshot the "after" frame) is done here
// with `await nextTick()` instead. Falls back to a plain state update on browsers without the
// View Transitions API (Firefox, older Safari).
export function usePosterCard() {
  const collapsed = ref(false)

  function toggle(next: boolean) {
    if (typeof document === 'undefined' || !document.startViewTransition) {
      collapsed.value = next
      return
    }
    const transition = document.startViewTransition(async () => {
      collapsed.value = next
      await nextTick()
    })
    // A transition the browser interrupts or skips (retriggered before the first finishes,
    // reduced-motion, tab hidden, ...) rejects its promises as an expected part of that, not a
    // bug — left uncaught it's just console noise.
    transition.updateCallbackDone.catch(() => {})
    transition.ready.catch(() => {})
    transition.finished.catch(() => {})
  }

  return { collapsed, toggle }
}
