import { deleteClicksBefore, getRecentClicks } from '@/helpers/durable-queries';
import { DurableObject } from 'cloudflare:workers';
import moment from 'moment';

export class LinkClickTracker extends DurableObject {
	sql: SqlStorage;
	// Add message broadcast logic to send link clicks to client
	// Handle and keep track of offsets
	mostRecentOffsetTime: number = 0;
	leastRecentOffsetTime: number = 0;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		// Save link click data to sorted SQLite table
		this.sql = ctx.storage.sql;

		// Define table at startup within constructor if it does not exist
		// blockConcurrencyWhile prevents errors if something else spins up this DO
		// We can always refactor into using Drizzle ORM
		ctx.blockConcurrencyWhile(async () => {
			// Save to storage
			const [leastRecentOffsetTime, mostRecentOffsetTime] = await Promise.all([
				ctx.storage.get<number>('leastRecentOffsetTime'),
				ctx.storage.get<number>('mostRecentOffsetTime'),
			]);

			this.leastRecentOffsetTime = leastRecentOffsetTime || this.leastRecentOffsetTime;
			this.mostRecentOffsetTime = mostRecentOffsetTime || this.mostRecentOffsetTime;

			this.sql.exec(`
				CREATE TABLE IF NOT EXISTS geo_link_clicks (
					latitude REAL NOT NULL,
					longitude REAL NOT NULL,
					country TEXT NOT NULL,
					time INTEGER NOT NULL
				)
			`);
		});
	}

	async addClick(latitude: number, longitude: number, country: string, time: number) {
		// Take info that we want to add into the DB
		// We can always refactor into using Drizzle ORM
		this.sql.exec(
			// The (?, ?, ?, ?) are valued that will be inserted into the order they're defined
			// Prevents SQL injections
			// These are called bindings
			// Drizzle has docs about how to configure this with DOs, but dynamic table migrations via Drizzle are terrible
			`
			INSERT INTO geo_link_clicks (latitude, longitude, country, time)
			VALUES (?, ?, ?, ?)
			`,
			latitude,
			longitude,
			country,
			time
		);
		// Not sustainable for high volume companies to loop through all clients
		// const sockets = this.ctx.getWebSockets()

		// Look 2 seconds into future instead of scenario where 5000 clicks a second, you would wait and then send those events done at once
		const alarm = await this.ctx.storage.getAlarm();
		if (!alarm) await this.ctx.storage.setAlarm(moment().add(2, 'seconds').valueOf());
	}

	async alarm() {
		console.log('alarm');
		const clickData = getRecentClicks(this.sql, this.mostRecentOffsetTime);

		// Iterate through sockets and send data to each client
		const sockets = this.ctx.getWebSockets();
		for (const socket of sockets) {
			socket.send(JSON.stringify(clickData.clicks));
		}

		await this.flushOffsetTimes(clickData.mostRecentTime, clickData.oldestTime);
		// Delete records we no longer need
		await deleteClicksBefore(this.sql, clickData.oldestTime);
	}

	// Update most recent and least recent times
	async flushOffsetTimes(mostRecentOffsetTime: number, leastRecentOffsetTime: number) {
		this.mostRecentOffsetTime = mostRecentOffsetTime;
		this.leastRecentOffsetTime = leastRecentOffsetTime;
		await this.ctx.storage.put('mostRecentOffsetTime', this.mostRecentOffsetTime);
		await this.ctx.storage.put('leastRecentOffsetTime', this.leastRecentOffsetTime);
	}

	// Defines a query that selects everything limited to 100
	// Executes the query and converts results into an array
	// async fetch(_: Request) {
	// 	const query = `
	// 		SELECT *
	// 		FROM geo_link_clicks
	// 		limit 100
	// 	`;

	// 	const cursor = this.sql.exec(query);
	// 	const results = cursor.toArray();

	// 	return new Response(
	// 		JSON.stringify({
	// 			clicks: results,
	// 		}),
	// 		{
	// 			headers: {
	// 				'Content-Type': 'application/json',
	// 			},
	// 		}
	// 	);
	// }

	// Update the fetch handler to create a socket connection
	async fetch(_: Request) {
		const webSocketPair = new WebSocketPair();
		const [client, server] = Object.values(webSocketPair);
		// When you pass the server, the websocket connection will now be accepted by the DO
		// And it knows the exact instance of server to track
		this.ctx.acceptWebSocket(server);
		// Return status 101 which is a websocket status that says connection must stay open between client and server
		return new Response(null, {
			status: 101,
			webSocket: client,
		});
	}

	webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): void | Promise<void> {
		console.log('client closed');
	}

	// Fire whenever a message event happens
	// async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
	// 	// Can use this for sending messages
	// 	await ws.send(message)
	// 	// or DO context is better
	// 	const connections = this.ctx.getWebSockets(); // array of all websockets
	// 	for (const connection of connections){
	// 		connection !== ws; // dont double send message
	// 		await connection.send(message)
	// 	}
	// }

	// webSocketError(ws: WebSocket, error: unknown): void | Promise<void> {

	// }
}
