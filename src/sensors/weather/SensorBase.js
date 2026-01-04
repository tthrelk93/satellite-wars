export class SensorBase {
  constructor({ id, cadenceSeconds, observes } = {}) {
    this.id = id;
    this.cadenceSeconds = cadenceSeconds;
    this.observes = Array.isArray(observes) ? observes : [];
    this._lastObsTime = null;
  }

  isDue(simTimeSeconds) {
    if (!Number.isFinite(simTimeSeconds)) return false;
    if (this._lastObsTime == null) return true;
    return simTimeSeconds - this._lastObsTime >= this.cadenceSeconds;
  }

  coverageFootprint() {
    return 1;
  }

  noiseModel() {
    return { bias: 0, sigmaObs: 0, kind: 'add' };
  }

  observe() {
    throw new Error('SensorBase.observe must be implemented by subclasses');
  }

  _markObserved(simTimeSeconds) {
    this._lastObsTime = simTimeSeconds;
  }
}
