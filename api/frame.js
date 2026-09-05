// api/frame.js
//
// Wraps a neofetch-profile card (or any similarly-shaped SVG) in a
// terminal-window frame: traffic-light dots, title bar, rounded border.
//
// Usage:
//   /api/frame?url=<url-encoded neofetch-profile URL>&label=kael@linux:%20~/profile
//
// The upstream SVG is fetched server-side and its markup is inlined directly
// into the response, so the final SVG has zero external references. This is
// what lets it render inside GitHub's sandboxed README CSP, which blocks
// SVGs that try to load external resources.

const TITLE_BAR_HEIGHT = 36;
const BORDER = 2;
const RADIUS = 12;

const DOT_COLORS = ['#ff5f56', '#ffbd2e', '#27c93f'];

export default async function handler(req, res) {
  const { url, label, bg, titlebar, border } = req.query;

  if (!url) {
    res.status(400).send('Missing required "url" query parameter (the neofetch-profile card URL to frame).');
    return;
  }

  let sourceUrl;
  try {
    sourceUrl = decodeURIComponent(url);
  } catch {
    sourceUrl = url;
  }

  // Safety: only allow https URLs from neofetch-profile.vercel.app
  let parsedUrl;
  try {
    parsedUrl = new URL(sourceUrl);
  } catch {
    res.status(400).send('Invalid "url" parameter.');
    return;
  }
  if (parsedUrl.protocol !== 'https:' || parsedUrl.host !== 'neofetch-profile.vercel.app') {
    res.status(400).send('Invalid "url" parameter — only https://neofetch-profile.vercel.app/* is allowed.');
    return;
  }

  try {
    const upstream = await fetch(sourceUrl);
    if (!upstream.ok) {
      res.status(502).send(`Failed to fetch source card: HTTP ${upstream.status}`);
      return;
    }

    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.includes('svg') && !contentType.includes('xml')) {
      res.status(502).send(`Source URL did not return an SVG (got content-type: ${contentType || 'unknown'})`);
      return;
    }

    const svgText = await upstream.text();
    const framed = buildFramedSvg(svgText, {
      label: label || 'kael@linux: ~/profile',
      bgColor: bg || '#11121a',
      titleBarColor: titlebar || '#1c1d29',
      borderColor: border || '#2f3040',
    });

    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    // Cache slightly longer than the upstream card's own 4h cache so we're
    // never serving a frame around a card that's about to change anyway.
    res.setHeader('Cache-Control', 'public, max-age=14400, s-maxage=14400, stale-while-revalidate=3600');
    res.status(200).send(framed);
  } catch (err) {
    res.status(500).send('Error generating framed SVG: ' + (err && err.message ? err.message : String(err)));
  }
}

function buildFramedSvg(svgText, opts) {
  const openTagMatch = svgText.match(/<svg\b[^>]*>/);
  const widthMatch = svgText.match(/width="(\d+)px"/);
  const heightMatch = svgText.match(/height="(\d+)px"/);

  if (!openTagMatch || !widthMatch || !heightMatch) {
    throw new Error('Could not parse width/height from source SVG.');
  }

  const innerWidth = parseInt(widthMatch[1], 10);
  const innerHeight = parseInt(heightMatch[1], 10);

  // Preserve font-family / font-size from the original opening <svg> tag —
  // the card's text elements inherit these rather than setting them per
  // element, and its line-height math is built assuming this exact font
  // size. Losing it when we re-nest the content changes text metrics and
  // throws off vertical spacing.
  const fontFamilyMatch = openTagMatch[0].match(/font-family="([^"]*)"/);
  const fontSizeMatch = openTagMatch[0].match(/font-size="([^"]*)"/);
  const fontFamily = fontFamilyMatch ? fontFamilyMatch[1] : 'Consolas,Monaco,monospace';
  const fontSize = fontSizeMatch ? fontSizeMatch[1] : '16px';

  // Keep everything between the opening <svg ...> tag and the closing
  // </svg> tag (the style block, background rect, and text content),
  // and re-nest it inside our own frame untouched.
  const innerContent = svgText
    .slice(svgText.indexOf(openTagMatch[0]) + openTagMatch[0].length)
    .replace(/<\/svg>\s*$/, '');

  const outerWidth = innerWidth + BORDER * 2;
  const outerHeight = innerHeight + TITLE_BAR_HEIGHT + BORDER * 2;
  const midY = TITLE_BAR_HEIGHT / 2;

  const dots = DOT_COLORS.map((color, i) => {
    const cx = 18 + i * 20;
    return `<circle cx="${cx}" cy="${midY}" r="6" fill="${color}"/>`;
  }).join('\n    ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${outerWidth}px" height="${outerHeight}px" viewBox="0 0 ${outerWidth} ${outerHeight}">
  <defs>
    <clipPath id="frameClip">
      <rect x="0" y="0" width="${outerWidth}" height="${outerHeight}" rx="${RADIUS}" ry="${RADIUS}"/>
    </clipPath>
  </defs>
  <g clip-path="url(#frameClip)">
    <rect x="0" y="0" width="${outerWidth}" height="${outerHeight}" fill="${opts.bgColor}"/>
    <rect x="0" y="0" width="${outerWidth}" height="${TITLE_BAR_HEIGHT}" fill="${opts.titleBarColor}"/>
    <line x1="0" y1="${TITLE_BAR_HEIGHT}" x2="${outerWidth}" y2="${TITLE_BAR_HEIGHT}" stroke="${opts.borderColor}" stroke-width="1"/>
    ${dots}
    <text x="${outerWidth / 2}" y="${midY + 5}" text-anchor="middle" font-family="Consolas,Monaco,monospace" font-size="13" fill="#8c8ea3">${escapeXml(opts.label)}</text>
    <g transform="translate(${BORDER}, ${TITLE_BAR_HEIGHT + BORDER})">
      <svg width="${innerWidth}px" height="${innerHeight}px" font-family="${fontFamily}" font-size="${fontSize}" xmlns="http://www.w3.org/2000/svg">
        ${innerContent}
      </svg>
    </g>
  </g>
  <rect x="0.5" y="0.5" width="${outerWidth - 1}" height="${outerHeight - 1}" rx="${RADIUS}" ry="${RADIUS}" fill="none" stroke="${opts.borderColor}" stroke-width="1"/>
</svg>`;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
