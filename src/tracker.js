/**
 * Core tracking logic
 */

const types = require('./types');
const configModule = require('./config');
const pricingModule = require('./pricing');
const transport = require('./transport');
const debug = require('./debug');
const EventBatcher = require('./batcher');
const metadataModule = require('./metadata');

class Tracker {
	constructor() {
		this.batcher = null;
		this.initialized = false;
	}

	initializeWithConfig(config) {
		if (this.batcher) {
			// Clean up existing batcher
			this.batcher.flushAll().catch((error) => {
				debug.logError('tracker', error);
			});
		}

		const flushCallback = async (events) => {
			return this.sendBatch(events, config);
		};

		this.batcher = new EventBatcher(
			flushCallback,
			config.batchInterval,
			config.maxBatchSize,
			config.maxQueueSize
		);
		this.initialized = true;
	}

	async sendBatch(events, config) {
			if (!config.apiKey || !config.endpoint) {
				debug.log('No API key or endpoint provided. Events queued but not sent.');
				return { sentCount: 0, success: false };
			}

		const payload = {
			events,
			timestamp: new Date().toISOString(),
		};

		const result = await transport.postWithRetryOptions(
			config.endpoint,
			config.apiKey,
			payload,
			{
				timeoutMs: config.timeoutMs,
				maxRetries: config.maxRetries,
				baseRetryDelayMs: config.baseRetryDelayMs,
				maxRetryDelayMs: config.maxRetryDelayMs,
				retryJitterRatio: config.retryJitterRatio,
			}
		);

		if (!result.success) {
			return {
				sentCount: 0,
				success: false,
			};
		}

		return {
			sentCount: events.length,
			success: true,
		};
	}

	async track(...args) {
		if (!this.initialized) {
			this.initializeWithConfig(configModule.getConfig());
		}

		const config = configModule.getConfig();

		try {
			// Parse input - support both direct arguments and object
			let trackingData;

			if (args.length === 1 && types.isPlainObject(args[0])) {
				const input = args[0];
				// Check if this is an object with nested usage
				const hasValidUsage = types.isValidUsage(input.usage);
				
				if (hasValidUsage) {
					// Object notation: track({ usage: {...}, model, functionName })
					trackingData = input;
				} else if (
					typeof input.model === 'string' ||
					typeof input.functionName === 'string'
				) {
					// Object notation but missing/invalid usage (error case)
					trackingData = input;
				} else {
					// Ambiguous - treat as positional with input as usage
					trackingData = {
						usage: input,
						model: undefined,
						functionName: undefined,
					};
				}
			} else if (args.length >= 3) {
				// Positional arguments: track(usage, model, functionName, apiKey?, metadata?)
				trackingData = {
					usage: args[0],
					model: args[1],
					functionName: args[2],
					apiKey: args[3],
					metadata: args[4],
				};
			} else {
				// Invalid call signature
				trackingData = {
					usage: args[0],
					model: args[1],
					functionName: args[2],
					apiKey: args[3],
					metadata: args[4],
				};
			}

			// Resolve API key
			const resolvedApiKey =
				typeof trackingData.apiKey === 'string' && trackingData.apiKey
					? trackingData.apiKey
					: config.apiKey || process.env.AI_USAGE_TRACKER_API_KEY || '';

			if (!resolvedApiKey) {
				debug.log('No API key provided (cannot send to server).');
				return false;
			}

			// Validate usage
			if (!types.isValidUsage(trackingData.usage)) {
				debug.log('Invalid usage object');
				return false;
			}

			// Validate model
			if (!types.isValidModel(trackingData.model)) {
				debug.log('Invalid model:', trackingData.model);
				return false;
			}

			// Validate function name
			if (!types.isValidFunctionName(trackingData.functionName)) {
				debug.log('Invalid functionName:', trackingData.functionName);
				return false;
			}

			const latencyMs = types.toLatencyMs(trackingData.latency_ms ?? trackingData.latencyMs);

			// Build event
			const event = {
				usage: trackingData.usage,
				model: trackingData.model.trim(),
				functionName: trackingData.functionName.trim(),
				timestamp: types.toIsoTimestamp(trackingData.timestamp),
				latency_ms: latencyMs,
				metadata: metadataModule.sanitizeMetadata(trackingData.metadata, {
					allowMetadataKeys: config.allowMetadataKeys,
					maxMetadataBytes: config.maxMetadataBytes,
				}),
			};

			// Add optional fields
			if (config.captureUser && trackingData.userId) {
				event.userId = trackingData.userId;
			}

			if (trackingData.sessionId) {
				event.sessionId = trackingData.sessionId;
			}

			// Calculate cost
			const cost = pricingModule.calculateCost(event.usage, event.model);
			if (cost) {
				event.estimatedCost = cost;
			}

			// Log event in debug mode
			debug.logEvent(event, cost);

			// Add to batch
			const queued = await this.batcher.add(event);
			if (!queued) {
				return false;
			}

			return true;
		} catch (error) {
			debug.logError('tracker', error);
			return false;
		}
	}

