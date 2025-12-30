import { WorkerEntrypoint } from 'cloudflare:workers';
import { App } from './hono/app';
import { initDatabase } from '@repo/data-ops/database';
import { QueueMessageSchema } from '@repo/data-ops/zod-schema/queue';
import { handleLinkClick } from './queue-handlers/link-clicks';

export { DestinationEvaluationWorkflow } from '@/workflows/destination-evaluation-workflow';

export { EvaluationScheduler} from "@/durable-objects/evaluation-scheduler";
export { LinkClickTracker } from "@/durable-objects/link-click-tracker";

// Entry point to data service / worker
// Class based approach is cleaner than worker/index.ts
// Gives you access to constructor instead of exporting each function
export default class DataService extends WorkerEntrypoint<Env> {
	// Execute whenever worker is triggered
	constructor(ctx: ExecutionContext, env: Env) {
		super(ctx, env);
		// This constructor is called when the specific workflow is spun up for the first time and runs code based on trigger
		initDatabase(env.DB);
		// However this constructor wont be called when our other workflows are triggered
		// So initDatabase in destination-evaluation-workflow as well
	}
	// A trigger which can invoke worker runtime
	fetch(request: Request) {
		// We'll have a few routes that users can hit that can handle some logic
		// return new Response('Hello World!');
		return App.fetch(request, this.env, this.ctx);
	}
	// Another trigger
	// Batch events which have messages of data to be processed (consumer)
	// Consumers are flexible
	async queue(batch: MessageBatch<unknown>): Promise<void> {
		for (const message of batch.messages) {
			// console.log('Queue event:', message.body);

			// parse data but wont error if it fails
			const parsedEvent = QueueMessageSchema.safeParse(message.body);
			if (parsedEvent.success) {
				const event = parsedEvent.data;
				if (event.type === 'LINK_CLICK') {
					await handleLinkClick(this.env, event);
					// throw new Error("to dead letter queue")
				}
			} else {
				// If it doesn't conform to our expected type
				console.error(parsedEvent.error);
			}
		}
	}
	// Handler ensures data coming into queue is of a certain type

	scheduled(controller: ScheduledController): void | Promise<void> {}
}
