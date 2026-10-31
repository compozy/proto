/**
 * A page on another origin (the render origin itself, not the configured shell origin) that
 * frames the render host, names its own origin in the URL and drives it with valid messages.
 */
const frame = "foreign-nonce";
/** What the render host posted to this page; it must stay empty. */
const received: unknown[] = [];
Object.assign(window, { received });
window.addEventListener("message", event => received.push(event.data));
const iframe = document.createElement("iframe");
const query = new URLSearchParams({
  slug: "card",
  frame,
  chrome: "0",
  shellOrigin: location.origin,
  parent: location.origin,
});
iframe.src = `/test/browser/render/__proto/render/index.html?${query}&foreign=1`;
iframe.style.cssText = "width: 600px; height: 500px; border: 0";
/** Valid `pick:start` messages from this untrusted parent; the suite calls it once the host runs. */
Object.assign(window, {
  forge: () => {
    for (let index = 0; index < 3; index += 1) {
      iframe.contentWindow?.postMessage(
        { proto: 1, frame, type: "pick:start", mode: "element" },
        "*"
      );
    }
    return true;
  },
});
document.body.append(iframe);