	async trackResponse(response, functionName, apiKey, metadata, options = {}) {
		try {
			const usage = types.extractUsage(response);
			const model = types.extractModel(response);

			if (!usage || !model || !types.isValidFunctionName(functionName)) {
				debug.log('Cannot extract usage or model from response');
				return false;
			}

			return this.track({
				usage,
				model,
				functionName: functionName.trim(),
				apiKey,
				metadata,
				latency_ms: options.latency_ms,
				userId: options.userId,
				sessionId: options.sessionId,
			});
		} catch (error) {
			debug.logError('trackResponse', error);
			return false;
		}
	}

	async trackLLM(functionName, llmCallFn, options = {}) {
		const startTime = Date.now();
		const safeOptions = types.isPlainObject(options) ? options : {};

		try {
			const response = await llmCallFn();
			const latencyMs = Date.now() - startTime;

			await this.trackResponse(
				response,
				functionName,
				safeOptions.apiKey,
				{
					...safeOptions.metadata,
					status: 'success',
				},
				{
					latency_ms: latencyMs,
					userId: safeOptions.userId,
					sessionId: safeOptions.sessionId,
				}
			);

			// Return the original response (passthrough)
			return response;
		} catch (error) {
			const latencyMs = Date.now() - startTime;
				const errorMetadata = metadataModule.sanitizeError(error, {
					captureErrorDetails: configModule.getConfig().captureErrorDetails,
				});

				await this.track({
					usage: {
						prompt_tokens: 0,
					completion_tokens: 0,
					total_tokens: 0,
				},
				model: typeof safeOptions.model === 'string' && safeOptions.model.trim()
					? safeOptions.model.trim()
					: 'unknown',
				functionName,
				apiKey: safeOptions.apiKey,
				latency_ms: latencyMs,
				userId: safeOptions.userId,
					sessionId: safeOptions.sessionId,
					metadata: {
						...safeOptions.metadata,
						status: 'error',
						...errorMetadata,
					},
				});

			// Re-throw the original error after logging
			throw error;
		}
	}

	getConfig() {
		return configModule.getConfig();
	}

	init(options = {}) {
		const config = configModule.init(options);
		this.initializeWithConfig(config);
		return config;
	}

	updatePricing(pricingConfig) {
		pricingModule.updatePricing(pricingConfig);
		debug.log('Pricing configuration updated');
	}

	async fetchPricingFromServer(options = {}) {
		return pricingModule.fetchPricingFromServer(options);
	}

	async flush() {
		if (this.batcher) {
			await this.batcher.flushAll();
			debug.log('All events flushed');
		}
	}

	getQueueSize() {
		return this.batcher ? this.batcher.getQueueSize() : 0;
	}
}

module.exports = Tracker;
