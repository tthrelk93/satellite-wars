// ActionRegistry: defines available player actions, their costs, preconditions, and execution

// Suggested constants; adjust as needed
const STRIKE_TRAVEL_TIME_MS = 90_000;
const STRIKE_DAMAGE = 50;
const STRIKE_COST = 20_000_000;
const AP_COST = {
  LAUNCH_SAT: 4,
  GROUND_STRIKE: 5,
};

export class ActionRegistry {
  /**
   * @param {object} deps
   * @param {object} deps.eventBus - EventBus instance
   * @param {object} deps.turnManager - TurnManager instance
   * @param {object} deps.players - Map of playerId to Player instance
   */
  constructor({ eventBus, turnManager, players }) {
    this.eventBus = eventBus;
    this.turnManager = turnManager;
    this.players = players;
  }

  /**
   * Check whether an action can be performed by the given player.
   * @param {string} actionType
   * @param {string} playerId
   * @returns {boolean}
   */
  canPerform(actionType, playerId) {
    const action = this._actions()[actionType];
    if (!action) return false;
    if (this.turnManager.currentPlayerId !== playerId) return false;
    if (this.turnManager.ap < action.apCost) return false;
    const player = this.players[playerId];
    if (player.funds < action.moneyCost) return false;
    return action.preconditions(playerId);
  }

  /**
   * Perform an action if preconditions and costs are met.
   * @param {string} actionType
   * @param {string} playerId
   * @param {object} payload - Additional data for the action
   * @returns {boolean} True if action was started, false otherwise
   */
  perform(actionType, playerId, payload = {}) {
    if (!this.canPerform(actionType, playerId)) {
      return false;
    }
    const action = this._actions()[actionType];
    // Deduct AP and funds
    this.turnManager.spendAP(action.apCost);
    const player = this.players[playerId];
    player.funds -= action.moneyCost;
    // Execute action
    action.perform(playerId, payload);
    this.eventBus.emit('ACTION_PERFORMED', { actionType, playerId, payload });
    return true;
  }

  /**
   * Define the available actions and their logic.
   */
  _actions() {
    return {
      LAUNCH_SAT: {
        apCost: AP_COST.LAUNCH_SAT,
        moneyCost: 0,
        preconditions: () => true,
        perform: (playerId, { launchFn, launchArgs }) => {
          if (typeof launchFn === 'function') {
            launchFn(...(launchArgs || []));
          }
        },
      },
      GROUND_STRIKE: {
        apCost: AP_COST.GROUND_STRIKE,
        moneyCost: STRIKE_COST,
        preconditions: () => true,
        perform: (attackerId, { targetHQ }) => {
          setTimeout(() => {
            targetHQ.applyDamage(STRIKE_DAMAGE);
            this.eventBus.emit('ACTION_STRIKE_RESOLVED', {
              attackerId,
              targetId: targetHQ.id,
              remainingHp: targetHQ.hp,
            });
            if (targetHQ.hp <= 0) {
              this.eventBus.emit('VICTORY', { winner: attackerId });
            }
          }, STRIKE_TRAVEL_TIME_MS);
        },
      },
    };
  }
}
