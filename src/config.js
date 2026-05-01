/**
 * Configuration management for the tracker
 */

const DEFAULT_ENDPOINT = '';
const DEFAULT_BASE_URL = '';
const DEFAULT_TRACK_PATH = '/v1/track';
const DEFAULT_PRICING_PATH = '/v1/pricing';
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BATCH_INTERVAL_MS = 2000;
const DEFAULT_MAX_BATCH_SIZE = 20;
const DEFAULT_DEBUG_MODE = false;
const DEFAULT_CAPTURE_USER = false;
const DEFAULT_BASE_RETRY_DELAY_MS = 150;
const DEFAULT_MAX_RETRY_DELAY_MS = 5000;
const DEFAULT_RETRY_JITTER_RATIO = 0.2;
const DEFAULT_MAX_METADATA_BYTES = 1024;
const DEFAULT_MAX_QUEUE_SIZE = 1000;
const DEFAULT_ALLOW_METADATA_KEYS = null;
const DEFAULT_PRICING_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_CAPTURE_ERROR_DETAILS = false;

const globalConfig = {
	apiKey: process.env.AI_USAGE_TRACKER_API_KEY || '',
	baseUrl: normalizeBaseUrl(process.env.AI_USAGE_TRACKER_BASE_URL || DEFAULT_BASE_URL),
	endpoint: '',
	timeoutMs: DEFAULT_TIMEOUT_MS,
	maxRetries: DEFAULT_MAX_RETRIES,
	batchInterval: DEFAULT_BATCH_INTERVAL_MS,
	maxBatchSize: DEFAULT_MAX_BATCH_SIZE,
	maxQueueSize: DEFAULT_MAX_QUEUE_SIZE,
	debug: DEFAULT_DEBUG_MODE,
	captureUser: DEFAULT_CAPTURE_USER,
	captureErrorDetails: DEFAULT_CAPTURE_ERROR_DETAILS,
	baseRetryDelayMs: DEFAULT_BASE_RETRY_DELAY_MS,
	maxRetryDelayMs: DEFAULT_MAX_RETRY_DELAY_MS,
	retryJitterRatio: DEFAULT_RETRY_JITTER_RATIO,
	maxMetadataBytes: DEFAULT_MAX_METADATA_BYTES,
	allowMetadataKeys: DEFAULT_ALLOW_METADATA_KEYS,
	pricingEndpoint: '',
	pricingCacheTtlMs: DEFAULT_PRICING_CACHE_TTL_MS,
};

globalConfig.endpoint = process.env.AI_USAGE_TRACKER_ENDPOINT ||
	buildEndpoint(globalConfig.baseUrl, DEFAULT_TRACK_PATH) ||
	DEFAULT_ENDPOINT;
globalConfig.pricingEndpoint = process.env.AI_USAGE_TRACKER_PRICING_ENDPOINT ||
	buildEndpoint(globalConfig.baseUrl, DEFAULT_PRICING_PATH) ||
	'';

function normalizeBaseUrl(value) {
	if (typeof value !== 'string' || !value.trim()) {
		return '';
	}

	return value.trim().replace(/\/+$/, '');
}

function buildEndpoint(baseUrl, path) {
	const normalized = normalizeBaseUrl(baseUrl);
	if (!normalized) {
		return '';
	}

	return `${normalized}${path}`;
}

