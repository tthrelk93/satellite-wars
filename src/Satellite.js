import * as THREE from 'three';
import {
  COMM_RANGE_KM,
  HQ_RANGE_KM_COMM,
  HQ_RANGE_KM_CLOUDWATCH,
  HQ_RANGE_KM_IMAGING,
  SPACE_LOS_EPS,
  GROUND_LOS_EPS
} from './constants';

/**
 * Returns true if the segment from start->end passes through the sphere (excluding endpoints).
 * Sphere centered at origin with radius = sphereRadius.
 */
function segmentOccludedBySphere(start, end, sphereRadius, epsilon = 1e-3) {
  const d = new THREE.Vector3().subVectors(end, start);
  const f = start.clone();
  const a = d.dot(d);
  const b = 2 * f.dot(d);
  const c = f.dot(f) - sphereRadius * sphereRadius;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return false;
  const sqrtDisc = Math.sqrt(disc);
  const t1 = (-b - sqrtDisc) / (2 * a);
  const t2 = (-b + sqrtDisc) / (2 * a);
  return (t1 > epsilon && t1 < 1 - epsilon) || (t2 > epsilon && t2 < 1 - epsilon);
}

class Satellite {
  constructor(id, ownerId, type, orbit, earth, fov, eventBus) {
    this.id = id;
    this.ownerId = ownerId;
    this.type = type;
    this.orbit = orbit;
    this.earth = earth;
    this.fov = fov;
    this.eventBus = eventBus;
    this.color = this.getColorByType(type);
    this.coneEnabled = true;
    this.cloudFootprintRadiusKm = this.type === 'cloudWatch'
      ? this.computeCloudFootprintRadiusKm()
      : 0;
    this.mesh = this.createMesh();
    this.viewCone = this.createViewCone();
    this.sarFootprintRadiusKm = this.type === 'sar' ? this.revealRadius : 0;
    this.highlightMesh = this.createHighlightMesh();
    if (this.highlightMesh) {
      this.mesh.add(this.highlightMesh);
      this.highlightMesh.visible = false;
    }
    this.lastLoggedAngle = null;
    this.lastLogTime = 0;
    this.inHqRange = false;
    this.storedFogPath = [];
    this.commLines = [];
    this.neighbors = new Set(); // Initialize neighbors for graph representation
    this.DEBUG = true;
    this._lastHQDetect = new Map(); // hqId -> timestamp
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
      case 'cloudWatch':
        return 0x55c6ff; // Cyan-blue
      case 'sar':
        return 0x7dd89a; // Green
      default:
        return 0xffffff; // White for unknown types
    }
  }

  computeCloudFootprintRadiusKm() {
    const earthRadius = this.earth?.earthRadiusKm ?? 6371;
    const r = this.orbit?.radius ?? earthRadius;
    if (!(r > earthRadius)) return 0;
    const psi = Math.acos(Math.min(1, earthRadius / r));
    const horizonKm = earthRadius * psi;
    const altitudeKm = r - earthRadius;
    if (altitudeKm >= 30000) {
      return horizonKm;
    }
    return Math.min(horizonKm, 1200);
  }

  createMesh() {
    const geometry = new THREE.SphereGeometry(10, 64, 64);
    const material = new THREE.MeshBasicMaterial({ color: this.color });
    return new THREE.Mesh(geometry, material);
  }

  createViewCone() {
    const earthRadius = this.earth.earthRadiusKm;
    const distanceToSurface = this.orbit.radius - earthRadius;
    let coneRadius = 1;
    if (this.type === 'cloudWatch') {
      this.cloudFootprintRadiusKm = this.computeCloudFootprintRadiusKm();
      coneRadius = Math.max(1, this.cloudFootprintRadiusKm);
    } else {
      const surfaceArea = 4 * Math.PI * Math.pow(earthRadius, 2);
      this.revealArea = (this.fov / 100000) * surfaceArea;
      this.revealRadius = Math.sqrt(this.revealArea / Math.PI);
      coneRadius = Math.max(1, this.revealRadius);
    }

    const coneGeometry = new THREE.ConeGeometry(coneRadius, distanceToSurface, 32);
    const coneMaterial = new THREE.MeshBasicMaterial({
      color: this.color,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    return new THREE.Mesh(coneGeometry, coneMaterial);
  }

  createHighlightMesh() {
    const geometry = new THREE.SphereGeometry(16, 32, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0xfff07a,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 10;
    return mesh;
  }

  setHighlighted(isOn) {
    if (this.highlightMesh) {
      this.highlightMesh.visible = Boolean(isOn);
    }
  }

  getHqRangeKm() {
    if (this.type === 'communication') return HQ_RANGE_KM_COMM;
    if (this.type === 'cloudWatch') return HQ_RANGE_KM_CLOUDWATCH;
    return HQ_RANGE_KM_IMAGING;
  }

updateOrbit(hqSpheres, playerID, satellites, deltaSimSeconds = 0) {
  const dt = Number.isFinite(deltaSimSeconds) ? Math.max(0, deltaSimSeconds) : 0;
  const { radius, speed, inclination, raan = 0 } = this.orbit;

  // advance true anomaly
  this.orbit.angle = (this.orbit.angle + speed * dt) % (2 * Math.PI);
  const nu = this.orbit.angle;

  // base circle in XZ
  let position = new THREE.Vector3(
    radius * Math.cos(nu),
    0,
    radius * Math.sin(nu)
  );

  // tilt by inclination about X, then rotate plane by RAAN about Y (Y is spin axis)
  position.applyMatrix4(new THREE.Matrix4().makeRotationX(inclination));
  position.applyMatrix4(new THREE.Matrix4().makeRotationY(raan));

  this.mesh.position.copy(position);

  // --- the rest of your method stays the same ---
  const spherical = new THREE.Spherical().setFromVector3(position);
  const latDeg = 90 - THREE.MathUtils.radToDeg(spherical.phi);
  let lonDeg = THREE.MathUtils.radToDeg(spherical.theta);
  if (lonDeg > 180) lonDeg -= 360;
  this.latitude = latDeg;
  this.longitude = lonDeg;
  this.altitude = spherical.radius - this.earth.earthRadiusKm;

  const earthRadius = this.earth.earthRadiusKm;
  const distanceToSurface = radius - earthRadius;
  const coneOffset = new THREE.Vector3(0, -distanceToSurface / 2, 0);
  coneOffset.applyQuaternion(this.viewCone.quaternion);
  this.viewCone.position.copy(this.mesh.position).add(coneOffset);

  const direction = new THREE.Vector3(0, 0, 0).sub(this.viewCone.position).normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), direction);
  this.viewCone.quaternion.copy(quaternion);

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
        // Update satellite neighbors with range + LoS
        satellites.forEach(satellite => {
            if (satellite !== this && satellite.ownerId === this.ownerId) {
                const p1 = this.mesh.position;
                const p2 = satellite.mesh.position;
                const distance = p1.distanceTo(p2);
                // sat <-> sat
                const maxRange = COMM_RANGE_KM;
                const hasLoS = !segmentOccludedBySphere(p1, p2, this.earth.earthRadiusKm, SPACE_LOS_EPS);


                if (distance <= maxRange && hasLoS) {
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

        // Update HQ neighbors with range + LoS
        hqSpheres.forEach(hq => {
            if (hq.ownerID === this.ownerId) {
                const hqWorld = new THREE.Vector3();
                hq.sphere.getWorldPosition(hqWorld);
                const distance = this.mesh.position.distanceTo(hqWorld);
                const maxRange = this.getHqRangeKm();
                const hasLoS = !segmentOccludedBySphere(hqWorld, this.mesh.position, this.earth.earthRadiusKm, GROUND_LOS_EPS);

                if (distance <= maxRange && hasLoS) {
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

      const detectedSpheres = [];
      const now = Date.now();
      hqSpheres.current.forEach(hq => {
        // Only detect enemy HQs (skip your own)
        if (hq.ownerID === this.ownerId) return;

        const spherePosition = new THREE.Vector3();
        hq.sphere.getWorldPosition(spherePosition);

        const coneBaseCenter = this.viewCone.position.clone();
        const coneTip = coneBaseCenter.clone().add(coneDirection.clone().multiplyScalar(coneHeight));

        const closest = new THREE.Line3(coneBaseCenter, coneTip)
          .closestPointToPoint(spherePosition, true, new THREE.Vector3());

        const distanceToConeAxis = closest.distanceTo(spherePosition);

      if (distanceToConeAxis <= coneRadius) {
           const last = this._lastHQDetect.get(hq.id) || 0;
           if (now - last < 5000) return;        // 5s throttle per HQ per sat
           this._lastHQDetect.set(hq.id, now);
          // Emit detection event for enemy HQ with hqId included
          if (this.eventBus) {
            this.eventBus.emit('DETECTION_HQ', {
              ownerId: this.ownerId,      // detecting player
              enemyId: hq.ownerID,        // defender
              hqId: hq.id,                // which HQ was seen
              position: spherePosition.clone(),
              timestamp: Date.now(),
            });
          }
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
      if (station.sphere) {
        const gsWorld = new THREE.Vector3();
        station.sphere.getWorldPosition(gsWorld);
        const distance = this.mesh.position.distanceTo(gsWorld);
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
      if (!satellites || !hqSpheres?.current) return;

      const myHqs = hqSpheres.current.filter(hq => hq.ownerID === this.ownerId);

      // --- Fast path: direct world-space range + LoS to any friendly HQ ---
      const maxRange = this.getHqRangeKm();
      const direct = myHqs.some(hq => {
        const hqWorld = new THREE.Vector3();
        hq.sphere.getWorldPosition(hqWorld);
        const distKm = this.mesh.position.distanceTo(hqWorld);
        if (distKm > maxRange) return false;
        // LoS with a tolerant epsilon for the ground endpoint
        const clear = !segmentOccludedBySphere(
          hqWorld,
          this.mesh.position,
          this.earth.earthRadiusKm,
          GROUND_LOS_EPS
        );
        return clear;
      });

      if (direct) {
        this.inHqRange = true;
        return;
      }

      // --- Graph reachability (via comm relays) ---
      const byId = id => satellites.find(s => s.id === id) || myHqs.find(h => h.id === id);
      const hqIds = new Set(myHqs.map(h => h.id));
      const visited = new Set();
      const stack = [this.id];
      let reachable = false;

      while (stack.length) {
        const id = stack.pop();
        if (visited.has(id)) continue;
        visited.add(id);
        if (hqIds.has(id)) { reachable = true; break; }
        const node = byId(id);
        if (!node || !node.neighbors) continue;
        node.neighbors.forEach(nid => { if (!visited.has(nid)) stack.push(nid); });
      }

      this.inHqRange = reachable;
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
    const maxRange = isHQ ? this.getHqRangeKm() : COMM_RANGE_KM;
    const distance = this.mesh.position.distanceTo(position);
    return distance <= maxRange;
  }

	  render(scene) {
	      if (!scene.children.includes(this.mesh)) {
	             scene.add(this.mesh);
	         }
         if (
             (this.type === "imaging" || this.type === "cloudWatch")
             && this.viewCone
             && this.coneEnabled !== false
             && !scene.children.includes(this.viewCone)
         ) {
             this.viewCone.visible = true;
             scene.add(this.viewCone);
	         } else if (this.viewCone) {
	             this.viewCone.visible = this.coneEnabled !== false;
	         }
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
        if (this.highlightMesh) {
            this.highlightMesh.geometry.dispose();
            this.highlightMesh.material.dispose();
            this.highlightMesh = null;
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
