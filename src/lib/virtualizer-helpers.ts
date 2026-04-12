/**
 * Custom observeElementRect — sadece yükseklik değişikliklerinde fire eder.
 *
 * Sidebar width transition sırasında ResizeObserver her animation frame'de
 * virtualizer'ı tetikler ve React re-render cascade başlatır. Bu fonksiyon
 * width değişikliklerini ignore ederek gereksiz re-render'ları tamamen önler.
 */
export function observeElementRectHeightOnly<T, I>(
  instance: { scrollElement: (T & HTMLElement) | null },
  cb: (rect: { width: number; height: number }) => void
): (() => void) | undefined {
  const el = instance.scrollElement;
  if (!el) return undefined;

  let prevH = 0;
  const ro = new ResizeObserver(() => {
    const h = el.clientHeight;
    if (h !== prevH) {
      prevH = h;
      cb({ width: el.clientWidth, height: h });
    }
  });

  const { width, height } = el.getBoundingClientRect();
  prevH = height;
  cb({ width, height });
  ro.observe(el);

  return () => ro.disconnect();
}
