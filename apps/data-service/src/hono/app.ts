// import { getLink } from '@repo/data-ops/queries/links';
import { Hono } from 'hono';
import { cloudflareInfoSchema } from '@repo/data-ops/zod-schema/links';
import { captureLinkClickInBackground, getDestinationForCountry, getRoutingDestinations } from '@/helpers/route-ops';
import { LinkClickMessageType } from '@repo/data-ops/zod-schema/queue';

// We need it exported to use it in our worker entry point
export const App = new Hono<{ Bindings: Env }>();

// Another get route, just for DOs
// App.get('/do/:name', async (c) => {
// 	const name = c.req.param('name');
// 	// Fetch specific instance of DO
// 	const doId = c.env.EVALUATION_SCHEDULAR.idFromName(name);
// 	// Instance of DO
// 	const stub = c.env.EVALUATION_SCHEDULAR.get(doId);
// 	await stub.increment();
// 	const count = await stub.getCount();
// 	return c.json({
// 		count,
// 	});
// });

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
	// // Don't wanna wait for I/O before redirect
	// // Run async task after request fulfilled
	// // Not always failsafe, don't do this for transaction data.
	// // Keep it for basic analytic things
	// c.executionCtx.waitUntil(
	// 	// Send to queue in the background
	// 	// You can also pass in some options like content type
	// 	// This is a producer
	// 	c.env.QUEUE.send(queueMsg, {
	// 		// Might save from parsing
	// 		contentType: 'json',
	// 		// Useful for when using Twilio API for sending SMS texts
	// 		// Stick Twilio ID and wait ten minutes to check if msg delivered, failed or sent
	// 		delaySeconds: 10,
	// 	})
	// );

	c.executionCtx.waitUntil(
		// Send data to queue and also DO
		captureLinkClickInBackground(c.env, queueMsg)
	);

	// There is some network latency for the redirect
	// A Cloudflare KV can speed it up by caching the link configuration
	return c.redirect(destination);
});

// Create another dummy route for demonstration purposes
App.get('/link-click/:accountId', async (c) => {
	const accountId = c.req.param('accountId');
	const doId = c.env.LINK_CLICK_TRACKER_OBJECT.idFromName(accountId);
	const stub = c.env.LINK_CLICK_TRACKER_OBJECT.get(doId);
	// Stub has a fetch handler
	// Stubs are used to invoke methods on remote DO
	return await stub.fetch(c.req.raw);
});

// This is better than the previous dummy route
// Websocket connection
App.get('/click-socket', async (c) => {
	// Ensure client can upgrade HTTP/1.1 or HTTP(s) connection to a WebSocket connection
	const upgradeHeader = c.req.header('Upgrade');
	if (!upgradeHeader || upgradeHeader !== 'websocket') {
		return c.text('Expected Upgrade: websocket', 426);
	}

	// extract account Id from headers for custom authentication
	const accountId = c.req.header('account-id');

	// const accountId = "1234567890";

	if (!accountId) return c.text('No Headers', 404);
	const doId = c.env.LINK_CLICK_TRACKER_OBJECT.idFromName(accountId);
	const stub = c.env.LINK_CLICK_TRACKER_OBJECT.get(doId);
	return await stub.fetch(c.req.raw);
});
