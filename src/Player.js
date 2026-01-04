class Player {
  constructor(id) {
    this.id = id;
    this.hqs = [];
    this.satellites = [];
    this.funds = 250000000; // starting funds for game economy
    this.reputation = 50;
    this.knownEnemyHQPosition = null; // store detected enemy HQ position
    this.forecastTechTier = 0;
    this.unlockedForecastLeadsHours = [1, 3, 6];
    this.unlockedWarningHazards = ['heavyPrecip', 'highWinds'];
  }

  addHQ(hq) {
    this.hqs.push(hq);
  }

  addSatellite(satellite) {
    this.satellites.push(satellite);
  }

  getHQs() {
    return this.hqs;
  }

  getSatellites() {
    return this.satellites;
  }
}

export default Player;
