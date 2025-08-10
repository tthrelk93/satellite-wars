import * as THREE from 'three';

class HQ {
  constructor(id, position, ownerID) {
    this.id = id; // identifier for this HQ
    this.type = 'HQ';
    this.hp = 100; // hit points for ground strikes
    this.sphere = this.createMesh(position);
    const spherical = new THREE.Spherical().setFromVector3(position);
    this.latitude = THREE.MathUtils.radToDeg(spherical.phi);
    this.longitude = THREE.MathUtils.radToDeg(spherical.theta);
    this.position = position;
    this.ownerID = ownerID;
    this.neighbors = new Set(); // Initialize neighbors for graph representation
  }

  /**
   * Apply damage to this HQ.
   * @param {number} amount
   * @returns {number} Remaining HP
   */
  applyDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    return this.hp;
  }

  createMesh(position) {
    const geometry = new THREE.SphereGeometry(100, 32, 32);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.setFromSpherical(new THREE.Spherical().setFromVector3(position));
    return sphere;
  }

  getPosition() {
    return this.sphere.position;
  }

  addNeighbor(id) {
    this.neighbors.add(id);
  }

  removeNeighbor(id) {
    this.neighbors.delete(id);
  }
    
    /**
     * Check if a world-space position is within range of this HQ.
     */
    isInRange(position) {
        const maxRange = 3000;
        const hqWorld = new THREE.Vector3();
        this.sphere.getWorldPosition(hqWorld);
        const distance = hqWorld.distanceTo(position);
        return distance <= maxRange;
      }

}

export default HQ;
