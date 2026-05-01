# AI Usage Tracker

A lightweight SDK for tracking LLM API usage with local cost estimation, event batching, retry handling, and privacy-focused defaults.

> First release note: this package is intentionally small and stable around the core tracking flow. Advanced features can be added in later versions.

## Features ✨

- **📊 Local Cost Estimation** — Calculate estimated costs for API calls based on token usage
- **📦 Async Event Batching** — Queue events and send in batches for efficiency
- **🔄 Retry Logic** — Built-in exponential backoff with configurable retries
- **🐛 Debug Mode** — Optional console logging for development
- **🎯 Multiple Tracking Methods** — Support both manual and wrapped tracking
- **⚙️ Flexible Configuration** — Customize batching, pricing, timeouts, and more
- **🔐 Safe** — Never captures or accesses API keys, prompts, or responses
- **⚡ Lightweight** — Minimal overhead, async-first design
- **📝 TypeScript Support** — Fully typed interfaces

## What is tracked

Only safe telemetry is captured:

- token usage
- model name
- function or operation name
- timestamp and optional latency
- optional metadata after sanitization
- optional user/session identifiers when enabled

Prompts, responses, API keys, and other secret-looking values are filtered out.

## Installation

```bash
npm install ai-usage-tracker
```

## Requirements

- Node.js 14 or newer
- An API endpoint that accepts `POST /v1/track`
- Optional pricing endpoint at `GET /v1/pricing`

## Quick Start

### Basic Setup

```js
const tracker = require('ai-usage-tracker');

// Initialize
tracker.init({
  apiKey: process.env.AI_USAGE_TRACKER_API_KEY,
  baseUrl: 'https://api.example.com',
  debug: true,
});

// Optional: load latest model pricing from your backend
await tracker.fetchPricingFromServer();

// Track usage
await tracker.track({
  usage: {
    prompt_tokens: 100,
    completion_tokens: 50,
    total_tokens: 150,
  },
  model: 'gpt-4',
  functionName: 'myFunction',
});
```

## Configuration

Initialize the tracker with configuration options:

```js
tracker.init({
  // API Configuration
  apiKey: 'your-api-key', // or env var: AI_USAGE_TRACKER_API_KEY
  baseUrl: 'https://api.example.com', // or env var: AI_USAGE_TRACKER_BASE_URL
  // Derived automatically:
  // endpoint: 'https://api.example.com/v1/track'
  // pricingEndpoint: 'https://api.example.com/v1/pricing'
  
  // HTTP Configuration
  timeoutMs: 5000, // Request timeout in milliseconds
  maxRetries: 3, // Retry attempts on failure
  baseRetryDelayMs: 150,
  maxRetryDelayMs: 5000,
  retryJitterRatio: 0.2,
  
  // Batching Configuration
  batchInterval: 2000, // Flush batch every 2 seconds (ms)
  maxBatchSize: 20, // Or when 20 events are queued
  maxQueueSize: 1000, // Refuse new events when memory queue is full
  
  // Features
  debug: false, // Enable console logging
  captureUser: false, // Allow capturing userId field
  captureErrorDetails: false, // Do not send error messages by default
  maxMetadataBytes: 1024,
  allowMetadataKeys: null, // Optional allow-list for metadata keys
});
```

## Tracking Methods

### 1. Manual Tracking (Object Notation - Recommended)

```js
await tracker.track({
  usage: {
    prompt_tokens: 100,
    completion_tokens: 50,
    total_tokens: 150,
  },
  model: 'gpt-4',
  functionName: 'generateResponse',
  metadata: { version: '1.0' },
  userId: 'user123', // optional
  sessionId: 'session456', // optional
});
```

### 2. Manual Tracking (Direct Arguments - Legacy Compatible)

```js
await tracker.track(
  { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
  'gpt-4',
  'generateResponse',
  'api-key', // optional
  { version: '1.0' } // metadata (optional)
);
```

### 3. Track LLM Response

Extract and track usage from LLM API responses:

```js
const response = await openaiClient.chat.completions.create({...});

await tracker.trackResponse(
  response,
  'chatCompletion',
  'api-key' // optional
);
```

### 4. Wrapped Tracking (Automatic)

Wrap an LLM call to automatically extract usage and track:

```js
// Original behavior: tracked passthrough
const response = await tracker.trackLLM(
  'generateArticle',
  async () => {
    // Your LLM call here
    return await openaiClient.chat.completions.create({
      model: 'gpt-4',
      messages: [...],
    });
  }
);

// response contains the original LLM response
console.log(response.choices[0].message.content);
```

**Key benefit:** The original response is returned unchanged (passthrough), so you can drop in the wrapper without modifying your existing code.

