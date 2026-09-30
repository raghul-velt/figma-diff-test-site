// The seeded differences. The BUGGY variant of a page is its CLEAN variant plus exactly these.
//
// Markup bugs are applied by the templates (they check `bugs.has(id)`); style bugs are the CSS rules
// below, emitted into a <style id="seeded-bugs"> block that only the buggy pages carry. Nothing else
// differs between the two variants, which `npm run build` asserts by diffing them.

export const BUGS = {
	// Home, desktop (/)
	a: { page: 'home', summary: 'Hero subtitle says "14-day" instead of "30-day"' },
	b: { page: 'home', summary: 'Trust line "No credit card required." removed' },
	c: { page: 'home', summary: 'Extra announcement bar "New: AI summaries for every project update" above the nav' },
	d: { page: 'home', summary: 'Hero title font size 48px instead of 56px (line height unchanged)', css: '.hero h1{font-size:48px}' },
	e: { page: 'home', summary: 'Feature card titles weight 400 instead of 600', css: '.feature-card h3{font-weight:400}' },
	f: { page: 'home', summary: 'Testimonial quote set in Inter instead of Playfair Display', css: '.quote{font-family:"Inter",system-ui,sans-serif}' },
	g: { page: 'home', summary: 'Nav "Get started" button background #7C3AED instead of #4F46E5', css: '.nav .btn-primary{background:#7C3AED}' },
	h: { page: 'home', summary: 'Features eyebrow colour #6B7280 instead of #4F46E5', css: '.features .eyebrow{color:#6B7280}' },
	i: { page: 'home', summary: 'Hero CTA row shifted 64px to the right', css: '.hero .cta-row{margin-left:64px}' },
	j: { page: 'home', summary: 'Feature cards 2 and 3 swapped' },
	k: { page: 'home', summary: 'Feature card gap 64px instead of 24px', css: '.feature-grid{gap:64px}' },
	l: { page: 'home', summary: 'First feature card icon missing (empty slot)' },
	m: { page: 'home', summary: 'Hero illustration rendered 480x240 instead of 480x320', css: '.hero-art svg{height:240px}' },
	// Pricing, desktop (/pricing)
	n: { page: 'pricing', summary: 'Pro plan description "Best for small teams" instead of "Best for growing teams"' },
	o: { page: 'pricing', summary: 'Plan names 24px instead of 20px (line height unchanged)', css: '[data-testid="plan-name"]{font-size:24px}' },
	p: { page: 'pricing', summary: 'Highlighted plan background #FFFFFF instead of #EEF2FF', css: '.plan-card--featured{background:#FFFFFF}' },
	// Home, mobile (/m)
	q: { page: 'mobile', summary: 'Mobile hero CTA "Start trial" instead of "Start free trial"' },
	r: { page: 'mobile', summary: 'Hamburger menu icon missing (empty button)' },
};

/** The ids seeded on one page, in order. */
export function bugsFor(page) {
	return Object.entries(BUGS).filter(([, bug]) => bug.page === page).map(([id]) => id);
}

/** The <style> block carrying one page's style bugs, one commented rule per bug. */
export function bugStyles(ids) {
	const rules = ids
		.filter((id) => BUGS[id].css)
		.map((id) => `/* seeded bug ${id}: ${BUGS[id].summary} */\n${BUGS[id].css}`);
	return rules.length ? `<style id="seeded-bugs">\n${rules.join('\n')}\n</style>` : '';
}
