/**
 * AI Usage Tracker
 * Production-ready SDK for tracking LLM API usage with local cost estimation,
 * event batching, and comprehensive configuration.
 */

const Tracker = require('./tracker');
const configModule = require('./config');
const pricingModule = require('./pricing');

// Create singleton instance
const tracker = new Tracker();

/**
 * Initialize the tracker with configuration
 * @param {Object} options - Configuration options
 * @returns {Object} Current configuration
 */
function init(options = {}) {
	return tracker.init(options);
}

/**
 * Track usage - supports both direct arguments and object notation
 * @param {Object|TokenUsage} usageOrInput - Usage object or tracking input
 * @returns {Promise<boolean>} Success status
 */
function track(...args) {
	return tracker.track(...args);
}

/**
 * Track response from LLM API
 * @param {Object} response - LLM API response
 * @param {string} functionName - Function/operation name
 * @param {string} apiKey - Optional API key override
 * @param {Object} metadata - Optional metadata
 * @returns {Promise<boolean>} Success status
 */
function trackResponse(response, functionName, apiKey, metadata, options) {
	return tracker.trackResponse(response, functionName, apiKey, metadata, options);
}

/**
 * Wrap an LLM call with automatic tracking
 * Captures response, extracts usage, and automatically tracks
 * @param {string} functionName - Function/operation name
 * @param {Function} llmCallFn - Async function that makes the LLM call
 * @param {Object} options - Optional tracking options (apiKey, metadata)
 * @returns {Promise<Object>} The actual LLM response (passthrough)
 */
function trackLLM(functionName, llmCallFn, options = {}) {
	return tracker.trackLLM(functionName, llmCallFn, options);
}

/**
 * Flush all queued events immediately
 * @returns {Promise<void>}
 */
function flush() {
	return tracker.flush();
}

/**
 * Get current configuration
 * @returns {Object} Current config
 */
function getConfig() {
	return tracker.getConfig();
}

/**
 * Update pricing configuration
 * @param {Object} pricingConfig - Model pricing information
 */
function updatePricing(pricingConfig) {
	tracker.updatePricing(pricingConfig);
}

/**
 * Fetch pricing from remote endpoint and cache locally.
 * @param {Object} options - Optional fetch options
 * @returns {Promise<Object>} Pricing map
 */
function fetchPricingFromServer(options = {}) {
	return tracker.fetchPricingFromServer(options);
}

/**
 * Get all pricing information
 * @returns {Object} Pricing for all models
 */
function getPricing() {
	return pricingModule.getAllPricing();
}

/**
 * Get estimated cost for usage
 * @param {Object} usage - Token usage object
 * @param {string} model - Model name
 * @returns {Object|null} Estimated cost breakdown
 */
function calculateCost(usage, model) {
	return pricingModule.calculateCost(usage, model);
}

/**
 * Get current queue size
 * @returns {number} Number of queued events
 */
function getQueueSize() {
	return tracker.getQueueSize();
}

// Re-export constants
const {
	DEFAULT_ENDPOINT,
	DEFAULT_BASE_URL,
	DEFAULT_TRACK_PATH,
	DEFAULT_PRICING_PATH,
	DEFAULT_TIMEOUT_MS,
	DEFAULT_MAX_RETRIES,
	DEFAULT_BATCH_INTERVAL_MS,
	DEFAULT_MAX_BATCH_SIZE,
	DEFAULT_MAX_QUEUE_SIZE,
	DEFAULT_BASE_RETRY_DELAY_MS,
	DEFAULT_MAX_RETRY_DELAY_MS,
	DEFAULT_RETRY_JITTER_RATIO,
	DEFAULT_MAX_METADATA_BYTES,
	DEFAULT_CAPTURE_ERROR_DETAILS,
} = configModule;

module.exports = {
	// Core tracking
	init,
	track,
	trackResponse,
	trackLLM,
	
	// Utilities
	flush,
	getConfig,
	updatePricing,
	fetchPricingFromServer,
	getPricing,
	calculateCost,
	getQueueSize,
	
	// Constants
	DEFAULT_ENDPOINT,
	DEFAULT_BASE_URL,
	DEFAULT_TRACK_PATH,
	DEFAULT_PRICING_PATH,
	DEFAULT_TIMEOUT_MS,
	DEFAULT_MAX_RETRIES,
	DEFAULT_BATCH_INTERVAL_MS,
	DEFAULT_MAX_BATCH_SIZE,
	DEFAULT_MAX_QUEUE_SIZE,
	DEFAULT_BASE_RETRY_DELAY_MS,
	DEFAULT_MAX_RETRY_DELAY_MS,
	DEFAULT_RETRY_JITTER_RATIO,
	DEFAULT_MAX_METADATA_BYTES,
	DEFAULT_CAPTURE_ERROR_DETAILS,
};
