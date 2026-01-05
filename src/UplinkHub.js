import * as THREE from 'three';

const DEFAULT_MODULES = {
  surface: true,
  radiosonde: false,
  radar: false,
  denseSurface: false
};
const HUB_MARKER_SIZE = 140;
const HUB_MARKER_OFFSET_KM = 8;

class UplinkHub {
  constructor({ id, ownerId, latDeg, lonDeg, earth, modules, isHqHub = false }) {
    this.id = id;
    this.ownerId = ownerId;
    this.latDeg = latDeg;
    this.lonDeg = lonDeg;
    this.modules = { ...DEFAULT_MODULES, ...(modules || {}) };
    this.isOnline = false;
    this.onlineReason = '';
    this.isHqHub = Boolean(isHqHub);
    this.mesh = this._createMesh(earth);
    this.setOnline(this.isHqHub, this.isHqHub ? 'HQ hub' : 'Offline');
  }

  _createMesh(earth) {
    const geometry = new THREE.PlaneGeometry(HUB_MARKER_SIZE, HUB_MARKER_SIZE);
    const material = new THREE.MeshBasicMaterial({
      color: 0x6b7280,
      transparent: false,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 5;
    mesh.userData.uplinkHubId = this.id;
    this._positionMesh(mesh, earth);
    return mesh;
  }

  _positionMesh(mesh, earth) {
    const radius = (earth?.earthRadiusKm ?? 6371) + HUB_MARKER_OFFSET_KM;
    const latRad = THREE.MathUtils.degToRad(this.latDeg);
    const lonRad = THREE.MathUtils.degToRad(this.lonDeg);
    const cosLat = Math.cos(latRad);
    const localPos = new THREE.Vector3(
      radius * cosLat * Math.sin(lonRad),
      radius * Math.sin(latRad),
      radius * cosLat * Math.cos(lonRad)
    );
    const normal = localPos.clone().normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    mesh.position.copy(localPos);
    mesh.quaternion.copy(quat);
  }

  setOnline(isOnline, reason) {
    this.isOnline = Boolean(isOnline);
    this.onlineReason = reason || (this.isOnline ? 'Online' : 'Offline');
    const color = this.isHqHub
      ? 0x22d3ee
      : (this.isOnline ? 0x22c55e : 0x6b7280);
    if (this.mesh?.material?.color) {
      this.mesh.material.color.setHex(color);
      this.mesh.material.needsUpdate = true;
    }
  }
}

export default UplinkHub;
