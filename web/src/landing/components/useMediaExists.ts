import { useEffect, useRef, useState } from 'react'

/** true once the image at url loads; false if missing. Lets shaders mount only when real media exists. */
export function useImageExists(url: string) {
  const [ok, setOk] = useState(false)
  useEffect(() => {
    const img = new Image()
    img.onload = () => setOk(true)
    img.src = url
    return () => {
      img.onload = null
    }
  }, [url])
  return ok
}

/** true while the element is near the viewport (lazy-mount heavy things like shaders). */
export function useInView<T extends Element>(margin = '200px') {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: margin })
    io.observe(el)
    return () => io.disconnect()
  }, [margin])
  return [ref, inView] as const
}
