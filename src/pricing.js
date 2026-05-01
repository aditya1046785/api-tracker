/**
 * Pricing configuration and cost estimation
 */

const configModule = require('./config');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const debug = require('./debug');

// Default pricing for common models (per 1K tokens)
const defaultPricing = {
	'gpt-3.5-turbo': {
		input: 0.0015,
		output: 0.002,
	},
	'gpt-4': {
		input: 0.03,
		output: 0.06,
	},
	'gpt-4-turbo': {
		input: 0.01,
		output: 0.03,
	},
	'gpt-4o': {
		input: 0.005,
		output: 0.015,
	},
	'claude-2': {
		input: 0.008,
		output: 0.024,
	},
	'claude-3-opus': {
		input: 0.015,
		output: 0.075,
	},
	'claude-3-sonnet': {
		input: 0.003,
		output: 0.015,
	},
	'claude-3-haiku': {
		input: 0.00125,
		output: 0.00625,
	},
};

let pricingCache = {
	value: null,
	fetchedAtMs: 0,
};

function updatePricing(modelPricing) {
	const normalized = normalizePricingMap(modelPricing);
	if (Object.keys(normalized).length > 0) {
		configModule.updatePricing(normalized);
	}
}

function getPricingForModel(model) {
	const pricing = configModule.getPricing();
	const remotePricing = pricingCache.value || {};
	return pricing[model] || remotePricing[model] || defaultPricing[model] || null;
}

function calculateCost(usage, model) {
	if (!usage || typeof usage !== 'object') {
		return null;
	}

	const pricingConfig = getPricingForModel(model);
	if (!pricingConfig) {
		return null;
	}

	const { prompt_tokens = 0, completion_tokens = 0 } = usage;
	if (!Number.isFinite(pricingConfig.input) || !Number.isFinite(pricingConfig.output)) {
		return null;
	}

	const inputCost = (prompt_tokens / 1000) * pricingConfig.input;
	const outputCost = (completion_tokens / 1000) * pricingConfig.output;

	return {
		inputCost: Number(inputCost.toFixed(6)),
		outputCost: Number(outputCost.toFixed(6)),
		totalCost: Number((inputCost + outputCost).toFixed(6)),
	};
}

function getAllPricing() {
	const userPricing = configModule.getPricing();
	return { ...defaultPricing, ...(pricingCache.value || {}), ...userPricing };
}

function requestPricingJson(endpoint, timeoutMs, apiKey) {
	return new Promise((resolve, reject) => {
		let parsedUrl;

		try {
			parsedUrl = new URL(endpoint);
		} catch (error) {
			reject(error);
			return;
		}

		const transport = parsedUrl.protocol === 'https:' ? https : http;
			const headers = {
				Accept: 'application/json',
			};

			if (typeof apiKey === 'string' && apiKey) {
				headers.Authorization = `Bearer ${apiKey}`;
			}

			const req = transport.request(
				{
					method: 'GET',
					hostname: parsedUrl.hostname,
					port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
					path: `${parsedUrl.pathname}${parsedUrl.search}`,
					headers,
				},
			(res) => {
				let body = '';

				res.setEncoding('utf8');
				res.on('data', (chunk) => {
					body += chunk;
				});

				res.on('end', () => {
					if (res.statusCode < 200 || res.statusCode >= 300) {
						reject(new Error(`Pricing request failed with status ${res.statusCode}`));
						return;
					}

					try {
						const parsed = JSON.parse(body || '{}');
						resolve(parsed);
					} catch (error) {
						reject(error);
					}
				});
			}
		);

		req.setTimeout(timeoutMs, () => {
			req.destroy(new Error('Pricing request timed out'));
		});

		req.on('error', reject);
		req.end();
	});
}

function isValidPricingEntry(entry) {
	return (
		entry &&
		typeof entry === 'object' &&
		!Array.isArray(entry) &&
		Number.isFinite(entry.input) &&
		entry.input >= 0 &&
		Number.isFinite(entry.output) &&
		entry.output >= 0
	);
}

function normalizePricingMap(pricing) {
	if (!pricing || typeof pricing !== 'object' || Array.isArray(pricing)) {
		return {};
	}

	const normalized = {};

	for (const [model, entry] of Object.entries(pricing)) {
		if (typeof model !== 'string' || !model.trim() || !isValidPricingEntry(entry)) {
			continue;
		}

		normalized[model.trim()] = {
			input: entry.input,
			output: entry.output,
		};
	}

	return normalized;
}

function isValidPricingObject(pricing) {
	return Object.keys(normalizePricingMap(pricing)).length > 0;
}

async function fetchPricingFromServer(options = {}) {
	const config = configModule.getConfig();
	const endpoint = typeof options.endpoint === 'string' && options.endpoint
		? options.endpoint
		: config.pricingEndpoint;

	if (!endpoint) {
		return getAllPricing();
	}

	const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : config.timeoutMs;
	const cacheTtlMs = Number.isFinite(options.cacheTtlMs) ? options.cacheTtlMs : config.pricingCacheTtlMs;
	const apiKey = typeof options.apiKey === 'string' ? options.apiKey : config.apiKey;
	const now = Date.now();

	if (
		pricingCache.value &&
		Number.isFinite(cacheTtlMs) &&
		cacheTtlMs > 0 &&
		now - pricingCache.fetchedAtMs < cacheTtlMs
	) {
		return getAllPricing();
	}

	try {
			const response = await requestPricingJson(endpoint, timeoutMs, apiKey);
			const remotePricing = response && response.pricing ? response.pricing : response;
			const normalizedPricing = normalizePricingMap(remotePricing);

			if (!isValidPricingObject(normalizedPricing)) {
				throw new Error('Invalid pricing response format');
			}

			pricingCache = {
				value: normalizedPricing,
				fetchedAtMs: now,
			};

		return getAllPricing();
	} catch (error) {
		debug.logError('pricing.fetchPricingFromServer', error);
		return getAllPricing();
	}
}

module.exports = {
	updatePricing,
	getPricingForModel,
	calculateCost,
	getAllPricing,
	fetchPricingFromServer,
	normalizePricingMap,
	isValidPricingObject,
	defaultPricing,
};
