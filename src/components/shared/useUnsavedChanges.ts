import { useEffect, useRef } from "react"

import { Modal } from "antd"

export default function useUnsavedChanges(dirty: boolean, discard: () => void) {
  const suppressed = useRef(false)

  useEffect(() => {
    if (!dirty) return

    let pending = false

    const beforeNavigate = (event: Event) => {
      if (event.defaultPrevented || suppressed.current) return

      event.preventDefault()

      if (pending) return

      pending = true

      Modal.confirm({
        title: "Thay đổi chưa lưu",
        content: "Rời khỏi sẽ bỏ các thay đổi chưa lưu.",
        okText: "Rời khỏi",
        cancelText: "Tiếp tục chỉnh sửa",
        onCancel: () => {
          pending = false
        },
        onOk: () => {
          discard()
          ;(event as CustomEvent<{ proceed: () => void }>).detail.proceed()
        },
      })
    }

    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }

    window.addEventListener("mes:before-navigation", beforeNavigate)

    window.addEventListener("beforeunload", beforeUnload)

    return () => {
      window.removeEventListener("mes:before-navigation", beforeNavigate)
      window.removeEventListener("beforeunload", beforeUnload)
    }
  }, [dirty, discard])

  return (action: () => void) => {
    suppressed.current = true
    try {
      action()
    } finally {
      suppressed.current = false
    }
  }
}