## Cost Estimation

### Get Estimated Cost

```js
const cost = tracker.calculateCost(
  { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 },
  'gpt-4'
);

console.log(cost);
// {
//   inputCost: 0.03,
//   outputCost: 0.06,
//   totalCost: 0.09
// }
```

### Update Pricing

Update pricing for your models:

```js
tracker.updatePricing({
  'gpt-4-turbo': {
    input: 0.01,   // $ per 1K input tokens
    output: 0.03,  // $ per 1K output tokens
  },
  'custom-model': {
    input: 0.002,
    output: 0.005,
  },
});
```

### Default Pricing

Pre-configured pricing for popular models:

- OpenAI: `gpt-3.5-turbo`, `gpt-4`, `gpt-4-turbo`, `gpt-4o`
- Anthropic: `claude-2`, `claude-3-opus`, `claude-3-sonnet`, `claude-3-haiku`

Get all pricing:

```js
const pricing = tracker.getPricing();
console.log(Object.keys(pricing)); // ['gpt-3.5-turbo', 'gpt-4', ...]
```

## Event Batching

Events are automatically queued and sent in batches for efficiency:

```js
tracker.init({
  baseUrl: 'https://api.example.com',
  batchInterval: 2000,  // Flush every 2 seconds
  maxBatchSize: 20,     // Or when 20 events are queued
});

// Track multiple events (they're queued)
for (let i = 0; i < 10; i++) {
  await tracker.track({...});
}

// Check queue size
console.log(tracker.getQueueSize()); // 10

// Flush manually if needed
await tracker.flush();
```

## Debug Mode

Enable debug logging to see all tracked events:

```js
tracker.init({
  baseUrl: 'https://api.example.com',
  debug: true,
});

// Now tracks log to console:
// [AI-Usage-Tracker] generateResponse → 100+50 tokens → $0.09 (gpt-4)
```

## Advanced Usage

### Graceful Shutdown

Flush pending events on application shutdown:

```js
process.on('SIGTERM', async () => {
  console.log('Shutting down, flushing events...');
  await tracker.flush();
  process.exit(0);
});
```

### Optional Fields

All tracking methods support optional fields:

```js
await tracker.track({
  usage: {...},
  model: 'gpt-4',
  functionName: 'operation',
  
  // Optional metadata
  userId: 'user123',
  sessionId: 'session456',
  metadata: {
    department: 'engineering',
    version: '2.0',
  },
  latency_ms: 245,
  timestamp: new Date(), // defaults to now
});
```

Metadata is sanitized before sending. Sensitive key names such as API keys, tokens, authorization headers, prompts, responses, raw request/response bodies, and content fields are removed. Secret-looking string values such as bearer tokens and `sk-...` keys are redacted.

### Get Configuration

```js
const config = tracker.getConfig();
console.log(config);
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
```

## Real-World Example: OpenAI Integration

```js
const tracker = require('ai-usage-tracker');
const OpenAI = require('openai');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

tracker.init({
  apiKey: process.env.AI_USAGE_TRACKER_API_KEY,
  baseUrl: 'https://api.example.com',
  debug: true,
});

async function generateResponse(userMessage) {
  // Wrap the call for automatic tracking
  const response = await tracker.trackLLM(
    'chatCompletion',
    async () => {
      return client.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'user', content: userMessage },
        ],
      });
    }
  );

  return response.choices[0].message.content;
}

// Usage
const answer = await generateResponse('What is the weather?');
console.log(answer);

// Events are automatically batched and sent to the tracking server
```

## API Reference

### Initialization

```js
tracker.init(options?: TrackerConfig): TrackerConfig
```

### Tracking

```js
// Manual (object)
track(input: TrackInput): Promise<boolean>

// Manual (direct arguments)
track(usage, model, functionName, apiKey?, metadata?): Promise<boolean>

// From response
trackResponse(response, functionName, apiKey?, metadata?): Promise<boolean>

// Wrapped
trackLLM(functionName, llmCallFn, options?): Promise<any>
```

## Environment Variables

- `AI_USAGE_TRACKER_API_KEY` - default API key
- `AI_USAGE_TRACKER_BASE_URL` - base URL used to derive tracking and pricing endpoints
- `AI_USAGE_TRACKER_ENDPOINT` - optional full tracking endpoint override
- `AI_USAGE_TRACKER_PRICING_ENDPOINT` - optional full pricing endpoint override

### Utilities

```js
flush(): Promise<void>
getConfig(): TrackerConfig
updatePricing(pricingConfig): void
getPricing(): Record<string, ModelPricing>
calculateCost(usage, model): EstimatedCost | null
getQueueSize(): number
```

## TypeScript

Full TypeScript support with exported types:

