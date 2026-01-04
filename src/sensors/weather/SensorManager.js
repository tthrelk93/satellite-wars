export class SensorManager {
  constructor({ onNewObservation } = {}) {
    this.sensors = [];
    this.latestBySensorId = new Map();
    this.onNewObservation = typeof onNewObservation === 'function' ? onNewObservation : null;
  }

  addSensor(sensor) {
    if (!sensor) return;
    this.sensors.push(sensor);
  }

  update({ truthCore, earth, simTimeSeconds }) {
    if (!Number.isFinite(simTimeSeconds)) return;
    this.sensors.forEach((sensor) => {
      if (!sensor?.isDue?.(simTimeSeconds)) return;
      const obsSet = sensor.observe({ truthCore, earth, simTimeSeconds });
      if (!obsSet) return;
      this.latestBySensorId.set(sensor.id, obsSet);
      if (typeof sensor._markObserved === 'function') {
        sensor._markObserved(simTimeSeconds);
      } else {
        sensor._lastObsTime = simTimeSeconds;
      }
      if (this.onNewObservation) {
        this.onNewObservation(obsSet);
      }
    });
  }

  getLatest(sensorId) {
    return this.latestBySensorId.get(sensorId) ?? null;
  }

  getAllLatest() {
    return Array.from(this.latestBySensorId.values());
  }
}
