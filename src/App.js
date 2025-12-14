import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import Satellite from './Satellite';
import Earth from './Earth';
import HQ from './HQ';
import Player from './Player';
import { UPKEEP_PER_SAT, INCOME_PER_COMM_IN_LINK, INCOME_PER_IMAGING_IN_LINK, BASE_INCOME_PER_TURN, MU_EARTH, RE_M, OMEGA_EARTH, LOSSES_MPS, DV_REF_MPS, DV_EXPONENT, COMM_RANGE_KM, HQ_RANGE_KM, SPACE_LOS_EPS, GROUND_LOS_EPS } from './constants';

import { EventBus } from './EventBus';
import { TurnManager, AP_MAX } from './TurnManager';
import { DetectionLog } from './DetectionLog';
import { ActionRegistry } from './ActionRegistry';

import {
    Button,
    IconButton,
    MenuItem,
    Select,
    TextField,
    Slider,
    FormControl,
    InputLabel,
    Box,
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';

const App = () => {
    const mountRef = useRef(null);
    const [gameMode, setGameMode] = useState(null); // 'solo' or 'pvp'
    const [showMenu, setShowMenu] = useState(false);
    const [showSatPanel, setShowSatPanel] = useState(false);
    const orbitPreviewRef = useRef(null); // Green orbit preview line
    const orbitHandlesRef = useRef([]);   // Draggable preview handle meshes
    const orbitArrowsRef = useRef([]); // little direction arrows
    const orbitPickMeshRef = useRef(null); // Invisible torus pick helper
    const orbitDragRef = useRef({ active: false, lastX: 0 }); // Drag state
    const previewRAANRef = useRef(null);  // Current preview RAAN (rad), set by solver or drag
    const [satelliteType, setSatelliteType] = useState('communication');
    const [altitude, setAltitude] = useState('705'); // Set default altitude
    const [speed, setSpeed] = useState('21078'); // Set default speed
    const [fieldOfView, setFieldOfView] = useState(7.95); // Set slider to max value
    const [angle, setAngle] = useState('0'); // Set default angle
    const [inclination, setInclination] = useState('11'); // Set default inclination
    const [satellites, setSatellites] = useState([]);
    const satellitesRef = useRef([]); // Use ref to keep track of satellites
    const showHQSphereRef = useRef(false);
    const hqSphereRef = useRef(null);
    const hqSpheresRef = useRef([]); // Manage HQ spheres in App.js

    const [players, setPlayers] = useState([]);
    const currentPlayerRef = useRef(null);
    // Reference for minimap (fog-of-war overlay)
    const miniRef = useRef(null);

    const sceneRef = useRef(null);
    const earthRef = useRef(null);
    const cameraRef = useRef(null);
    const rendererRef = useRef(null);
    const controlsRef = useRef(null);
    const orbitHoveringRef = useRef(false); // true while pointer over orbit gizmo
    // Live mirrors for state that global listeners read
    const showSatPanelRef = useRef(false);
    const altitudeRef = useRef(altitude);
    const inclinationRef = useRef(inclination);
    const previewNormalRef = useRef(null); // plane normal n (always ⟂ to HQ vector t)


    const [launchCost, setLaunchCost] = useState(0);

    // Core game system instances
    const eventBusRef = useRef(null);
    const turnManagerRef = useRef(null);
    const detectionLogRef = useRef(null);
    const actionRegistryRef = useRef(null);

    // UI state for turn and action points
    const [activePlayerId, setActivePlayerId] = useState(null);
    const [currentTurn, setCurrentTurn] = useState(0);
    const [actionPoints, setActionPoints] = useState(AP_MAX);

    const [showStrikePad, setShowStrikePad] = useState(false);

    // Enemy intel & warnings
    const knownEnemyHQsRef = useRef({});          // { [playerId]: Set<enemyPlayerId> }
    const compromisedHQIdsRef = useRef(new Set()); // Set<hqId> flagged as detected
    const pendingWarningsRef = useRef({});        // { [playerId]: true } => toast next turn
    const [selectedTargetHQ, setSelectedTargetHQ] = useState(null);

// --- Toasts (player-facing warnings/info) ---
    const [toasts, setToasts] = useState([]);
    const notify = (severity, message, ttl = 4500) => {
        const id = Date.now() + Math.random();
        setToasts(t => [...t, { id, severity, message, ttl }]);
        // auto-remove after ttl
        setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), ttl + 200);
    };
    // Initialize the scene, camera, renderer, controls, and lights
    useEffect(() => {
        if (!gameMode) return;

        // Reset shared refs/state when switching modes
        satellitesRef.current = [];
        hqSpheresRef.current = [];
        knownEnemyHQsRef.current = {};
        compromisedHQIdsRef.current = new Set();
        pendingWarningsRef.current = {};
        setSatellites([]);
        setPlayers([]);
        setToasts([]);
        setActivePlayerId(null);
        setCurrentTurn(0);
        setActionPoints(AP_MAX);
        setShowMenu(false);
        setShowSatPanel(false);
        setShowStrikePad(false);
        showHQSphereRef.current = false;

        // Core systems setup
        const eventBus = new EventBus();
        const turnManager = new TurnManager(eventBus);
        const detectionLog = new DetectionLog(eventBus);
        const playersMap = {};
        const actionRegistry = new ActionRegistry({ eventBus, turnManager, players: playersMap });
        eventBusRef.current = eventBus;
        turnManagerRef.current = turnManager;
        detectionLogRef.current = detectionLog;
        actionRegistryRef.current = actionRegistry;

        // Initialize players based on mode
        const playersList = [new Player('player1')];
        if (gameMode === 'pvp') {
            playersList.push(new Player('player2'));
        }
        setPlayers(playersList);
        playersList.forEach(p => {
            playersMap[p.id] = p;
            knownEnemyHQsRef.current[p.id] = new Set();
            pendingWarningsRef.current[p.id] = false;
        });

        // Subscribe to turn and AP events for UI updates
        eventBus.on('TURN_STARTED', ({ playerId, turnNumber }) => {
            setActivePlayerId(playerId);
            setCurrentTurn(turnNumber);
            if (pendingWarningsRef.current[playerId]) {
                notify('warning', `The enemy has located your HQ!`);
                pendingWarningsRef.current[playerId] = false;
            }
        });
        eventBus.on('AP_CHANGED', ({ playerId, ap }) => {
            setActionPoints(ap);
        });

        // Economy tick: apply income and upkeep after a turn ends
        eventBus.on('ECONOMY_TICK', ({ playerId }) => {
            const player = playersMap[playerId];
            if (!player) return;
            const sats = player.getSatellites();
            const inLink = sats.filter(sat => sat.inHqRange);
            const imagingCount = inLink.filter(sat => sat.type === 'imaging').length;
            const commCount = inLink.filter(sat => sat.type === 'communication').length;
            const totalCount = sats.length;
            const income = BASE_INCOME_PER_TURN + imagingCount * INCOME_PER_IMAGING_IN_LINK + commCount * INCOME_PER_COMM_IN_LINK;
            const upkeep = totalCount * UPKEEP_PER_SAT;
            player.funds += income - upkeep;
        });

        // Enemy HQ detection -> reveal to attacker; warn defender
        eventBus.on('DETECTION_HQ', ({ ownerId, enemyId, hqId, position }) => {
            // mark intel for attacker (if enemy exists in this mode)
            if (knownEnemyHQsRef.current[ownerId]) {
                knownEnemyHQsRef.current[ownerId].add(enemyId);
            }
            if (hqId) compromisedHQIdsRef.current.add(hqId);
            if (pendingWarningsRef.current[enemyId] !== undefined) {
                pendingWarningsRef.current[enemyId] = true;
            }

            // attacker toast (only if currently viewing the attacker)
            const latDeg = THREE.MathUtils.radToDeg(Math.asin(position.clone().normalize().y)).toFixed(1);
            if (currentPlayerRef.current?.id === ownerId) {
                notify('success', `You detected an enemy HQ (≈lat ${latDeg}°). You can ground‑strike when you have enough AP & comms.`);
            }
            // If attacker is the active view, immediately reveal
            if (currentPlayerRef.current?.id === ownerId) renderPlayerObjects();
        });

        // Handle ground strike resolution and victory
        eventBus.on('ACTION_STRIKE_RESOLVED', ({ attackerId, targetId, remainingHp }) => {
            notify('info', `Ground strike resolved on ${targetId} by ${attackerId} — remaining HP: ${remainingHp}`);
        });
        eventBus.on('VICTORY', ({ winner }) => {
            notify('success', `Game over — winner: ${winner}`);
            // TODO: disable inputs and show victory UI
        });

        const scene = new THREE.Scene();
        sceneRef.current = scene;
        const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.7, 100000);
        camera.position.set(0, 0, 20000); // Set camera far enough to view the entire Earth
        cameraRef.current = camera;
        const renderer = new THREE.WebGLRenderer();
        renderer.setSize(window.innerWidth, window.innerHeight);
        rendererRef.current = renderer;
        const mountNode = mountRef.current;
        if (mountNode) {
            mountNode.appendChild(renderer.domElement);
        }

        // Handle WebGL context lost and restore
        renderer.domElement.addEventListener('webglcontextlost', (event) => {
            event.preventDefault();
            notify('error', 'WebGL context lost. If graphics freeze, try reloading or reducing load.');
        }, false);

        renderer.domElement.addEventListener('webglcontextrestored', () => {
            notify('info', 'WebGL context restored.');
            // Reinitialize the scene or handle the context restoration as needed
        }, false);

        // Create Earth
        const earth = new Earth(camera, playersList);
        earth.render(scene);
        earthRef.current = earth;

        // Sync view and objects on turn start (after Earth exists)
        eventBus.on('TURN_STARTED', ({ playerId }) => {
            currentPlayerRef.current = playersMap[playerId];
            earthRef.current.setCurrentPlayer(playerId);
            renderPlayerObjects();
            // Reset orbit preview to this player's HQ
            previewNormalRef.current = null;
            previewRAANRef.current = null;
            if (showSatPanelRef.current) updateOrbitPreview();
        });
        // Now that Earth is ready, start the turn cycle, emitting initial TURN_STARTED
        turnManager.startGame(playersList.map(p => p.id));


        // Set up camera and orbit controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enablePan = true;
        controlsRef.current = controls;
        // Let canvas own pointer gestures for our gizmo drags
        renderer.domElement.style.touchAction = 'none';

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404040);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 3, 5);
        scene.add(directionalLight);

        // Add AxesHelper to the scene
        const axesHelper = new THREE.AxesHelper(80);
        scene.add(axesHelper);

        // Input listeners (capture phase to override OrbitControls when needed)
        const onPointerDownCapture = (e) => {
            if (tryStartOrbitDrag(e)) {
                e.preventDefault();
                e.stopPropagation();
            }
        };
        renderer.domElement.addEventListener('pointermove', handlePointerMoveCapture, { capture: true, passive: false });
        renderer.domElement.addEventListener('pointerdown', onPointerDownCapture,      { capture: true, passive: false });
        renderer.domElement.addEventListener('pointerup',   handlePointerUpCapture,     { capture: true });
        window.addEventListener('pointerup', handlePointerUpCapture, true);

        renderer.domElement.addEventListener('pointermove', handleMouseMove); // <— NEW, ensures drag updates fire

        // Handle window resize
        const handleResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener('resize', handleResize);

        window.addEventListener('mousedown', handleMouseClick);


        // Initial player objects rendering is handled via TURN_STARTED event
        // renderPlayerObjects();

        // Cleanup on component unmount
        return () => {
            window.removeEventListener('resize', handleResize);
            renderer.domElement.removeEventListener('pointermove', handlePointerMoveCapture, true);
            renderer.domElement.removeEventListener('pointerdown', onPointerDownCapture, true);
            renderer.domElement.removeEventListener('pointerup', handlePointerUpCapture, true);
            window.removeEventListener('pointerup', handlePointerUpCapture, true);
            renderer.domElement.removeEventListener('pointermove', handleMouseMove);
            window.removeEventListener('mousedown', handleMouseClick);
            if (rendererRef.current) rendererRef.current.dispose();
            if (sceneRef.current) {
                sceneRef.current.children.forEach(child => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                    sceneRef.current.remove(child);
                });
            }
            if (mountNode && renderer.domElement.parentNode === mountNode) {
                mountNode.removeChild(renderer.domElement);
            }
        };
    }, [gameMode]);

    // Orbit preview helpers
    const removeOrbitPreview = () => {
        const scene = sceneRef.current;
        if (!scene) return;

        if (orbitPreviewRef.current) {
            scene.remove(orbitPreviewRef.current);
            orbitPreviewRef.current.geometry?.dispose?.();
            orbitPreviewRef.current.material?.dispose?.();
            orbitPreviewRef.current = null;
        }

        if (orbitHandlesRef.current.length) {
            orbitHandlesRef.current.forEach(h => {
                scene.remove(h);
                h.geometry?.dispose?.();
                h.material?.dispose?.();
            });
            orbitHandlesRef.current = [];
        }

        if (orbitArrowsRef.current.length) {
            orbitArrowsRef.current.forEach(a => {
                scene.remove(a);
                a.geometry?.dispose?.();
                a.material?.dispose?.();
            });
            orbitArrowsRef.current = [];
        }

        if (orbitPickMeshRef.current) {
            scene.remove(orbitPickMeshRef.current);
            orbitPickMeshRef.current.geometry?.dispose?.();
            orbitPickMeshRef.current.material?.dispose?.();
            orbitPickMeshRef.current = null;
        }
    };

    function getMainHQ() {
        const me = currentPlayerRef.current;
        if (!me) return null;
        const list = (me.getHQs?.() || []);
        if (list.length) return list[0];
        // Fallback: find by ownership in the scene registry
        return hqSpheresRef.current.find(h => h.ownerID === me.id) || null;
    }

    function getHQUnitVector() {
        const hq = getMainHQ();
        if (!hq) return null;
        const hqWorld = new THREE.Vector3();
        hq.sphere.getWorldPosition(hqWorld);
        return hqWorld.normalize();
    }

    function solveRAANForInc(incRad, t) {
        const i = incRad;
        const lat = Math.asin(t.y);
        const sinI = Math.sin(i);
        const cosI = Math.cos(i);
        const EPS = 1e-8;

        let solved = false;
        let best = { err: Number.POSITIVE_INFINITY, raan: 0, nu: 0 };

        if (Math.abs(sinI) < 1e-6) {
            if (Math.abs(lat) <= 1e-3) {
                const Rx = new THREE.Matrix4().makeRotationX(i);
                const lon = Math.atan2(t.z, t.x);
                const Ry = new THREE.Matrix4().makeRotationY(lon);
                const a = new THREE.Vector3(1, 0, 0).applyMatrix4(Rx).applyMatrix4(Ry);
                const b = new THREE.Vector3(0, 0, 1).applyMatrix4(Rx).applyMatrix4(Ry);
                const nu = Math.atan2(t.clone().dot(b), t.clone().dot(a));
                const p = a.clone().multiplyScalar(Math.cos(nu)).add(b.clone().multiplyScalar(Math.sin(nu)));
                const err = p.angleTo(t);
                best = { err, raan: lon, nu };
                solved = true;
            }
        }

        if (!solved) {
            const A = t.x;
            const B = t.z;
            const M = Math.hypot(A, B);
            const lon = Math.atan2(t.z, t.x);
            if (M < EPS) {
                if (Math.abs(cosI) < 1e-6) {
                    const Omega = -lon;
                    const Rx = new THREE.Matrix4().makeRotationX(i);
                    const Ry = new THREE.Matrix4().makeRotationY(Omega);
                    const a = new THREE.Vector3(1, 0, 0).applyMatrix4(Rx).applyMatrix4(Ry);
                    const b = new THREE.Vector3(0, 0, 1).applyMatrix4(Rx).applyMatrix4(Ry);
                    const nu = Math.atan2(t.clone().dot(b), t.clone().dot(a));
                    const p = a.clone().multiplyScalar(Math.cos(nu)).add(b.clone().multiplyScalar(Math.sin(nu)));
                    const err = p.angleTo(t);
                    best = { err, raan: Omega, nu };
                    solved = true;
                }
            } else {
                const C = - (cosI / Math.max(sinI, EPS)) * t.y; // -cot(i)*t.y
                const ratio = C / M;
                if (ratio >= -1 - 1e-9 && ratio <= 1 + 1e-9) {
                    const clamp = Math.max(-1, Math.min(1, ratio));
                    const psi = Math.atan2(A, B);
                    const delta = Math.acos(clamp);
                    const candidates = [psi + delta, psi - delta];
                    const Rx = new THREE.Matrix4().makeRotationX(i);
                    for (const Omega of candidates) {
                        const Ry = new THREE.Matrix4().makeRotationY(Omega);
                        const a = new THREE.Vector3(1, 0, 0).applyMatrix4(Rx).applyMatrix4(Ry);
                        const b = new THREE.Vector3(0, 0, 1).applyMatrix4(Rx).applyMatrix4(Ry);
                        const nu = Math.atan2(t.clone().dot(b), t.clone().dot(a));
                        const p = a.clone().multiplyScalar(Math.cos(nu)).add(b.clone().multiplyScalar(Math.sin(nu)));
                        const err = p.angleTo(t);
                        if (err < best.err) best = { err, raan: Omega, nu };
                    }
                    solved = true;
                }
            }
        }
        return { solved, raan: best.raan, nu: best.nu };
    }

    function solveIncForRAAN(raan, t) {
        const A = t.x;
        const B = t.z;
        const denom = A * Math.sin(raan) + B * Math.cos(raan);
        if (Math.abs(denom) < 1e-8) return Math.PI / 2;
        const i = Math.atan(-t.y / denom);
        const iAbs = Math.abs(i);
        return Math.max(0, Math.min(Math.PI / 2, iAbs));
    }

    const updateOrbitPreview = () => {
        const scene = sceneRef.current;
        const earth = earthRef.current;
        if (!scene || !earth) return;

        // Remove any existing preview bits
        removeOrbitPreview();

        // Need an HQ to preview a launchable orbit
        const hq = getMainHQ();
        if (!hq) return;

        // t = unit vector from Earth center to HQ (world space)
        const t = new THREE.Vector3();
        hq.sphere.getWorldPosition(t);
        t.normalize();

        // n = plane normal, keep n·t = 0 (orbit plane must contain HQ)
        let n = previewNormalRef.current;
        if (!n) {
            const ref = Math.abs(t.x) < 0.8 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
            n = t.clone().cross(ref).normalize(); // any perpendicular to t
        } else {
            // sanitize: force exact perpendicular to t
            n = n.clone().sub(t.clone().multiplyScalar(n.dot(t))).normalize();
        }
        // Keep prograde by convention
        if (n.y < 0) n.multiplyScalar(-1);

        // --- Elements derived from the plane normal (with snapping to reachable band) ---
        const lat = Math.asin(t.y); // site latitude (rad)

        // raw inclination from current normal
        let incRad = Math.acos(THREE.MathUtils.clamp(n.y, -1, 1));

        // clamp to physically reachable **prograde** band: i ∈ [|φ|, 90°]
        const incClamped = Math.max(Math.abs(lat), Math.min(incRad, Math.PI / 2));

        // If we had to clamp, rotate the plane normal n so the preview matches
        if (Math.abs(incClamped - incRad) > 1e-6) {
            const y = new THREE.Vector3(0, 1, 0);

            // u = projection of +Y onto plane ⟂ t  (direction that controls n.y)
            let u = y.clone().sub(t.clone().multiplyScalar(y.dot(t)));
            const ulen = u.length();
            if (ulen < 1e-6) {
                // At the pole: use X projected instead
                u = new THREE.Vector3(1, 0, 0).sub(t.clone().multiplyScalar(t.x)).normalize();
            } else {
                u.multiplyScalar(1 / ulen);
            }

            // v completes an orthonormal basis in the plane (t, u, v are mutually ⟂)
            const v = t.clone().cross(u).normalize();

            // Preserve around-t orientation (sign of the v component)
            const signV = Math.sign(n.dot(v)) || 1;

            // Choose γ so that n'.y = cos(incClamped); since v.y = 0, only u contributes to y
            const uy   = Math.abs(u.y);
            const cosG = uy < 1e-6 ? 0 : THREE.MathUtils.clamp(Math.cos(incClamped) / uy, -1, 1);
            const sinG = signV * Math.sqrt(Math.max(0, 1 - cosG * cosG));

            // New plane normal snapped to the band, still ⟂ t
            n = u.multiplyScalar(cosG).add(v.multiplyScalar(sinG)).normalize();
            incRad = incClamped;
        } else {
            incRad = incClamped;
        }

        // Update readouts derived from the (possibly adjusted) normal
        const raan   = Math.atan2(n.x, n.z);
        const newDeg = THREE.MathUtils.radToDeg(incRad).toFixed(2);
        if (Math.abs(parseFloat(inclination) - parseFloat(newDeg)) > 0.05) {
            setInclination(newDeg);
        }
        previewRAANRef.current   = raan;
        previewNormalRef.current = n;

        // Build ring in the plane using basis (a = t, b = n×a)
        const earthRadiusKm = earth.earthRadiusKm;
        const altKm = parseFloat(altitude || '0');
        const radius = Math.max(earthRadiusKm + altKm, earthRadiusKm + 10);

        const a = t.clone(); // passes through HQ at θ=0
        const b = n.clone().cross(a).normalize(); // forward direction at θ=0

        // Green orbit ring
        const segments = 512;
        const pts = [];
        for (let s = 0; s <= segments; s++) {
            const theta = (s / segments) * Math.PI * 2;
            const p = a.clone().multiplyScalar(Math.cos(theta))
                .add(b.clone().multiplyScalar(Math.sin(theta)))
                .multiplyScalar(radius);
            pts.push(p);
        }
        const geom = new THREE.BufferGeometry().setFromPoints(pts);
        const mat  = new THREE.LineBasicMaterial({ color: 0x00ff00 });
        const ringLine = new THREE.Line(geom, mat);
        scene.add(ringLine);
        orbitPreviewRef.current = ringLine;

        // Create 4 draggable node handles at 0°, 90°, 180°, 270° along the ring
        const nodeAngles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
        // --- Handles (smaller) ---
          const handleMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
          const handleR = Math.max(radius * 0.007, 60);   // smaller handles

        nodeAngles.forEach(theta => {
            const p = a.clone().multiplyScalar(Math.cos(theta))
                      .add(b.clone().multiplyScalar(Math.sin(theta)))
                  .multiplyScalar(radius);

            const m = new THREE.Mesh(new THREE.SphereGeometry(handleR, 16, 16), handleMaterial);
            m.position.copy(p);
            m.userData.kind = 'orbitHandle';
            scene.add(m);
            orbitHandlesRef.current.push(m);
        });

// --- Pick torus (thinner so it looks lighter but still easy to grab) ---
        const torusTube = Math.max(radius * 0.004, 40); // was 0.01, 80
        const torusGeo = new THREE.TorusGeometry(radius, torusTube, 12, 128);
        const torusMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.0 });
        const torus = new THREE.Mesh(torusGeo, torusMat);
