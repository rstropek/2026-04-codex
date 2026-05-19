# Step 2 — Host context & theming

The host doesn't just embed the iframe; it tells the View everything it needs
to look native — theme, locale, timezone, container size, safe-area insets,
even a full set of CSS custom properties for colours, spacing and fonts.

## Principle

The View is a guest. Don't hard-code colours, fonts, or font sizes — read them
from the host and re-read them every time `onhostcontextchanged` fires.

## New APIs

| Side | API                                                                                |
| ---- | ---------------------------------------------------------------------------------- |
| View | `app.getHostContext()` — current `McpUiHostContext` (snapshot).                    |
| View | `app.onhostcontextchanged = () => ...` — fires on theme / size / mode change.      |
| View | `applyDocumentTheme(theme)` — toggles `<html data-theme>` (drives `color-scheme`). |
| View | `applyHostStyleVariables(vars)` — sets `--color-*`, `--spacing-*`, ... on `:root`. |
| View | `applyHostFonts(fonts)` — registers host-supplied `@font-face` rules.              |

## What to point at on screen

- The grid in the iframe updates live — toggle the basic-host theme dropdown
  and watch every cell re-render.
- The View's CSS uses `var(--color-text-primary)` etc., but the _values_
  come from the host. The View ships fallbacks via `light-dark(...)` so it
  still looks fine in a host that pushes no variables.
- `app.onhostcontextchanged` delivers a delta. We don't merge by hand — we
  just call `getHostContext()` to read the merged, current state.

## Try this live

1. Toggle the host's theme — colours flip without a tool call.
2. Resize the basic-host browser window — `containerDimensions` updates.
3. Comment out `applyHostStyleVariables(...)` and re-toggle the theme — the
   text colour now stays whatever the View hard-coded; the host can no longer
   influence it. That's why we delegate.
