// Copy for the Orbit test pages. Orbit is a fictional product.
//
// Dynamic strings (times, prices) deliberately differ between the page and the Figma frames:
// `designText` is what the frame shows. The agent must NOT report these (it ignores clock times and
// standalone prices), so they are traps, not seeded differences.

export const FEATURES = [
	{ n: 1, title: 'Comment in context', text: 'Pin feedback to live pages, design files and staging builds in one click.' },
	{ n: 2, title: 'Approve with confidence', text: 'Route every change to the right reviewers and see who signed off.' },
	{ n: 3, title: 'Connect your stack', text: 'Send decisions to your issue tracker and team chat without copying links.' },
];

export const PLANS = [
	{
		name: 'Starter', desc: 'For individuals and side projects', price: '$0', cta: 'Start free',
		features: ['3 active projects', 'Unlimited reviewers', 'Comments on live pages', '7-day history', 'Community support'],
	},
	{
		name: 'Pro', featured: true, desc: 'Best for growing teams', buggyDesc: 'Best for small teams',
		price: '$29', designPrice: '$24', cta: 'Start free trial',
		features: ['Unlimited projects', 'Approval workflows', 'Design file and staging reviews', '1-year history', 'Priority support'],
	},
	{
		name: 'Enterprise', desc: 'Advanced controls for large organizations', price: '$79', cta: 'Contact sales',
		features: ['Everything in Pro', 'SSO and SCIM', 'Audit log export', 'Unlimited history', 'Dedicated success manager'],
	},
];

export const FAQ = [
	{ q: 'Can I change plans later?', a: 'Yes. Upgrade or downgrade at any time and we will prorate the difference on your next invoice.' },
	{ q: 'Is there a free trial?', a: 'Every paid plan starts with a 30-day trial. See our <a href="#billing">billing guide</a> for details.' },
	{ q: 'Do you offer discounts for nonprofits?', a: 'Yes. Nonprofits and schools get 50% off any paid plan.' },
];

/** Page text on the left, what the Figma frame shows on the right. Applied when the frames are built. */
export const DESIGN_TEXT_OVERRIDES = {
	'Status updated 10:42 AM': 'Status updated 9:15 AM',
	'$29/month': '$24/month',
};

export const STATUS_TEXT = 'Status updated 10:42 AM';