// orient to plane: Y-axis → -n (same as your basis)
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n.clone().negate());
        torus.quaternion.copy(q);
        torus.material.depthWrite = false;
        torus.material.colorWrite = false;
        scene.add(torus);
        orbitPickMeshRef.current = torus;

// --- Direction arrows (smaller cones) ---
        const arrowCount = 10;
        const arrowH = Math.max(radius * 0.02, 220);  // height (smaller)
        const arrowR = Math.max(radius * 0.006, 60);  // base radius (smaller)
        const arrowMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });

        for (let i = 0; i < arrowCount; i++) {
            const theta = (i / arrowCount) * Math.PI * 2;
            // point on ring
            const p = a.clone().multiplyScalar(Math.cos(theta))
                .add(b.clone().multiplyScalar(Math.sin(theta))).multiplyScalar(radius);

            // tangent = direction of motion (prograde): n × (r̂)
            const tangent = n.clone().cross(p.clone().normalize()).normalize();

            const cone = new THREE.Mesh(new THREE.ConeGeometry(arrowR, arrowH, 10), arrowMat);
            // Cone model points +Y; rotate so +Y aligns with tangent
            cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);

            // place cone slightly “ahead” of the ring so it’s visible
            cone.position.copy(p).add(tangent.clone().multiplyScalar(arrowH * 0.35));

            scene.add(cone);
            orbitArrowsRef.current.push(cone);
        }

        // Invisible pick surface (thin ring) so clicking the ring starts a drag
        const pickWidth = Math.max(radius * 0.012, 150);
        const pick = new THREE.Mesh(
            new THREE.RingGeometry(radius - pickWidth, radius + pickWidth, 96),
            new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.0, side: THREE.DoubleSide })
        );
        // Default RingGeometry faces +Z; rotate +Z → n
        pick.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
        scene.add(pick);
        orbitPickMeshRef.current = pick;
    };


    // ---- Orbit gizmo hit test (handles first, then pick ring) ----
    function hitOrbitGizmo(event) {
        if (!showSatPanelRef.current) return null;
        const scene = sceneRef.current;
        if (!scene || (!orbitHandlesRef.current.length && !orbitPickMeshRef.current)) return null;

        const mouse = new THREE.Vector2(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, cameraRef.current);

        if (orbitHandlesRef.current.length) {
            const hit = raycaster.intersectObjects(orbitHandlesRef.current, false);
            if (hit.length) return hit[0];
        }
        if (orbitPickMeshRef.current) {
            const hit = raycaster.intersectObject(orbitPickMeshRef.current, false);
            if (hit.length) return hit[0];
        }
        return null;
    }

    // Capture-phase pointermove: toggle OrbitControls when hovering the gizmo
    function handlePointerMoveCapture(e) {
        if (!rendererRef.current) return;
        const hit = hitOrbitGizmo(e);
        const hovering = !!hit;
        orbitHoveringRef.current = hovering;

        const controls = controlsRef.current;
        const block = hovering || orbitDragRef.current.active;
        if (controls) {
            controls.enabled = !block;
            controls.enableRotate = !block;
            controls.enablePan = !block;
            controls.enableZoom = !block;
        }

        const dom = rendererRef.current.domElement;
        if (orbitDragRef.current.active) dom.style.cursor = 'grabbing';
        else if (hovering) dom.style.cursor = 'grab';
        else dom.style.cursor = '';
    }

    // Start orbit drag if the gizmo is hit (capture-phase on pointerdown)
    function tryStartOrbitDrag(event) {
        if (!showSatPanelRef.current) return false;
        const hit = hitOrbitGizmo(event);
        if (!hit) return false;

        event.preventDefault?.();
        event.stopPropagation?.();

        // Compute baseline yaw around Y at the orbit preview radius
        const mouse = new THREE.Vector2(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight) * 2 + 1
        );
        const ray = new THREE.Raycaster();
        ray.setFromCamera(mouse, cameraRef.current);
        const cam = cameraRef.current;
        const origin = cam.position.clone();
        const dir = ray.ray.direction.clone();

        const earth = earthRef.current;
        const altKm = parseFloat(altitudeRef.current || '0');
        const radius = Math.max(earth.earthRadiusKm + altKm, earth.earthRadiusKm + 10);

        // Intersect ray with sphere of radius `radius`
        const A = dir.dot(dir);
        const B = 2 * origin.dot(dir);
        const C = origin.dot(origin) - radius * radius;
        const disc = B * B - 4 * A * C;
        if (disc < 0) return false;
        const sqrtDisc = Math.sqrt(disc);
        const t1 = (-B - sqrtDisc) / (2 * A);
        const t2 = (-B + sqrtDisc) / (2 * A);
        const tHit = t1 > 0 ? t1 : t2;
        if (tHit <= 0) return false;

        const hitPos = origin.clone().add(dir.multiplyScalar(tHit));
        const yaw = Math.atan2(hitPos.z, hitPos.x);

        orbitDragRef.current.active = true;
        orbitDragRef.current.startYaw = yaw;
        orbitDragRef.current.startRAAN = (previewRAANRef.current ?? 0);
        orbitDragRef.current.radius = radius;

        const controls = controlsRef.current;
        if (controls) {
            controls.enabled = false;
            controls.enableRotate = false;
            controls.enablePan = false;
            controls.enableZoom = false;
        }

        const el = rendererRef.current?.domElement;
        if (el && el.setPointerCapture && event.pointerId != null) {
            try { el.setPointerCapture(event.pointerId); } catch (_) {}
        }
        if (el) el.style.cursor = 'grabbing';

        if (previewRAANRef.current == null) previewRAANRef.current = 0;
        return true;
    }

    // End drag, restore controls and cursor
    function handlePointerUpCapture() {
        orbitDragRef.current.active = false;
        orbitHoveringRef.current = false;
        const controls = controlsRef.current;
        if (controls) {
            controls.enabled = true;
            controls.enableRotate = true;
            controls.enablePan = true;
            controls.enableZoom = true;
        }
        const el = rendererRef.current?.domElement;
        if (el) el.style.cursor = '';
    }

    // Collapse all UI panels + clean up any editor/ghost state
    function collapsePanels() {
        // hide panels
        setShowSatPanel(false);
        setShowStrikePad(false);

        // stop orbit preview / drag
        orbitDragRef.current.active = false;
        removeOrbitPreview();

        // remove HQ placement ghost
        showHQSphereRef.current = false;
        if (hqSphereRef.current) {
            sceneRef.current?.remove(hqSphereRef.current);
            hqSphereRef.current = null;
        }

        // restore camera controls & cursor
        const controls = controlsRef.current;
        if (controls) {
            controls.enabled = true;
            controls.enableRotate = true;
            controls.enablePan = true;
            controls.enableZoom = true;
        }
        const el = rendererRef.current?.domElement;
        if (el) el.style.cursor = '';
    }


    useEffect(() => { showSatPanelRef.current = showSatPanel; }, [showSatPanel]);
    useEffect(() => { altitudeRef.current = altitude; }, [altitude]);
    useEffect(() => { inclinationRef.current = inclination; }, [inclination]);

    // When the Sat panel opens, default inclination to 90° (polar) and show preview.
    useEffect(() => {
        if (showSatPanel) {
            setInclination('90');
        } else {
            removeOrbitPreview();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showSatPanel]);

    // Keep orbit preview synced with panel tweaks while open
    useEffect(() => {
        if (showSatPanel) updateOrbitPreview();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showSatPanel, altitude, speed, angle, inclination]);

    useEffect(() => {
        if (currentPlayerRef.current && currentPlayerRef.current.getHQs().length > 0) {
            const curPlayerMainHQ = currentPlayerRef.current.getHQs()[0];
            const kmToMeters = 1000;
            const hoursToSeconds = 3600;
            const degreesToRadians = Math.PI / 180;
            const earthRadiusKm = 6371; // Earth's radius in kilometers

            // Convert the speed from km/h to radians per second
            const orbitalSpeedKmPerH = parseFloat(speed);
            const orbitalSpeedMPerS = (orbitalSpeedKmPerH * kmToMeters) / hoursToSeconds;
            const orbitRadiusMeters = (parseFloat(altitude) + earthRadiusKm) * kmToMeters; // Altitude + Earth's radius in meters
            const orbitalCircumference = 2 * Math.PI * orbitRadiusMeters;
            const speedInRadiansPerSecond = orbitalSpeedMPerS / orbitalCircumference;

            const orbit = {
                radius: orbitRadiusMeters / kmToMeters, // Convert back to kilometers
                speed: speedInRadiansPerSecond, // Speed in radians per second
                angle: THREE.MathUtils.degToRad(parseFloat(angle)), // Convert degrees to radians
                inclination: THREE.MathUtils.degToRad(parseFloat(inclination)), // Convert degrees to radians
            };

            const cost = calculateLaunchCost(satelliteType, curPlayerMainHQ.latitude, orbit);
            setLaunchCost(cost);
        }
    }, [satelliteType, altitude, speed, angle, inclination]);

    // Minimap overlay: continuously draw fog-of-war canvas from Earth
    useEffect(() => {
        let frameId;
        const drawMini = () => {
            const mini = miniRef.current;
            const earth = earthRef.current;
            if (mini && earth && earth.canvas) {
                const ctx = mini.getContext('2d');
                ctx.clearRect(0, 0, mini.width, mini.height);
                ctx.drawImage(earth.canvas, 0, 0, mini.width, mini.height);
            }
            frameId = requestAnimationFrame(drawMini);
        };
        drawMini();
        return () => cancelAnimationFrame(frameId);
    }, []);


    const slerp = (start, end, t) => {
        const omega = Math.acos(start.dot(end));
        const sinOmega = Math.sin(omega);

        const scale0 = Math.sin((1 - t) * omega) / sinOmega;
        const scale1 = Math.sin(t * omega) / sinOmega;

        const result = new THREE.Vector3().addVectors(
            start.clone().multiplyScalar(scale0),
            end.clone().multiplyScalar(scale1)
        );

        return result;
    };

    // Keep comm-lines & FoW perfectly in sync:
// - For IMAGING sats: draw the BFS path to any friendly HQ (if reachable).
// - For COMM sats: draw simple neighbor edges (network view).
    const handleCommSatDetections = () => {
        if (!currentPlayerRef.current) return;

        const mySats = satellitesRef.current.filter(
            s => s.ownerId === currentPlayerRef.current.id
        );

        mySats.forEach(sat => {
            drawCommLines(sat); // we compute everything from the neighbor graph
        });
    };

    const drawCommLines = (sat /*, targets (unused) */) => {
        // Clear existing lines
        sat.commLines.forEach(line => {
            if (sceneRef.current) sceneRef.current.remove(line);
            if (line.geometry) line.geometry.dispose();
            if (line.material) line.material.dispose();
        });
        sat.commLines = [];

        const scene = sceneRef.current;
        if (!scene) return;

        // Helper: resolve an ID to a node (Satellite or HQ)
        const byId = (id) =>
            satellitesRef.current.find(s => s.id === id) ||
            hqSpheresRef.current.find(h => h.id === id);

        // ---- IMAGING: draw the actual path to HQ (if any) ----
        if (sat.type === 'imaging') {
            const myHqs = hqSpheresRef.current.filter(h => h.ownerID === sat.ownerId);
            if (myHqs.length === 0) return;

            const hqIds = new Set(myHqs.map(h => h.id));

            // BFS over the same neighbor graph maintained in Satellite.updateNeighbors
            const prev = new Map();      // childId -> parentId (for path reconstruction)
            const visited = new Set([sat.id]);
            const queue = [sat.id];
            let foundHq = null;

            while (queue.length) {
                const id = queue.shift();
                if (hqIds.has(id)) { foundHq = id; break; }
                const node = byId(id);
                if (!node || !node.neighbors) continue;
                node.neighbors.forEach(nid => {
                    if (!visited.has(nid)) {
                        visited.add(nid);
                        prev.set(nid, id);
                        queue.push(nid);
                    }
                });
            }

            // Not reachable => no path => no lines
            if (!foundHq) return;

            // Reconstruct path sat -> ... -> HQ
            const pathIds = [];
            for (let at = foundHq; at !== undefined; at = prev.get(at)) {
                pathIds.push(at);
                if (at === sat.id) break;
            }
            pathIds.reverse();

            // Draw segments along the path
            for (let i = 0; i < pathIds.length - 1; i++) {
                const a = byId(pathIds[i]);
                const b = byId(pathIds[i + 1]);
                if (!a || !b) continue;

                const aPos = a.sphere ? a.sphere.getWorldPosition(new THREE.Vector3()) : a.mesh.position.clone();
                const bPos = b.sphere ? b.sphere.getWorldPosition(new THREE.Vector3()) : b.mesh.position.clone();


                const geometry = new THREE.BufferGeometry().setFromPoints([aPos, bPos]);
                const material = new THREE.LineBasicMaterial({ color: 0xff00ff });
                const line = new THREE.Line(geometry, material);
                scene.add(line);
                sat.commLines.push(line);
            }

            return; // imaging handled fully
        }

        // ---- COMM: draw neighbor edges (network view) ----
        const targets = Array.from(sat.neighbors)
            .map(id => byId(id))
            .filter(Boolean);

        targets.forEach(target => {
            const startPos = sat.mesh.position.clone();
            const endPos = target.type === 'HQ'
                ? target.sphere.getWorldPosition(new THREE.Vector3())
                : target.mesh.position.clone();

            const geometry = new THREE.BufferGeometry().setFromPoints([startPos, endPos]);
            const material = new THREE.LineBasicMaterial({ color: 0xff00ff });
            const line = new THREE.Line(geometry, material);
            scene.add(line);
            sat.commLines.push(line);
        });
    };

    // Animation loop
    useEffect(() => {
        const animate = () => {
            if (!rendererRef.current) return;
            requestAnimationFrame(animate);

            // Update Earth
            if (earthRef.current) {
                earthRef.current.update();
            }

            let detectedSpheres = [];
            satellitesRef.current.forEach(satellite => { // Update all satellites, regardless of player
                const detections = satellite.updateOrbit(hqSpheresRef, currentPlayerRef, satellitesRef.current); // Pass the current HQ spheres
                detectedSpheres = detectedSpheres.concat(detections);
            });


            // Handle sphere detections
//      handleSphereDetections(detectedSpheres);
            handleCommSatDetections();

            if (sceneRef.current && cameraRef.current) {
                rendererRef.current.render(sceneRef.current, cameraRef.current);
            }
        };

        animate();
    }, [satellites, gameMode]);

    function handleMouseMove(event) {
        // --- Orbit preview drag: rotate plane normal around HQ vector t ---
        if (orbitDragRef.current.active && showSatPanelRef.current) {
            if (!earthRef.current) return;

            const mouse = new THREE.Vector2(
                (event.clientX / window.innerWidth) * 2 - 1,
                -(event.clientY / window.innerHeight) * 2 + 1
            );
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, cameraRef.current);

            const cam = cameraRef.current;
            const origin = cam.position.clone();
            const dir = raycaster.ray.direction.clone();

            const r = orbitDragRef.current.radius ||
                (earthRef.current.earthRadiusKm + parseFloat(altitudeRef.current || '0'));

            // Intersect ray with sphere of radius r
            const A = dir.dot(dir);
            const B = 2 * origin.dot(dir);
            const C = origin.dot(origin) - r * r;
            const disc = B * B - 4 * A * C;
            if (disc > 0) {
                const sqrtDisc = Math.sqrt(disc);
                const t1 = (-B - sqrtDisc) / (2 * A);
                const t2 = (-B + sqrtDisc) / (2 * A);
                const tHit = t1 > 0 ? t1 : t2;
                if (tHit > 0) {
                    const hit = origin.clone().add(dir.clone().multiplyScalar(tHit)).normalize();

                    const hq = getMainHQ();
                    if (hq) {
                        const t = new THREE.Vector3();
                        hq.sphere.getWorldPosition(t);
                        t.normalize();

                        // Tangent direction at HQ: project hit onto plane ⟂ t
                        let d = hit.clone().sub(t.clone().multiplyScalar(hit.dot(t)));
                        const len = d.length();
                        if (len > 1e-6) {
                            d.multiplyScalar(1 / len);
                            // New plane normal n = t × d  (guarantees n·t = 0)
                            let n = t.clone().cross(d).normalize();
                            if (n.y < 0) n.multiplyScalar(-1); // prograde

                            previewNormalRef.current = n;

                            // Update UI inclination readout
                            const incRad = Math.acos(THREE.MathUtils.clamp(n.y, -1, 1));
                            const newDeg = THREE.MathUtils.radToDeg(incRad).toFixed(2);
                            if (Math.abs(parseFloat(inclinationRef.current) - parseFloat(newDeg)) > 0.05) {
                                setInclination(newDeg);
                            }

                            updateOrbitPreview();
                        }
                    }
                    return; // while dragging, ignore HQ ghost updates
                }
            }
            return;
        }

        // --- HQ placement ghost follow (unchanged) ---
        if (!showHQSphereRef.current || !hqSphereRef.current || !earthRef.current?.mesh) return;

        const mouse = new THREE.Vector2(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight) * 2 + 1
        );

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, cameraRef.current);

        const intersects = raycaster.intersectObject(earthRef.current.mesh);
        if (intersects.length > 0) {
            const intersectPoint = intersects[0].point;
            hqSphereRef.current.position.copy(intersectPoint);
        } else {
            const vector = new THREE.Vector3(mouse.x, mouse.y, 0.5).unproject(cameraRef.current);
            vector.sub(cameraRef.current.position).normalize();
            const distance = -cameraRef.current.position.z / vector.z;
            const pos = cameraRef.current.position.clone().add(vector.multiplyScalar(distance));
            hqSphereRef.current.position.copy(pos);
        }
    }





    const handleHQButtonClick = (event) => {
        // close other panels and orbit preview
        setShowSatPanel(false);
        setShowStrikePad(false);
        removeOrbitPreview();

        const newShowHQSphere = !showHQSphereRef.current;
        showHQSphereRef.current = newShowHQSphere;

        if (newShowHQSphere) {
            const sphereGeometry = new THREE.SphereGeometry(100, 32, 32);
            const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
            const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);

            const mouse = new THREE.Vector2(
                (event.clientX / window.innerWidth) * 2 - 1,
                -(event.clientY / window.innerHeight) * 2 + 1
            );
            const vector = new THREE.Vector3(mouse.x, mouse.y, 0.5).unproject(cameraRef.current);
            vector.sub(cameraRef.current.position).normalize();
            const distance = -cameraRef.current.position.z / vector.z;
            const pos = cameraRef.current.position.clone().add(vector.multiplyScalar(distance));

            sphere.position.copy(pos);
            sceneRef.current.add(sphere);
            hqSphereRef.current = sphere;
        } else {
            if (hqSphereRef.current) {
                sceneRef.current.remove(hqSphereRef.current);
                hqSphereRef.current = null;
            }
        }
    };

    const handleAddSatellite = () => {
        if (!earthRef.current || !actionRegistryRef.current || !currentPlayerRef.current) return;

        const kmToMeters = 1000;
        const hoursToSeconds = 3600;
        const earthRadiusKm = 6371;

        // 1) Orbit numbers from UI (unchanged math)
        const orbitalSpeedKmPerH   = parseFloat(speed);
        const orbitalSpeedMPerS    = (orbitalSpeedKmPerH * kmToMeters) / hoursToSeconds;
        const orbitRadiusMeters    = (parseFloat(altitude) + earthRadiusKm) * kmToMeters;
        const orbitalCircumference = 2 * Math.PI * orbitRadiusMeters;
        const speedInRadPerSec     = orbitalSpeedMPerS / orbitalCircumference;

        const orbit = {
            radius: orbitRadiusMeters / kmToMeters,                         // km
            speed:  speedInRadPerSec,                                       // rad/s
            angle:  0,                                                      // true anomaly ν (solved below)
            inclination: THREE.MathUtils.degToRad(parseFloat(inclination)), // rad
            raan:   0                                                       // Ω (solved below)
        };
        const player = currentPlayerRef.current;

        // Need an HQ to launch from
        if (player.getHQs().length === 0) {
            notify('warning', 'No HQ placed yet — cannot launch.');
            return;
        }
        const mainHQ = player.getHQs()[0];

        // 3) Choose plane from preview normal if available; else fall back to solver
        const hqWorld = new THREE.Vector3();
        mainHQ.sphere.getWorldPosition(hqWorld);
        const t = hqWorld.clone().normalize();

        if (previewNormalRef.current) {
            // Desired plane normal from the widget (prograde by convention)
            let n = previewNormalRef.current.clone().normalize();
            if (n.y < 0) n.multiplyScalar(-1);

            // IMPORTANT: your Satellite basis uses a = Rx(i)→Ry(Ω)·X, b = Rx(i)→Ry(Ω)·Z.
            // Its plane normal is a×b = -[Ry(Ω)·Rx(i)·Y]. To make that equal our preview 'n',
            // we pick (i, Ω) that rotate +Y to -n:
            const raanForSat = Math.atan2(-n.x, -n.z);
            const incForSat  = Math.acos(THREE.MathUtils.clamp(-n.y, -1, 1));

            // Rebuild the *same* a,b basis the Satellite will use…
            const Rx = new THREE.Matrix4().makeRotationX(incForSat);
            const Ry = new THREE.Matrix4().makeRotationY(raanForSat);
            const a  = new THREE.Vector3(1, 0, 0).applyMatrix4(Rx).applyMatrix4(Ry);
            const b  = new THREE.Vector3(0, 0, 1).applyMatrix4(Rx).applyMatrix4(Ry);

            // …and solve ν so the satellite starts *exactly over the HQ*
            const nu = Math.atan2(t.dot(b), t.dot(a));

            // Commit elements
            orbit.inclination = incForSat;
            orbit.raan        = raanForSat;
            orbit.angle       = nu;   // ← guarantees start-over-HQ

        } else {
            // Fallback: previous Ω↔i solver (unchanged)
            let raan = previewRAANRef.current;
            if (raan == null) {
                let incRad = orbit.inclination;
                const lat = Math.asin(t.y);
                if (Math.abs(lat) > incRad + 1e-6) incRad = Math.abs(lat);
                const sol = solveRAANForInc(incRad, t);
                if (!sol.solved) {
                    notify('warning', 'Launch aborted: no valid orbital alignment found for this HQ and inclination.');
                    return;
                }
                orbit.inclination = incRad;
                orbit.raan = sol.raan;
                orbit.angle = sol.nu;
            } else {
                const incRad = solveIncForRAAN(raan, t);
                orbit.inclination = incRad;
                const Rx = new THREE.Matrix4().makeRotationX(incRad);
                const Ry = new THREE.Matrix4().makeRotationY(raan);
                const a  = new THREE.Vector3(1,0,0).applyMatrix4(Rx).applyMatrix4(Ry);
                const b  = new THREE.Vector3(0,0,1).applyMatrix4(Rx).applyMatrix4(Ry);
                const nu = Math.atan2(t.dot(b), t.dot(a));
                orbit.raan  = raan;
                orbit.angle = nu;
            }
        }

        // 4) Launch cost (unchanged)
        const costToLaunchFromHQ = calculateLaunchCost(satelliteType, mainHQ.latitude, orbit);

        // 5) Launch (unchanged)
        const launchFn = () => {
            const newSatellite = new Satellite(
                'sat' + Math.floor(Math.random() * 1000),
                player.id,
                satelliteType,
                orbit,
                earthRef.current,
                fieldOfView,
                eventBusRef.current
            );

            newSatellite.render(sceneRef.current);
            player.addSatellite(newSatellite);

            setSatellites(prev => {
                const updated = [...prev, newSatellite];
                satellitesRef.current = updated;
                return updated;
            });

            // Remove orbit preview once the satellite is actually launched
            removeOrbitPreview();
        };

        // 6) Gate via ActionRegistry (turn, AP, funds)
        const ok = actionRegistryRef.current.perform('LAUNCH_SAT', player.id, {
            moneyCost: Math.round(costToLaunchFromHQ),
            launchFn,
            launchArgs: []
        });

        if (!ok) {
            notify('warning', 'Launch blocked: not your turn, insufficient AP, or insufficient funds.');
        } else {
            // Ensure scene/UI state reflects the new satellite immediately
            renderPlayerObjects();
        }
    };




