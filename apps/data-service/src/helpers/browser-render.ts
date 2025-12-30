import puppeteer from '@cloudflare/puppeteer';
import { base64 } from 'zod/v4';

export async function collectDestinationInfo(env: Env, destinationUrl: string) {
	const browser = await puppeteer.launch(env.VIRTUAL_BROWSER);
	const page = await browser.newPage();
	const response = await page.goto(destinationUrl);
	// No more requests get issued, page fully loaded
	await page.waitForNetworkIdle();

	// Raw dump of the text
	const bodyText = (await page.$eval('body', (el) => el.innerText)) as string;
	// Also get HTML block
	const html = await page.content();
	// If a status is 404, you don't need to render through AI
	const status = response ? response.status() : 0;

	// Add screenshot capability
	// const screenshot = await page.screenshot({ encoding: 'base64' });
	// const screenshotDataUrl = `data:image/png;base64,${screenshot}`;

	// Ensure you don't hit your 10 concurrent
	await browser.close();
	console.log('Collecting rendered destination page data');
	return {
		bodyText,
		html,
		status,
		// screenshotDataUrl
	};
}
