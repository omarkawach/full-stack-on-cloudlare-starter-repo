// Will use browser rendering to render destination and with Vercel AI SDK and R2
// Browser rendering for interacting with headless browser instances

// This worker entry point is important for the logic of the workflow
import { collectDestinationInfo } from '@/helpers/browser-render';
import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';

export class DestinationEvaluationWorkflow extends WorkflowEntrypoint<Env, DestinationStatusEvaluationParams> {
	async run(event: Readonly<WorkflowEvent<DestinationStatusEvaluationParams>>, step: WorkflowStep) {
		// Will be passed to AI use case, ensure healthy website
		const collectedData = await step.do('Collect rendered destination page data', async () => {
			return collectDestinationInfo(this.env, event.payload.destinationUrl)
		});
		console.log(collectedData);
	}
}
