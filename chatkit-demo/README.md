# ChatKit Demo (Next.js)

## Setup

```bash
pnpm install
pnpm dev
```

Required env vars in `.env.local`:

- `OPENAI_API_KEY`
- `CHATKIT_WORKFLOW_ID` (workflow id from Agent Builder, `wf_...`)
- (optional) `CHATKIT_API_BASE` (defaults to `https://api.openai.com`)

## Scripts

- `pnpm dev` — start the Next.js dev server
- `pnpm build` — production build
- `pnpm start` — run the production build
- `pnpm typecheck` — `tsc --noEmit`
