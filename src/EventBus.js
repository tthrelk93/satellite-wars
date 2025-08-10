// EventBus: simple pub/sub event emitter
export class EventBus {
  constructor() {
    this.subscribers = {};
  }

  /**
   * Subscribe to a topic.
   * @param {string} topic
   * @param {function(any): void} handler
   */
  on(topic, handler) {
    if (!this.subscribers[topic]) {
      this.subscribers[topic] = [];
    }
    this.subscribers[topic].push(handler);
  }

  /**
   * Unsubscribe a handler (or all handlers) from a topic.
   * @param {string} topic
   * @param {function(any): void=} handler
   */
  off(topic, handler) {
    const subs = this.subscribers[topic];
    if (!subs) return;
    if (!handler) {
      delete this.subscribers[topic];
    } else {
      this.subscribers[topic] = subs.filter(h => h !== handler);
    }
  }

  /**
   * Emit an event to all subscribers of the topic.
   * @param {string} topic
   * @param {any} payload
   */
  emit(topic, payload) {
    const subs = this.subscribers[topic];
    if (!subs) return;
    subs.forEach(handler => {
      try {
        handler(payload);
      } catch (e) {
        console.error(`Error in EventBus handler for topic '${topic}':`, e);
      }
    });
  }
}
