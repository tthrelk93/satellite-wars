import * as THREE from 'three';

class HQ {
  constructor(id, position, ownerID) {
    this.id = id; // Add an id field
    this.type = 'HQ'; // Add a type field
    this.sphere = this.createMesh(position);
    const spherical = new THREE.Spherical().setFromVector3(position);
    this.latitude = THREE.MathUtils.radToDeg(spherical.phi);
    this.longitude = THREE.MathUtils.radToDeg(spherical.theta);
    this.position = position;
    this.ownerID = ownerID;
    this.neighbors = new Set(); // Initialize neighbors for graph representation
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
    
    isInRange(position) {
        const maxRange = 3000; // Use the range value used in communication lines
        const distance = this.sphere.position.distanceTo(position);
        console.log("hqDist: ", distance);
        return distance <= maxRange;
      }

}

export default HQ;
