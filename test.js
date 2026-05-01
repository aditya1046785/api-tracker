const assert = require('assert');
const EventBatcher = require('./src/batcher');
const Tracker = require('./src/tracker');
const transport = require('./src/transport');
const metadata = require('./src/metadata');
const pricing = require('./src/pricing');
const config = require('./src/config');

async function testBatchingBehavior() {
	const sentBatches = [];
	const batcher = new EventBatcher(async (batch) => {
		sentBatches.push(batch.map((event) => event.id));
		return { sentCount: batch.length, success: true };
	}, 1000, 2);

	await batcher.add({ id: 1 });
	await batcher.add({ id: 2 });
	await batcher.add({ id: 3 });
	await batcher.add({ id: 4 });
	await batcher.add({ id: 5 });

	await batcher.flushAll();

	assert.deepStrictEqual(sentBatches, [[1, 2], [3, 4], [5]]);
	assert.strictEqual(batcher.getQueueSize(), 0);
}

async function testQueueLimit() {
	const batcher = new EventBatcher(async (batch) => ({ sentCount: batch.length, success: true }), 1000, 10, 2);

	assert.strictEqual(await batcher.add({ id: 1 }), true);
	assert.strictEqual(await batcher.add({ id: 2 }), true);
	assert.strictEqual(await batcher.add({ id: 3 }), false);
	assert.strictEqual(batcher.getQueueSize(), 2);

	await batcher.flushAll();
	assert.strictEqual(batcher.getQueueSize(), 0);
}

function testRetryBackoffLogic() {
	const options = {
		baseRetryDelayMs: 100,
		maxRetryDelayMs: 1000,
		retryJitterRatio: 0,
	};

	assert.strictEqual(transport.computeBackoffDelayMs(0, options), 100);
	assert.strictEqual(transport.computeBackoffDelayMs(1, options), 200);
	assert.strictEqual(transport.computeBackoffDelayMs(2, options), 400);
	assert.strictEqual(transport.computeBackoffDelayMs(4, options), 1000);
}

function testBaseUrlDerivation() {
	const normalized = config.normalizeConfig({
		apiKey: 'test-key',
		baseUrl: 'https://tracker.example.com/',
	});

	assert.strictEqual(normalized.baseUrl, 'https://tracker.example.com');
	assert.strictEqual(normalized.endpoint, 'https://tracker.example.com/v1/track');
	assert.strictEqual(normalized.pricingEndpoint, 'https://tracker.example.com/v1/pricing');

	const withOverrides = config.normalizeConfig({
		apiKey: 'test-key',
		baseUrl: 'https://tracker.example.com/',
		endpoint: 'https://custom.example.com/events',
		pricingEndpoint: 'https://custom.example.com/prices',
	});

	assert.strictEqual(withOverrides.endpoint, 'https://custom.example.com/events');
	assert.strictEqual(withOverrides.pricingEndpoint, 'https://custom.example.com/prices');
}


async function testNoDataLossOnFailure() {
	const tracker = new Tracker();
	tracker.init({
		apiKey: 'test-key',
		endpoint: 'https://tracker.test/events',
		batchInterval: 100000,
		maxBatchSize: 10,
		maxRetries: 1,
	});

	const originalPost = transport.postWithRetryOptions;

	try {
		transport.postWithRetryOptions = async () => ({ success: false, sentCount: 0, error: new Error('fail') });

		const tracked = await tracker.track({
			usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
			model: 'gpt-4',
			functionName: 'failureCase',
		});

		assert.strictEqual(tracked, true);
		await tracker.flush();
		assert.strictEqual(tracker.getQueueSize(), 1);

		transport.postWithRetryOptions = async () => ({ success: true, sentCount: 1, error: null });
		await tracker.flush();
		assert.strictEqual(tracker.getQueueSize(), 0);
	} finally {
		transport.postWithRetryOptions = originalPost;
	}
}

