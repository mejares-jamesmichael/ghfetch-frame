# ghfetch-frame

A tiny serverless wrapper that puts a terminal-window frame (traffic-light
dots, title bar, rounded border) around a [neofetch-profile](https://github.com/jeantimex/neofetch-profile)
GitHub stats card — without touching that project's code or your existing
`neofetch.json`.

It fetches the card SVG server-side and inlines it into a new, fully
self-contained SVG response, so GitHub's README sandbox (which blocks SVGs
that reference external resources) has nothing to block.

## Deploy

1. Push this folder to its own GitHub repo (e.g. `neofetch-frame`).
2. Go to [vercel.com/new](https://vercel.com/new), import that repo, and
   deploy. No environment variables or build config needed — it's a single
   serverless function.
3. Vercel will give you a URL like `https://neofetch-frame-yourname.vercel.app`.

## Usage

```
https://YOUR-DEPLOYMENT.vercel.app/api/frame?url=<url-encoded neofetch-profile card URL>
```

### Parameters

| Param      | Description                                      | Default                    |
| ---------- | ------------------------------------------------- | --------------------------- |
| `url`      | URL-encoded neofetch-profile card URL (required)  | —                            |
| `label`    | Text shown in the title bar                       | `kael@linux: ~/profile`     |
| `bg`       | Card background color (hex)                       | `#11121a`                   |
| `titlebar` | Title bar background color (hex)                  | `#1c1d29`                   |
| `border`   | Border/divider color (hex)                        | `#2f3040`                   |

### Example

Given your existing card URL:

```
https://neofetch-profile.vercel.app/api?username=mejares-jamesmichael&theme=github-dark&config=https%3A%2F%2Fraw.githubusercontent.com%2Fmejares-jamesmichael%2Fmejares-jamesmichael%2Fmain%2Fneofetch.json
```

URL-encode that whole thing and pass it as `url`:

```
https://YOUR-DEPLOYMENT.vercel.app/api/frame?url=https%3A%2F%2Fneofetch-profile.vercel.app%2Fapi%3Fusername%3Dmejares-jamesmichael%26theme%3Dgithub-dark%26config%3Dhttps%253A%252F%252Fraw.githubusercontent.com%252Fmejares-jamesmichael%252Fmejares-jamesmichael%252Fmain%252Fneofetch.json&label=kael%40linux%3A%20~%2Fprofile
```

Note the config URL inside gets **double-encoded** (its own `%3A%2F%2F`
becomes `%253A%252F%252F`) since it's now a query param nested inside
another query param.

## README integration

Replace your existing `<picture>` block's `src`/`srcset` with the wrapped
URLs (one for dark, one for light — same pattern as before):

```html
<div align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://YOUR-DEPLOYMENT.vercel.app/api/frame?url=<encoded dark card url>&v=1" />
  <img src="https://YOUR-DEPLOYMENT.vercel.app/api/frame?url=<encoded light card url>&v=1" alt="Neofetch profile card" />
</picture>
</div>
```

Keep using the `&v=` cache-busting trick from before — bump it whenever you
update `neofetch.json` and want to see the change immediately, since this
wrapper caches for 4 hours just like the upstream card.

## How it works

1. Request comes in with a `url` param pointing at your neofetch-profile card.
2. The function fetches that URL server-side.
3. It parses the source SVG's `width`/`height` and strips its outer `<svg>` tag.
4. It builds a new outer SVG (title bar + dots + border) and nests the
   original card's content inside it at an offset, so nothing in the
   original card is modified.
5. Returns the combined SVG with a 4-hour cache header.

No dependencies, no API keys, no build step — just Node's built-in `fetch`.
