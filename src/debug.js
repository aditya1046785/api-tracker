/**
 * Debug logging utilities
 */

const configModule = require('./config');

function log(...args) {
	const config = configModule.getConfig();
	if (config.debug) {
		console.log('[AI-Metrics]', ...args);
	}
}

function logEvent(event, cost) {
	const config = configModule.getConfig();
	if (!config.debug) {
		return;
	}

	const costStr = cost ? `$${cost.totalCost.toFixed(6)}` : 'n/a';
	const tokens = `${event.usage.prompt_tokens}+${event.usage.completion_tokens}`;
	const latencyStr = Number.isFinite(event.latency_ms) ? `${event.latency_ms}ms` : 'n/a';
	console.log(
		`[AI-Metrics] function=${event.functionName} model=${event.model} tokens=${tokens} cost=${costStr} latency=${latencyStr}`
	);
}

function logBatch(batchSize, batches) {
	const config = configModule.getConfig();
	if (config.debug) {
		console.log(`[AI-Metrics] Flushing batch: ${batchSize} events (${batches} batches)`);
	}
}

function logError(context, error) {
	const config = configModule.getConfig();
	if (config.debug) {
		console.error(`[AI-Metrics] Error in ${context}:`, error.message);
	}
}

module.exports = {
	log,
	logEvent,
	logBatch,
	logError,
};