```ts
import {
  TokenUsage,
  TrackerConfig,
  TrackInput,
  EstimatedCost,
  ModelPricing,
  track,
  init,
  flush,
} from 'ai-usage-tracker';

const config: TrackerConfig = {
  apiKey: 'key',
  debug: true,
};

const usage: TokenUsage = {
  prompt_tokens: 100,
  completion_tokens: 50,
  total_tokens: 150,
};

await track({
  usage,
  model: 'gpt-4',
  functionName: 'myFunc',
});
```

## Privacy & Security

✅ **Safe Design:**
- Never captures or accesses API keys from responses
- Never logs prompt content or response data
- Only tracks: tokens, model name, function name, timing, sanitized metadata, and optional user/session identifiers
- Optional fields are truly optional (no defaults set)
- Error messages are not sent unless `captureErrorDetails: true` is explicitly enabled

✅ **No Side Effects:**
- Non-blocking async behavior
- No request/response interception
- Minimal performance overhead

## Performance

- **Lightweight:** < 5KB bundle
- **Non-blocking:** All operations are async
- **Efficient batching:** Reduces API calls and bandwidth
- **Configurable:** Tune batch settings for your workload
- **Bounded memory:** `maxQueueSize` prevents unbounded growth if the endpoint is unavailable

## Error Handling

The tracker handles errors gracefully:

```js
const result = await tracker.track({...});

if (!result) {
  console.log('Tracking failed or the queue is full');
}

// Events are automatically retried with exponential backoff
// No exceptions thrown
```

## Folder Structure

```
src/
├── index.js          # Main entry point
├── index.d.ts        # TypeScript definitions
├── config.js         # Configuration management
├── types.js          # Type validation & utilities
├── metadata.js       # Metadata sanitization
├── pricing.js        # Cost calculation
├── debug.js          # Debug logging
├── batcher.js        # Event batching
├── transport.js      # HTTP requests with retry
└── tracker.js        # Core tracking logic
examples.js           # Usage examples
```

## License

MIT

## Support

For issues, questions, or contributions:
- GitHub: [aditya1046785/api-tracker](https://github.com/aditya1046785/api-tracker)
- Issues: [Report a bug](https://github.com/aditya1046785/api-tracker/issues)

## Release Checklist

Before publishing a new version:

- run the test suite
- verify the package tarball
- confirm the README install and examples
- check the tracking endpoint and pricing endpoint URLs
- ensure the changelog reflects the release

## TypeScript

```ts
import { init, track, TokenUsage } from 'ai-usage-tracker';

init({
	apiKey: process.env.AI_USAGE_TRACKER_API_KEY,
	baseUrl: process.env.AI_USAGE_TRACKER_BASE_URL,
});

const usage: TokenUsage = {
	prompt_tokens: 10,
	completion_tokens: 20,
	total_tokens: 30,
};

await track(usage, 'gpt-4o-mini', 'summary');
```

## Environment variables

- `AI_USAGE_TRACKER_API_KEY` - default API key
- `AI_USAGE_TRACKER_BASE_URL` - dashboard/backend base URL used to derive `/v1/track` and `/v1/pricing`
- `AI_USAGE_TRACKER_ENDPOINT` - optional full tracking endpoint override
- `AI_USAGE_TRACKER_PRICING_ENDPOINT` - optional full pricing endpoint override

## Behavior

- Requests time out after 5 seconds by default.
- Failed requests retry with exponential backoff and jitter.
- Tracking failures are silent and return `false`.
- Validation blocks invalid payloads before sending.
- Failed sends remain queued in memory for later retry while the process is alive.
- The SDK does not persist queued events to disk by default.

## Initialize once or pass a key each time

```js
const { init, track, trackResponse } = require('ai-usage-tracker');

init({
	apiKey: 'service-key',
	baseUrl: 'https://api.example.com',
});

await track(response.usage, response.model, 'chat');

await track(response.usage, response.model, 'chat', 'service-key');

await trackResponse(response, 'chat');
```

## Backend endpoint

The library does not ship with a fake default backend URL. Configure the dashboard-provided backend base URL once:

```js
tracker.init({
  apiKey: 'dashboard-api-key',
  baseUrl: 'https://api.your-service.com',
});
```

The SDK derives:

- `https://api.your-service.com/v1/track`
- `https://api.your-service.com/v1/pricing`

Advanced users can still override the full URLs with `endpoint`, `pricingEndpoint`, `AI_USAGE_TRACKER_ENDPOINT`, or `AI_USAGE_TRACKER_PRICING_ENDPOINT`.

For model pricing, call `fetchPricingFromServer()` after `init()`. The pricing request uses the same API key as the tracking endpoint.
