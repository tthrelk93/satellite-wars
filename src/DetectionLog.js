// DetectionLog: records detection events per player and tracks unread entries
export class DetectionLog {
  constructor(eventBus) {
    this.logs = {}; // { playerId: [ { type, ownerId, targetId?, position, timestamp, read }, ... ] }
    eventBus.on('DETECTION_HQ', this._handleHQ.bind(this));
    eventBus.on('AREA_REVEALED', this._handleArea.bind(this));
  }

  _handleHQ({ ownerId, enemyId, position }) {
    this.record(ownerId, {
      type: 'HQ_DETECTED',
      ownerId,
      targetId: enemyId,
      position,
      timestamp: Date.now(),
      read: false,
    });
  }

  _handleArea({ ownerId, position }) {
    this.record(ownerId, {
      type: 'AREA_REVEALED',
      ownerId,
      position,
      timestamp: Date.now(),
      read: false,
    });
  }

  /**
   * Record a detection event for a player.
   * @param {string} playerId
   * @param {object} event
   */
  record(playerId, event) {
    if (!this.logs[playerId]) {
      this.logs[playerId] = [];
    }
    this.logs[playerId].push(event);
  }

  /**
   * Get unread events for a player.
   * @param {string} playerId
   * @returns {Array}
   */
  unread(playerId) {
    const all = this.logs[playerId] || [];
    return all.filter(e => !e.read);
  }

  /**
   * Mark all events as read for a player.
   * @param {string} playerId
   */
  markRead(playerId) {
    const all = this.logs[playerId] || [];
    all.forEach(e => { e.read = true; });
  }
}
