/**
 * Token usage breakdown
 */
export interface TokenUsage {
	prompt_tokens: number;
	completion_tokens: number;
	total_tokens: number;
}

/**
 * Estimated cost breakdown
 */
export interface EstimatedCost {
	inputCost: number;
	outputCost: number;
	totalCost: number;
}

/**
 * Pricing configuration for a model
 */
export interface ModelPricing {
	input: number;
	output: number;
}

/**
 * Core tracker configuration
 */
export interface TrackerConfig {
	apiKey?: string;
	baseUrl?: string;
	endpoint?: string;
	timeoutMs?: number;
	maxRetries?: number;
	baseRetryDelayMs?: number;
	maxRetryDelayMs?: number;
	retryJitterRatio?: number;
	batchInterval?: number;
	maxBatchSize?: number;
	maxQueueSize?: number;
	debug?: boolean;
	captureUser?: boolean;
	captureErrorDetails?: boolean;
	maxMetadataBytes?: number;
	allowMetadataKeys?: string[];
	pricingEndpoint?: string;
	pricingCacheTtlMs?: number;
}

/**
 * Tracked event structure
 */
export interface TrackedEvent {
	usage: TokenUsage;
	model: string;
	functionName: string;
	timestamp: string;
	latency_ms?: number | null;
	metadata?: Record<string, unknown>;
	userId?: string;
	sessionId?: string;
	estimatedCost?: EstimatedCost;
}

/**
 * Input for track() function - supports multiple signatures
 */
export interface TrackInput extends TrackerConfig {
	usage?: TokenUsage;
	model?: string;
	functionName?: string;
	metadata?: Record<string, unknown>;
	timestamp?: string | number | Date;
	latency_ms?: number;
	latencyMs?: number;
	userId?: string;
	sessionId?: string;
}

/**
 * Options for trackLLM wrapper
 */
export interface TrackLLMOptions {
	apiKey?: string;
	model?: string;
	metadata?: Record<string, unknown>;
	userId?: string;
	sessionId?: string;
}

export interface TrackResponseOptions {
	latency_ms?: number;
	userId?: string;
	sessionId?: string;
}

export interface PricingFetchOptions {
	endpoint?: string;
	apiKey?: string;
	timeoutMs?: number;
	cacheTtlMs?: number;
}

// Constants
export const DEFAULT_ENDPOINT: string;
export const DEFAULT_BASE_URL: string;
export const DEFAULT_TRACK_PATH: string;
export const DEFAULT_PRICING_PATH: string;
export const DEFAULT_TIMEOUT_MS: number;
export const DEFAULT_MAX_RETRIES: number;
export const DEFAULT_BATCH_INTERVAL_MS: number;
export const DEFAULT_MAX_BATCH_SIZE: number;
export const DEFAULT_MAX_QUEUE_SIZE: number;
export const DEFAULT_BASE_RETRY_DELAY_MS: number;
export const DEFAULT_MAX_RETRY_DELAY_MS: number;
export const DEFAULT_RETRY_JITTER_RATIO: number;
export const DEFAULT_MAX_METADATA_BYTES: number;
export const DEFAULT_CAPTURE_ERROR_DETAILS: boolean;

// Initialization
/**
 * Initialize tracker with configuration
 */
export function init(options?: TrackerConfig): TrackerConfig;

// Core tracking functions

/**
 * Track usage - supports both direct arguments and object notation
 * Overload 1: Direct arguments (legacy compatible)
 */
export function track(
	usage: TokenUsage,
	model: string,
	functionName: string,
	apiKey?: string,
	metadata?: Record<string, unknown>,
): Promise<boolean>;

/**
 * Track usage - supports both direct arguments and object notation
 * Overload 2: Object notation (recommended)
 */
export function track(input: TrackInput): Promise<boolean>;

/**
 * Track from LLM API response
 */
export function trackResponse(
	response: {
		usage?: TokenUsage;
		tokenUsage?: TokenUsage;
		tokens?: TokenUsage;
		model?: string;
	},
	functionName: string,
	apiKey?: string,
	metadata?: Record<string, unknown>,
	options?: TrackResponseOptions,
): Promise<boolean>;

/**
 * Wrap an LLM call with automatic tracking
 * Returns the original response (passthrough)
 */
export function trackLLM(
	functionName: string,
	llmCallFn: () => Promise<any>,
	options?: TrackLLMOptions,
): Promise<any>;

// Utility functions

/**
 * Flush all queued events immediately
 */
export function flush(): Promise<void>;

/**
 * Get current configuration
 */
export function getConfig(): TrackerConfig;

/**
 * Update pricing configuration
 */
export function updatePricing(pricingConfig: Record<string, ModelPricing>): void;

/**
 * Fetch pricing config from remote endpoint and cache locally.
 */
export function fetchPricingFromServer(options?: PricingFetchOptions): Promise<Record<string, ModelPricing>>;

/**
 * Get all pricing information
 */
export function getPricing(): Record<string, ModelPricing>;

/**
 * Calculate estimated cost for usage
 */
export function calculateCost(usage: TokenUsage, model: string): EstimatedCost | null;

/**
 * Get current queue size
 */
export function getQueueSize(): number;
