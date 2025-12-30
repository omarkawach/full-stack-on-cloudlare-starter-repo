// Will use browser rendering to render destination and with Vercel AI SDK and R2
// Browser rendering for interacting with headless browser instances

// This worker entry point is important for the logic of the workflow
import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import { collectDestinationInfo } from '@/helpers/browser-render';
import { aiDestinationChecker } from '@/helpers/ai-destination-checker';
import { addEvaluation } from '@repo/data-ops/queries/evaluations';
import { initDatabase } from '@repo/data-ops/database';
import { v4 as uuidv4 } from 'uuid';

export class DestinationEvaluationWorkflow extends WorkflowEntrypoint<Env, DestinationStatusEvaluationParams> {
	async run(event: Readonly<WorkflowEvent<DestinationStatusEvaluationParams>>, step: WorkflowStep) {
		initDatabase(this.env.DB);
		// Will be passed to AI use case, ensure healthy website
		// Max size 1MB by default for response that can be saved
		// Should be plenty for HTML page, but you can exceed it if you do screenshot or something

		// const collectedData = await step.do('Collect rendered destination page data', async () => {
		// 	return collectDestinationInfo(this.env, event.payload.destinationUrl);
		// });
		// console.log(collectedData);

		// Solves max size 1MB error when grabbing a screenshot
		// Less things to return as a single step instead of separate
		const evaluationInfo = await step.do(
			'Collect rendered destination page data',
			{
				retries: {
					limit: 1,
					delay: 1000,
				},
			},
			async () => {
				const evaluationId = uuidv4();
				const data = await collectDestinationInfo(this.env, event.payload.destinationUrl);
				const accountId = event.payload.accountId;
				const r2PathHtml = `evaluations/${accountId}/html/${evaluationId}`;
				const r2PathBodyText = `evaluations/${accountId}/body-text/${evaluationId}`;

				await this.env.BUCKET.put(r2PathHtml, data.html);
				await this.env.BUCKET.put(r2PathBodyText, data.bodyText);
				return {
					bodyText: data.bodyText,
					evaluationId: evaluationId,
				};
			}
		);

		// New step, should save results into D1 database
		const aiStatus = await step.do(
			'Use AI to check status of page',
			{
				// Limit to 0 to avoid costs in case of failure
				// Best to keep 1 or 0 to control spending
				retries: {
					limit: 0,
					delay: 0,
				},
			},
			async () => {
				return await aiDestinationChecker(this.env, evaluationInfo.bodyText);
			}
		);

		// Save results to database, evaluationId will help with stuffing into R2 since its a large file
		// We don't want to bloat our db with textual data (collectedData)
		const evaluationId = await step.do('Save evaluation in database', async () => {
			return await addEvaluation({
				linkId: event.payload.linkId,
				status: aiStatus.status,
				reason: aiStatus.statusReason,
				accountId: event.payload.accountId,
				destinationUrl: event.payload.destinationUrl,
			});
		});

		// Store everything based on accountId which comes from payload
		// evaluationId for retrieving data
		// await step.do('Backup destination HTML in R2', async () => {
		// 	const accountId = event.payload.accountId;
		// 	// Path in bucket where the files will live
		// 	const r2PathHtml = `evaluations/${accountId}/html/${evaluationId}`;
		// 	const r2PathBodyText = `evaluations/${accountId}/body-text/${evaluationId}`;
		// 	// const r2PathScreenshot = `evaluations/${accountId}/screenshots/${evaluationId}`;

		// 	// const screenshotBase64 = collectedData.screenshotDataUrl.replace(/^data:image\/png;base64,/, '');
		// 	// const screenshotBuffer = Buffer.from(screenshotBase64, 'base64');

		// 	await this.env.BUCKET.put(r2PathHtml, collectedData.html);
		// 	await this.env.BUCKET.put(r2PathBodyText, collectedData.bodyText);
		// 	// await this.env.BUCKET.put(r2PathScreenshot, screenshotBuffer)
		// });
	}
}
