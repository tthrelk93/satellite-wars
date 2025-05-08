import * as THREE from 'three';

class Satellite {
  constructor(id, ownerId, type, orbit, earth, fov) {
    this.id = id;
    this.ownerId = ownerId;
    this.type = type;
    this.orbit = orbit;
    this.earth = earth;
    this.fov = fov;
    this.color = this.getColorByType(type);
    this.mesh = this.createMesh();
    this.viewCone = this.createViewCone();
    this.lastLoggedAngle = null;
    this.lastLogTime = 0;
    this.inHqRange = false;
    this.storedFogPath = [];
    this.commLines = [];
    this.neighbors = new Set(); // Initialize neighbors for graph representation
    this.DEBUG = true;

    this.latitude = null;
    this.longitude = null;
    this.altitude = null;

    const revealArea = 0;
    const revealRadius = 0;

    // Initialize trail geometry and material
    this.trailGeometry = new THREE.BufferGeometry();
    this.trailPositions = new Float32Array(10000 * 3);
    this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(this.trailPositions, 3));
    this.trailMaterial = new THREE.LineBasicMaterial({ color: this.color });
    this.trail = new THREE.Line(this.trailGeometry, this.trailMaterial);
    this.trailIndex = 0;
  }

  getColorByType(type) {
    switch (type) {
      case 'communication':
        return 0xffa500; // Orange
      case 'imaging':
        return 0xffc0cb; // Pink
      default:
        return 0xffffff; // White for unknown types
    }
  }

  createMesh() {
    const geometry = new THREE.SphereGeometry(10, 64, 64);
    const material = new THREE.MeshBasicMaterial({ color: this.color });
    return new THREE.Mesh(geometry, material);
  }

  createViewCone() {
    const earthRadius = this.earth.earthRadiusKm;
    const distanceToSurface = this.orbit.radius - earthRadius;

    const surfaceArea = 4 * Math.PI * Math.pow(earthRadius, 2);
    this.revealArea = (this.fov / 100000) * surfaceArea;
    this.revealRadius = Math.sqrt(this.revealArea / Math.PI);

    const coneGeometry = new THREE.ConeGeometry(this.revealRadius, distanceToSurface, 32);
    const coneMaterial = new THREE.MeshBasicMaterial({
      color: this.color,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    return new THREE.Mesh(coneGeometry, coneMaterial);
  }

  updateOrbit(hqSpheres, playerID, satellites) {
    const { radius, speed, angle, inclination } = this.orbit;
    this.orbit.angle = (this.orbit.angle + speed) % (2 * Math.PI);
    const phi = this.orbit.angle;
    const x = radius * Math.cos(phi);
    const z = radius * Math.sin(phi);
    const y = 0;
    let position = new THREE.Vector3(x, y, z);
    let inclinationMatrix = new THREE.Matrix4().makeRotationZ(inclination);
    position.applyMatrix4(inclinationMatrix);
    this.mesh.position.copy(position);

    // Calculate latitude, longitude, and altitude
    const spherical = new THREE.Spherical().setFromVector3(position);
    this.latitude = THREE.MathUtils.radToDeg(spherical.phi);
    this.longitude = THREE.MathUtils.radToDeg(spherical.theta);
    this.altitude = spherical.radius - this.earth.earthRadiusKm;

    const earthRadius = this.earth.earthRadiusKm;
    const distanceToSurface = radius - earthRadius;
    const coneOffset = new THREE.Vector3(0, -distanceToSurface / 2, 0);
    coneOffset.applyQuaternion(this.viewCone.quaternion);
    this.viewCone.position.copy(this.mesh.position).add(coneOffset);

    const direction = new THREE.Vector3(0, 0, 0).sub(this.viewCone.position).normalize();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), direction);
    this.viewCone.quaternion.copy(quaternion);
      
      // Update neighbors in range
          this.updateNeighbors(satellites, hqSpheres.current);

    if (this.earth) {
      this.checkInHqRange(hqSpheres, playerID, satellites);
      if (this.type === "imaging" && this.inHqRange) {
       
        this.revealFog();
        this.sendStoredFogPath();
      } else if (this.type === "imaging") {
        this.storeFogPath();
      } else {
          return [];
      }
    }

    return this.detectHQSpheres(hqSpheres, playerID);
  }
    
    updateNeighbors(satellites, hqSpheres) {
        // Update satellite neighbors
        satellites.forEach(satellite => {
            if (satellite !== this && satellite.ownerId === this.ownerId) {
                const distance = this.mesh.position.distanceTo(satellite.mesh.position);
                const maxRange = 40000; // Use the range value used in communication lines
                const isInRange = distance <= maxRange;

                if (isInRange) {
                    if (!this.neighbors.has(satellite.id)) {
                        this.addNeighbor(satellite.id);
                        satellite.addNeighbor(this.id);
                    }
                } else {
                    if (this.neighbors.has(satellite.id)) {
                        this.removeNeighbor(satellite.id);
                        satellite.removeNeighbor(this.id);
                    }
                }
            }
        });

        // Update HQ neighbors
        hqSpheres.forEach(hq => {
            if (hq.ownerID === this.ownerId) {
                const distance = this.mesh.position.distanceTo(hq.sphere.position);
                let maxRange = 40000; // Use the range value used in communication lines
                // console.log("intersectDist: ", intersectionDistance);
                 if(this.type === "communication"){
                     maxRange = 40000;
                 }
                const isInRange = distance <= maxRange;

                if (isInRange) {
                    if (!this.neighbors.has(hq.id)) {
                        this.addNeighbor(hq.id);
                        hq.addNeighbor(this.id);
                    }
                } else {
                    if (this.neighbors.has(hq.id)) {
                        this.removeNeighbor(hq.id);
                        hq.removeNeighbor(this.id);
                    }
                }
            }
        });
    }


  detectHQSpheres(hqSpheres, playerID) {
    const coneDirection = new THREE.Vector3(0, -1, 0).applyQuaternion(this.viewCone.quaternion);
    const coneHeight = this.viewCone.geometry.parameters.height;
    const earthRadius = this.earth.earthRadiusKm;
    const surfaceArea = 4 * Math.PI * Math.pow(earthRadius, 2);
    const revealArea = (this.fov / 100000) * surfaceArea;
    const coneRadius = Math.sqrt(revealArea / Math.PI);

    let detectedSpheres = [];

    hqSpheres.current.forEach(hq => {
      const spherePosition = hq.sphere.position.clone();
      const coneBaseCenter = this.viewCone.position.clone();
      const coneTip = coneBaseCenter.clone().add(coneDirection.clone().multiplyScalar(coneHeight));
      const distanceToConeAxis = new THREE.Line3(coneBaseCenter, coneTip).closestPointToPoint(spherePosition, true, new THREE.Vector3()).distanceTo(spherePosition);

      if (distanceToConeAxis <= coneRadius) {
        console.log("HQ Detected");
        detectedSpheres.push(hq.sphere);
      }
    });

    return detectedSpheres;
  }

  detectCommTargets(satellites, groundStations) {
    const targets = [];
      let maxRange = 40000; // Use the range value used in communication lines
      // console.log("intersectDist: ", intersectionDistance);
       if(this.type === "communication"){
           maxRange = 40000;
       }

    satellites.forEach(sat => {
      if (sat !== this && sat.ownerId === this.ownerId) {
        const distance = this.mesh.position.distanceTo(sat.mesh.position);
        if (distance <= maxRange) {
          targets.push(sat);
        }
      }
    });

    groundStations.forEach(station => {
      if (station.sphere.position) {
        const distance = this.mesh.position.distanceTo(station.sphere.position);
        if (distance <= maxRange) {
          targets.push(station);
        }
      } else {
        console.log("Ground station position is undefined:", station);
      }
    });

    return targets;
  }

  checkInHqRange(hqSpheres, playerID, satellites) {
    if (!satellites) {
      console.error("Satellites array is undefined");
      return;
    }
      if (!hqSpheres.current) {
        console.error("hq spheres array is undefined");
        return;
      }
    const myHqs = hqSpheres.current.filter(hq => hq.ownerID === this.ownerId);
    const commSats = satellites.filter(sat => sat.type === 'communication' && sat.ownerId === this.ownerId);
    this.inHqRange = myHqs.some(hq => this.isInRange(hq.sphere.position, true)) ||
      commSats.some(commSat => this.isInRange(commSat.mesh.position, false) && commSat.canTransmitToHQ(satellites, myHqs));
  }

  canTransmitToHQ(satellites, myHqs) {
    const visited = new Set();
    const stack = [this.id];

    while (stack.length > 0) {
      const currentId = stack.pop();
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const currentNode = satellites.find(sat => sat.id === currentId) || myHqs.find(hq => hq.id === currentId);
      if (!currentNode) continue;

      if (currentNode.type === 'HQ') return true;

      currentNode.neighbors.forEach(neighborId => {
        if (!visited.has(neighborId)) {
          stack.push(neighborId);
        }
      });
    }

    return false;
  }

  revealFog() {
    if (this.earth) {
      const rotatedPosition = this.mesh.position.clone().applyAxisAngle(new THREE.Vector3(0, -1, 0), this.earth.parentObject.rotation.y);
      this.earth.revealFog(rotatedPosition, this.fov, true, this.orbit.radius, { current: this.ownerId });
    }
  }

  storeFogPath() {
    const rotatedPosition = this.mesh.position.clone().applyAxisAngle(new THREE.Vector3(0, -1, 0), this.earth.parentObject.rotation.y);
    this.storedFogPath.push({ position: rotatedPosition, fov: this.fov });
  }

  sendStoredFogPath() {
    this.storedFogPath.forEach(path => {
      this.earth.revealFog(path.position, path.fov, false, undefined, { current: this.ownerId });
    });
    this.storedFogPath = [];
  }

  addNeighbor(id) {
    this.neighbors.add(id);
  }

  removeNeighbor(id) {
    this.neighbors.delete(id);
  }

  isInRange(position, isHQ) {
      
      let maxRange = 40000; // Use the range value used in communication lines
      // console.log("intersectDist: ", intersectionDistance);
       if(isHQ){
           maxRange = 3000;
       }
    const distance = this.mesh.position.distanceTo(position);
      
    return distance <= maxRange;
  }

  render(scene) {
      if (!scene.children.includes(this.mesh)) {
             scene.add(this.mesh);
         }
         if (this.type === "imaging" && !scene.children.includes(this.viewCone)) {
             scene.add(this.viewCone);
         }
    console.log('Satellite added to scene:', this.mesh.position);
  }
    
    dispose() {
        if (this.mesh) {
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
            this.mesh = null;
        }
        if (this.viewCone) {
            this.viewCone.geometry.dispose();
            this.viewCone.material.dispose();
            this.viewCone = null;
        }
        if (this.trail) {
            this.trail.geometry.dispose();
            this.trail.material.dispose();
            this.trail = null;
        }
        this.commLines.forEach(line => {
            line.geometry.dispose();
            line.material.dispose();
        });
        this.commLines = [];
    }

}

export default Satellite;
