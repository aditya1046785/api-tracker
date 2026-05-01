/**
 * Metadata sanitization helpers.
 */

const SENSITIVE_KEY_PATTERN = /(?:api[_-]?key|authorization|auth[_-]?header|bearer|password|passphrase|secret|credential|private[_-]?key|access[_-]?token|refresh[_-]?token|id[_-]?token|session[_-]?token|prompt|response|completion|raw[_-]?request|raw[_-]?response|request[_-]?body|response[_-]?body|messages?|content)$/i;
const SECRET_VALUE_PATTERNS = [
	/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
	/\bsk-[A-Za-z0-9_-]{12,}\b/g,
	/\b[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
];

function isPlainObject(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isSensitiveKey(key) {
	return typeof key === 'string' && SENSITIVE_KEY_PATTERN.test(key.trim());
}

function toAllowKeySet(allowMetadataKeys) {
	if (!Array.isArray(allowMetadataKeys) || allowMetadataKeys.length === 0) {
		return null;
	}

	const set = new Set();
	for (const key of allowMetadataKeys) {
		if (typeof key === 'string' && key.trim()) {
			set.add(key.trim());
		}
	}

	return set.size > 0 ? set : null;
}

function stripSensitiveKeys(input, options = {}) {
	if (!isPlainObject(input)) {
		return {};
	}

	const allowSet = toAllowKeySet(options.allowMetadataKeys);
	const output = {};

	for (const [key, value] of Object.entries(input)) {
		if (isSensitiveKey(key)) {
			continue;
		}

		if (allowSet && !allowSet.has(key)) {
			continue;
		}

		if (typeof value === 'function' || typeof value === 'undefined') {
			continue;
		}

		output[key] = sanitizeValue(value);
	}

	return output;
}

function sanitizeValue(value) {
	if (typeof value === 'function' || typeof value === 'undefined') {
		return undefined;
	}

	if (Array.isArray(value)) {
		const sanitized = value
			.map((item) => sanitizeValue(item))
			.filter((item) => typeof item !== 'undefined');

		return sanitized;
	}

	if (isPlainObject(value)) {
		const nested = {};

		for (const [nestedKey, nestedValue] of Object.entries(value)) {
			if (isSensitiveKey(nestedKey)) {
				continue;
			}

			const sanitizedNestedValue = sanitizeValue(nestedValue);
			if (typeof sanitizedNestedValue !== 'undefined') {
				nested[nestedKey] = sanitizedNestedValue;
			}
		}

		return nested;
	}

	if (typeof value === 'string') {
		return redactString(value);
	}

	return value;
}

function redactString(value) {
	let redacted = value;

	for (const pattern of SECRET_VALUE_PATTERNS) {
		redacted = redacted.replace(pattern, '[REDACTED]');
	}

	return redacted;
}

function sanitizeError(error, options = {}) {
	const output = {
		errorName: error && error.name ? String(error.name) : 'Error',
	};

	if (error && (typeof error.code === 'string' || typeof error.code === 'number')) {
		output.errorCode = String(error.code);
	}

	if (error && Number.isFinite(error.status)) {
		output.errorStatus = error.status;
	} else if (error && Number.isFinite(error.statusCode)) {
		output.errorStatus = error.statusCode;
	}

	if (options.captureErrorDetails && error && error.message) {
		output.errorDetail = redactString(String(error.message));
	}

	return output;
}

function truncateMetadataToBytes(metadata, maxBytes) {
	if (!isPlainObject(metadata)) {
		return {};
	}

	if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
		return {};
	}

	const entries = Object.entries(metadata);
	const truncated = {};

	for (const [key, value] of entries) {
		const candidate = { ...truncated, [key]: value };
		let serialized;

		try {
			serialized = JSON.stringify(candidate);
		} catch (_error) {
			continue;
		}

		if (Buffer.byteLength(serialized, 'utf8') <= maxBytes) {
			truncated[key] = value;
		}
	}

	return truncated;
}

function sanitizeMetadata(metadata, options = {}) {
	const stripped = stripSensitiveKeys(metadata, options);
	const maxBytes = Number.isFinite(options.maxMetadataBytes)
		? options.maxMetadataBytes
		: 1024;

	return truncateMetadataToBytes(stripped, maxBytes);
}

module.exports = {
	sanitizeMetadata,
	sanitizeError,
	isSensitiveKey,
	stripSensitiveKeys,
	truncateMetadataToBytes,
};
