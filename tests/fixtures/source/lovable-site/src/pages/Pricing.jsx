import * as Tabs from '@radix-ui/react-tabs';
import { Check } from 'lucide-react';

const plans = {
	monthly: [ [ 'Starter', '$49', 'For a simple site' ], [ 'Growth', '$99', 'For growing teams' ], [ 'Scale', '$199', 'For busy sites' ] ],
	yearly: [ [ 'Starter', '$490', 'Two months free' ], [ 'Growth', '$990', 'Two months free' ], [ 'Scale', '$1,990', 'Two months free' ] ],
};

function Plans( { list } ) {
	return (
		<div className="grid-3">
			{ list.map( ( [ name, price, note ] ) => (
				<div key={ name } className="card">
					<h3>{ name }</h3>
					<p className="price">{ price }</p>
					<p className="muted">{ note }</p>
					<ul className="plan-list">
						<li><Check className="icon-sm ok" /> Hosting and updates</li>
						<li><Check className="icon-sm ok" /> Monthly report</li>
					</ul>
				</div>
			) ) }
		</div>
	);
}

export function PricingTabs() {
	return (
		<Tabs.Root defaultValue="monthly" className="tabs">
						<Tabs.List className="tabs-list" aria-label="Billing period">
							<Tabs.Trigger value="monthly" className="tabs-trigger">Monthly</Tabs.Trigger>
							<Tabs.Trigger value="yearly" className="tabs-trigger">Yearly</Tabs.Trigger>
						</Tabs.List>
						<Tabs.Content value="monthly" className="tabs-content"><Plans list={ plans.monthly } /></Tabs.Content>
						<Tabs.Content value="yearly" className="tabs-content"><Plans list={ plans.yearly } /></Tabs.Content>
		</Tabs.Root>
	);
}

export default function Pricing() {
	return (
		<main>
			<section className="section">
				<div className="container">
					<h1 className="center">Simple pricing</h1>
					<p className="lead center">No setup fees. Cancel any time.</p>
					<PricingTabs />
				</div>
			</section>
		</main>
	);
}
