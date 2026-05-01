/**
 * AI Usage Tracker - Comprehensive Usage Examples
 */

const tracker = require('./src/index');

// ============================================================================
// 1. BASIC INITIALIZATION
// ============================================================================

// Initialize with configuration
tracker.init({
	apiKey: process.env.AI_USAGE_TRACKER_API_KEY,
	baseUrl: process.env.AI_USAGE_TRACKER_BASE_URL || 'https://api.example.com',
	batchInterval: 2000, // Flush batch every 2 seconds
	maxBatchSize: 20, // Or after 20 events
	maxQueueSize: 1000, // Prevent unbounded memory growth
	debug: true, // Enable console logging
	captureUser: false, // Don't capture user IDs by default
	captureErrorDetails: false, // Don't send provider error messages by default
	allowMetadataKeys: ['version', 'source', 'department', 'tags'], // Optional metadata allow-list
});

// ============================================================================
// 2. MANUAL TRACKING - object notation (recommended)
// ============================================================================

async function example_manualTrackingObject() {
	const result = await tracker.track({
		usage: {
			prompt_tokens: 150,
			completion_tokens: 100,
			total_tokens: 250,
		},
		model: 'gpt-4',
		functionName: 'generateArticle',
		metadata: {
			version: '1.0',
		},
	});

	console.log('Tracking result:', result); // true/false
}

// ============================================================================
// 3. MANUAL TRACKING - direct arguments (legacy compatible)
// ============================================================================

async function example_manualTrackingDirect() {
	const usage = {
		prompt_tokens: 150,
		completion_tokens: 100,
		total_tokens: 250,
	};

	const result = await tracker.track(
		usage,
		'gpt-4', // model
		'generateArticle', // functionName
		process.env.AI_USAGE_TRACKER_API_KEY, // apiKey (optional)
		{ version: '1.0' } // metadata (optional)
	);

	console.log('Tracking result:', result);
}

// ============================================================================
// 4. TRACKING RESPONSES FROM LLM APIs
// ============================================================================

async function example_trackResponse() {
	// Simulated LLM response
	const response = {
		id: 'chatcmpl-8P7Go3...',
		model: 'gpt-4',
		usage: {
			prompt_tokens: 150,
			completion_tokens: 100,
			total_tokens: 250,
		},
		choices: [
			{
				message: { role: 'assistant', content: '...' },
			},
		],
	};

	const result = await tracker.trackResponse(
		response,
		'chatCompletion', // functionName
		process.env.AI_USAGE_TRACKER_API_KEY // apiKey (optional)
	);

	console.log('Response tracked:', result);
}

// ============================================================================
// 5. WRAPPED TRACKING - automatic extraction and timing
// ============================================================================

async function example_wrappedTracking() {
	const result = await tracker.trackLLM(
		'generateResponse', // functionName
		async () => {
			// Your actual LLM call here
			return {
				model: 'gpt-4o',
				usage: {
					prompt_tokens: 100,
					completion_tokens: 80,
					total_tokens: 180,
				},
				data: 'response data',
			};
		},
		{
			metadata: {
				source: 'chatbot',
				userId: 'user456',
			},
		}
	);

	// result contains the original response (passthrough)
	console.log('LLM result:', result);
}

// ============================================================================
// 6. REAL-WORLD EXAMPLE - OpenAI Integration
// ============================================================================

async function example_openaiIntegration() {
	// This is how you'd integrate with OpenAI
	const openai = require('openai');
	const client = new openai.OpenAI({
		apiKey: process.env.OPENAI_API_KEY,
	});

	// Option A: Wrap the call
	const response = await tracker.trackLLM(
		'summarizeText',
		async () => {
			return client.chat.completions.create({
				model: 'gpt-4',
				messages: [
					{
						role: 'user',
						content: 'Summarize this text...',
					},
				],
			});
		}
	);

	console.log('Summary:', response.choices[0].message.content);

	// Option B: Track manually after the call
	const response2 = await client.chat.completions.create({
		model: 'gpt-4',
		messages: [
			{
				role: 'user',
				content: 'Another prompt...',
			},
		],
	});

	await tracker.trackResponse(response2, 'analyzeContent');
}

// ============================================================================
// 7. CUSTOM PRICING CONFIGURATION
// ============================================================================

async function example_customPricing() {
	// Update pricing for your models
	tracker.updatePricing({
		'gpt-4-turbo': {
			input: 0.01,
			output: 0.03,
		},
		'custom-model': {
			input: 0.002,
			output: 0.005,
		},
	});

	// Calculate cost
	const usage = {
		prompt_tokens: 1000,
		completion_tokens: 500,
		total_tokens: 1500,
	};

	const cost = tracker.calculateCost(usage, 'gpt-4');
	console.log('Estimated cost:', cost);
	// Output: {
	//   inputCost: 0.03,
	//   outputCost: 0.06,
	//   totalCost: 0.09
	// }
}