async function testTrackLLMSuccessAndFailureTracking() {
	const tracker = new Tracker();
	tracker.init({
		apiKey: 'test-key',
		endpoint: 'https://tracker.test/events',
		batchInterval: 100000,
		maxBatchSize: 20,
		maxRetries: 1,
		allowMetadataKeys: null,
		captureUser: true,
	});

	const originalPost = transport.postWithRetryOptions;
	const capturedEvents = [];

	try {
		transport.postWithRetryOptions = async (_endpoint, _apiKey, payload) => {
			if (Array.isArray(payload.events)) {
				capturedEvents.push(...payload.events);
			}
			return { success: true, sentCount: payload.events ? payload.events.length : 0, error: null };
		};

		const response = await tracker.trackLLM(
			'wrappedSuccess',
			async () => ({
				model: 'gpt-4',
				usage: {
					prompt_tokens: 10,
					completion_tokens: 5,
					total_tokens: 15,
				},
				ok: true,
			}),
			{
				userId: 'user-1',
				sessionId: 'session-1',
				metadata: {
					plan: 'pro',
					prompt: 'should-be-removed',
				},
			}
		);

		assert.strictEqual(response.ok, true);

		let failed = false;
		try {
			await tracker.trackLLM(
				'wrappedFailure',
				async () => {
					throw new Error('synthetic failure');
				},
				{
					model: 'gpt-4',
					userId: 'user-1',
					sessionId: 'session-1',
				}
			);
		} catch (_error) {
			failed = true;
		}

		assert.strictEqual(failed, true);

		await tracker.flush();

		assert.strictEqual(capturedEvents.length, 2);
		assert.strictEqual(capturedEvents[0].functionName, 'wrappedSuccess');
		assert.strictEqual(capturedEvents[0].metadata.status, 'success');
		assert.strictEqual(capturedEvents[0].metadata.prompt, undefined);
		assert.strictEqual(capturedEvents[0].userId, 'user-1');
		assert.strictEqual(capturedEvents[0].sessionId, 'session-1');
		assert.ok(Number.isFinite(capturedEvents[0].latency_ms));

			assert.strictEqual(capturedEvents[1].functionName, 'wrappedFailure');
			assert.strictEqual(capturedEvents[1].metadata.status, 'error');
			assert.strictEqual(capturedEvents[1].metadata.errorName, 'Error');
			assert.strictEqual(capturedEvents[1].metadata.errorDetail, undefined);
			assert.strictEqual(capturedEvents[1].usage.total_tokens, 0);
			assert.ok(Number.isFinite(capturedEvents[1].latency_ms));
		} finally {
		transport.postWithRetryOptions = originalPost;
	}
}

function testMetadataSanitization() {
	const cleaned = metadata.sanitizeMetadata(
		{
				apiKey: 'secret',
				openaiApiKey: 'secret0',
				authorization: 'Bearer secret',
				token: 'secret2',
				userPrompt: 'should be stripped',
				rawResponse: 'should also be stripped',
				plan: 'pro',
				region: 'us-east-1',
				notes: 'keep me out if allow-list is enabled',
		},
		{
			allowMetadataKeys: ['plan', 'region'],
			maxMetadataBytes: 1024,
		}
	);

	assert.deepStrictEqual(cleaned, {
		plan: 'pro',
		region: 'us-east-1',
	});

	const limited = metadata.sanitizeMetadata(
		{
			a: '12345678901234567890',
			b: '12345678901234567890',
			c: '12345678901234567890',
		},
		{ maxMetadataBytes: 40 }
	);

	assert.ok(Buffer.byteLength(JSON.stringify(limited), 'utf8') <= 40);

	const valueRedacted = metadata.sanitizeMetadata(
		{
			plan: 'pro',
			header: 'Bearer sk-test123456789012345',
		},
		{ maxMetadataBytes: 1024 }
	);

	assert.strictEqual(valueRedacted.header, '[REDACTED]');
}

function testErrorDetailOptIn() {
	const safeDefault = metadata.sanitizeError(new Error('Bearer sk-test123456789012345'), {
		captureErrorDetails: false,
	});
	assert.deepStrictEqual(safeDefault, { errorName: 'Error' });

	const detailed = metadata.sanitizeError(new Error('Bearer sk-test123456789012345'), {
		captureErrorDetails: true,
	});
	assert.strictEqual(detailed.errorName, 'Error');
	assert.strictEqual(detailed.errorDetail, '[REDACTED]');
}

function testPricingValidation() {
	const normalized = pricing.normalizePricingMap({
		'gpt-valid': { input: 0.01, output: 0.02 },
		'gpt-negative': { input: -1, output: 0.02 },
		'gpt-invalid': { input: '0.01', output: 0.02 },
		'': { input: 0.01, output: 0.02 },
	});

	assert.deepStrictEqual(normalized, {
		'gpt-valid': { input: 0.01, output: 0.02 },
	});
}

async function runTests() {
	console.log('Running reliability/security tests...');

	await testBatchingBehavior();
	console.log('PASS batching behavior');

	await testQueueLimit();
	console.log('PASS queue limit');

	testRetryBackoffLogic();
	console.log('PASS retry backoff logic');

	testBaseUrlDerivation();
	console.log('PASS base URL endpoint derivation');

	await testNoDataLossOnFailure();
	console.log('PASS no data loss on failure');

	await testTrackLLMSuccessAndFailureTracking();
	console.log('PASS trackLLM success/failure');

	testMetadataSanitization();
	console.log('PASS metadata sanitization');

	testErrorDetailOptIn();
	console.log('PASS safe error details');

	testPricingValidation();
	console.log('PASS pricing validation');

	console.log('All tests passed.');
}

runTests().catch((error) => {
	console.error('Test failed:', error && error.stack ? error.stack : error);
	process.exit(1);
});
