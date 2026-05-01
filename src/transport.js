/**
 * HTTP transport layer with retry logic
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');
const debug = require('./debug');

function requestJson(endpoint, apiKey, payload, timeoutMs) {
	return new Promise((resolve, reject) => {
		let parsedUrl;

		try {
			parsedUrl = new URL(endpoint);
		} catch (error) {
			reject(error);
			return;
		}

		const body = JSON.stringify(payload);
		const transport = parsedUrl.protocol === 'https:' ? https : http;
		const requestOptions = {
			method: 'POST',
			hostname: parsedUrl.hostname,
			port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
			path: `${parsedUrl.pathname}${parsedUrl.search}`,
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
				'Content-Length': Buffer.byteLength(body),
			},
		};

		const req = transport.request(requestOptions, (res) => {
			res.resume();

			if (res.statusCode >= 200 && res.statusCode < 300) {
				resolve(true);
				return;
			}

			reject(new Error(`Request failed with status ${res.statusCode}`));
		});

		req.setTimeout(timeoutMs, () => {
			req.destroy(new Error('Request timed out'));
		});

		req.on('error', reject);
		req.write(body);
		req.end();
	});
}

async function postWithRetry(endpoint, apiKey, payload, timeoutMs, maxRetries) {
	const result = await postWithRetryOptions(endpoint, apiKey, payload, {
		timeoutMs,
		maxRetries,
	});

	return result.success;
}

function sleep(delayMs) {
	return new Promise((resolve) => {
		const timer = setTimeout(resolve, delayMs);
		if (typeof timer.unref === 'function') {
			timer.unref();
		}
	});
}

function computeBackoffDelayMs(attemptIndex, options) {
	const baseDelay = Number.isFinite(options.baseRetryDelayMs) ? options.baseRetryDelayMs : 150;
	const maxDelay = Number.isFinite(options.maxRetryDelayMs) ? options.maxRetryDelayMs : 5000;
	const jitterRatio = Number.isFinite(options.retryJitterRatio) ? options.retryJitterRatio : 0.2;
	const cappedJitterRatio = Math.max(0, Math.min(jitterRatio, 1));

	const exponentialDelay = Math.min(baseDelay * (2 ** attemptIndex), maxDelay);
	const jitterWindow = exponentialDelay * cappedJitterRatio;
	const randomJitter = Math.random() * jitterWindow;

	return Math.floor(exponentialDelay + randomJitter);
}

async function postWithRetryOptions(endpoint, apiKey, payload, options = {}) {
	let lastError;
	const maxRetries = Number.isFinite(options.maxRetries) && options.maxRetries > 0
		? Math.floor(options.maxRetries)
		: 3;
	const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
		? options.timeoutMs
		: 5000;

	for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
		try {
			await requestJson(endpoint, apiKey, payload, timeoutMs);
			debug.log(`Successfully sent ${payload.events?.length || 1} event(s) on attempt ${attempt}`);
			return {
				success: true,
				attempt,
				error: null,
			};
		} catch (error) {
			lastError = error;
			debug.logError('transport', error);

			if (attempt < maxRetries) {
				const delayMs = computeBackoffDelayMs(attempt - 1, options);
				await sleep(delayMs);
			}
		}
	}

	debug.logError('transport', new Error(`Failed after ${maxRetries} retries`));
	return {
		success: false,
		attempt: maxRetries,
		error: lastError || new Error('Unknown transport error'),
	};
}

module.exports = {
	requestJson,
	postWithRetry,
	postWithRetryOptions,
	computeBackoffDelayMs,
};
