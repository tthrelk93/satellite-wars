class Player {
  constructor(id) {
    this.id = id;
    this.hqs = [];
    this.satellites = [];
    this.funds = 5000000000;
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

