class Player {
  constructor(id) {
    this.id = id;
    this.hqs = [];
    this.satellites = [];
    this.funds = 250000000; // starting funds for game economy
    this.knownEnemyHQPosition = null; // store detected enemy HQ position
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
