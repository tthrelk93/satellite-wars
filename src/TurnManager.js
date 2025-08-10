// TurnManager: handles alternating turns, action points, and turn events
/** Maximum action points per turn */
export const AP_MAX = 10;

export class TurnManager {
  /**
   * @param {EventBus} eventBus - shared event bus
   */
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.playerIds = [];
    this.currentPlayerId = null;
    this.turnNumber = 0;
    this.ap = AP_MAX;
  }

  /**
   * Begin the game by registering players and starting the first turn.
   * @param {string[]} playerIds
   */
  startGame(playerIds) {
    if (!playerIds || playerIds.length === 0) return;
    this.playerIds = playerIds;
    this.startTurn(playerIds[0]);
  }

  /**
   * Start a new turn for the specified player.
   * @param {string} playerId
   */
  startTurn(playerId) {
    this.currentPlayerId = playerId;
    this.turnNumber += 1;
    this.ap = AP_MAX;
    this.eventBus.emit('TURN_STARTED', { playerId, turnNumber: this.turnNumber });
    this.eventBus.emit('AP_CHANGED', { playerId, ap: this.ap });
  }

  /**
   * Spend action points; emits AP_CHANGED if successful.
   * @param {number} cost
   * @returns {boolean} true if spent, false if insufficient AP
   */
  spendAP(cost) {
    if (cost > this.ap) return false;
    this.ap -= cost;
    this.eventBus.emit('AP_CHANGED', { playerId: this.currentPlayerId, ap: this.ap });
    return true;
  }

  /**
   * Ends the current player's turn, triggers economy, and moves to the next player.
   */
  endTurn() {
    const prev = this.currentPlayerId;
    this.eventBus.emit('TURN_ENDED', { playerId: prev, turnNumber: this.turnNumber });
    this.eventBus.emit('ECONOMY_TICK', { playerId: prev });
    const idx = this.playerIds.indexOf(prev);
    const next = this.playerIds[(idx + 1) % this.playerIds.length];
    this.startTurn(next);
  }
}
