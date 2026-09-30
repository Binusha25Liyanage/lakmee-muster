// Thin wrapper: window.pywebview.api.<method>(...) -> Promise. Waits until PyWebView is ready.
let ready = null
export function whenReady() {
  if (!ready) {
    ready = new Promise((res) => {
      if (window.pywebview && window.pywebview.api) res()
      else window.addEventListener('pywebviewready', () => res())
    })
  }
  return ready
}
export const api = new Proxy({}, {
  get: (_, name) => async (...args) => {
    await whenReady()
    return window.pywebview.api[name](...args)
  },
})