// Derive launch azimuth A (measured from EAST toward NORTH) from site latitude φ and orbital inclination i.
// Prograde branch only (A ∈ [0, 90°]) — consistent with your preview.
    function deriveAzimuthFromInc(siteLatDeg, incRad) {
        const phi = THREE.MathUtils.degToRad(siteLatDeg);
        const cosphi = Math.cos(phi);
        if (Math.abs(cosphi) < 1e-6) return Math.PI / 2; // at the poles, it's effectively polar
        const ratio = Math.cos(incRad) / cosphi;         // prograde
        const clamped = Math.min(1, Math.max(0, ratio)); // keep within [0,1]
        return Math.acos(clamped);
    }

// Realistic Δv-based cost (returns **dollars**)
    function calculateLaunchCost(satelliteType, siteLatDeg, orbit) {
        // Base prices per type (dollars). Tweak to fit your economy.
        const BASE = {
            imaging:       50_000_000,
            communication: 60_000_000,
        };

        const incRad = orbit?.inclination ?? 0;                  // radians
        const altKm = Math.max(0, (orbit?.radius ?? 6371) - 6371);
        const r_m   = (6371 + altKm) * 1000;                    // orbital radius (m)

        const v_c   = Math.sqrt(MU_EARTH / r_m);                // circular speed (m/s)
        const A     = deriveAzimuthFromInc(siteLatDeg, incRad); // rad, from EAST toward NORTH
        const v_rot = OMEGA_EARTH * RE_M * Math.cos(THREE.MathUtils.degToRad(siteLatDeg)); // m/s
        const boost = v_rot * Math.cos(A);                      // effective rotational help

        const deltaV = Math.max(0, v_c + LOSSES_MPS - boost);   // m/s

        const base = BASE[satelliteType] ?? 50_000_000;
        const cost = base * Math.pow(deltaV / DV_REF_MPS, DV_EXPONENT);
        return Math.round(cost); // dollars
    }

    const addNeighborsInRange = (satelliteOrHQ, neighbors) => {

        neighbors.forEach(neighbor => {
            let neighborPosition;
            if (neighbor instanceof Satellite) {
                neighborPosition = neighbor.mesh.position.clone();
            } else {
                neighborPosition = new THREE.Vector3();
                neighbor.sphere.getWorldPosition(neighborPosition);
            }

            let isHQ = false;
            if(satelliteOrHQ.type === "HQ"){
                isHQ = true;
            }
            const inRange = satelliteOrHQ.isInRange(neighborPosition, isHQ);
            if (inRange) {
                const lhs = satelliteOrHQ.type === 'HQ' ? `HQ ${satelliteOrHQ.id}` : `Sat ${satelliteOrHQ.id}`;
                const rhs = neighbor instanceof Satellite ? `Sat ${neighbor.id}` : `HQ ${neighbor.id}`;
                notify('info', `Link in range: ${lhs} ↔ ${rhs}`);
            }
            if (inRange) {
                satelliteOrHQ.addNeighbor(neighbor.id);
                neighbor.addNeighbor(satelliteOrHQ.id);
            }
        });
    };

    function handleMouseClick(event) {
        // Try orbit-handle drag first if Sat panel open
        if (tryStartOrbitDrag(event)) return;
        if (!showHQSphereRef.current) return;

        const mouse = new THREE.Vector2(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight) * 2 + 1
        );

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, cameraRef.current);

        const earth = earthRef.current;
        if (!earth?.mesh) {
            notify('error', 'Earth not ready yet.');
            return;
        }

        const intersects = raycaster.intersectObject(earth.mesh);
        if (intersects.length === 0) {
            notify('warning', 'Click the Earth surface to place an HQ.');
            return;
        }

        // Place the HQ at the clicked point on Earth
        const intersectPoint = intersects[0].point;
        const newHQ = earth.addHQSphere(intersectPoint, hqSpheresRef, currentPlayerRef);

        // Player-facing confirmation
        notify(
            'success',
            `HQ placed at lat ${newHQ.latitude.toFixed(1)}°, lon ${newHQ.longitude.toFixed(1)}°`
        );

        // Turn off placement preview + remove the draggable ghost sphere
        showHQSphereRef.current = false;
        if (hqSphereRef.current) {
            sceneRef.current.remove(hqSphereRef.current);
            hqSphereRef.current = null;
        }

        renderPlayerObjects();
    }


