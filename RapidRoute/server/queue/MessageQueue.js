/**
 * Message Queue — In-memory EventEmitter-based pub/sub simulating a production message broker.
 *
 * In production this would be replaced with RabbitMQ or Apache Kafka.
 * Implements: publish/subscribe, dead letter queue with exponential backoff retry (3 retries: 1s, 2s, 4s).
 */

const EventEmitter = require('events');

class MessageQueue {
  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100);

    this.stats = {
      published: 0,
      consumed: 0,
      deadLettered: 0,
      pendingByTopic: {},
    };

    // Topics that can be published/subscribed to
    this.topics = [
      'booking.confirmed',
      'seat.hold.expired',
      'payment.processed',
      'search.performed',
    ];

    // Initialize topic stats
    this.topics.forEach((topic) => {
      this.stats.pendingByTopic[topic] = 0;
    });

    console.log('[MessageQueue] Initialized with topics:', this.topics.join(', '));
  }

  /**
   * Publish a message to a topic.
   * @param {string} topic - The topic to publish to
   * @param {object} message - The message payload
   */
  publish(topic, message) {
    if (!this.topics.includes(topic)) {
      console.warn(`[MessageQueue] Attempted to publish to unknown topic: ${topic}`);
      return;
    }

    const msg = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      topic,
      data: message,
      timestamp: new Date().toISOString(),
      retryCount: 0,
    };

    this.stats.published++;
    this.stats.pendingByTopic[topic] = (this.stats.pendingByTopic[topic] || 0) + 1;

    console.log(`[MessageQueue] Published ${topic} for ${JSON.stringify(message).slice(0, 100)}`);

    this.emitter.emit(topic, msg);
  }

  /**
   * Subscribe to a topic with a handler.
   * Handlers receive the message object and can throw to trigger retry/dead-letter.
   * @param {string} topic - The topic to subscribe to
   * @param {function} handler - Async handler(message)
   */
  subscribe(topic, handler) {
    if (!this.topics.includes(topic)) {
      console.warn(`[MessageQueue] Attempted to subscribe to unknown topic: ${topic}`);
      return;
    }

    console.log(`[MessageQueue] Subscribed to topic: ${topic}`);

    this.emitter.on(topic, async (msg) => {
      try {
        await handler(msg);
        this.stats.consumed++;
        this.stats.pendingByTopic[topic] = Math.max(0, (this.stats.pendingByTopic[topic] || 0) - 1);
      } catch (error) {
        msg.retryCount++;

        if (msg.retryCount <= 3) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, msg.retryCount - 1) * 1000;
          console.log(
            `[MessageQueue] Retrying ${topic} (attempt ${msg.retryCount}/3) after ${delay}ms delay: ${error.message}`
          );

          setTimeout(() => {
            this.emitter.emit(topic, msg);
          }, delay);
        } else {
          // Dead letter queue — message failed after 3 retries
          this.stats.deadLettered++;
          this.stats.pendingByTopic[topic] = Math.max(0, (this.stats.pendingByTopic[topic] || 0) - 1);
          console.log(
            `[MessageQueue] Dead-lettered message after 3 retries: ${topic} — ${error.message}`
          );
        }
      }
    });
  }

  /**
   * Get queue statistics.
   */
  getStats() {
    return {
      published: this.stats.published,
      consumed: this.stats.consumed,
      deadLettered: this.stats.deadLettered,
      pendingByTopic: { ...this.stats.pendingByTopic },
    };
  }
}

// Singleton instance
const messageQueue = new MessageQueue();

module.exports = messageQueue;
