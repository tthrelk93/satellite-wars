import { SensorBase } from './SensorBase';

export class GroundRadarSensor extends SensorBase {
  constructor({ worldSeed = 0 } = {}) {
    super({ id: 'groundRadar', cadenceSeconds: 600, observes: ['radarDbzPpi'] });
    this.worldSeed = Number.isFinite(worldSeed) ? worldSeed : 0;
  }

  observe({ earth, simTimeSeconds }) {
    if (!earth?.renderGroundRadarObservation) return null;
    const texture = earth.renderGroundRadarObservation(simTimeSeconds);
    if (!texture) return null;
    return {
      sensorId: this.id,
      t: simTimeSeconds,
      products: {
        radarDbzPpi: {
          kind: 'texture',
          units: 'dBZ',
          data: texture
        }
      }
    };
  }
}
