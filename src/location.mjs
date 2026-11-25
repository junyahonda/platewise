export function currentLocation({ geolocation = globalThis.navigator?.geolocation, timeoutMs = 12000 } = {}) {
  if (!geolocation) return Promise.reject(Error(
    "Location is unavailable in this browser. Try Chrome on your phone, or explore San Francisco.",
  ));
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback(value);
    };
    // The native timeout can exclude time waiting for permission. Bound the whole request.
    const timer = setTimeout(() => finish(reject, Error(
      "Location took too long. Try again, or explore San Francisco below.",
    )), timeoutMs);
    try {
      geolocation.getCurrentPosition(
        position => finish(resolve, position.coords),
        error => finish(reject, Error(error.code === 1
          ? "Location is off. Allow location in Chrome’s site settings, then try again. Or explore San Francisco below."
          : "We couldn’t get your location. Check your phone’s location setting and try again.")),
        { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60000 },
      );
    } catch {
      finish(reject, Error("We couldn’t get your location. Try again, or explore San Francisco below."));
    }
  });
}
