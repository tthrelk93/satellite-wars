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
   * @param {object} [payload] - optional per-call data (e.g., moneyCost override)
   * @returns {boolean}
   */
  canPerform(actionType, playerId, payload = {}) {
    const action = this._actions()[actionType];
    if (!action) return false;

    // Must be the active player and have enough AP
    if (this.turnManager.currentPlayerId !== playerId) return false;
    if (this.turnManager.ap < action.apCost) return false;

    // Funds: allow per-call override (e.g., computed launch cost)
    const player = this.players[playerId];
    const moneyCost = (payload.moneyCost !== undefined) ? payload.moneyCost : action.moneyCost;
    if (player.funds < moneyCost) return false;

    // Pass payload into preconditions in case they need context
    return action.preconditions(playerId, payload);
  }


  /**
   * Perform an action if preconditions and costs are met.
   * @param {string} actionType
   * @param {string} playerId
   * @param {object} payload - Additional data for the action
   * @returns {boolean} True if action was started, false otherwise
   */
  perform(actionType, playerId, payload = {}) {
    const action = this._actions()[actionType];
    if (!action) return false;

    // Gate by turn/AP/funds using the same dynamic money cost
    if (!this.canPerform(actionType, playerId, payload)) return false;

    // Deduct AP and funds
    this.turnManager.spendAP(action.apCost);
    const player = this.players[playerId];
    const moneyCost = (payload.moneyCost !== undefined) ? payload.moneyCost : action.moneyCost;
    player.funds -= moneyCost;

    // Execute the action
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
