// Inline SVG assets for the Orbit test site.
//
// Rules that keep the Figma side comparable (see README, "How the frames are built"):
//  - every shape is a flat child of <svg> (no <g>, no transforms, no <text>, no opacity, no gradients);
//  - colours are explicit hex values (no currentColor);
//  - the visible geometry covers the whole viewBox, so the imported and flattened Figma vector
//    has exactly the same box as the <svg> element on the page.

const svg = (w, h, body, extra = '') =>
	`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none"${extra}>${body}</svg>`;

export const logoMark = svg(28, 28,
	'<rect width="28" height="28" rx="8" fill="#4F46E5"/>' +
	'<circle cx="14" cy="14" r="6" stroke="#FFFFFF" stroke-width="2.5"/>' +
	'<circle cx="21" cy="7.5" r="2.5" fill="#A5B4FC"/>');

export const hamburger = svg(24, 18,
	'<rect width="24" height="2" rx="1" fill="#101828"/>' +
	'<rect y="8" width="24" height="2" rx="1" fill="#101828"/>' +
	'<rect y="16" width="24" height="2" rx="1" fill="#101828"/>');

const tile = '<rect width="48" height="48" rx="12" fill="#EEF2FF"/>';
const stroke = 'stroke="#4F46E5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

export const featureIcons = [
	// Comment in context: a speech bubble with a pin dot.
	svg(48, 48, tile +
		`<path d="M15 18a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v7a4 4 0 0 1-4 4h-6l-5 4v-4a3 3 0 0 1-3-3z" ${stroke}/>` +
		'<circle cx="24" cy="21.5" r="2" fill="#4F46E5"/>'),
	// Approve with confidence: a shield with a check.
	svg(48, 48, tile +
		`<path d="M24 13l9 3.5v6.5c0 5.8-3.8 10-9 12-5.2-2-9-6.2-9-12v-6.5z" ${stroke}/>` +
		`<path d="M20 24l3 3 5.5-6" ${stroke}/>`),
	// Connect your stack: two linked blocks.
	svg(48, 48, tile +
		`<rect x="13" y="13" width="10" height="10" rx="3" ${stroke}/>` +
		`<rect x="25" y="25" width="10" height="10" rx="3" ${stroke}/>` +
		`<path d="M23 18h3a4 4 0 0 1 4 4v3" ${stroke}/>`),
];

export const avatar = svg(48, 48,
	'<circle cx="24" cy="24" r="24" fill="#C7D2FE"/>' +
	'<circle cx="24" cy="19" r="8" fill="#4F46E5"/>' +
	'<path d="M10 40c2.6-6.4 8-10 14-10s11.4 3.6 14 10c-3.8 4.4-8.6 6.8-14 6.8S13.8 44.4 10 40z" fill="#4F46E5"/>');

export const check = svg(20, 20,
	'<circle cx="10" cy="10" r="10" fill="#EEF2FF"/>' +
	'<path d="M6 10.4l2.6 2.6L14 7.6" stroke="#4F46E5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>');

// The hero illustration: a stylised review window with comment pins and a comment list.
// preserveAspectRatio="none" so a wrong-sized box renders visibly squashed (seeded bug m).
export const heroArt = svg(480, 320,
	'<rect width="480" height="320" rx="20" fill="#EEF2FF"/>' +
	'<rect x="28" y="28" width="424" height="264" rx="12" fill="#FFFFFF"/>' +
	'<rect x="28" y="28" width="424" height="40" rx="12" fill="#F3F4F6"/>' +
	'<rect x="28" y="56" width="424" height="12" fill="#F3F4F6"/>' +
	'<circle cx="50" cy="48" r="5" fill="#F87171"/>' +
	'<circle cx="66" cy="48" r="5" fill="#FBBF24"/>' +
	'<circle cx="82" cy="48" r="5" fill="#34D399"/>' +
	'<rect x="148" y="41" width="184" height="14" rx="7" fill="#FFFFFF"/>' +
	'<rect x="48" y="88" width="244" height="184" rx="10" fill="#F9FAFB"/>' +
	'<rect x="64" y="104" width="120" height="12" rx="6" fill="#C7D2FE"/>' +
	'<rect x="64" y="126" width="196" height="8" rx="4" fill="#E5E7EB"/>' +
	'<rect x="64" y="142" width="164" height="8" rx="4" fill="#E5E7EB"/>' +
	'<rect x="64" y="162" width="212" height="94" rx="8" fill="#E0E7FF"/>' +
	'<rect x="80" y="178" width="72" height="8" rx="4" fill="#C7D2FE"/>' +
	'<rect x="80" y="194" width="120" height="6" rx="3" fill="#FFFFFF"/>' +
	'<circle cx="258" cy="112" r="12" fill="#4F46E5"/>' +
	'<circle cx="258" cy="112" r="4" fill="#FFFFFF"/>' +
	'<circle cx="236" cy="226" r="12" fill="#F59E0B"/>' +
	'<circle cx="236" cy="226" r="4" fill="#FFFFFF"/>' +
	'<rect x="308" y="88" width="124" height="184" rx="10" fill="#F9FAFB"/>' +
	'<rect x="318" y="100" width="104" height="48" rx="8" fill="#FFFFFF"/>' +
	'<circle cx="332" cy="114" r="6" fill="#4F46E5"/>' +
	'<rect x="344" y="110" width="64" height="8" rx="4" fill="#C7D2FE"/>' +
	'<rect x="328" y="130" width="84" height="6" rx="3" fill="#E5E7EB"/>' +
	'<rect x="318" y="156" width="104" height="48" rx="8" fill="#FFFFFF"/>' +
	'<circle cx="332" cy="170" r="6" fill="#F59E0B"/>' +
	'<rect x="344" y="166" width="56" height="8" rx="4" fill="#FDE68A"/>' +
	'<rect x="328" y="186" width="76" height="6" rx="3" fill="#E5E7EB"/>' +
	'<rect x="318" y="212" width="104" height="48" rx="8" fill="#FFFFFF"/>' +
	'<circle cx="332" cy="226" r="6" fill="#10B981"/>' +
	'<rect x="344" y="222" width="60" height="8" rx="4" fill="#A7F3D0"/>' +
	'<rect x="328" y="242" width="80" height="6" rx="3" fill="#E5E7EB"/>',
	' preserveAspectRatio="none"');

/** Adds attributes (class, data-figma-name, aria-hidden) to an SVG string's root element. */
export function withAttrs(svgString, attrs) {
	const rendered = Object.entries(attrs)
		.filter(([, value]) => value !== undefined && value !== null && value !== false)
		.map(([key, value]) => (value === true ? ` ${key}` : ` ${key}="${String(value).replace(/"/g, '&quot;')}"`))
		.join('');
	return svgString.replace('<svg ', `<svg${rendered} `);
}
