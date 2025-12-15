import { getLink } from '@repo/data-ops/queries/links';
import { Hono } from 'hono';
import { cloudflareInfoSchema } from '@repo/data-ops/zod-schema/links';
import { getDestinationForCountry, getRoutingDestinations } from '@/helpers/route-ops';
import { LinkClickMessageType } from '@repo/data-ops/zod-schema/queue';

// We need it exported to use it in our worker entry point
export const App = new Hono<{ Bindings: Env }>();

// First route, handle requests
// Dynamic path where the ID of a given link will be routed to
// Useful for getting all routing information
// Should happen as fast as possible, by sending things to queue
App.get('/:id', async (c) => {
	// C is for context
	// Could set cookies with response
	// console.log(JSON.stringify(c.req.raw.cf));
	// const cf = c.req.raw.cf;
	// const country = cf?.country;
	// const lat = cf?.latitude;
	// const long = cf?.longitude;
	// return c.json({
	// 	country,
	// 	lat,
	// 	long,
	// });
	const id = c.req.param('id');
	// const linkInfo = await getLink(id);
	const linkInfo = await getRoutingDestinations(c.env, id);
	if (!linkInfo) {
		return c.text('Destination not found', 404);
	}

	// return c.json(linkInfo);

	const cfHeader = cloudflareInfoSchema.safeParse(c.req.raw.cf);
	if (!cfHeader.success) {
		return c.text('Invalid Cloudflare headers', 400);
	}

	const headers = cfHeader.data;
	console.log(headers);
	const destination = getDestinationForCountry(linkInfo, headers.country);

	const queueMsg: LinkClickMessageType = {
		type: 'LINK_CLICK',
		data: {
			id: id,
			country: headers.country,
			destination: destination,
			accountId: linkInfo.accountId,
			latitude: headers.latitude,
			longitude: headers.longitude,
			timestamp: new Date().toISOString(),
		},
	};
	// Don't wanna wait for I/O before redirect
	// Run async task after request fulfilled
	// Not always failsafe, don't do this for transaction data.
	// Keep it for basic analytic things
	c.executionCtx.waitUntil(
		// Send to queue in the background
		// You can also pass in some options like content type
		// This is a producer
		c.env.QUEUE.send(queueMsg, {
			// Might save from parsing
			contentType: "json",
			// Useful for when using Twilio API for sending SMS texts
			// Stick Twilio ID and wait ten minutes to check if msg delivered, failed or sent
			delaySeconds: 10,
		})
	);

	// There is some network latency for the redirect
	// A Cloudflare KV can speed it up by caching the link configuration
	return c.redirect(destination);
});
