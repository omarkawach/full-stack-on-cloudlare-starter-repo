// Schedule when evaluation workflow should run
import { DurableObject } from 'cloudflare:workers';
import moment from 'moment';

interface ClickData {
	accountId: string;
	linkId: string;
	destinationUrl: string;
	destinationCountryCode: string;
}

// Simple base class with counter logic
export class EvaluationScheduler extends DurableObject<Env> {
	// count: number = 0
	clickData: ClickData | undefined;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		// No other requests going to this durable object while running
		// ctx.blockConcurrencyWhile(async () => {
		// 	// Fetch count from storage
		// 	// Helps recover last known count
		//     this.count = await ctx.storage.get("count") || this.count
		// })
		ctx.blockConcurrencyWhile(async () => {
			this.clickData = await ctx.storage.get<ClickData>('click_data');
		});
	}

	// async increment() {
	//     this.count++
	// 	// Durable Object KV store
	//     await this.ctx.storage.put("count", this.count)
	// }

	// async getCount() {
	//     return this.count
	// }

	async collectLinkClick(accountId: string, linkId: string, destinationUrl: string, destinationCountryCode: string) {
		// Saved in memory
		this.clickData = {
			accountId,
			linkId,
			destinationUrl,
			destinationCountryCode,
		};
		// DO KV store
		await this.ctx.storage.put('click_data', this.clickData);

		const alarm = await this.ctx.storage.getAlarm();
		if (!alarm) {
			// const oneDay = moment().add(24, 'hours').valueOf();
			// Only run for one URL in a 10 second window, even if we get 1000 clicks in under 5 seconds
			const oneDay = moment().add(10, 'seconds').valueOf();
			await this.ctx.storage.setAlarm(oneDay);
		}
	}

	async alarm() {
		console.log('Evaluation scheduler alarm triggered');

		const clickData = this.clickData;

		// This should never happen, probably wanna send these to something like PostHog
		if (!clickData) throw new Error('Click data not set');

		// Grab workflow that checks if webpage is health or not
		// .create() programmatically triggers workflow
		await this.env.DESTINATION_EVALUATION_WORKFLOW.create({
			// Typed because of override in service-bindings.d.ts
			params: {
				linkId: clickData.linkId,
				accountId: clickData.accountId,
				destinationUrl: clickData.destinationUrl,
			},
		});
	}
}
