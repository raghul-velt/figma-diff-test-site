// Page templates. One function per page; each takes the variant's options and returns a full HTML
// document. `bugs` is a Set of seeded bug ids (empty for the clean variant).
//
// `data-figma-name` names the Figma layer built from an element (it is what a finding's
// `designName` will say). `data-figma-autolayout` marks a container that becomes a real Figma
// auto-layout frame. Neither attribute changes how the page renders.

import { avatar, check, featureIcons, hamburger, heroArt, logoMark, withAttrs } from './icons.mjs';
import { FAQ, FEATURES, PLANS, STATUS_TEXT } from './content.mjs';
import { bugStyles } from './bugs.mjs';

const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Playfair+Display:ital,wght@0,400;1,400&display=swap';

const esc = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function documentShell({ title, description, bodyClass, bugs, body, variant }) {
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="noindex">
<meta name="orbit-variant" content="${variant}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS_HREF}">
<link rel="stylesheet" href="/styles.css">
${bugStyles([...bugs])}
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
<div class="page">
${body}
</div>
<script>
// Scroll reveal: sections marked .reveal fade in once they enter the viewport, and stay revealed.
(function () {
	var targets = document.querySelectorAll('.reveal');
	if (!('IntersectionObserver' in window)) { targets.forEach(function (el) { el.classList.add('is-visible'); }); return; }
	var observer = new IntersectionObserver(function (entries) {
		entries.forEach(function (entry) {
			if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
		});
	}, { threshold: 0.15 });
	targets.forEach(function (el) { observer.observe(el); });
})();
</script>
</body>
</html>
`;
}

function header({ bugs, links }) {
	const menuIcon = bugs.has('r') ? '' : withAttrs(hamburger, { 'data-figma-name': 'Menu icon', 'aria-hidden': 'true' });
	return `<header class="site-header" data-figma-name="Nav bar">
	<div class="container nav">
		<a class="logo" href="${links.home}" data-figma-name="Logo">${withAttrs(logoMark, { class: 'logo-mark', 'data-figma-name': 'Logo mark', 'aria-hidden': 'true' })}<span class="logo-word" data-figma-name="Logo wordmark">Orbit</span></a>
		<nav class="nav-links" aria-label="Main" data-figma-autolayout="horizontal" data-figma-name="Nav links">
			<a href="${links.home}#product" data-figma-name="Nav link Product">Product</a>
			<a href="${links.home}#solutions" data-figma-name="Nav link Solutions">Solutions</a>
			<a href="${links.pricing}" data-figma-name="Nav link Pricing">Pricing</a>
			<a href="${links.home}#customers" data-figma-name="Nav link Customers">Customers</a>
		</nav>
		<div class="nav-actions">
			<a class="btn btn-ghost" href="#sign-in" data-figma-name="Sign in button"><span data-figma-name="Sign in label">Sign in</span></a>
			<a class="btn btn-primary btn-sm" href="#get-started" data-figma-name="Get started button"><span data-figma-name="Get started label">Get started</span></a>
		</div>
		<button class="menu-btn" type="button" aria-label="Open menu" data-figma-name="Menu button">${menuIcon}</button>
	</div>
</header>`;
}

function footer({ links }) {
	return `<footer class="site-footer" data-figma-name="Footer">
	<div class="container">
		<div class="footer-top">
			<a class="logo" href="${links.home}" data-figma-name="Footer logo">${withAttrs(logoMark, { class: 'logo-mark', 'data-figma-name': 'Footer logo mark', 'aria-hidden': 'true' })}<span class="logo-word" data-figma-name="Footer wordmark">Orbit</span></a>
			<nav class="footer-links" aria-label="Footer" data-figma-autolayout="horizontal" data-figma-name="Footer links">
				<a href="${links.home}#product" data-figma-name="Footer link Product">Product</a>
				<a href="${links.pricing}" data-figma-name="Footer link Pricing">Pricing</a>
				<a href="#changelog" data-figma-name="Footer link Changelog">Changelog</a>
				<a href="#privacy" data-figma-name="Footer link Privacy">Privacy</a>
			</nav>
		</div>
		<div class="footer-bottom">
			<p class="copyright" data-figma-name="Copyright">© 2026 Orbit Labs, Inc. All rights reserved.</p>
			<p class="status" data-figma-name="Status"><span class="status-dot" data-figma-name="Status dot"></span><span class="status-text" data-figma-name="Status text">${STATUS_TEXT}</span></p>
		</div>
	</div>
</footer>`;
}

function featureCard(feature, { bugs }) {
	const iconMissing = feature.n === 1 && bugs.has('l');
	const icon = iconMissing
		// Seeded bug l: the icon failed to render; its slot keeps its size, so nothing else moves.
		? '<span class="feature-icon" aria-hidden="true"></span>'
		: withAttrs(featureIcons[feature.n - 1], { class: 'feature-icon', 'data-figma-name': `Feature ${feature.n} icon`, 'aria-hidden': 'true' });
	return `<article class="feature-card" data-figma-name="Feature card ${feature.n}">
					${icon}
					<h3 data-figma-name="Feature ${feature.n} title">${feature.title}</h3>
					<p data-figma-name="Feature ${feature.n} text">${feature.text}</p>
				</article>`;
}

function homeBody({ bugs, mobile, links }) {
	const features = bugs.has('j') ? [FEATURES[0], FEATURES[2], FEATURES[1]] : FEATURES;
	const stack = mobile ? 'vertical' : 'horizontal';
	return `${bugs.has('c') ? '<div class="announcement" data-figma-name="Announcement bar"><p class="announcement-text">New: AI summaries for every project update</p></div>\n' : ''}${header({ bugs, links })}
<main>
	<section class="hero" data-figma-name="Hero">
		<div class="container hero-grid">
			<div class="hero-copy">
				<h1 data-figma-name="Hero title">Design reviews without the wait</h1>
				<p class="hero-subtitle" data-figma-name="Hero subtitle">Start your ${bugs.has('a') ? '14' : '30'}-day free trial and ship reviews faster.</p>
				<div class="cta-row" data-figma-autolayout="${stack}" data-figma-name="Hero CTA row">
					<a class="btn btn-primary btn-lg" href="#start-trial" data-figma-name="Start free trial button"><span data-figma-name="Start free trial label">${bugs.has('q') ? 'Start trial' : 'Start free trial'}</span></a>
					<a class="btn btn-secondary btn-lg" href="#demo" data-figma-name="Book a demo button"><span data-figma-name="Book a demo label">Book a demo</span></a>
				</div>
				${bugs.has('b') ? '' : '<p class="trust" data-figma-name="Trust line">No credit card required.</p>'}
			</div>
			<div class="hero-art">${withAttrs(heroArt, { 'data-figma-name': 'Hero illustration', role: 'img', 'aria-label': 'Orbit review workspace with comment pins' })}</div>
		</div>
	</section>
	<section class="features" id="product" data-figma-name="Features section">
		<div class="container">
			<div class="section-head">
				<p class="eyebrow" data-figma-name="Features eyebrow">Why teams switch</p>
				<h2 data-figma-name="Features title">Everything your team needs to review and ship</h2>
				<p class="section-intro" data-figma-name="Features intro">Orbit keeps feedback, approvals and release notes in one place, so nothing gets lost between design and code.</p>
			</div>
			<div class="feature-grid" data-figma-autolayout="${stack}" data-figma-name="Features row">
				${features.map((feature) => featureCard(feature, { bugs })).join('\n\t\t\t\t')}
			</div>
		</div>
	</section>
	<section class="testimonial reveal" id="customers" data-figma-name="Testimonial section">
		<div class="container">
			<figure class="quote-wrap">
				<blockquote class="quote" data-figma-name="Testimonial quote">“Orbit replaced three tools and a weekly review meeting. Our designers finally see feedback where it happens.”</blockquote>
				<figcaption class="attribution">
					${withAttrs(avatar, { class: 'avatar', 'data-figma-name': 'Customer avatar', 'aria-hidden': 'true' })}
					<div class="person">
						<p class="person-name" data-figma-name="Customer name">Maya Chen</p>
						<p class="person-role" data-figma-name="Customer role">Head of Design, Lumen Health</p>
					</div>
				</figcaption>
			</figure>
			<p class="story-link" data-figma-name="Story link">Read the full story on our <a href="#blog">blog</a>.</p>
		</div>
	</section>
	<section class="cta-band" data-figma-name="CTA band">
		<div class="container">
			<h2 data-figma-name="CTA title">Ready for calmer release days?</h2>
			<p data-figma-name="CTA text">Join the product teams that review, approve and ship in one place.</p>
			<div class="cta-actions"><a class="btn btn-light btn-lg" href="#start-trial" data-figma-name="CTA button"><span data-figma-name="CTA button label">Start free trial</span></a></div>
		</div>
	</section>
</main>
${footer({ links })}`;
}

function planCard(plan, { bugs }) {
	const desc = plan.featured && bugs.has('n') ? plan.buggyDesc : plan.desc;
	const badge = plan.featured
		? `<div class="badge" data-figma-name="Most popular badge"><span data-figma-name="Most popular label">Most popular</span></div>\n\t\t\t\t`
		: '';
	const items = plan.features.map((text, index) => `<li>${withAttrs(check, { 'data-figma-name': `${plan.name} check ${index + 1}`, 'aria-hidden': 'true' })}<span data-figma-name="${plan.name} feature ${index + 1}">${text}</span></li>`).join('\n\t\t\t\t\t');
	return `<article class="plan-card${plan.featured ? ' plan-card--featured' : ''}" data-testid="plan-card" data-figma-name="${plan.name} plan card">
				${badge}<h3 class="plan-name" data-testid="plan-name" data-figma-name="${plan.name} plan name">${plan.name}</h3>
				<p class="plan-desc" data-figma-name="${plan.name} plan description">${desc}</p>
				<p class="plan-price" data-figma-name="${plan.name} plan price"><span class="amount">${plan.price}</span><span class="per">/month</span></p>
				<a class="btn ${plan.featured ? 'btn-primary' : 'btn-secondary'} btn-md btn-block" href="#start" data-figma-name="${plan.name} plan button"><span data-figma-name="${plan.name} plan button label">${plan.cta}</span></a>
				<ul class="plan-features" data-figma-name="${plan.name} plan features">
					${items}
				</ul>
			</article>`;
}

function pricingBody({ bugs, links }) {
	return `${header({ bugs, links })}
<main>
	<section class="pricing-hero" data-figma-name="Pricing header">
		<div class="container">
			<h1 data-figma-name="Pricing title">Simple pricing for every team</h1>
			<p class="pricing-subtitle" data-figma-name="Pricing subtitle">Start free, then upgrade when your team is ready. Every paid plan includes a 30-day trial.</p>
		</div>
	</section>
	<section class="plans" data-figma-name="Plans section">
		<div class="container plan-grid" data-figma-autolayout="horizontal" data-figma-name="Plans row">
			${PLANS.map((plan) => planCard(plan, { bugs })).join('\n\t\t\t')}
		</div>
	</section>
	<section class="faq" data-figma-name="FAQ section">
		<div class="container">
			<h2 data-figma-name="FAQ title">Frequently asked questions</h2>
			<div class="faq-list" data-figma-autolayout="vertical" data-figma-name="FAQ list">
				${FAQ.map((item, index) => `<div class="faq-item" data-figma-name="FAQ item ${index + 1}">
					<h3 class="faq-q" data-figma-name="FAQ question ${index + 1}">${item.q}</h3>
					<p class="faq-a" data-figma-name="FAQ answer ${index + 1}">${item.a}</p>
				</div>`).join('\n\t\t\t\t')}
			</div>
		</div>
	</section>
</main>
${footer({ links })}`;
}

/**
 * Renders one page.
 *
 * @param {'home'|'pricing'|'mobile'} page
 * @param {{ bugs: Set<string>, links: { home: string, pricing: string }, variant: 'clean'|'buggy' }} options
 */
export function renderPage(page, { bugs, links, variant }) {
	switch (page) {
		case 'home':
			return documentShell({
				title: 'Orbit | Design reviews without the wait', description: 'Orbit collects feedback, approvals and release notes in one place.',
				bodyClass: '', bugs, variant, body: homeBody({ bugs, mobile: false, links }),
			});
		case 'mobile':
			return documentShell({
				title: 'Orbit | Design reviews without the wait', description: 'Orbit collects feedback, approvals and release notes in one place.',
				bodyClass: 'layout-mobile', bugs, variant, body: homeBody({ bugs, mobile: true, links }),
			});
		case 'pricing':
			return documentShell({
				title: 'Orbit | Pricing', description: 'Simple pricing for every team.',
				bodyClass: '', bugs, variant, body: pricingBody({ bugs, links }),
			});
		default:
			throw new Error(`Unknown page ${page}`);
	}
}
