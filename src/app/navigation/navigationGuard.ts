export function requestNavigation(proceed: () => void) {
  const event = new CustomEvent("mes:before-navigation", {
    cancelable: true,
    detail: { proceed },
  })
  if (window.dispatchEvent(event)) proceed()
}
