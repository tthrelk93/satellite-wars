class SimClock {
  constructor({ startTimeSeconds = 0, simSpeed = 3600, paused = false } = {}) {
    this.simTimeSeconds = startTimeSeconds;
    this.simSpeed = Math.max(0, simSpeed);
    this.paused = Boolean(paused);
  }

  tick(realDtSeconds) {
    if (this.paused) return;
    if (!Number.isFinite(realDtSeconds) || realDtSeconds <= 0) return;
    this.simTimeSeconds += realDtSeconds * this.simSpeed;
  }

  setSpeed(simSpeed) {
    if (!Number.isFinite(simSpeed)) return;
    this.simSpeed = Math.max(0, simSpeed);
  }

  setPaused(paused) {
    this.paused = Boolean(paused);
  }

  stepSeconds(deltaSeconds) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds === 0) return;
    this.simTimeSeconds += deltaSeconds;
  }

  getDayFraction() {
    const daySeconds = 86400;
    const wrapped = ((this.simTimeSeconds % daySeconds) + daySeconds) % daySeconds;
    return wrapped / daySeconds;
  }
}

export default SimClock;