//    function handleSphereDetections(detections) {
//    // Reset all sphere colors to default
//    hqSpheresRef.current.forEach(hq => {
//      hq.sphere.material.color.set(0xff0000);
//      hq.sphere.material.needsUpdate = true;
//    });
//
//    // Update detected spheres to the detection color
//    detections.forEach(sphere => {
//      sphere.material.color.set(0x00ff00);
//      sphere.material.needsUpdate = true;
//    });
//  };

    function renderPlayerObjects() {
        const earth = earthRef.current;
        const scene = sceneRef.current;
        const currentPlayer = currentPlayerRef.current;
        if (!earth || !scene || !currentPlayer) return;

        // Remove all satellites/cones/lines from the scene
        satellitesRef.current.forEach(satellite => {
            scene.remove(satellite.mesh);
            if (satellite.viewCone) scene.remove(satellite.viewCone);
            satellite.commLines.forEach(line => scene.remove(line));
        });

        // Keep ALL HQs parented; visible if it's mine OR I have intel on that enemy
        hqSpheresRef.current.forEach(hq => {
            if (hq.sphere.parent !== earth.parentObject) earth.parentObject.add(hq.sphere);
            const isMine = (hq.ownerID === currentPlayer.id);
            const IKnowEnemy = knownEnemyHQsRef.current[currentPlayer.id]?.has(hq.ownerID);
            hq.sphere.visible = isMine || !!IKnowEnemy;

            // colors:
            // - my HQ: red (or yellow if compromised)
            // - known enemy HQ: cyan
            if (isMine) {
                const compromised = compromisedHQIdsRef.current.has(hq.id);
                hq.sphere.material.color.set(compromised ? 0xffff00 : 0xff0000);
            } else if (IKnowEnemy) {
                hq.sphere.material.color.set(0x00ffff);
            }
            hq.sphere.material.needsUpdate = true;
        });

        // Add only the current player's satellites back (cones for imaging only)
        currentPlayer.getSatellites().forEach(satellite => {
            scene.add(satellite.mesh);
            if (satellite.type === 'imaging' && satellite.viewCone) {
                scene.add(satellite.viewCone);
            }
            satellite.commLines.forEach(line => scene.add(line));
            // keep inHqRange updated for economy/fog
            satellite.checkInHqRange(hqSpheresRef, currentPlayerRef, satellitesRef.current);
        });

        earth.currentPlayerID = currentPlayer.id;
        earth.updateFogMapForCurrentPlayer();
    }


    const renderSatellitesPanel = () => {
        const currentPlayer = currentPlayerRef.current;

        if (!currentPlayer) {
            return null; // or some placeholder content if desired
        }

        const playerSatellites = currentPlayer.getSatellites();

        return (
            <div style={{
                position: 'absolute',
                top: '5%',
                right: '1%',
                width: '22%',
                height: '40%',
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                padding: '10px',
                overflowY: 'auto',
                zIndex: 1000
            }}>
                <TableContainer component={Paper}>
                    <Table size="small" aria-label="satellites table">
                        <TableHead>
                            <TableRow>
                                <TableCell>Sat ID</TableCell>
                                <TableCell>Owner ID</TableCell>
                                <TableCell>Lat/Lon</TableCell>
                                <TableCell>Neighbors</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {playerSatellites.map(sat => (
                                <TableRow key={sat.id}>
                                    <TableCell>{sat.id}</TableCell>
                                    <TableCell>{sat.ownerId}</TableCell>
                                    <TableCell>{`Lat: ${sat.latitude}, Lon: ${sat.longitude}`}</TableCell>
                                    <TableCell>{Array.from(sat.neighbors).join(', ')}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </div>
        );
    };



    if (!gameMode) {
        return (
            <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, background: '#0b1020', color: 'white' }}>
                <Typography variant="h4" gutterBottom>Satellite Wars</Typography>
                <Typography variant="body1" gutterBottom>Select a mode to begin:</Typography>
                <Box display="flex" gap={2}>
                    <Button variant="contained" color="primary" onClick={() => setGameMode('solo')}>Single Player</Button>
                    <Button variant="outlined" color="secondary" onClick={() => setGameMode('pvp')}>Player vs Player</Button>
                </Box>
            </div>
        );
    }

    return (
        <div>
            {/* End Turn button controlled by TurnManager */}
            <Button
                variant="contained"
                color="primary"
                onClick={() => turnManagerRef.current && turnManagerRef.current.endTurn()}
                style={{ position: 'absolute', top: 20, left: 10, zIndex: 1000 }}
            >
                End Turn
            </Button>

            <div ref={mountRef} style={{ width: '100vw', height: '100vh' }} />

            <Typography variant="h6" style={{ position: 'absolute', top: 20, right: 430, zIndex: 1000, color: 'white' }}>
                Funds: {'$'}{Math.round((currentPlayerRef.current?.funds ?? 0) / 1_000_000)}M
            </Typography>

            <Typography
                variant="h6"
                style={{ position: 'absolute', top: 20, right: 250, zIndex: 1000, color: 'white' }}>
                Turn: {currentTurn} | AP: {actionPoints}
            </Typography>

            <IconButton
                onClick={() => {
                    setShowMenu(prev => {
                        const next = !prev;
                        if (!next) collapsePanels();   // collapsing -> hide everything
                        return next;
                    });
                }}
                style={{ position: 'absolute', top: 60, left: 10, zIndex: 1100, backgroundColor: 'white' }}
            >
                {showMenu ? <RemoveIcon /> : <AddIcon />}
            </IconButton>

            {showMenu && (
                <Paper style={{ position: 'absolute', top: 110, left: 10, padding: 10, zIndex: 1000, backgroundColor: 'white' }}>
                    <Button
                        onClick={(e) => {
                            // entering HQ placement hides other panels + preview
                            setShowSatPanel(false);
                            setShowStrikePad(false);
                            removeOrbitPreview();
                            handleHQButtonClick(e);
                        }}
                    >
                        HQ
                    </Button>

                    <Button
                        onClick={() => {
                            setShowSatPanel(prev => {
                                const next = !prev;
                                if (next) {
                                    // opening SAT editor closes Strike Pad
                                    setShowStrikePad(false);
                                } else {
                                    // closing SAT editor clears preview
                                    removeOrbitPreview();
                                }
                                return next;
                            });
                        }}
                    >
                        Sat
                    </Button>

                    {gameMode === 'pvp' && (
                        <Button
                            onClick={() => {
                                setShowStrikePad(prev => {
                                    const next = !prev;
                                    if (next) {
                                        // opening Strike Pad closes SAT editor & clears preview
                                        setShowSatPanel(false);
                                        removeOrbitPreview();
                                    }
                                    return next;
                                });
                            }}
                        >
                            Strike
                        </Button>
                    )}
                </Paper>
            )}

            {showSatPanel && (
                <Paper style={{ position: 'absolute', top: 170, left: 10, padding: 10, width: 200, zIndex: 1000, backgroundColor: 'white' }}>
                    <Typography variant="h6">Create Satellite</Typography>
                    <FormControl fullWidth style={{ marginBottom: 10 }}>
                        <InputLabel>Type</InputLabel>
                        <Select
                            value={satelliteType}
                            onChange={(e) => setSatelliteType(e.target.value)}
                        >
                            <MenuItem value="communication">Communication</MenuItem>
                            <MenuItem value="imaging">Imaging</MenuItem>
                        </Select>
                    </FormControl>
                    <TextField
                        label="Altitude"
                        type="number"
                        fullWidth
                        value={altitude}
                        onChange={(e) => setAltitude(e.target.value)}
                        style={{ marginBottom: 10 }}
                    />
                    <TextField
                        label="Speed"
                        type="number"
                        fullWidth
                        value={speed}
                        onChange={(e) => setSpeed(e.target.value)}
                        style={{ marginBottom: 10 }}
                    />
                    <Box style={{ marginBottom: 10 }}>
                        <Typography>Field of View</Typography>
                        <Slider
                            value={fieldOfView}
                            onChange={(e, val) => setFieldOfView(val)}
                            step={0.01}
                            min={1.69}
                            max={7.95}
                            valueLabelDisplay="auto"
                        />
                    </Box>
                    <TextField
                        label="Initial Angle"
                        type="number"
                        fullWidth
                        value={angle}
                        onChange={(e) => setAngle(e.target.value)}
                        style={{ marginBottom: 10 }}
                    />
                    <TextField
                        label="Inclination"
                        type="number"
                        fullWidth
                        value={inclination}
                        onChange={(e) => setInclination(e.target.value)}
                        style={{ marginBottom: 10 }}
                    />
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleAddSatellite}
                    >
                        Launch (${Math.round(launchCost / 1_000_000)}M)
                    </Button>
                    <Typography variant="caption" display="block" style={{ marginTop: 6 }}>
                        Uses AP and funds. AP left: {actionPoints}; Funds: {'$'}{Math.round((currentPlayerRef.current?.funds ?? 0) / 1_000_000)}M
                    </Typography>
                </Paper>
            )}

            {/* Strike Pad */}
            {gameMode === 'pvp' && showStrikePad && (
                <Paper style={{ position: 'absolute', top: 100, left: 230, padding: 12, width: 280, zIndex: 1000, backgroundColor: 'white' }}>
                    <Typography variant="h6" gutterBottom>Strike Pad</Typography>

                    {(() => {
                        const me = currentPlayerRef.current;
                        if (!me) return <Typography variant="body2">No active player.</Typography>;

                        const log = detectionLogRef.current?.forPlayer?.(me.id) || [];
                        const knownHQIds = new Set(
                            log.filter(e => e.type === 'HQ_DETECTED').map(e => e.targetId)
                        );
                        const knownHQs = hqSpheresRef.current.filter(
                            h => knownHQIds.has(h.id) && h.ownerID !== me.id
                        );
                        if (knownHQs.length === 0) {
                            return <Typography variant="body2">No known enemy HQs yet.</Typography>;
                        }

                        // simple comms gate: any of my satellites currently reachable from HQ
                        const hasComms = satellitesRef.current.some(s => s.ownerId === me.id && s.inHqRange === true);

                        return (
                            <div>
                                {!hasComms && (
                                    <Typography variant="caption" color="error" style={{ display: 'block', marginBottom: 8 }}>
                                        No comms link to your HQ — strikes are disabled.
                                    </Typography>
                                )}

                                {knownHQs.map(hq => {
                                    const canAPFunds = !!actionRegistryRef.current?.canPerform?.(
                                        'GROUND_STRIKE',
                                        me.id,
                                        { targetHQ: hq, hasComms }
                                    );
                                    const canStrike = hasComms && canAPFunds;

                                    return (
                                        <Box key={hq.id} style={{ border: '1px solid #ddd', borderRadius: 6, padding: 8, marginBottom: 8 }}>
                                            <Typography variant="subtitle2" gutterBottom>
                                                Enemy HQ ({hq.ownerID}) — {hq.id}
                                            </Typography>
                                            <Typography variant="caption" display="block" gutterBottom>
                                                HP: {hq.hp}
                                            </Typography>
                                            <Box display="flex" gap={8}>
                                                <Button
                                                    size="small"
                                                    variant="contained"
                                                    color="error"
                                                    disabled={!canStrike}
                                                    onClick={() => {
                                                        const ok = actionRegistryRef.current.perform('GROUND_STRIKE', me.id, {
                                                            targetHQ: hq,
                                                            hasComms
                                                        });
                                                        if (ok) {
                                                            notify('success', 'Strike launched. Impact in ~90s.');
                                                        } else {
                                                            notify('error', 'Cannot launch strike (AP/funds/turn).');
                                                        }
                                                    }}
                                                >
                                                    Launch Strike
                                                </Button>
                                                {!canAPFunds && (
                                                    <Typography variant="caption" color="textSecondary" style={{ alignSelf: 'center' }}>
                                                        Need more AP/funds
                                                    </Typography>
                                                )}
                                            </Box>
                                        </Box>
                                    );
                                })}
                            </div>
                        );
                    })()}
                </Paper>
            )}

            {/* Minimap overlay */}
            <canvas
                ref={miniRef}
                width={200}
                height={100}
                style={{
                    position: 'absolute',
                    bottom: 10,
                    right: 10,
                    border: '1px solid white',
                    zIndex: 1000,
                    backgroundColor: 'black'
                }}
            />

            {/* Toasts (player-facing notifications) */}
            {toasts.map((t, i) => (
                <div
                    key={t.id}
                    style={{
                        position: 'fixed',
                        top: 16 + i * 64,
                        right: 16,
                        zIndex: 2000
                    }}
                >
                    <Paper
                        elevation={6}
                        style={{
                            padding: '8px 12px',
                            background: '#1f1f1f',
                            color: 'white',
                            maxWidth: 360
                        }}
                    >
                        <strong style={{ textTransform: 'capitalize' }}>{t.severity}</strong>: {t.message}
                    </Paper>
                </div>
            ))}

            {renderSatellitesPanel()}
        </div>
    );


};

export default App;
