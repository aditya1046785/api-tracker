/**
 * Type validation and utility functions
 */

function isPlainObject(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isValidUsage(usage) {
	return (
		isPlainObject(usage) &&
		Number.isInteger(usage.prompt_tokens) && usage.prompt_tokens >= 0 &&
		Number.isInteger(usage.completion_tokens) && usage.completion_tokens >= 0 &&
		Number.isInteger(usage.total_tokens) && usage.total_tokens >= 0
	);
}

function isValidModel(model) {
	return typeof model === 'string' && model.trim().length > 0;
}

function isValidFunctionName(functionName) {
	return typeof functionName === 'string' && functionName.trim().length > 0;
}

function toIsoTimestamp(value) {
	if (!value) {
		return new Date().toISOString();
	}

	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function toLatencyMs(value) {
	if (Number.isFinite(value) && value >= 0) {
		return Math.round(value);
	}

	return null;
}

function extractUsage(response) {
	if (!isPlainObject(response)) {
		return null;
	}

	return response.usage || response.tokenUsage || response.tokens || null;
}

function extractModel(response, fallback) {
	if (isPlainObject(response) && typeof response.model === 'string' && response.model.trim()) {
		return response.model.trim();
	}

	return typeof fallback === 'string' ? fallback.trim() : '';
}

module.exports = {
	isPlainObject,
	isValidUsage,
	isValidModel,
	isValidFunctionName,
	toIsoTimestamp,
	toLatencyMs,
	extractUsage,
	extractModel,
};