function normalizeConfig(input) {
	if (!input || typeof input !== 'object' || Array.isArray(input)) {
		return { ...globalConfig };
	}

	const normalizedAllowMetadataKeys = Object.prototype.hasOwnProperty.call(input, 'allowMetadataKeys')
		? (
			Array.isArray(input.allowMetadataKeys)
				? input.allowMetadataKeys.filter((key) => typeof key === 'string' && key.trim().length > 0)
				: null
		)
		: globalConfig.allowMetadataKeys;

	const baseUrl = Object.prototype.hasOwnProperty.call(input, 'baseUrl')
		? normalizeBaseUrl(input.baseUrl)
		: globalConfig.baseUrl;
	const endpoint = typeof input.endpoint === 'string' && input.endpoint
		? input.endpoint
		: (buildEndpoint(baseUrl, DEFAULT_TRACK_PATH) || globalConfig.endpoint);
	const pricingEndpoint = typeof input.pricingEndpoint === 'string' && input.pricingEndpoint
		? input.pricingEndpoint
		: (buildEndpoint(baseUrl, DEFAULT_PRICING_PATH) || globalConfig.pricingEndpoint);

	return {
		apiKey: typeof input.apiKey === 'string' ? input.apiKey : globalConfig.apiKey,
		baseUrl,
		endpoint,
		timeoutMs: Number.isFinite(input.timeoutMs) && input.timeoutMs > 0 ? input.timeoutMs : globalConfig.timeoutMs,
		maxRetries: Number.isFinite(input.maxRetries) && input.maxRetries > 0 ? Math.floor(input.maxRetries) : globalConfig.maxRetries,
		batchInterval: Number.isFinite(input.batchInterval) && input.batchInterval > 0 ? input.batchInterval : globalConfig.batchInterval,
		maxBatchSize: Number.isFinite(input.maxBatchSize) && input.maxBatchSize > 0 ? Math.floor(input.maxBatchSize) : globalConfig.maxBatchSize,
		maxQueueSize: Number.isFinite(input.maxQueueSize) && input.maxQueueSize > 0 ? Math.floor(input.maxQueueSize) : globalConfig.maxQueueSize,
		debug: typeof input.debug === 'boolean' ? input.debug : globalConfig.debug,
		captureUser: typeof input.captureUser === 'boolean' ? input.captureUser : globalConfig.captureUser,
		captureErrorDetails: typeof input.captureErrorDetails === 'boolean'
			? input.captureErrorDetails
			: globalConfig.captureErrorDetails,
		baseRetryDelayMs: Number.isFinite(input.baseRetryDelayMs) && input.baseRetryDelayMs > 0
			? Math.floor(input.baseRetryDelayMs)
			: globalConfig.baseRetryDelayMs,
		maxRetryDelayMs: Number.isFinite(input.maxRetryDelayMs) && input.maxRetryDelayMs > 0
			? Math.floor(input.maxRetryDelayMs)
			: globalConfig.maxRetryDelayMs,
		retryJitterRatio: Number.isFinite(input.retryJitterRatio) && input.retryJitterRatio >= 0
			? input.retryJitterRatio
			: globalConfig.retryJitterRatio,
		maxMetadataBytes: Number.isFinite(input.maxMetadataBytes) && input.maxMetadataBytes > 0
			? Math.floor(input.maxMetadataBytes)
			: globalConfig.maxMetadataBytes,
		allowMetadataKeys: normalizedAllowMetadataKeys,
		pricingEndpoint,
		pricingCacheTtlMs: Number.isFinite(input.pricingCacheTtlMs) && input.pricingCacheTtlMs > 0
			? Math.floor(input.pricingCacheTtlMs)
			: globalConfig.pricingCacheTtlMs,
	};
}

function init(options = {}) {
	const normalized = normalizeConfig(options);

	globalConfig.apiKey = normalized.apiKey;
	globalConfig.baseUrl = normalized.baseUrl;
	globalConfig.endpoint = normalized.endpoint;
	globalConfig.timeoutMs = normalized.timeoutMs;
	globalConfig.maxRetries = normalized.maxRetries;
	globalConfig.batchInterval = normalized.batchInterval;
	globalConfig.maxBatchSize = normalized.maxBatchSize;
	globalConfig.maxQueueSize = normalized.maxQueueSize;
	globalConfig.debug = normalized.debug;
	globalConfig.captureUser = normalized.captureUser;
	globalConfig.captureErrorDetails = normalized.captureErrorDetails;
	globalConfig.baseRetryDelayMs = normalized.baseRetryDelayMs;
	globalConfig.maxRetryDelayMs = normalized.maxRetryDelayMs;
	globalConfig.retryJitterRatio = normalized.retryJitterRatio;
	globalConfig.maxMetadataBytes = normalized.maxMetadataBytes;
	globalConfig.allowMetadataKeys = normalized.allowMetadataKeys;
	globalConfig.pricingEndpoint = normalized.pricingEndpoint;
	globalConfig.pricingCacheTtlMs = normalized.pricingCacheTtlMs;

	return { ...globalConfig };
}

function getConfig() {
	return { ...globalConfig };
}

function updatePricing(pricingConfig) {
	globalConfig.pricing = pricingConfig;
}

function getPricing() {
	return globalConfig.pricing || {};
}

module.exports = {
	DEFAULT_ENDPOINT,
	DEFAULT_BASE_URL,
	DEFAULT_TRACK_PATH,
	DEFAULT_PRICING_PATH,
	DEFAULT_TIMEOUT_MS,
	DEFAULT_MAX_RETRIES,
	DEFAULT_BATCH_INTERVAL_MS,
	DEFAULT_MAX_BATCH_SIZE,
	DEFAULT_BASE_RETRY_DELAY_MS,
	DEFAULT_MAX_RETRY_DELAY_MS,
	DEFAULT_RETRY_JITTER_RATIO,
	DEFAULT_MAX_METADATA_BYTES,
	DEFAULT_MAX_QUEUE_SIZE,
	DEFAULT_CAPTURE_ERROR_DETAILS,
	init,
	getConfig,
	normalizeConfig,
	updatePricing,
	getPricing,
	normalizeBaseUrl,
	buildEndpoint,
};