// ============================================================================
// 8. DEBUG MODE
// ============================================================================

async function example_debugMode() {
	// Initialize with debug enabled
	tracker.init({
		apiKey: process.env.AI_USAGE_TRACKER_API_KEY,
		debug: true, // Enable debug logging
	});

	// Now all tracking calls will log:
	// [AI-Usage-Tracker] functionName → 150+100 tokens → $0.09 (gpt-4)

	await tracker.track({
		usage: {
			prompt_tokens: 150,
			completion_tokens: 100,
			total_tokens: 250,
		},
		model: 'gpt-4',
		functionName: 'myFunction',
	});
}

// ============================================================================
// 9. BATCHING AND QUEUE MANAGEMENT
// ============================================================================

async function example_batching() {
	// Initialize with custom batch settings
	tracker.init({
		apiKey: process.env.AI_USAGE_TRACKER_API_KEY,
		baseUrl: process.env.AI_USAGE_TRACKER_BASE_URL || 'https://api.example.com',
		batchInterval: 3000, // Send every 3 seconds
		maxBatchSize: 50, // Or when 50 events are queued
	});

	// Track multiple events (they're queued)
	for (let i = 0; i < 10; i++) {
		await tracker.track({
			usage: {
				prompt_tokens: 100,
				completion_tokens: 50,
				total_tokens: 150,
			},
			model: 'gpt-3.5-turbo',
			functionName: `operation_${i}`,
		});
	}

	// Check queue size
	console.log('Events queued:', tracker.getQueueSize()); // 10

	// Flush manually if needed
	await tracker.flush();
	console.log('Events queued after flush:', tracker.getQueueSize()); // 0
}

// ============================================================================
// 10. OPTIONAL FIELDS
// ============================================================================

async function example_optionalFields() {
	// All optional fields are supported
	await tracker.track({
		usage: {
			prompt_tokens: 100,
			completion_tokens: 50,
			total_tokens: 150,
		},
		model: 'gpt-4',
		functionName: 'complexOperation',
		userId: 'user_xyz', // Optional
		sessionId: 'session_abc', // Optional
		metadata: {
			// Optional: any custom metadata
			department: 'sales',
			version: '2.1',
			tags: ['important', 'processed'],
		},
	});
}

// ============================================================================
// 11. ERROR HANDLING
// ============================================================================

async function example_errorHandling() {
	try {
		// Track returns boolean, not throwing errors
		const success = await tracker.track({
			usage: {
				prompt_tokens: 100,
				completion_tokens: 50,
				total_tokens: 150,
			},
			model: 'gpt-4',
			functionName: 'operation',
		});

	if (!success) {
			console.log('Tracking failed or the queue is full');
		}
	} catch (error) {
		console.error('Unexpected error:', error);
	}
}

// ============================================================================
// 12. GRACEFUL SHUTDOWN
// ============================================================================

async function example_gracefulShutdown() {
	// When your app shuts down, flush any pending events
	process.on('SIGTERM', async () => {
		console.log('Shutting down, flushing events...');
		await tracker.flush();
		process.exit(0);
	});
}

// ============================================================================
// 13. GET CONFIGURATION
// ============================================================================

async function example_getConfig() {
	const config = tracker.getConfig();
	console.log('Current config:', config);
	// {
	//   apiKey: '...',
	//   baseUrl: 'https://...',
	//   endpoint: 'https://.../v1/track',
	//   pricingEndpoint: 'https://.../v1/pricing',
	//   timeoutMs: 5000,
	//   maxRetries: 3,
	//   batchInterval: 2000,
	//   maxBatchSize: 20,
	//   debug: false,
	//   captureUser: false
	// }
}

// ============================================================================
// 14. GET PRICING
// ============================================================================

async function example_getPricing() {
	const pricing = tracker.getPricing();
	console.log('Available models:', Object.keys(pricing));
	// ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'gpt-4o', ...]
}

// ============================================================================
// Export examples for testing
// ============================================================================

module.exports = {
	example_manualTrackingObject,
	example_manualTrackingDirect,
	example_trackResponse,
	example_wrappedTracking,
	example_openaiIntegration,
	example_customPricing,
	example_debugMode,
	example_batching,
	example_optionalFields,
	example_errorHandling,
	example_gracefulShutdown,
	example_getConfig,
	example_getPricing,
};

// ============================================================================
// Quick start (uncomment to run)
// ============================================================================

/*
(async () => {
  tracker.init({
    apiKey: process.env.AI_USAGE_TRACKER_API_KEY,
    debug: true,
  });

  await example_manualTrackingObject();
  await tracker.flush();
  process.exit(0);
})();
*/
