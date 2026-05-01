/**
 * Event batching logic
 */

const debug = require('./debug');

class EventBatcher {
	constructor(flushCallback, batchInterval, maxBatchSize, maxQueueSize) {
		this.events = [];
		this.flushCallback = flushCallback;
		this.batchInterval = batchInterval;
		this.maxBatchSize = maxBatchSize;
		this.maxQueueSize = Number.isFinite(maxQueueSize) && maxQueueSize > 0
			? Math.floor(maxQueueSize)
			: Infinity;
		this.flushTimer = null;
		this.isFlushing = false;
	}

	async add(event) {
		if (this.events.length >= this.maxQueueSize) {
			debug.log('Queue is full; dropping new tracking event.');
			return false;
		}

		this.events.push(event);

		// Flush immediately if max batch size reached
		if (this.events.length >= this.maxBatchSize) {
			this.scheduleFlush(0);
		} else if (!this.flushTimer) {
			// Schedule flush after batchInterval
			this.scheduleFlush(this.batchInterval);
		}

		return true;
	}

	scheduleFlush(delayMs) {
		if (this.flushTimer) {
			clearTimeout(this.flushTimer);
		}

		if (delayMs === 0) {
			// Flush immediately
			this.flush().catch((error) => {
				debug.logError('batcher', error);
			});
		} else {
			this.flushTimer = setTimeout(() => {
				this.flushTimer = null;
				this.flush().catch((error) => {
					debug.logError('batcher', error);
				});
			}, delayMs);

			if (typeof this.flushTimer.unref === 'function') {
				this.flushTimer.unref();
			}
		}
	}

	acknowledgeSent(count) {
		if (!Number.isFinite(count) || count <= 0) {
			return;
		}

		const safeCount = Math.min(this.events.length, Math.floor(count));
		this.events.splice(0, safeCount);
	}

	async flush() {
		if (this.isFlushing || this.events.length === 0) {
			return;
		}

		this.isFlushing = true;

		try {
			const eventsToSend = this.events.slice();
			const batchCount = Math.ceil(eventsToSend.length / this.maxBatchSize);
			let sentCount = 0;

			debug.logBatch(eventsToSend.length, batchCount);

			// Split into smaller batches and send
			for (let i = 0; i < eventsToSend.length; i += this.maxBatchSize) {
				const batch = eventsToSend.slice(i, i + this.maxBatchSize);
				let result;

				try {
					result = await this.flushCallback(batch);
				} catch (error) {
					debug.logError('batcher.flushCallback', error);
					break;
				}
				const batchAck = result && Number.isFinite(result.sentCount)
					? Math.max(0, Math.min(batch.length, Math.floor(result.sentCount)))
					: (result === true ? batch.length : 0);

				sentCount += batchAck;

				if (batchAck < batch.length) {
					// Stop on first failed/partial batch to preserve order and retry later.
					break;
				}
			}

			this.acknowledgeSent(sentCount);
		} finally {
			this.isFlushing = false;

			if (this.events.length > 0 && !this.flushTimer) {
				this.scheduleFlush(this.batchInterval);
			}
		}
	}

	async flushAll() {
		if (this.flushTimer) {
			clearTimeout(this.flushTimer);
			this.flushTimer = null;
		}
		await this.flush();
	}

	getQueueSize() {
		return this.events.length;
	}
}

module.exports = EventBatcher;
