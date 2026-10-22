// Checking for news on a timer, without wasting requests.
//   - It asks again after `base` ms. When nothing changed it waits a little longer each time (up to `max`), and goes
//     back to `base` the moment something does change.
//   - It does nothing while the tab is hidden, and asks straight away when the tab comes back.
// `run` returns false when the answer was the same as last time; anything else counts as a change.
export function poll(run: () => Promise<boolean | void>, opts: { base?: number; max?: number } = {}) {
  const base = opts.base ?? 8000;
  const max = opts.max ?? 20000;
  let delay = base;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  const visible = () => typeof document === "undefined" || document.visibilityState === "visible";

  const schedule = () => {
    clearTimeout(timer);
    if (stopped || !visible()) return;
    timer = setTimeout(tick, delay);
  };
  const tick = async () => {
    let changed = true;
    try {
      changed = (await run()) !== false;
    } catch {
      // A failed check counts as a change, so it is retried at the normal pace.
    }
    delay = changed ? base : Math.min(max, Math.round(delay * 1.5));
    schedule();
  };
  const wake = () => {
    if (stopped || !visible()) return;
    delay = base;
    clearTimeout(timer);
    tick();
  };

  document.addEventListener("visibilitychange", wake);
  window.addEventListener("focus", wake);
  schedule();
  return () => {
    stopped = true;
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", wake);
    window.removeEventListener("focus", wake);
  };
}
