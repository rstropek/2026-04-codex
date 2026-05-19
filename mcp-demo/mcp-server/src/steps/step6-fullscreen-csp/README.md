# Step 6 — Display modes + external resources via CSP (React)

The View runs sandboxed in a default-deny CSP. To load anything off-origin
(images, fonts, fetch targets, nested iframes) the server must declare the
allowed domains in the resource's `_meta.ui.csp`. And: the View can ask to
go fullscreen, but the host always has the final word.

## Principle

| `_meta.ui.csp` field | Controls                                                    |
| -------------------- | ----------------------------------------------------------- |
| `resourceDomains`    | `<img>`, `<script>`, `<link rel=stylesheet>`, fonts, media. |
| `connectDomains`     | `fetch`, `XHR`, WebSocket targets.                          |
| `frameDomains`       | Nested iframes inside the View.                             |
| `baseUriDomains`     | Allowed values for `<base href>`.                           |

And for display:

| `app.requestDisplayMode({ mode })` | Asks the host to switch modes. The result reports the _granted_ mode. |
| `hostContext.availableDisplayModes` | Feature-detect — don't show a fullscreen button if the host won't grant it. |

## New APIs

| Side   | API                                                                           |
| ------ | ----------------------------------------------------------------------------- |
| Server | `_meta.ui.csp.resourceDomains: ["https://..."]` on the resource content item. |
| Server | `_meta.ui.preferences: { prefersBorder: true }` (cosmetic hints).             |
| View   | `await app.requestDisplayMode({ mode: "fullscreen" })`.                       |
| View   | `app.getHostContext().availableDisplayModes`.                                 |

## What to point at on screen

- Open the iframe, then DevTools → Network: the flag image comes from
  `flagcdn.com`. That cross-origin load only works because of the CSP entry.
- Click the fullscreen button — the iframe expands. The button label and
  internal `mode` state follow the _host's_ answer, not the request.
- Note the difference between `displayMode` (current) and
  `availableDisplayModes` (what the host advertises as grantable). Both
  arrive in `hostContext` and can change over the iframe's lifetime.

## Try this live

1. Delete `"https://flagcdn.com"` from `resourceDomains` and reload — the
   image is blocked by the sandbox's CSP. The View has no way to override.
2. Add a `fetch("https://api.example.com/...")` call — it fails until you
   also add the origin under `connectDomains` (different directive!).
3. Call `app.requestDisplayMode({ mode: "pip" })` — if the host doesn't
   support PiP, it returns `inline` or `fullscreen` instead. Always trust
   the returned mode.
