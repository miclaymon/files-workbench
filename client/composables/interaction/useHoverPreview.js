import { ref } from 'vue'

export function useHoverPreview() {
  const activeItem = ref(null)
  const triggerRect = ref(null)
  let _preloadTimer = null
  let _showTimer    = null

  /**
   * @param item        - the data item being hovered
   * @param el          - element whose rect is used to position the popup
   * @param showMs      - delay before the popup appears
   * @param preloadMs   - delay before onPreload fires (should be < showMs)
   * @param onPreload   - optional fn(item) called at preloadMs to warm the cache
   */
  function startHover(item, el, showMs, preloadMs = 0, onPreload = null) {
    clearTimeout(_preloadTimer)
    clearTimeout(_showTimer)

    if (onPreload && preloadMs > 0 && preloadMs < showMs) {
      _preloadTimer = setTimeout(() => onPreload(item), preloadMs)
    }

    _showTimer = setTimeout(() => {
      triggerRect.value = el.getBoundingClientRect()
      activeItem.value  = item
    }, showMs)
  }

  function endHover() {
    clearTimeout(_preloadTimer)
    clearTimeout(_showTimer)
    activeItem.value  = null
    triggerRect.value = null
  }

  // Cancel pending timers AND dismiss any open popup (used on mousedown / drag)
  function cancelPending() {
    clearTimeout(_preloadTimer)
    clearTimeout(_showTimer)
    activeItem.value  = null
    triggerRect.value = null
  }

  return { activeItem, triggerRect, startHover, endHover, cancelPending }
}
