import { addLinkClick } from '@repo/data-ops/queries/links';
import { LinkClickMessageType } from '@repo/data-ops/zod-schema/queue';

// Using database method defined from data-ops
// Wrapper around database call but will eventually handle more cascading operations as we build more features
export async function handleLinkClick(env: Env, event: LinkClickMessageType) {
	await addLinkClick(event.data);
}
