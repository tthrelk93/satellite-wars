import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import Satellite from './Satellite';
import Earth from './Earth';
import { sampleV2AtLatLonSigma } from './sensors/radar/radarSampleCpu';
import { DEFAULT_GROUND_DOPPLER_SPECS } from './sensors/radar/radarSpecs';
import HQ from './HQ';
import Player from './Player';
import { UPKEEP_PER_SAT, INCOME_PER_COMM_IN_LINK, INCOME_PER_IMAGING_IN_LINK, BASE_INCOME_PER_TURN, MU_EARTH, RE_M, OMEGA_EARTH, LOSSES_MPS, DV_REF_MPS, DV_EXPONENT, COMM_RANGE_KM, SPACE_LOS_EPS, GROUND_LOS_EPS, CLOUD_WATCH_GRID_LON_OFFSET_RAD } from './constants';
import SimClock from './SimClock';
import { solarDeclination } from './weather/solar';

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
    FormControlLabel,
    Switch,
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

const WEATHER_DEBUG_OPTIONS = [
    { value: 'clouds', label: 'Clouds (normal)' },
    { value: 'ps', label: 'Pressure (ps)' },
    { value: 'T', label: 'Temp (T)' },
    { value: 'Ts', label: 'Surface Temp (Ts)' },
    { value: 'TU', label: 'Upper Temp (TU)' },
    { value: 'RHU', label: 'Upper RH (RHU)' },
    { value: 'sst', label: 'SST (climo)' },
    { value: 'seaIce', label: 'Sea Ice (climo)' },
    { value: 'albedo', label: 'Albedo (climo)' },
    { value: 'elev', label: 'Elevation (climo)' },
    { value: 'soilCap', label: 'Soil Capacity (climo)' },
    { value: 'soilW', label: 'Soil Water (soilW)' },
    { value: 'landMask', label: 'Land Mask' },
    { value: 'RH', label: 'RH' },
    { value: 'wind', label: 'Wind (arrows)' },
    { value: 'windUpper', label: 'Upper Wind (speed)' },
    { value: 'hUpper', label: 'Upper Thickness (hU)' },
    { value: 'omegaL', label: 'Omega (lower)' },
    { value: 'omegaU', label: 'Omega (upper)' },
    { value: 'phiMid', label: 'Geopotential Φ (mid)' },
    { value: 'tauLow', label: 'Tau (low)' },
    { value: 'tauHigh', label: 'Tau (high)' },
    { value: 'tauLowDelta', label: 'Tau Low Delta' },
    { value: 'cloudLow', label: 'Cloud Low' },
    { value: 'cloudHigh', label: 'Cloud High' },
    { value: 'cwpLow', label: 'CWP (low)' },
    { value: 'cwpHigh', label: 'CWP (high)' },
    { value: 'tcGenesis', label: 'TC Genesis' },
    { value: 'tcMask', label: 'TC Mask' },
    { value: 'div', label: 'Divergence' },
    { value: 'vort', label: 'Vorticity' },
    { value: 'cwp', label: 'Cloud Water Path' },
    { value: 'precip', label: 'Precip (mm/hr)' }
];

const WEATHER_DEBUG_SCALE = {
    clouds: { min: 0, max: 1 },
    ps: { min: 95000, max: 103000 },
    T: { min: 240, max: 320 },
    Ts: { min: 240, max: 320 },
    TU: { min: 180, max: 320 },
    RHU: { min: 0, max: 1.2 },
    sst: { min: 271, max: 307 },
    seaIce: { min: 0, max: 1 },
    albedo: { min: 0, max: 1 },
    elev: { min: 0, max: 5000 },
    soilCap: { min: 0, max: 1 },
    soilW: { min: 0, max: 200 },
    landMask: { min: 0, max: 1 },
    RH: { min: 0, max: 1.2 },
    wind: { min: 0, max: 30 },
    windUpper: { min: 0, max: 100 },
    hUpper: { min: 1000, max: 5000 },
    omegaL: { min: -0.2, max: 0.2, diverging: true },
    omegaU: { min: -0.2, max: 0.2, diverging: true },
    phiMid: { min: 0, max: 600000 },
    tauLow: { min: 0, max: 20 },
    tauHigh: { min: 0, max: 20 },
    tauLowDelta: { min: 0, max: 1 },
    cloudLow: { min: 0, max: 1 },
    cloudHigh: { min: 0, max: 1 },
    cwpLow: { min: 0, max: 0.5, log: true },
    cwpHigh: { min: 0, max: 0.5, log: true },
    tcGenesis: { min: 0, max: 0.2, log: true },
    tcMask: { min: 0, max: 1 },
    vort: { min: -5e-5, max: 5e-5, diverging: true },
    div: { min: -5e-5, max: 5e-5, diverging: true },
    cwp: { min: 0, max: 0.5, log: true },
    precip: { min: 0, max: 50, log: true }
};

const SIM_SPEED_DEFAULT = 3600;
const SIM_SPEED_MAX = 14400;
const MONTH_SECONDS = (365 * 86400) / 12;
const SELECTION_DOUBLE_CLICK_MS = 250;
const SELECTION_DOUBLE_CLICK_PX = 8;
const SELECTION_EDGE_SAMPLES = 24;
const COLLECT_LOOKAHEAD_SECONDS = 2 * 3600;
const COLLECT_STEP_SECONDS = 300;
const SIM_SPEED_MARKS = [
    { value: 0, label: '1x' },
    { value: 1, label: '10x' },
    { value: 2, label: '100x' },
    { value: 3, label: '1k' },
    { value: 4, label: '10k' },
    { value: Math.log10(SIM_SPEED_MAX), label: `${(SIM_SPEED_MAX / 1000).toFixed(1)}k` }
];

const WEATHER_LOG_CADENCE_OPTIONS = [
    { value: 600, label: '10 min' },
    { value: 3600, label: '1 hour' },
    { value: 21600, label: '6 hours' },
    { value: 86400, label: '1 day' }
];

const DEFAULT_FORECAST_LEADS = [1, 3, 6];
const MAX_DRAFTS_PER_HAZARD = 2;
const ALERTS_HISTORY_MAX = 500;
const FORECAST_PRODUCT_LABELS = {
    cloudTau: 'Clouds',
    precipRate: 'Rain',
    windSpeed: 'Wind',
    confidence: 'Confidence'
};
const HAZARD_LABELS = {
    heavyPrecip: 'Heavy Precip',
    highWinds: 'High Winds',
    severeStormRisk: 'Severe Storm Risk'
};
const HAZARD_TO_FORECAST_PRODUCT = {
    heavyPrecip: 'precipRate',
    highWinds: 'windSpeed',
    severeStormRisk: 'precipRate'
};
const AUTO_WARNING_CONFIG = {
    confidenceMin: 0.6,
    maxHitFracServiceArea: 0.25,
    minComponentCells: 40,
    maxPolygonsPerHazard: 3,
    maxAreaFracByHazardByLead: {
        heavyPrecip: { 1: 0.08, 3: 0.10, 6: 0.12, 12: 0.15, 24: 0.18 },
        highWinds: { 1: 0.08, 3: 0.10, 6: 0.12, 12: 0.15, 24: 0.18 },
        severeStormRisk: { 1: 0.07, 3: 0.09, 6: 0.11, 12: 0.14, 24: 0.17 }
    },
    hazards: {
        heavyPrecip: { kind: 'precipRate', threshold: 0.25 },
        highWinds: { kind: 'windSpeed', threshold: 35, requireStormy: true },
        severeStormRisk: { kind: 'stormRisk', threshold: 1.0 }
    }
};
const SERVICE_RADIUS_KM = 2500;
const DOPPLER_RADAR_RADIUS_KM = 350;
const RADAR_CADENCE_SECONDS = 300;
const EVENT_SAMPLE_INTERVAL_SECONDS = 600;
const EVENT_GAP_SECONDS = EVENT_SAMPLE_INTERVAL_SECONDS * 2;
const MIN_EVENT_DURATION_SECONDS = 1800;
const EVENT_FOOTPRINT_RETENTION_SECONDS = 24 * 3600;
const EVENT_HISTORY_RETENTION_SECONDS = 30 * 3600;
const EVENT_THRESHOLDS = {
	heavyPrecip: 0.25,
	highWinds: 35,
	severeStormRisk: 1.0
};
const FORECAST_TECH_TIERS = [
    {
        tier: 0,
        name: 'CloudWatch Nowcaster',
        costMoney: 0,
        costAp: 0,
        unlockedLeads: [1, 3, 6]
    },
    {
        tier: 1,
        name: 'AMV Motion Vectors',
        costMoney: 35_000_000,
        costAp: 1,
        unlockedLeads: [1, 3, 6]
    },
    {
        tier: 2,
        name: 'Upper-Air Soundings',
        costMoney: 60_000_000,
        costAp: 1,
        unlockedLeads: [1, 3, 6, 12]
    },
    {
        tier: 3,
        name: 'Radar Nowcast Processor',
        costMoney: 45_000_000,
        costAp: 1,
        unlockedLeads: [1, 3, 6, 12]
    },
    {
        tier: 4,
        name: 'Dense Surface Network',
        costMoney: 80_000_000,
        costAp: 1,
        unlockedLeads: [1, 3, 6, 12, 24]
    }
];
const IOU_MATCH_MIN = 0.2;
const PAYOUT = {
    hitBase: {
        heavyPrecip: 5_000_000,
        highWinds: 3_000_000,
        severeStormRisk: 7_000_000
    }
};
const HIT_REP_BASE = {
    heavyPrecip: 3,
    highWinds: 2,
    severeStormRisk: 4
};
const PRECISION_BONUS_MAX = 0.5;
const PRECISION_CONF_START = 0.6;
const PRECISION_CONF_FULL = 0.9;
const PRECISION_AREA_FULL_FRAC = 0.05;
const PRECISION_AREA_NONE_FRAC = 0.20;
const PENALTY = {
    falseAlarmMoney: {
        heavyPrecip: 1_000_000,
        highWinds: 750_000,
        severeStormRisk: 1_500_000
    },
    falseAlarmRep: {
        heavyPrecip: -2,
        highWinds: -2,
        severeStormRisk: -3
    },
    missMoney: {
        heavyPrecip: 8_000_000,
        highWinds: 6_000_000,
        severeStormRisk: 12_000_000
    },
    missRep: {
        heavyPrecip: -6,
        highWinds: -5,
        severeStormRisk: -8
    }
};

const App = () => {
    const mountRef = useRef(null);
    const [gameMode, setGameMode] = useState(null); // 'solo' or 'pvp'
    const params = new URLSearchParams(window.location.search);
    const initialSeedParam = params.get('weatherSeed');
    const envSeedParam = process.env.REACT_APP_WEATHER_SEED;
    const fallbackSeed = Number.isFinite(Number.parseInt(envSeedParam, 10)) ? envSeedParam : '12345';
    const initialSeed = Number.isFinite(Number.parseInt(initialSeedParam, 10)) ? initialSeedParam : fallbackSeed;
    const [showMenu, setShowMenu] = useState(false);
    const [showSatPanel, setShowSatPanel] = useState(false);
    const [showSatListPanel, setShowSatListPanel] = useState(false);
    const [showFogLayer, setShowFogLayer] = useState(true);
    const [showWeatherLayer, setShowWeatherLayer] = useState(true);
    const [weatherViewSource, setWeatherViewSource] = useState('truth');
    const [showStationObs, setShowStationObs] = useState(true);
    const [showCloudObs, setShowCloudObs] = useState(true);
    const [showRadarObs, setShowRadarObs] = useState(true);
    const [cloudObsProduct, setCloudObsProduct] = useState('tauTotal');
    const [showForecastOverlay, setShowForecastOverlay] = useState(false);
    const [forecastProduct, setForecastProduct] = useState('cloudTau');
    const [forecastLeadHours, setForecastLeadHours] = useState(1);
    const [forecastStatus, setForecastStatus] = useState({ running: false, progress01: 0, message: '', lastRunId: null });
    const [forecastBaseTimeSeconds, setForecastBaseTimeSeconds] = useState(null);
    const [showForecastAdvanced, setShowForecastAdvanced] = useState(false);
    const [warningDrawMode, setWarningDrawMode] = useState(false);
    const [warningDraft, setWarningDraft] = useState({
        hazardType: 'heavyPrecip',
        validStartHours: 1,
        validDurationHours: 6,
        vertices: []
    });
    const [warningsByPlayerId, setWarningsByPlayerId] = useState({});
    const [draftWarningsByPlayerId, setDraftWarningsByPlayerId] = useState({});
    const [alertsHistory, setAlertsHistory] = useState([]);
    const [alertsUnreadCount, setAlertsUnreadCount] = useState(0);
    const [showAlertsPanel, setShowAlertsPanel] = useState(false);
    const [showDebugPanel, setShowDebugPanel] = useState(true);
    const [cloudWatchDebugEnabled, setCloudWatchDebugEnabled] = useState(false);
    const [cloudWatchDebugInfo, setCloudWatchDebugInfo] = useState([]);
    const showFogLayerRef = useRef(true);
    const showWeatherLayerRef = useRef(true);
    const [weatherDebugMode, setWeatherDebugMode] = useState('clouds');
    const weatherDebugModeRef = useRef('clouds');
    const [simPausedUI, setSimPausedUI] = useState(false);
    const [simSpeedUI, setSimSpeedUI] = useState(SIM_SPEED_DEFAULT);
    const [simTimeLabel, setSimTimeLabel] = useState('Day 0, 00:00');
    const [skipDayHover, setSkipDayHover] = useState(false);
    const [weatherSeed, setWeatherSeed] = useState(initialSeed);
    const [weatherSeedInput, setWeatherSeedInput] = useState(initialSeed);
    const [weatherLogEnabled, setWeatherLogEnabled] = useState(true);
    const [weatherLogCadence, setWeatherLogCadence] = useState(21600);
    const [weatherLogCount, setWeatherLogCount] = useState(0);
    const [weatherV2ConvectionEnabled, setWeatherV2ConvectionEnabled] = useState(true);
    const [sensorOnlyWeather, setSensorOnlyWeather] = useState(false);
    const zonalCanvasRef = useRef(null);
    const seedEditedRef = useRef(false);
    const orbitPreviewRef = useRef(null); // Green orbit preview line
    const orbitHandlesRef = useRef([]);   // Draggable preview handle meshes
    const orbitArrowsRef = useRef([]); // little direction arrows
    const orbitPickMeshRef = useRef(null); // Invisible torus pick helper
    const orbitDragRef = useRef({ active: false, lastX: 0, mode: 'rotate' }); // Drag state
    const previewRAANRef = useRef(null);  // Current preview RAAN (rad), set by solver or drag
    const [satelliteType, setSatelliteType] = useState('communication');
    const [altitude, setAltitude] = useState('35785'); // Set default altitude
    const [speed, setSpeed] = useState('28800'); // Set default speed
    const [fieldOfView, setFieldOfView] = useState(7.95); // Set slider to max value
    const [angle, setAngle] = useState('0'); // Set default angle
    const [inclination, setInclination] = useState('11'); // Set default inclination
    const [satellites, setSatellites] = useState([]);
    const [selectedSatelliteId, setSelectedSatelliteId] = useState(null);
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
    const directionalLightRef = useRef(null);
    const controlsRef = useRef(null);
    const simClockRef = useRef(new SimClock({ startTimeSeconds: 0, simSpeed: SIM_SPEED_DEFAULT, paused: false }));
    const lastFrameMsRef = useRef(null);
    const lastSimTimeRef = useRef(null);
    const sunDirRef = useRef(new THREE.Vector3());
    const orbitHoveringRef = useRef(false); // true while pointer over orbit gizmo
    // Live mirrors for state that global listeners read
    const showSatPanelRef = useRef(false);
    const altitudeRef = useRef(altitude);
    const inclinationRef = useRef(inclination);
    const previewNormalRef = useRef(null); // plane normal n (always ⟂ to HQ vector t)
    const showAlertsPanelRef = useRef(false);
    const alertsButtonRef = useRef(null);
    const cloudWatchDebugRef = useRef(false);
    const cloudWatchDebugInfoRef = useRef({ lastUpdateMs: 0 });
    const showForecastOverlayRef = useRef(false);
    const forecastProductRef = useRef('cloudTau');
    const forecastLeadHoursRef = useRef(1);
    const showCloudObsRef = useRef(showCloudObs);
    const sensorOnlyWeatherRef = useRef(sensorOnlyWeather);
	const warningOverlayFocusRef = useRef({
		activeHazardType: null,
		lastWarningId: null
	});
    const warningDrawModeRef = useRef(false);
    const warningDraftRef = useRef(warningDraft);
    const warningsByPlayerIdRef = useRef({});
    const draftWarningsByPlayerIdRef = useRef({});
    const eventsByPlayerIdRef = useRef({});
    const forecastSkillSummaryRef = useRef({});
    const serviceMaskRef = useRef({ playerId: null, gridKey: '', hqCount: 0, mask: null });
    const lastEventSampleRef = useRef(null);
    const areaWeightsRef = useRef({ gridKey: '', weights: null });
    const cursorLatLonRef = useRef(null);
    const anchorLatLonRef = useRef(null);
    const anchorMeshRef = useRef(null);
    const anchorLockRef = useRef(null);
    const selectionActiveRef = useRef(false);
    const selectionAnchorRef = useRef(null);
    const selectionRectRef = useRef(null);
    const selectionOutlineRef = useRef(null);
    const selectionDataRef = useRef(null);
    const selectionControlsStateRef = useRef(null);
    const selectionPendingClickRef = useRef(null);
    const selectionRaycasterRef = useRef(new THREE.Raycaster());
    const selectionMenuRef = useRef(null);
    const forecastHintShownRef = useRef(false);


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
    const [runCounter, setRunCounter] = useState(0);
    const [runScore, setRunScore] = useState(0);
    const [bestScore, setBestScore] = useState(null);
    const [sensorHudInfo, setSensorHudInfo] = useState(null);
    const [focusedWarningInfo, setFocusedWarningInfo] = useState(null);
    const [cursorLatLon, setCursorLatLon] = useState(null);
    const [anchorLatLon, setAnchorLatLon] = useState(null);
    const [selectionDragRect, setSelectionDragRect] = useState(null);
    const [selectionMenu, setSelectionMenu] = useState(null);

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
        const simTimeSeconds = simClockRef.current?.simTimeSeconds;
        setAlertsHistory(prev => {
            const next = [...prev, {
                id,
                severity,
                message,
                simTimeSeconds,
                createdAtMs: Date.now()
            }];
            if (next.length > ALERTS_HISTORY_MAX) {
                next.splice(0, next.length - ALERTS_HISTORY_MAX);
            }
            return next;
        });
        if (!showAlertsPanelRef.current) {
            setAlertsUnreadCount(count => count + 1);
        }
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
        setAlertsHistory([]);
        setAlertsUnreadCount(0);
        setShowAlertsPanel(false);
        setWarningsByPlayerId({});
        warningsByPlayerIdRef.current = {};
        setDraftWarningsByPlayerId({});
        draftWarningsByPlayerIdRef.current = {};
        eventsByPlayerIdRef.current = {};
        serviceMaskRef.current = { playerId: null, gridKey: '', hqCount: 0, mask: null };
        areaWeightsRef.current = { gridKey: '', weights: null };
        lastEventSampleRef.current = null;
        setActivePlayerId(null);
        setCurrentTurn(0);
        setActionPoints(AP_MAX);
        setShowMenu(false);
        setShowSatPanel(false);
        setShowSatListPanel(false);
        setShowDebugPanel(true);
        setShowStrikePad(false);
        setWarningDrawMode(false);
        setWarningDraft({
            hazardType: 'heavyPrecip',
            validStartHours: 1,
            validDurationHours: 6,
            vertices: []
        });
		warningOverlayFocusRef.current = {
			activeHazardType: null,
			lastWarningId: null
		};
        setFocusedWarningInfo(null);
        setSensorHudInfo(null);
        setShowForecastOverlay(false);
        setForecastProduct('cloudTau');
        setForecastLeadHours(1);
        setForecastStatus({ running: false, progress01: 0, message: '', lastRunId: null });
        setForecastBaseTimeSeconds(null);
        setShowForecastAdvanced(false);
        setRunScore(0);
        setWeatherLogEnabled(false);
        setWeatherLogCount(0);
        showHQSphereRef.current = false;
        forecastHintShownRef.current = false;

        const simClock = simClockRef.current;
        simClock.simTimeSeconds = 0;
        simClock.setSpeed(simSpeedUI);
        simClock.setPaused(simPausedUI);
        lastFrameMsRef.current = null;
        lastSimTimeRef.current = null;
        setSimTimeLabel('Day 0, 00:00');

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
            applyTierToPlayer(p);
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
            const repFactor = 0.5 + (player.reputation ?? 50) / 100;
            const income = (BASE_INCOME_PER_TURN + imagingCount * INCOME_PER_IMAGING_IN_LINK + commCount * INCOME_PER_COMM_IN_LINK) * repFactor;
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
        scene.add(camera);
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
        const seedNum = Number.parseInt(weatherSeed, 10);
        const earth = new Earth(camera, playersList, {
            weatherSeed: Number.isFinite(seedNum) ? seedNum : undefined
        });
        earth.render(scene);
        earthRef.current = earth;
        setSatellites([...satellitesRef.current]);
        const urlParams = new URLSearchParams(window.location.search);
        const radarDebug = process.env.NODE_ENV !== 'production' && urlParams.get('radarDebug') === '1';
        const cloudWatchDebug = process.env.NODE_ENV !== 'production' && urlParams.get('cloudWatchDebug') === '1';
        earth.initRadarVolume?.(renderer, { debug: radarDebug });
        earth.initWeatherSensors?.({ renderer });
        earth.setCloudWatchDebugEnabled?.(cloudWatchDebug);
        cloudWatchDebugRef.current = cloudWatchDebug;
        setCloudWatchDebugEnabled(cloudWatchDebug);
        earth.setWeatherVisible(false);
        earth.setCloudObsVisible(false);
        if (process.env.NODE_ENV !== 'production') {
            window.__sw = window.__sw || {};
            window.__sw.earth = earth;
            window.__sw.sampleRadarV2 = (lat, lon, sigma = 0.95) => sampleV2AtLatLonSigma(
                earth.weatherField?.core,
                lat,
                lon,
                sigma,
                { method: 'bilinear', returnMeta: true }
            );
            window.__sw.getRadarOrigin = () => {
                const simTimeSeconds = simClockRef.current?.simTimeSeconds ?? 0;
                const origin = earth.getGroundRadarOriginLatLonRad?.(simTimeSeconds);
                if (!origin) return null;
                return {
                    latDeg: THREE.MathUtils.radToDeg(origin.latRad),
                    lonDeg: THREE.MathUtils.radToDeg(origin.lonRad),
                    source: origin.source ?? 'unknown'
                };
            };
            window.__sw.logRadarOrigin = () => {
                const info = window.__sw.getRadarOrigin?.();
                if (!info) {
                    console.log('[radar] origin unavailable');
                    return null;
                }
                console.log(`[radar] origin ${info.source} lat=${info.latDeg.toFixed(3)} lon=${info.lonDeg.toFixed(3)}`);
                return info;
            };
            window.__sw.setRadarZScale = (value) => {
                const pass = earth.getGroundRadarPpiPass?.();
                if (!pass || !pass.material?.uniforms?.zScale) return null;
                const v = Number(value);
                if (!Number.isFinite(v)) return pass.material.uniforms.zScale.value;
                pass.material.uniforms.zScale.value = v;
                return pass.material.uniforms.zScale.value;
            };
            window.__sw.setRadarZExponent = (value) => {
                const pass = earth.getGroundRadarPpiPass?.();
                if (!pass || !pass.material?.uniforms?.zExponent) return null;
                const v = Number(value);
                if (!Number.isFinite(v)) return pass.material.uniforms.zExponent.value;
                pass.material.uniforms.zExponent.value = v;
                return pass.material.uniforms.zExponent.value;
            };
            window.__sw.setRadarDbzMin = (value) => {
                const pass = earth.getGroundRadarPpiPass?.();
                if (!pass || !pass.material?.uniforms?.dbzMin) return null;
                const v = Number(value);
                if (!Number.isFinite(v)) return pass.material.uniforms.dbzMin.value;
                pass.material.uniforms.dbzMin.value = v;
                return pass.material.uniforms.dbzMin.value;
            };
            window.__sw.setRadarQMin = (value) => {
                const pass = earth.getGroundRadarPpiPass?.();
                if (!pass || !pass.material?.uniforms?.qMin) return null;
                const v = Number(value);
                if (!Number.isFinite(v)) return pass.material.uniforms.qMin.value;
                pass.material.uniforms.qMin.value = v;
                return pass.material.uniforms.qMin.value;
            };
            window.__sw.setRadarDbzAlphaSpan = (value) => {
                const pass = earth.getGroundRadarPpiPass?.();
                if (!pass || !pass.material?.uniforms?.dbzAlphaSpan) return null;
                const v = Number(value);
                if (!Number.isFinite(v)) return pass.material.uniforms.dbzAlphaSpan.value;
                pass.material.uniforms.dbzAlphaSpan.value = v;
                return pass.material.uniforms.dbzAlphaSpan.value;
            };
            window.__sw.radarDiskStats = () => {
                const simTimeSeconds = simClockRef.current?.simTimeSeconds ?? 0;
                const origin = earth.getGroundRadarOriginLatLonRad?.(simTimeSeconds);
                const core = window.__sw.earth?.weatherField?.core;
                const grid = core?.grid;
                const state = core?.state;
                if (!origin || !core || !grid || !state) return null;

                const { nx, ny, latDeg, lonDeg } = grid;
                const N = nx * ny;
                if (!nx || !ny || !latDeg || !lonDeg) return null;

                const rangeMaxKm = DEFAULT_GROUND_DOPPLER_SPECS.rangeMaxKm;
                const rangeMaxM = rangeMaxKm * 1000;
                const cosLat0 = Math.cos(origin.latRad);
                const precip = state.precipRate;
                const qr = state.qr;
                const nz = state.nz ?? core.nz ?? 0;
                const base = Math.max(0, nz - 1) * N;

                const maxPrecip = { value: 0, distKm: null, latDeg: null, lonDeg: null };
                const maxQr = { value: 0, distKm: null, latDeg: null, lonDeg: null };

                for (let j = 0; j < ny; j += 1) {
                    const latRad = THREE.MathUtils.degToRad(latDeg[j]);
                    const dLat = latRad - origin.latRad;
                    const rowOffset = j * nx;
                    for (let i = 0; i < nx; i += 1) {
                        const lonRad = THREE.MathUtils.degToRad(lonDeg[i]);
                        const dLon = wrapRadToPi(lonRad - origin.lonRad);
                        const eastM = dLon * RE_M * cosLat0;
                        const northM = dLat * RE_M;
                        const rM = Math.hypot(eastM, northM);
                        if (rM > rangeMaxM) continue;

                        const k = rowOffset + i;
                        if (precip && precip.length === N) {
                            const val = precip[k];
                            if (val > maxPrecip.value) {
                                maxPrecip.value = val;
                                maxPrecip.distKm = rM / 1000;
                                maxPrecip.latDeg = latDeg[j];
                                maxPrecip.lonDeg = lonDeg[i];
                            }
                        }
                        if (qr && qr.length >= base + N) {
                            const val = qr[base + k];
                            if (val > maxQr.value) {
                                maxQr.value = val;
                                maxQr.distKm = rM / 1000;
                                maxQr.latDeg = latDeg[j];
                                maxQr.lonDeg = lonDeg[i];
                            }
                        }
                    }
                }

                const result = {
                    rangeKm: rangeMaxKm,
                    origin: {
                        latDeg: THREE.MathUtils.radToDeg(origin.latRad),
                        lonDeg: THREE.MathUtils.radToDeg(origin.lonRad),
                        source: origin.source ?? 'unknown'
                    },
                    maxPrecipRateMmHr: maxPrecip,
                    maxQrSurface: maxQr
                };
                console.log('[radar] disk stats', result);
                return result;
            };
            window.__sw.cloudSatProbe = () => earthRef.current?.debugCloudSatMappingProbe?.();
            window.__sw.weatherObsLatest = () => earthRef.current?.latestWeatherObservations;
            window.__sw.clearCloudIntel = () => {
                const pid = currentPlayerRef.current?.id;
                return earthRef.current?.clearCloudIntelForPlayer?.(pid);
            };
            window.__sw.cloudWatchCalibrate = (enabled = true) => {
                earthRef.current?.setCloudWatchCalibrationEnabled?.(enabled);
            };
        }
        earth.setWeatherDebugMode(weatherDebugModeRef.current);
        earth.setWeatherVisible(false);
        earth.setFogVisible(sensorOnlyWeather ? false : showFogLayerRef.current);
        earth.setCloudObsVisible(false);

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
        const handleControlStart = () => {
            if (anchorLockRef.current) anchorLockRef.current.isDragging = true;
        };
        const handleControlEnd = () => {
            if (anchorLockRef.current) anchorLockRef.current.isDragging = false;
        };
        controls.addEventListener('start', handleControlStart);
        controls.addEventListener('end', handleControlEnd);
        // Let canvas own pointer gestures for our gizmo drags
        renderer.domElement.style.touchAction = 'none';

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404040);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(1, 0, 0);
        directionalLight.target.position.set(0, 0, 0);
        scene.add(directionalLight.target);
        scene.add(directionalLight);
        directionalLightRef.current = directionalLight;

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
        renderer.domElement.addEventListener('contextmenu', handleRightClick);

        // Handle window resize
        const handleResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener('resize', handleResize);

        window.addEventListener('mousedown', handleMouseClick);
        window.addEventListener('keydown', handleKeyDown);


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
            renderer.domElement.removeEventListener('contextmenu', handleRightClick);
            controls.removeEventListener('start', handleControlStart);
            controls.removeEventListener('end', handleControlEnd);
            window.removeEventListener('mousedown', handleMouseClick);
            window.removeEventListener('keydown', handleKeyDown);
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
    }, [gameMode, runCounter]);

    // Orbit preview helpers
    const removeOrbitPreview = () => {
        const removeObj = (obj) => {
            if (obj?.parent) obj.parent.remove(obj);
        };

        if (orbitPreviewRef.current) {
            removeObj(orbitPreviewRef.current);
            orbitPreviewRef.current.geometry?.dispose?.();
            orbitPreviewRef.current.material?.dispose?.();
            orbitPreviewRef.current = null;
        }

        if (orbitHandlesRef.current.length) {
            orbitHandlesRef.current.forEach(h => {
                removeObj(h);
                h.geometry?.dispose?.();
                h.material?.dispose?.();
            });
            orbitHandlesRef.current = [];
        }

        if (orbitArrowsRef.current.length) {
            orbitArrowsRef.current.forEach(a => {
                removeObj(a);
                a.geometry?.dispose?.();
                a.material?.dispose?.();
            });
            orbitArrowsRef.current = [];
        }

        if (orbitPickMeshRef.current) {
            removeObj(orbitPickMeshRef.current);
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

        const previewParent = earth.parentObject ?? scene;

        // t = unit vector from Earth center to HQ (Earth-local space)
        const t = hq.sphere.position.clone().normalize();

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
        const altKm = parseFloat(altitudeRef.current || altitude || '0');
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
        previewParent.add(ringLine);
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
            previewParent.add(m);
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
        previewParent.add(torus);
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

            previewParent.add(cone);
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
        previewParent.add(pick);
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
        if (selectionActiveRef.current) {
            const controls = controlsRef.current;
            if (controls) {
                controls.enabled = false;
                controls.enableRotate = false;
                controls.enablePan = false;
                controls.enableZoom = false;
            }
            const dom = rendererRef.current.domElement;
            if (dom) dom.style.cursor = 'crosshair';
            return;
        }
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
        if (selectionActiveRef.current) return false;
        if (!showSatPanelRef.current) return false;
        const hit = hitOrbitGizmo(event);
        if (!hit) return false;

        event.preventDefault?.();
        event.stopPropagation?.();

        const dragMode = hit?.object?.userData?.kind === 'orbitHandle' ? 'radius' : 'rotate';

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
        const hitLocal = hitPos.clone();
        if (earth?.parentObject) {
            earth.parentObject.worldToLocal(hitLocal);
        }
        const yaw = Math.atan2(hitLocal.z, hitLocal.x);

        orbitDragRef.current.active = true;
        orbitDragRef.current.startYaw = yaw;
        orbitDragRef.current.startRAAN = (previewRAANRef.current ?? 0);
        orbitDragRef.current.radius = radius;
        orbitDragRef.current.mode = dragMode;

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
        orbitDragRef.current.mode = 'rotate';
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

    const formatSimTime = (seconds) => {
        if (!Number.isFinite(seconds)) return 'Day 0, 00:00';
        const total = Math.max(0, Math.floor(seconds));
        const day = Math.floor(total / 86400);
        const hours = Math.floor((total % 86400) / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        const pad = (value) => String(value).padStart(2, '0');
        return `Day ${day}, ${pad(hours)}:${pad(minutes)}`;
    };

    const formatHoursLabel = (hours) => {
        const h = Number(hours);
        if (!Number.isFinite(h)) return 'In ? hours';
        return `In ${h} hour${h === 1 ? '' : 's'}`;
    };

    const getAlertColor = (severity) => {
        switch (severity) {
            case 'success':
                return '#4ade80';
            case 'info':
                return '#60a5fa';
            case 'warning':
                return '#facc15';
            case 'error':
                return '#f87171';
            default:
                return '#e5e7eb';
        }
    };

    const getZonalScale = (values, mode) => {
        const config = WEATHER_DEBUG_SCALE[mode] || WEATHER_DEBUG_SCALE.clouds;
        const transform = config.log
            ? (v) => Math.log10(1 + Math.max(0, v))
            : (v) => v;
        let min = transform(config.min);
        let max = transform(config.max);
        if (values && values.length > 0) {
            const sorted = Array.from(values, (v) => {
                const t = transform(v);
                return Number.isFinite(t) ? t : 0;
            });
            sorted.sort((a, b) => a - b);
            const lo = Math.floor(0.05 * (sorted.length - 1));
            const hi = Math.floor(0.95 * (sorted.length - 1));
            const pMin = sorted[Math.max(0, lo)];
            const pMax = sorted[Math.min(sorted.length - 1, hi)];
            if (Number.isFinite(pMin) && Number.isFinite(pMax) && pMax > pMin) {
                min = pMin;
                max = pMax;
            }
        }
        if (config.diverging) {
            const maxAbs = Math.max(Math.abs(min), Math.abs(max)) || 1;
            min = -maxAbs;
            max = maxAbs;
        }
        if (!(max > min)) {
            min = 0;
            max = 1;
        }
        return { min, max, transform, diverging: Boolean(config.diverging) };
    };

    const drawZonalMean = (canvas, values, mode) => {
        if (!canvas || !values || values.length === 0) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0, 0, w, h);
        const pad = 6;
        const plotW = w - pad * 2;
        const plotH = h - pad * 2;
        const { min, max, transform, diverging } = getZonalScale(values, mode);
        const denom = max - min || 1;

        if (diverging) {
            const zeroX = pad + ((transform(0) - min) / denom) * plotW;
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.beginPath();
            ctx.moveTo(zeroX, pad);
            ctx.lineTo(zeroX, pad + plotH);
            ctx.stroke();
        }

        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let j = 0; j < values.length; j++) {
            const t = Math.max(0, Math.min(1, (transform(values[j]) - min) / denom));
            const x = pad + t * plotW;
            const y = pad + (j / Math.max(1, values.length - 1)) * plotH;
            if (j === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.strokeRect(pad, pad, plotW, plotH);
    };

    function updateWeatherDebugNow() {
        const simTime = simClockRef.current?.simTimeSeconds ?? 0;
        setSimTimeLabel(formatSimTime(simTime));
        const earth = earthRef.current;
        if (!earth) return;
        const seed = earth.getWeatherSeed();
        if (seed !== undefined && seed !== null) {
            const seedText = String(seed);
            setWeatherSeed(seedText);
            if (!seedEditedRef.current) {
                setWeatherSeedInput(seedText);
            }
        }
        const canvas = zonalCanvasRef.current;
        if (canvas) {
            const zonal = earth.getWeatherZonalMean(weatherDebugModeRef.current);
            drawZonalMean(canvas, zonal, weatherDebugModeRef.current);
        }
        const logStatus = earth.getWeatherLogStatus?.();
        if (logStatus && Number.isFinite(logStatus.count)) {
            setWeatherLogCount(logStatus.count);
        }
        if (logStatus && typeof logStatus.enabled === 'boolean' && logStatus.enabled !== weatherLogEnabled) {
            setWeatherLogEnabled(logStatus.enabled);
        }
        if (
            logStatus &&
            Number.isFinite(logStatus.cadenceSeconds) &&
            logStatus.cadenceSeconds !== weatherLogCadence
        ) {
            setWeatherLogCadence(logStatus.cadenceSeconds);
        }

        const sensorStatus = earth.getSensorStatus?.();
        if (sensorStatus) {
            setSensorHudInfo(sensorStatus);
        }

        const player = currentPlayerRef.current;
        if (player) {
            const score = (player.funds ?? 0) + (player.reputation ?? 50) * 1_000_000;
            setRunScore(score);
            const key = `sw_bestScore_seed_${weatherSeed}`;
            try {
                const stored = Number(localStorage.getItem(key));
                if (!Number.isFinite(stored) || score > stored) {
                    localStorage.setItem(key, String(score));
                    setBestScore(score);
                } else {
                    setBestScore(stored);
                }
            } catch (err) {
                setBestScore(null);
            }
        }
    }

    const skipToNextDay = () => {
        const simClock = simClockRef.current;
        if (!simClock) return;
        const current = simClock.simTimeSeconds ?? 0;
        const nextDayStart = (Math.floor(current / 86400) + 1) * 86400;
        const delta = nextDayStart - current;
        if (!(delta > 0)) return;
        simClock.stepSeconds(delta);
        const earth = earthRef.current;
        if (earth) {
            earth.update(simClock.simTimeSeconds, 1, {
                simSpeed: simClock.simSpeed,
                paused: simClock.paused,
                sensorGating: buildSensorGating()
            });
        }
        updateWeatherDebugNow();
    };

    const handleEndTurnClick = () => {
        turnManagerRef.current?.endTurn();
        if (gameMode === 'solo') {
            skipToNextDay();
        }
    };

    const startNewRun = (randomizeSeed = false) => {
        if (randomizeSeed) {
            const nextSeed = Math.floor(Math.random() * 1_000_000);
            setWeatherSeed(String(nextSeed));
            setWeatherSeedInput(String(nextSeed));
            seedEditedRef.current = false;
        }
        setRunCounter(prev => prev + 1);
    };

    const handleWeatherSeedChange = (event) => {
        setWeatherSeedInput(event.target.value);
        seedEditedRef.current = true;
    };

    const applyWeatherSeed = () => {
        const seed = Number.parseInt(weatherSeedInput, 10);
        if (!Number.isFinite(seed)) return;
        seedEditedRef.current = false;
        setWeatherSeed(String(seed));
        earthRef.current?.setWeatherSeed(seed);
        updateWeatherDebugNow();
    };

    const speedToSliderValue = (speed) => {
        if (!Number.isFinite(speed) || speed <= 0) return 0;
        return Math.log10(speed);
    };

    const sliderValueToSpeed = (value) => {
        const v = Number.isFinite(value) ? value : 0;
        return Math.min(SIM_SPEED_MAX, Math.pow(10, v));
    };

    const handleSimSpeedChange = (_, value) => {
        const raw = Array.isArray(value) ? value[0] : value;
        const nextSpeed = Math.round(sliderValueToSpeed(raw));
        setSimSpeedUI(nextSpeed);
    };

    const handleWeatherLogCadenceChange = (event) => {
        const nextCadence = Number(event.target.value);
        if (!Number.isFinite(nextCadence)) return;
        setWeatherLogCadence(nextCadence);
        const simTime = simClockRef.current?.simTimeSeconds ?? 0;
        earthRef.current?.setWeatherLogCadence(nextCadence, simTime);
    };

    const toggleWeatherLogCapture = () => {
        const earth = earthRef.current;
        if (!earth) return;
        const simClock = simClockRef.current;
        const nextEnabled = !weatherLogEnabled;
        setWeatherLogEnabled(nextEnabled);
        if (nextEnabled) {
            earth.startWeatherLogCapture({
                cadenceSeconds: weatherLogCadence,
                simTimeSeconds: simClock.simTimeSeconds
            });
        } else {
            earth.stopWeatherLogCapture();
        }
        updateWeatherDebugNow();
    };

    const handleV2ConvectionToggle = (_, checked) => {
        setWeatherV2ConvectionEnabled(checked);
        earthRef.current?.setWeatherV2ConvectionEnabled?.(checked);
    };

    const clearWeatherLogCapture = () => {
        earthRef.current?.clearWeatherLogCapture();
        setWeatherLogCount(0);
    };

    const downloadWeatherLogCapture = () => {
        earthRef.current?.downloadWeatherLogCapture(`weather-log-${Date.now()}.jsonl`);
    };


    useEffect(() => { showSatPanelRef.current = showSatPanel; }, [showSatPanel]);
    useEffect(() => { altitudeRef.current = altitude; }, [altitude]);
    useEffect(() => { inclinationRef.current = inclination; }, [inclination]);
    useEffect(() => {
        if (!cloudWatchDebugEnabled) setCloudWatchDebugInfo([]);
    }, [cloudWatchDebugEnabled]);
    const SAT_TYPE_DEFAULTS = {
        communication: { altitude: '35785', speed: '28800' }, // GEO comms
        imaging: { altitude: '700', speed: '28800' }, // LEO imaging
        cloudWatch: { altitude: '35786', speed: '11074' }, // GEO cloud watch
        sar: { altitude: '700', speed: '28800' } // LEO SAR
    };

    useEffect(() => {
        const defaults = SAT_TYPE_DEFAULTS[satelliteType];
        if (!defaults) return;
        setAltitude(defaults.altitude);
        setSpeed(defaults.speed);
    }, [satelliteType]);
    useEffect(() => { showForecastOverlayRef.current = showForecastOverlay; }, [showForecastOverlay]);
    useEffect(() => { forecastProductRef.current = forecastProduct; }, [forecastProduct]);
    useEffect(() => { forecastLeadHoursRef.current = forecastLeadHours; }, [forecastLeadHours]);
    useEffect(() => { showCloudObsRef.current = showCloudObs; }, [showCloudObs]);
    useEffect(() => { sensorOnlyWeatherRef.current = sensorOnlyWeather; }, [sensorOnlyWeather]);
    useEffect(() => { warningDrawModeRef.current = warningDrawMode; }, [warningDrawMode]);
    useEffect(() => { warningDraftRef.current = warningDraft; }, [warningDraft]);
    useEffect(() => { warningsByPlayerIdRef.current = warningsByPlayerId; }, [warningsByPlayerId]);
    useEffect(() => { draftWarningsByPlayerIdRef.current = draftWarningsByPlayerId; }, [draftWarningsByPlayerId]);
    useEffect(() => { selectionMenuRef.current = selectionMenu; }, [selectionMenu]);
    useEffect(() => {
        showAlertsPanelRef.current = showAlertsPanel;
        if (showAlertsPanel) {
            setAlertsUnreadCount(0);
        }
    }, [showAlertsPanel]);
    useEffect(() => {
        setSkipDayHover(false);
    }, [gameMode]);
    useEffect(() => {
        showFogLayerRef.current = showFogLayer;
    }, [showFogLayer, sensorOnlyWeather]);
    useEffect(() => {
        showWeatherLayerRef.current = showWeatherLayer;
    }, [showWeatherLayer, sensorOnlyWeather]);
    useEffect(() => {
        if (!earthRef.current) return;
        earthRef.current.setWeatherViewSource?.(weatherViewSource);
    }, [weatherViewSource, gameMode]);
    useEffect(() => {
        if (!earthRef.current) return;
        earthRef.current.setStationObsVisible?.(showStationObs);
    }, [showStationObs, gameMode]);
    useEffect(() => {
        if (!earthRef.current) return;
        if (showCloudObs) {
            earthRef.current.logCloudSatStats?.('toggleOn');
        }
    }, [showCloudObs, gameMode]);
    useEffect(() => {
        if (!earthRef.current) return;
        earthRef.current.setRadarOverlayVisible?.(showRadarObs);
        if (showRadarObs) {
            const pass = earthRef.current.getGroundRadarPpiPass?.();
            const uniforms = pass?.material?.uniforms;
            if (uniforms?.dbzMin && uniforms?.qMin && uniforms?.dbzAlphaSpan) {
                console.log('[groundRadar] pass uniforms:', {
                    dbzMin: uniforms.dbzMin.value,
                    qMin: uniforms.qMin.value,
                    dbzAlphaSpan: uniforms.dbzAlphaSpan.value
                });
                uniforms.dbzMin.value = Math.min(uniforms.dbzMin.value, 0);
                uniforms.qMin.value = Math.min(uniforms.qMin.value, 1e-6);
                uniforms.dbzAlphaSpan.value = Math.max(uniforms.dbzAlphaSpan.value, 16);
            }
        }
    }, [showRadarObs, gameMode]);
    useEffect(() => {
        if (!earthRef.current) return;
        earthRef.current.setForecastOverlayVisible?.(showForecastOverlay);
    }, [showForecastOverlay, gameMode]);
    useEffect(() => {
        if (!earthRef.current) return;
        earthRef.current.setForecastDisplayProduct?.(forecastProduct);
    }, [forecastProduct, gameMode]);
    useEffect(() => {
        if (!earthRef.current) return;
        earthRef.current.setForecastDisplayLeadHours?.(forecastLeadHours);
    }, [forecastLeadHours, gameMode]);
    useEffect(() => {
        const player = currentPlayerRef.current;
        const unlockedLeads = getUnlockedForecastLeads(player);
        if (unlockedLeads.length && !unlockedLeads.includes(forecastLeadHours)) {
            setForecastLeadHours(unlockedLeads[0]);
        }
        const unlockedHazards = getUnlockedWarningHazards(player);
        setWarningDraft((prev) => {
            let next = prev;
            if (unlockedHazards.length && !unlockedHazards.includes(prev.hazardType)) {
                next = { ...next, hazardType: unlockedHazards[0] };
            }
            const startHours = Number(prev.validStartHours);
            if (unlockedLeads.length && !unlockedLeads.includes(startHours)) {
                next = { ...next, validStartHours: unlockedLeads[0] };
            }
            return next;
        });
    }, [activePlayerId, forecastLeadHours, gameMode]);
    useEffect(() => {
        if (!earthRef.current) return;
        earthRef.current.setCloudObsProduct?.(cloudObsProduct);
    }, [cloudObsProduct, gameMode]);
    useEffect(() => {
        const currentPlayer = currentPlayerRef.current;
        const list = currentPlayer?.getSatellites?.() ?? [];
        if (selectedSatelliteId && !list.some(sat => sat.id === selectedSatelliteId)) {
            setSelectedSatelliteId(null);
        }
        list.forEach(sat => sat.setHighlighted?.(sat.id === selectedSatelliteId));
    }, [selectedSatelliteId, activePlayerId, satellites, gameMode]);
    useEffect(() => {
        const earth = earthRef.current;
        const playerId = activePlayerId;
        if (!earth || !playerId) return;
        const warnings = warningsByPlayerId[playerId] || [];
        const visibleWarnings = warnings.filter(w => !w.outcome);
        const drafts = draftWarningsByPlayerId[playerId] || [];
        earth.setPlayerWarnings?.(playerId, [...visibleWarnings, ...drafts]);
    }, [warningsByPlayerId, draftWarningsByPlayerId, activePlayerId, gameMode]);
    useEffect(() => {
        if (earthRef.current) {
            const seedNum = Number.parseInt(weatherSeed, 10);
            if (Number.isFinite(seedNum)) earthRef.current.setWeatherSeed(seedNum);
        }
    }, [weatherSeed]);
    useEffect(() => {
        weatherDebugModeRef.current = weatherDebugMode;
        if (earthRef.current) earthRef.current.setWeatherDebugMode(weatherDebugMode);
        updateWeatherDebugNow();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [weatherDebugMode]);
    useEffect(() => {
        simClockRef.current.setPaused(simPausedUI);
    }, [simPausedUI]);
    useEffect(() => {
        simClockRef.current.setSpeed(Math.min(SIM_SPEED_MAX, Math.max(0, simSpeedUI)));
    }, [simSpeedUI]);
    useEffect(() => {
        if (!gameMode) return;
        const interval = setInterval(() => {
            updateWeatherDebugNow();
        }, 500);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameMode]);

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
            const speedInRadiansPerSecond = orbitalSpeedMPerS / orbitRadiusMeters;

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

    const vectorToLatLonRad = (vec) => {
        if (!vec) return null;
        const r = vec.length();
        if (!(r > 0)) return null;
        return {
            latRad: Math.asin(vec.y / r),
            lonRad: Math.atan2(vec.x, vec.z)
        };
    };

    const isCanvasEvent = (event) => {
        const canvas = rendererRef.current?.domElement;
        return !!canvas && event?.target === canvas;
    };

    const setSelectionControlsEnabled = (enabled) => {
        const controls = controlsRef.current;
        if (!controls) return;
        if (enabled) {
            const prev = selectionControlsStateRef.current;
            if (prev) {
                controls.enabled = prev.enabled;
                controls.enableRotate = prev.enableRotate;
                controls.enablePan = prev.enablePan;
                controls.enableZoom = prev.enableZoom;
            } else {
                controls.enabled = true;
                controls.enableRotate = true;
                controls.enablePan = true;
                controls.enableZoom = true;
            }
            selectionControlsStateRef.current = null;
        } else {
            selectionControlsStateRef.current = {
                enabled: controls.enabled,
                enableRotate: controls.enableRotate,
                enablePan: controls.enablePan,
                enableZoom: controls.enableZoom
            };
            controls.enabled = false;
            controls.enableRotate = false;
            controls.enablePan = false;
            controls.enableZoom = false;
        }
    };

    const clearSelectionOutline = () => {
        const earth = earthRef.current;
        const outline = selectionOutlineRef.current;
        if (outline && earth?.parentObject) {
            earth.parentObject.remove(outline);
            outline.geometry?.dispose?.();
            outline.material?.dispose?.();
        }
        selectionOutlineRef.current = null;
    };

    const clearSelection = () => {
        clearSelectionOutline();
        selectionActiveRef.current = false;
        selectionAnchorRef.current = null;
        selectionRectRef.current = null;
        selectionDataRef.current = null;
        setSelectionDragRect(null);
        setSelectionMenu(null);
        selectionMenuRef.current = null;
        setSelectionControlsEnabled(true);
        const dom = rendererRef.current?.domElement;
        if (dom) dom.style.cursor = '';
        if (selectionPendingClickRef.current?.timerId) {
            clearTimeout(selectionPendingClickRef.current.timerId);
        }
        selectionPendingClickRef.current = null;
    };

    const screenToEarthLocal = (clientX, clientY) => {
        const earth = earthRef.current;
        const camera = cameraRef.current;
        if (!earth?.mesh || !camera) return null;
        const mouse = new THREE.Vector2(
            (clientX / window.innerWidth) * 2 - 1,
            -(clientY / window.innerHeight) * 2 + 1
        );
        const raycaster = selectionRaycasterRef.current;
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObject(earth.mesh, false);
        if (!intersects.length) return null;
        const point = intersects[0].point.clone();
        earth.parentObject.worldToLocal(point);
        return point;
    };

    const buildSelectionOutlineFromRect = (rect) => {
        if (!rect) return null;
        const earth = earthRef.current;
        if (!earth?.parentObject) return null;
        const radius = earth.earthRadiusKm + 6;
        const points = [];
        const left = rect.left;
        const top = rect.top;
        const right = rect.left + rect.width;
        const bottom = rect.top + rect.height;
        const samples = Math.max(6, SELECTION_EDGE_SAMPLES);
        const sampleEdge = (x0, y0, x1, y1, includeEnd) => {
            const steps = includeEnd ? samples : samples - 1;
            for (let s = 0; s <= steps; s++) {
                const t = steps === 0 ? 0 : s / steps;
                const x = x0 + (x1 - x0) * t;
                const y = y0 + (y1 - y0) * t;
                const local = screenToEarthLocal(x, y);
                if (!local) continue;
                const p = local.clone().normalize().multiplyScalar(radius);
                points.push(p);
            }
        };
        sampleEdge(left, top, right, top, false);
        sampleEdge(right, top, right, bottom, false);
        sampleEdge(right, bottom, left, bottom, false);
        sampleEdge(left, bottom, left, top, true);
        if (points.length < 3) return null;
        return points;
    };

    const computeSelectionStats = (outlineLocalPoints) => {
        const earth = earthRef.current;
        if (!earth || !outlineLocalPoints || outlineLocalPoints.length < 3) return null;
        const center = new THREE.Vector3();
        outlineLocalPoints.forEach((p) => center.add(p.clone().normalize()));
        if (center.lengthSq() < 1e-6) return null;
        center.normalize();
        const latLon = vectorToLatLonRad(center);
        if (!latLon) return null;
        const earthRadiusKm = earth.earthRadiusKm;
        let maxAng = 0;
        outlineLocalPoints.forEach((p) => {
            const dot = THREE.MathUtils.clamp(center.dot(p.clone().normalize()), -1, 1);
            const ang = Math.acos(dot);
            if (ang > maxAng) maxAng = ang;
        });
        return {
            centroidLatLonDeg: {
                latDeg: THREE.MathUtils.radToDeg(latLon.latRad),
                lonDeg: THREE.MathUtils.radToDeg(latLon.lonRad)
            },
            boundingRadiusKm: maxAng * earthRadiusKm
        };
    };

    const getEarthRotationForTime = (simTimeSeconds) => {
        const daySeconds = 86400;
        const dayFrac = (((simTimeSeconds / daySeconds) % 1) + 1) % 1;
        return 2 * Math.PI * (dayFrac - 0.5);
    };

    const predictSatelliteSubpoint = (sat, baseSimTimeSeconds, targetSimTimeSeconds) => {
        const earth = earthRef.current;
        if (!sat?.orbit || !earth) return null;
        const dt = targetSimTimeSeconds - baseSimTimeSeconds;
        const { radius, speed, inclination, raan = 0, angle = 0 } = sat.orbit;
        if (!Number.isFinite(radius) || !Number.isFinite(speed)) return null;
        const nu = angle + speed * dt;
        const pos = new THREE.Vector3(
            radius * Math.cos(nu),
            0,
            radius * Math.sin(nu)
        );
        pos.applyMatrix4(new THREE.Matrix4().makeRotationX(inclination));
        pos.applyMatrix4(new THREE.Matrix4().makeRotationY(raan));
        const rotY = getEarthRotationForTime(targetSimTimeSeconds);
        pos.applyAxisAngle(new THREE.Vector3(0, 1, 0), -rotY);
        pos.normalize().multiplyScalar(earth.earthRadiusKm);
        return vectorToLatLonRad(pos);
    };

    const computeSelectionEligibility = (selection, simTimeSeconds) => {
        const playerId = currentPlayerRef.current?.id;
        if (!selection || !playerId) {
            return {
                image: { enabled: false, nextAccessSeconds: null, candidateIds: [] },
                sar: { enabled: false, nextAccessSeconds: null, candidateIds: [] }
            };
        }
        const centroid = selection.centroidLatLonDeg;
        if (!centroid) {
            return {
                image: { enabled: false, nextAccessSeconds: null, candidateIds: [] },
                sar: { enabled: false, nextAccessSeconds: null, candidateIds: [] }
            };
        }
        const centroidLatRad = THREE.MathUtils.degToRad(centroid.latDeg);
        const centroidLonRad = THREE.MathUtils.degToRad(centroid.lonDeg);
        const earthRadiusKm = earthRef.current?.earthRadiusKm ?? 6371;
        const selectionRadiusKm = selection.boundingRadiusKm ?? 0;
        const candidates = satellitesRef.current.filter(
            (sat) => sat.ownerId === playerId && sat.inHqRange === true
        );
        const evalSat = (sat, footprintRadiusKm) => {
            let earliest = null;
            for (let t = 0; t <= COLLECT_LOOKAHEAD_SECONDS; t += COLLECT_STEP_SECONDS) {
                const latLon = predictSatelliteSubpoint(sat, simTimeSeconds, simTimeSeconds + t);
                if (!latLon) continue;
                const dLat = latLon.latRad - centroidLatRad;
                const dLon = wrapRadToPi(latLon.lonRad - centroidLonRad);
                const sinDLat = Math.sin(dLat * 0.5);
                const sinDLon = Math.sin(dLon * 0.5);
                const a = sinDLat * sinDLat + Math.cos(latLon.latRad) * Math.cos(centroidLatRad) * sinDLon * sinDLon;
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                const distKm = earthRadiusKm * c;
                if (distKm <= footprintRadiusKm + selectionRadiusKm) {
                    earliest = t;
                    break;
                }
            }
            return earliest;
        };

        const imageCandidates = candidates.filter((sat) => sat.type === 'imaging');
        const sarCandidates = candidates.filter((sat) => sat.type === 'sar');
        const imageResult = { enabled: false, nextAccessSeconds: null, candidateIds: [] };
        const sarResult = { enabled: false, nextAccessSeconds: null, candidateIds: [] };

        imageCandidates.forEach((sat) => {
            const footprint = Number.isFinite(sat.revealRadius) ? sat.revealRadius : 0;
            if (!(footprint > 0)) return;
            const earliest = evalSat(sat, footprint);
            if (earliest == null) return;
            imageResult.candidateIds.push(sat.id);
            if (imageResult.nextAccessSeconds == null || earliest < imageResult.nextAccessSeconds) {
                imageResult.nextAccessSeconds = earliest;
            }
            imageResult.enabled = true;
        });

        sarCandidates.forEach((sat) => {
            const footprint = Number.isFinite(sat.sarFootprintRadiusKm)
                ? sat.sarFootprintRadiusKm
                : (Number.isFinite(sat.revealRadius) ? sat.revealRadius : 0);
            if (!(footprint > 0)) return;
            const earliest = evalSat(sat, footprint);
            if (earliest == null) return;
            sarResult.candidateIds.push(sat.id);
            if (sarResult.nextAccessSeconds == null || earliest < sarResult.nextAccessSeconds) {
                sarResult.nextAccessSeconds = earliest;
            }
            sarResult.enabled = true;
        });

        return { image: imageResult, sar: sarResult };
    };

    const getEarthClickLatLonDeg = (event) => {
        const earth = earthRef.current;
        if (!earth?.mesh || !cameraRef.current) return null;
        const mouse = new THREE.Vector2(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, cameraRef.current);
        const intersects = raycaster.intersectObject(earth.mesh);
        if (intersects.length === 0) return null;
        const localPoint = intersects[0].point.clone();
        earth.parentObject.worldToLocal(localPoint);
        const latLon = vectorToLatLonRad(localPoint);
        if (!latLon) return null;
        return {
            latDeg: THREE.MathUtils.radToDeg(latLon.latRad),
            lonDeg: THREE.MathUtils.radToDeg(latLon.lonRad)
        };
    };

    const updateCursorLatLon = (latLon) => {
        if (!latLon) {
            if (cursorLatLonRef.current) {
                cursorLatLonRef.current = null;
                setCursorLatLon(null);
            }
            return;
        }
        const prev = cursorLatLonRef.current;
        const next = { latDeg: latLon.latDeg, lonDeg: latLon.lonDeg };
        if (
            prev
            && Math.abs(prev.latDeg - next.latDeg) < 0.1
            && Math.abs(prev.lonDeg - next.lonDeg) < 0.1
        ) {
            return;
        }
        cursorLatLonRef.current = next;
        setCursorLatLon(next);
    };

    const createAnchorMesh = () => {
        const size = 80;
        const material = new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.9,
            depthWrite: false
        });
        const geomX = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-size, 0, 0),
            new THREE.Vector3(size, 0, 0)
        ]);
        const geomY = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, -size, 0),
            new THREE.Vector3(0, size, 0)
        ]);
        const lineX = new THREE.Line(geomX, material);
        const lineY = new THREE.Line(geomY, material);
        const group = new THREE.Group();
        group.add(lineX);
        group.add(lineY);
        group.renderOrder = 8;
        return group;
    };

    const clearAnchor = () => {
        const earth = earthRef.current;
        if (anchorMeshRef.current && earth?.parentObject) {
            earth.parentObject.remove(anchorMeshRef.current);
            anchorMeshRef.current.traverse((child) => {
                if (child.geometry?.dispose) child.geometry.dispose();
                if (child.material?.dispose) child.material.dispose();
            });
        }
        anchorMeshRef.current = null;
        anchorLatLonRef.current = null;
        anchorLockRef.current = null;
        setAnchorLatLon(null);
        if (controlsRef.current) {
            controlsRef.current.enableRotate = true;
            controlsRef.current.enablePan = true;
            const center = new THREE.Vector3();
            earth?.parentObject?.getWorldPosition?.(center);
            controlsRef.current.target.copy(center);
            controlsRef.current.update();
        }
    };

    const setAnchorAtLatLon = (latDeg, lonDeg) => {
        const earth = earthRef.current;
        if (!earth?.parentObject || !earth?._latLonToVector3) return;
        const radius = earth.earthRadiusKm + 18;
        const localPos = earth._latLonToVector3(latDeg, lonDeg, radius);
        let anchor = anchorMeshRef.current;
        if (!anchor) {
            anchor = createAnchorMesh();
            anchorMeshRef.current = anchor;
            earth.parentObject.add(anchor);
        }
        const normal = localPos.clone().normalize();
        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
        anchor.position.copy(localPos);
        anchor.quaternion.copy(quat);
        const localDir = earth._latLonToVector3(latDeg, lonDeg, 1).normalize();
        const camera = cameraRef.current;
        const distance = camera ? Math.max(earth.earthRadiusKm + 300, camera.position.length()) : earth.earthRadiusKm + 3000;
        anchorLockRef.current = { localDir, distance, isDragging: false };
        if (controlsRef.current) {
            controlsRef.current.enableRotate = true;
            controlsRef.current.enablePan = true;
        }
        anchorLatLonRef.current = { latDeg, lonDeg };
        setAnchorLatLon({ latDeg, lonDeg });
    };

    const getForecastTier = (player) => {
        const tier = Number(player?.forecastTechTier);
        if (!Number.isFinite(tier)) return 0;
        return Math.max(0, Math.min(4, Math.floor(tier)));
    };

    const getTierSpec = (tier) => {
        const t = Number(tier);
        if (!Number.isFinite(t)) return FORECAST_TECH_TIERS[0];
        return FORECAST_TECH_TIERS.find(spec => spec.tier === t) || FORECAST_TECH_TIERS[0];
    };

    const applyTierToPlayer = (player) => {
        if (!player) return;
        const tier = getForecastTier(player);
        const spec = getTierSpec(tier);
        player.unlockedForecastLeadsHours = Array.isArray(spec?.unlockedLeads)
            ? spec.unlockedLeads.slice()
            : [1, 3, 6];
    };

		const buildSensorGating = () => {
	        const earth = earthRef.current;
	        const player = currentPlayerRef.current;
	        if (!player || !earth) return null;
	        const playerId = player.id;
        const hqSites = hqSpheresRef.current
            .filter(hq => hq.ownerID === playerId && hq.hp > 0)
            .map(hq => {
                const pos = hq.position?.clone?.() ?? hq.sphere?.position?.clone?.();
                const latLon = vectorToLatLonRad(pos);
                return latLon ? { latRad: latLon.latRad, lonRad: latLon.lonRad } : null;
            })
            .filter(Boolean);
        const radarSites = hqSites.map((site) => ({
            latRad: site.latRad,
            lonRad: site.lonRad,
            radiusKm: DOPPLER_RADAR_RADIUS_KM
        }));

        const hasComms = satellitesRef.current.some(
            s => s.ownerId === playerId && s.type === 'communication' && s.inHqRange === true
        );
        const forecastTechTier = getForecastTier(player);
        const enabledWeatherSensors = {
            amv: forecastTechTier >= 1,
            soundings: forecastTechTier >= 2,
            radarNowcast: forecastTechTier >= 3,
            denseSurface: forecastTechTier >= 4
        };

			const imagingFootprints = [];
			const debugEntries = cloudWatchDebugRef.current ? [] : null;
			const tmpWorldPos = new THREE.Vector3();
			const tmpLocalPos = new THREE.Vector3();
			const tmpSubWorld = new THREE.Vector3();
			const tmpSubLocal = new THREE.Vector3();
			satellitesRef.current.forEach(sat => {
				if (sat.ownerId !== playerId) return;
				if (sat.type !== 'cloudWatch' || sat.inHqRange !== true) return;
				if (!sat.mesh?.getWorldPosition) return;
				sat.mesh.getWorldPosition(tmpWorldPos);
				tmpLocalPos.copy(tmpWorldPos);
				earth.parentObject?.worldToLocal?.(tmpLocalPos);
				const latLon = vectorToLatLonRad(tmpLocalPos);
				if (!latLon) return;
				const lonRadWorld = wrapRadToPi(latLon.lonRad);
				const lonRadGrid = wrapRadToPi(lonRadWorld + CLOUD_WATCH_GRID_LON_OFFSET_RAD);
				const radiusKm = sat.cloudFootprintRadiusKm ?? 0;
				if (!(radiusKm > 0)) return;
				imagingFootprints.push({
				latRad: latLon.latRad,
                lonRad: lonRadGrid,
                radiusKm
            });
				if (debugEntries) {
					tmpSubWorld.copy(tmpWorldPos).normalize().multiplyScalar(earth.earthRadiusKm);
					tmpSubLocal.copy(tmpSubWorld);
					earth.parentObject?.worldToLocal?.(tmpSubLocal);
					const subLatLon = vectorToLatLonRad(tmpSubLocal);
					const subLonRad = subLatLon ? wrapRadToPi(subLatLon.lonRad) : null;
					const toUnit = (latRad, lonRad) => {
						const cosLat = Math.cos(latRad);
						return new THREE.Vector3(
							cosLat * Math.sin(lonRad),
							Math.sin(latRad),
							cosLat * Math.cos(lonRad)
						);
					};
					let separationDeg = null;
					if (subLatLon) {
						const a = toUnit(latLon.latRad, lonRadWorld);
						const b = toUnit(subLatLon.latRad, subLonRad);
						const dot = Math.max(-1, Math.min(1, a.dot(b)));
						separationDeg = THREE.MathUtils.radToDeg(Math.acos(dot));
					}
					debugEntries.push({
						satId: sat.id,
						footprintLatRad: latLon.latRad,
						footprintLonRad: lonRadWorld,
						footprintLonRadGrid: lonRadGrid,
						subpointLatRad: subLatLon?.latRad ?? null,
						subpointLonRad: subLonRad,
						radiusKm,
						separationDeg
					});
				}
        });

        return {
            playerId,
            hasComms,
            hqSites,
            imagingFootprints,
            radarSites,
            radarCadenceSeconds: RADAR_CADENCE_SECONDS,
			cloudWatchDebugEntries: debugEntries,
            forecastTechTier,
            enabledWeatherSensors
        };
    };

    const applyCloudIntelVisibility = (sensorGating) => {
        const earth = earthRef.current;
        if (!earth) return;
        const hasCloudWatch = (sensorGating?.imagingFootprints?.length ?? 0) > 0;
        const showCloudIntel = showCloudObsRef.current && hasCloudWatch;
        if (sensorOnlyWeatherRef.current) {
            earth.setWeatherVisible(false);
            earth.setFogVisible(false);
        } else {
            earth.setWeatherVisible(false);
            earth.setFogVisible(showFogLayerRef.current);
        }
        earth.setCloudObsVisible(showCloudIntel);
    };

    const normalizeLonDeg = (lonDeg) => {
        let v = lonDeg;
        if (v >= 180) v -= 360;
        if (v < -180) v += 360;
        return v;
    };

    const wrapLonDeltaDeg = (lonDeg, refLonDeg) => {
        let d = lonDeg - refLonDeg;
        while (d > 180) d -= 360;
        while (d < -180) d += 360;
        return d;
    };

    const getPlayerHasComms = (playerId) => {
        if (!playerId) return false;
        return satellitesRef.current.some(
            sat => sat.ownerId === playerId && sat.type === 'communication' && sat.inHqRange === true
        );
    };

    const getUnlockedForecastLeads = (player) => {
        const leads = player?.unlockedForecastLeadsHours;
        const base = Array.isArray(leads) && leads.length ? leads.slice() : DEFAULT_FORECAST_LEADS.slice();
        const hasComms = getPlayerHasComms(player?.id);
        const filtered = hasComms
            ? base
            : base.filter((h) => h !== 12 && h !== 24);
        return filtered.sort((a, b) => a - b);
    };

    const getUnlockedWarningHazards = (player) => {
        const hazards = player?.unlockedWarningHazards;
        return Array.isArray(hazards) && hazards.length ? hazards.slice() : ['heavyPrecip', 'highWinds'];
    };

    const buildHazardHitMask = ({ hazardType, forecastResult, leadIdx, grid, config, serviceMask }) => {
        if (!forecastResult || !grid || leadIdx < 0) return null;
        const hazardCfg = config.hazards[hazardType];
        if (!hazardCfg) return null;
        const { nx, ny } = grid;
        const N = nx * ny;
        if (!N) return null;
        if (!serviceMask || serviceMask.length !== N) return null;

        const precip = forecastResult.products.precipRateByLead?.[leadIdx];
        const wind = forecastResult.products.windSpeedByLead?.[leadIdx];
        const cloud = forecastResult.products.cloudTauByLead?.[leadIdx];
        const conf = forecastResult.products.confidenceByLead?.[leadIdx];

        const mask = new Uint8Array(N);
        const values = new Float32Array(N);
        let hitCount = 0;
        let serviceCellCount = 0;
        let maxVal = -Infinity;
        let maxK = -1;

        for (let k = 0; k < N; k++) {
            if (serviceMask[k] !== 1) continue;
            serviceCellCount += 1;
            const p = precip ? precip[k] : 0;
            const w = wind ? wind[k] : 0;
            const c = cloud ? cloud[k] : 0;
            const confVal = conf ? conf[k] : 0;
            const stormy = (p >= 0.1) || (c >= 4);

            let hazardVal = 0;
            if (hazardCfg.kind === 'precipRate') {
                hazardVal = p;
            } else if (hazardCfg.kind === 'windSpeed') {
                hazardVal = w;
            } else if (hazardCfg.kind === 'stormRisk') {
                hazardVal = (w / 50) * (p / 2) + (c / 20);
            }

            values[k] = hazardVal;

            let hit = hazardVal >= hazardCfg.threshold;
            if (hazardCfg.requireStormy || hazardCfg.kind === 'stormRisk') {
                hit = hit && stormy;
            }
            if (conf && confVal < config.confidenceMin) {
                hit = false;
            }

            if (hit) {
                mask[k] = 1;
                hitCount += 1;
                if (hazardVal > maxVal) {
                    maxVal = hazardVal;
                    maxK = k;
                }
            }
        }

        return {
            mask,
            values,
            hitCount,
            serviceCellCount,
            hitFracService: serviceCellCount ? hitCount / serviceCellCount : 0,
            thresholdUsed: hazardCfg.threshold,
            stormyGateUsed: Boolean(hazardCfg.requireStormy || hazardCfg.kind === 'stormRisk'),
            maxVal: Number.isFinite(maxVal) ? maxVal : null,
            maxK
        };
    };

    const labelConnectedComponents = (mask, nx, ny, values = null) => {
        const N = nx * ny;
        const labels = new Int32Array(N);
        const components = [];
        const queue = new Int32Array(N);
        let nextId = 0;

        for (let k = 0; k < N; k++) {
            if (!mask[k] || labels[k] !== 0) continue;
            nextId += 1;
            let head = 0;
            let tail = 0;
            queue[tail++] = k;
            labels[k] = nextId;

            let cellCount = 0;
            let maxVal = -Infinity;
            let maxK = -1;
            let minI = nx;
            let maxI = -1;
            let minJ = ny;
            let maxJ = -1;

            while (head < tail) {
                const idx = queue[head++];
                cellCount += 1;
                const j = Math.floor(idx / nx);
                const i = idx - j * nx;
                if (i < minI) minI = i;
                if (i > maxI) maxI = i;
                if (j < minJ) minJ = j;
                if (j > maxJ) maxJ = j;

                const v = values ? values[idx] : 1;
                if (v > maxVal) {
                    maxVal = v;
                    maxK = idx;
                }

                if (i > 0) {
                    const n = idx - 1;
                    if (mask[n] && labels[n] === 0) {
                        labels[n] = nextId;
                        queue[tail++] = n;
                    }
                }
                if (i < nx - 1) {
                    const n = idx + 1;
                    if (mask[n] && labels[n] === 0) {
                        labels[n] = nextId;
                        queue[tail++] = n;
                    }
                }
                if (j > 0) {
                    const n = idx - nx;
                    if (mask[n] && labels[n] === 0) {
                        labels[n] = nextId;
                        queue[tail++] = n;
                    }
                }
                if (j < ny - 1) {
                    const n = idx + nx;
                    if (mask[n] && labels[n] === 0) {
                        labels[n] = nextId;
                        queue[tail++] = n;
                    }
                }
            }

            components.push({
                id: nextId,
                cellCount,
                maxVal: Number.isFinite(maxVal) ? maxVal : null,
                maxK,
                bbox: { minI, maxI, minJ, maxJ }
            });
        }

        return { labels, components };
    };

    const traceBoundaryPolygonsFromLabels = (labels, nx, ny, componentId, grid) => {
        if (!labels || !nx || !ny) return null;
        const cornerStride = nx + 1;
        const edges = [];
        const addEdge = (i0, j0, i1, j1) => {
            edges.push({
                start: j0 * cornerStride + i0,
                end: j1 * cornerStride + i1
            });
        };

        for (let j = 0; j < ny; j++) {
            const row = j * nx;
            for (let i = 0; i < nx; i++) {
                const k = row + i;
                if (labels[k] !== componentId) continue;

                if (j === 0 || labels[(j - 1) * nx + i] !== componentId) {
                    addEdge(i + 1, j, i, j);
                }
                if (j === ny - 1 || labels[(j + 1) * nx + i] !== componentId) {
                    addEdge(i, j + 1, i + 1, j + 1);
                }
                if (i === 0 || labels[row + i - 1] !== componentId) {
                    addEdge(i, j, i, j + 1);
                }
                if (i === nx - 1 || labels[row + i + 1] !== componentId) {
                    addEdge(i + 1, j + 1, i + 1, j);
                }
            }
        }

        if (edges.length === 0) return null;

        const byStart = new Map();
        edges.forEach((edge, idx) => {
            const list = byStart.get(edge.start);
            if (list) {
                list.push(idx);
            } else {
                byStart.set(edge.start, [idx]);
            }
        });

        const used = new Uint8Array(edges.length);
        const rings = [];

        for (let e = 0; e < edges.length; e++) {
            if (used[e]) continue;
            const startKey = edges[e].start;
            let currentKey = startKey;
            let currentIdx = e;
            const ringKeys = [];

            while (true) {
                const edge = edges[currentIdx];
                used[currentIdx] = 1;
                if (ringKeys.length === 0) ringKeys.push(edge.start);
                ringKeys.push(edge.end);
                currentKey = edge.end;
                if (currentKey === startKey) break;
                const nextList = byStart.get(currentKey);
                if (!nextList) break;
                let nextIdx = -1;
                for (let n = 0; n < nextList.length; n++) {
                    const candidate = nextList[n];
                    if (!used[candidate]) {
                        nextIdx = candidate;
                        break;
                    }
                }
                if (nextIdx < 0) break;
                currentIdx = nextIdx;
            }

            if (ringKeys.length < 4) continue;
            if (ringKeys[0] === ringKeys[ringKeys.length - 1]) {
                ringKeys.pop();
            }
            if (ringKeys.length >= 3) rings.push(ringKeys);
        }

        if (!rings.length) return null;

        const cellLatDeg = grid.cellLatDeg ?? (180 / ny);
        const cellLonDeg = grid.cellLonDeg ?? (360 / nx);
        const latEdge = (j) => 90 - j * cellLatDeg;
        const lonEdge = (i) => -180 + i * cellLonDeg;

        let bestRing = null;
        for (const ring of rings) {
            if (!bestRing || ring.length > bestRing.length) {
                bestRing = ring;
            }
        }
        if (!bestRing) return null;

        const vertices = [];
        for (let r = 0; r < bestRing.length; r++) {
            const key = bestRing[r];
            const j = Math.floor(key / cornerStride);
            const i = key - j * cornerStride;
            const latDeg = latEdge(j);
            const lonDeg = normalizeLonDeg(lonEdge(i));
            const prev = vertices[vertices.length - 1];
            if (!prev || prev.latDeg !== latDeg || prev.lonDeg !== lonDeg) {
                vertices.push({ latDeg, lonDeg });
            }
        }
        return vertices.length >= 3 ? vertices : null;
    };

    const pointLineDistance = (p, a, b) => {
        const x0 = p.lonDeg;
        const y0 = p.latDeg;
        const x1 = a.lonDeg;
        const y1 = a.latDeg;
        const x2 = b.lonDeg;
        const y2 = b.latDeg;
        const dx = x2 - x1;
        const dy = y2 - y1;
        if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
            return Math.hypot(x0 - x1, y0 - y1);
        }
        const num = Math.abs(dy * x0 - dx * y0 + x2 * y1 - y2 * x1);
        const den = Math.hypot(dx, dy);
        return num / den;
    };

    const simplifyRdp = (points, epsilon) => {
        if (points.length <= 2) return points;
        const first = points[0];
        const last = points[points.length - 1];
        let maxDist = -1;
        let idx = -1;
        for (let i = 1; i < points.length - 1; i++) {
            const d = pointLineDistance(points[i], first, last);
            if (d > maxDist) {
                maxDist = d;
                idx = i;
            }
        }
        if (maxDist > epsilon && idx > 0) {
            const left = simplifyRdp(points.slice(0, idx + 1), epsilon);
            const right = simplifyRdp(points.slice(idx), epsilon);
            return left.slice(0, -1).concat(right);
        }
        return [first, last];
    };

    const simplifyPolygon = (points, epsilon) => {
        if (!points || points.length < 4) return points;
        const first = points[0];
        const last = points[points.length - 1];
        let pts = points;
        if (first.latDeg === last.latDeg && first.lonDeg === last.lonDeg) {
            pts = points.slice(0, -1);
        }
        const simplified = simplifyRdp(pts, epsilon);
        if (simplified.length < 3) return pts;
        return simplified;
    };

    const getAutoWarningAreaCap = (hazardType, leadHours) => {
        const table = AUTO_WARNING_CONFIG.maxAreaFracByHazardByLead?.[hazardType];
        if (!table) return AUTO_WARNING_CONFIG.maxHitFracServiceArea;
        const leads = Object.keys(table)
            .map(Number)
            .filter((v) => Number.isFinite(v))
            .sort((a, b) => a - b);
        if (leads.length === 0) return AUTO_WARNING_CONFIG.maxHitFracServiceArea;
        let chosen = leads[0];
        for (let i = 0; i < leads.length; i++) {
            if (leadHours >= leads[i]) chosen = leads[i];
        }
        return table[chosen] ?? AUTO_WARNING_CONFIG.maxHitFracServiceArea;
    };

    const buildAutoWarningsFromForecast = ({
        forecastResult,
        grid,
        issuedAtSimTimeSeconds,
        leadHours,
        durationHours,
        allowedHazards,
        maxPolygonsPerHazard,
        mode = 'warning'
    }) => {
        if (!forecastResult || !grid) return [];
        const leadIdx = forecastResult.leadHours.indexOf(leadHours);
        if (leadIdx < 0) return [];
        const confValues = forecastResult.products?.confidenceByLead?.[leadIdx] ?? null;

        const nextWarnings = [];
        const config = AUTO_WARNING_CONFIG;
        const hazardTypes = Array.isArray(allowedHazards) && allowedHazards.length
            ? allowedHazards
            : Object.keys(config.hazards);
        const maxPolygons = Number.isFinite(maxPolygonsPerHazard)
            ? maxPolygonsPerHazard
            : config.maxPolygonsPerHazard;
        const serviceMask = getServiceMask(grid);
        if (!serviceMask || serviceMask.length !== grid.nx * grid.ny) {
            hazardTypes.forEach((hazardType) => {
                earthRef.current?.logWeatherEvent?.(
                    'autoWarningCandidate',
                    {
                        forecastRunId: forecastResult.runId,
                        playerId: forecastResult.playerId,
                        hazardType,
                        leadHours,
                        reason: 'noServiceMask',
                        grid: { nx: grid.nx, ny: grid.ny }
                    },
                    { simTimeSeconds: issuedAtSimTimeSeconds }
                );
            });
            return [];
        }
        let serviceCellCount = 0;
        for (let k = 0; k < serviceMask.length; k++) {
            if (serviceMask[k] === 1) serviceCellCount += 1;
        }
        if (serviceCellCount === 0) {
            hazardTypes.forEach((hazardType) => {
                earthRef.current?.logWeatherEvent?.(
                    'autoWarningCandidate',
                    {
                        forecastRunId: forecastResult.runId,
                        playerId: forecastResult.playerId,
                        hazardType,
                        leadHours,
                        reason: 'noServiceMask',
                        grid: { nx: grid.nx, ny: grid.ny }
                    },
                    { simTimeSeconds: issuedAtSimTimeSeconds }
                );
            });
            return [];
        }
        const weights = getAreaWeights(grid);
        let serviceAreaW = 0;
        if (weights) {
            const { nx, ny } = grid;
            for (let j = 0; j < ny; j++) {
                const row = j * nx;
                const w = weights[j] || 0;
                for (let i = 0; i < nx; i++) {
                    const k = row + i;
                    if (serviceMask[k] === 1) serviceAreaW += w;
                }
            }
        }

        const getLatLonFromK = (k) => {
            if (!(k >= 0) || !grid?.nx || !grid?.latDeg || !grid?.lonDeg) return null;
            const j = Math.floor(k / grid.nx);
            const i = k - j * grid.nx;
            return { latDeg: grid.latDeg[j], lonDeg: grid.lonDeg[i] };
        };

        hazardTypes.forEach((hazardType) => {
            const hazardCfg = config.hazards[hazardType];
            if (!hazardCfg) return;
            const maskResult = buildHazardHitMask({
                hazardType,
                forecastResult,
                leadIdx,
                grid,
                config,
                serviceMask
            });
            if (!maskResult || !maskResult.mask) return;

            const hitFracService = maskResult.hitFracService ?? 0;
            let reason = null;
            if (!(maskResult.hitCount > 0)) {
                reason = 'noHit';
            } else if (hitFracService > config.maxHitFracServiceArea) {
                reason = 'tooBroadServiceArea';
            }

            const baseLog = {
                forecastRunId: forecastResult.runId,
                playerId: forecastResult.playerId,
                hazardType,
                leadHours,
                confidenceMin: config.confidenceMin,
                thresholdUsed: maskResult.thresholdUsed,
                stormyGateUsed: maskResult.stormyGateUsed,
                hitCount: maskResult.hitCount,
                serviceCellCount: maskResult.serviceCellCount,
                hitFracService,
                grid: { nx: grid.nx, ny: grid.ny }
            };

            if (reason) {
                earthRef.current?.logWeatherEvent?.(
                    'autoWarningCandidate',
                    {
                        ...baseLog,
                        reason
                    },
                    { simTimeSeconds: issuedAtSimTimeSeconds }
                );
                return;
            }

            const { labels, components } = labelConnectedComponents(maskResult.mask, grid.nx, grid.ny, maskResult.values);
            const cap = getAutoWarningAreaCap(hazardType, leadHours);
            const filtered = [];
            for (const component of components) {
                if (component.cellCount < config.minComponentCells) continue;
                const { indices } = extractComponentMaskAndIndices(
                    labels,
                    component.id,
                    grid.nx * grid.ny,
                    component.cellCount
                );
                let compAreaW = 0;
                if (indices && weights && serviceAreaW > 0) {
                    for (let i = 0; i < indices.length; i++) {
                        const k = indices[i];
                        if (serviceMask[k] !== 1) continue;
                        const j = Math.floor(k / grid.nx);
                        compAreaW += weights[j] || 0;
                    }
                }
                const compFrac = serviceAreaW > 0 ? compAreaW / serviceAreaW : 0;
                if (compFrac > cap) {
                    earthRef.current?.logWeatherEvent?.(
                        'autoWarningCandidate',
                        {
                            ...baseLog,
                            reason: 'componentTooBroad',
                            compFrac,
                            cap,
                            componentCellCount: component.cellCount,
                            componentMaxVal: component.maxVal
                        },
                        { simTimeSeconds: issuedAtSimTimeSeconds }
                    );
                    continue;
            }
            filtered.push(component);
        }
        filtered.sort((a, b) => (b.maxVal ?? 0) - (a.maxVal ?? 0));
            const limited = filtered.slice(0, maxPolygons);

            if (limited.length === 0) {
                earthRef.current?.logWeatherEvent?.(
                    'autoWarningCandidate',
                    {
                        ...baseLog,
                        componentCount: components.length,
                        reason: 'allComponentsTooSmall'
                    },
                    { simTimeSeconds: issuedAtSimTimeSeconds }
                );
                return;
            }

            let polygonCount = 0;
            const isDraft = mode === 'draft';

            limited.forEach((component) => {
                const polygon = traceBoundaryPolygonsFromLabels(labels, grid.nx, grid.ny, component.id, grid);
                if (!polygon || polygon.length < 3) return;
                const simplified = simplifyPolygon(polygon, 0.75);
                if (!simplified || simplified.length < 3) return;

                const maxLoc = getLatLonFromK(component.maxK);
                const bbox = component.bbox;
                const cellLatDeg = grid.cellLatDeg ?? (180 / grid.ny);
                const cellLonDeg = grid.cellLonDeg ?? (360 / grid.nx);
                const cellLat = (j) => (grid.latDeg ? grid.latDeg[j] : 90 - (j + 0.5) * cellLatDeg);
                const cellLon = (i) => (grid.lonDeg ? grid.lonDeg[i] : -180 + (i + 0.5) * cellLonDeg);
                const minLat = Math.min(cellLat(bbox.minJ), cellLat(bbox.maxJ));
                const maxLat = Math.max(cellLat(bbox.minJ), cellLat(bbox.maxJ));
                const minLon = Math.min(cellLon(bbox.minI), cellLon(bbox.maxI));
                const maxLon = Math.max(cellLon(bbox.minI), cellLon(bbox.maxI));

                earthRef.current?.logWeatherEvent?.(
                    'autoWarningComponent',
                    {
                        ...baseLog,
                        componentCellCount: component.cellCount,
                        componentMaxVal: component.maxVal,
                        componentMaxLatLonDeg: maxLoc,
                        componentBbox: {
                            minLat,
                            maxLat,
                            minLon,
                            maxLon
                        },
                        polygonVertexCount: simplified.length
                    },
                    { simTimeSeconds: issuedAtSimTimeSeconds }
                );

                const maskResult = buildWarningGridMask(simplified, grid);
                let warningFrac = null;
                if (maskResult?.mask && weights && serviceAreaW > 0) {
                    let warningAreaW = 0;
                    const { mask } = maskResult;
                    const { nx, ny } = grid;
                    for (let j = 0; j < ny; j++) {
                        const row = j * nx;
                        const w = weights[j] || 0;
                        for (let i = 0; i < nx; i++) {
                            const k = row + i;
                            if (mask[k] === 1 && serviceMask[k] === 1) {
                                warningAreaW += w;
                            }
                        }
                    }
                    warningFrac = serviceAreaW > 0 ? warningAreaW / serviceAreaW : 0;
                    if (warningFrac > cap) {
                        earthRef.current?.logWeatherEvent?.(
                            'autoWarningCandidate',
                            {
                                ...baseLog,
                                reason: 'polygonTooBroad',
                                warningFrac,
                                cap,
                                polygonVertexCount: simplified.length
                            },
                            { simTimeSeconds: issuedAtSimTimeSeconds }
                        );
                        return;
                    }
                }
                if (isDraft) {
                    const meanConfidence = confValues
                        ? computeMeanConfidenceInWarning(confValues, maskResult?.mask, grid, serviceMask, weights)
                        : null;
                    const draft = {
                        id: `draft-${hazardType}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
                        playerId: forecastResult.playerId,
                        createdAtSimTimeSeconds: issuedAtSimTimeSeconds,
                        hazardType,
                        polygonLatLonDeg: simplified,
                        forecastRunId: forecastResult.runId,
                        forecastLeadHours: leadHours,
                        status: 'draft',
                        areaFracService: warningFrac,
                        meanConfidence,
                        componentCellCount: component.cellCount,
                        componentMaxVal: component.maxVal,
                        componentMaxLatLonDeg: maxLoc,
                        _gridMask: maskResult?.mask ?? null,
                        _gridMaskNx: maskResult?.nx ?? null,
                        _gridMaskNy: maskResult?.ny ?? null
                    };
                    nextWarnings.push(draft);
                    earthRef.current?.logWeatherEvent?.(
                        'autoWarningDraftCreated',
                        {
                            forecastRunId: forecastResult.runId,
                            playerId: forecastResult.playerId,
                            hazardType,
                            leadHours,
                            areaFracService: warningFrac,
                            cellCount: component.cellCount
                        },
                        { simTimeSeconds: issuedAtSimTimeSeconds }
                    );
                } else {
                    nextWarnings.push({
                        id: `warn-${hazardType}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
                        playerId: forecastResult.playerId,
                        issuedAtSimTimeSeconds,
                        validStartSimTimeSeconds: issuedAtSimTimeSeconds + leadHours * 3600,
                        validEndSimTimeSeconds: issuedAtSimTimeSeconds + (leadHours + durationHours) * 3600,
                        hazardType,
                        polygonLatLonDeg: simplified,
                        forecastRunId: forecastResult.runId,
                        forecastLeadHours: leadHours,
                        autoIssued: true,
                        componentCellCount: component.cellCount,
                        componentMaxVal: component.maxVal,
                        componentMaxLatLonDeg: maxLoc,
                        _gridMask: maskResult?.mask ?? null,
                        _gridMaskNx: maskResult?.nx ?? null,
                        _gridMaskNy: maskResult?.ny ?? null
                    });
                }
                polygonCount += 1;
            });

            earthRef.current?.logWeatherEvent?.(
                'autoWarningCandidate',
                {
                    ...baseLog,
                    componentCount: components.length,
                    polygonCount,
                    reason: polygonCount > 0 ? null : 'allComponentsTooSmall'
                },
                { simTimeSeconds: issuedAtSimTimeSeconds }
            );
        });

        return nextWarnings;
    };

    const getServiceMask = (grid) => {
        const player = currentPlayerRef.current;
        if (!player || !grid?.nx || !grid?.ny) return null;
        const hqs = hqSpheresRef.current.filter(hq => hq.ownerID === player.id && hq.hp > 0);
        const gridKey = `${grid.nx}x${grid.ny}`;
        const cache = serviceMaskRef.current;
        if (cache.playerId === player.id && cache.gridKey === gridKey && cache.hqCount === hqs.length && cache.mask) {
            return cache.mask;
        }

        const N = grid.nx * grid.ny;
        const mask = new Uint8Array(N);
        if (hqs.length === 0) {
            serviceMaskRef.current = { playerId: player.id, gridKey, hqCount: 0, mask };
            return mask;
        }

        const hqLocs = hqs.map(hq => {
            if (Number.isFinite(hq.latitude) && Number.isFinite(hq.longitude)) {
                return { latDeg: hq.latitude, lonDeg: hq.longitude };
            }
            const pos = hq.position?.clone?.() ?? hq.sphere?.position?.clone?.();
            const latLon = vectorToLatLonRad(pos);
            if (!latLon) return null;
            return {
                latDeg: THREE.MathUtils.radToDeg(latLon.latRad),
                lonDeg: THREE.MathUtils.radToDeg(latLon.lonRad)
            };
        }).filter(Boolean);

        const latDeg = grid.latDeg;
        const lonDeg = grid.lonDeg;
        const reKm = RE_M / 1000;
        for (let j = 0; j < grid.ny; j++) {
            const lat = latDeg ? latDeg[j] : 90 - (j + 0.5) * (180 / grid.ny);
            const latRad = THREE.MathUtils.degToRad(lat);
            const cosLat = Math.cos(latRad);
            const row = j * grid.nx;
            for (let i = 0; i < grid.nx; i++) {
                const lon = lonDeg ? lonDeg[i] : -180 + (i + 0.5) * (360 / grid.nx);
                let inRange = false;
                for (let h = 0; h < hqLocs.length; h++) {
                    const hq = hqLocs[h];
                    const dLat = THREE.MathUtils.degToRad(lat - hq.latDeg);
                    const dLon = THREE.MathUtils.degToRad(wrapLonDeltaDeg(lon, hq.lonDeg));
                    const distKm = reKm * Math.sqrt(dLat * dLat + (cosLat * dLon) * (cosLat * dLon));
                    if (distKm <= SERVICE_RADIUS_KM) {
                        inRange = true;
                        break;
                    }
                }
                if (inRange) mask[row + i] = 1;
            }
        }

        serviceMaskRef.current = { playerId: player.id, gridKey, hqCount: hqs.length, mask };
        return mask;
    };

    const getPlayerHqLatLonDegList = (playerId) => {
        if (!playerId) return [];
        return hqSpheresRef.current
            .filter(hq => hq.ownerID === playerId && hq.hp > 0)
            .map(hq => {
                if (Number.isFinite(hq.latitude) && Number.isFinite(hq.longitude)) {
                    return { latDeg: hq.latitude, lonDeg: hq.longitude };
                }
                const pos = hq.position?.clone?.() ?? hq.sphere?.position?.clone?.();
                const latLon = vectorToLatLonRad(pos);
                if (!latLon) return null;
                return {
                    latDeg: THREE.MathUtils.radToDeg(latLon.latRad),
                    lonDeg: THREE.MathUtils.radToDeg(latLon.lonRad)
                };
            })
            .filter(Boolean);
    };

    const buildRadarCoverageMask = (grid, hqLocs, radiusKm = DOPPLER_RADAR_RADIUS_KM) => {
        if (!grid?.nx || !grid?.ny) return null;
        const N = grid.nx * grid.ny;
        const mask = new Uint8Array(N);
        if (!hqLocs || hqLocs.length === 0) return mask;
        const latDeg = grid.latDeg;
        const lonDeg = grid.lonDeg;
        const reKm = RE_M / 1000;
        for (let j = 0; j < grid.ny; j++) {
            const lat = latDeg ? latDeg[j] : 90 - (j + 0.5) * (180 / grid.ny);
            const latRad = THREE.MathUtils.degToRad(lat);
            const cosLat = Math.cos(latRad);
            const row = j * grid.nx;
            for (let i = 0; i < grid.nx; i++) {
                const lon = lonDeg ? lonDeg[i] : -180 + (i + 0.5) * (360 / grid.nx);
                let inRange = false;
                for (let h = 0; h < hqLocs.length; h++) {
                    const hq = hqLocs[h];
                    const dLat = THREE.MathUtils.degToRad(lat - hq.latDeg);
                    const dLon = THREE.MathUtils.degToRad(wrapLonDeltaDeg(lon, hq.lonDeg));
                    const distKm = reKm * Math.sqrt(dLat * dLat + (cosLat * dLon) * (cosLat * dLon));
                    if (distKm <= radiusKm) {
                        inRange = true;
                        break;
                    }
                }
                if (inRange) mask[row + i] = 1;
            }
        }
        return mask;
    };

    const computeWeightedMeanWithMask = (values, weights, mask, nx, ny) => {
        if (!values || !weights || !mask) return null;
        let sum = 0;
        let sumW = 0;
        for (let j = 0; j < ny; j++) {
            const w = weights[j] || 0;
            if (w <= 0) continue;
            const row = j * nx;
            for (let i = 0; i < nx; i++) {
                const k = row + i;
                if (mask[k] !== 1) continue;
                sum += w * (values[k] ?? 0);
                sumW += w;
            }
        }
        return sumW > 0 ? sum / sumW : null;
    };

    const buildTruthEventMask = ({ hazardType, grid, fields, serviceMask }) => {
        if (!grid?.nx || !grid?.ny || !fields) return null;
        const N = grid.nx * grid.ny;
        const mask = new Uint8Array(N);
        const values = new Float32Array(N);
        const threshold = hazardType === 'heavyPrecip'
            ? EVENT_THRESHOLDS.heavyPrecip
            : hazardType === 'severeStormRisk'
                ? EVENT_THRESHOLDS.severeStormRisk
                : EVENT_THRESHOLDS.highWinds;
        const precip = fields.precipRate;
        const u = fields.u;
        const v = fields.v;
        const tauLow = fields.tauLow;
        const tauHigh = fields.tauHigh;
        let hitCount = 0;
        let maxVal = -Infinity;
        let maxK = -1;
        for (let k = 0; k < N; k++) {
            if (serviceMask && serviceMask[k] !== 1) continue;
            let val = 0;
            if (hazardType === 'heavyPrecip') {
                val = precip ? precip[k] : 0;
            } else if (hazardType === 'highWinds') {
                const uVal = u ? u[k] : 0;
                const vVal = v ? v[k] : 0;
                val = Math.hypot(uVal, vVal);
            } else if (hazardType === 'severeStormRisk') {
                const p = precip ? precip[k] : 0;
                const uVal = u ? u[k] : 0;
                const vVal = v ? v[k] : 0;
                const w = Math.hypot(uVal, vVal);
                const c = (tauLow ? tauLow[k] : 0) + (tauHigh ? tauHigh[k] : 0);
                val = (w / 50) * (p / 2) + (c / 20);
            }
            values[k] = val;
            const stormy = hazardType === 'severeStormRisk'
                ? ((precip ? precip[k] : 0) >= 0.1)
                    || (((tauLow ? tauLow[k] : 0) + (tauHigh ? tauHigh[k] : 0)) >= 4)
                : true;
            if (val >= threshold && stormy) {
                mask[k] = 1;
                hitCount += 1;
                if (val > maxVal) {
                    maxVal = val;
                    maxK = k;
                }
            }
        }
        return {
            mask,
            values,
            hitCount,
            threshold,
            maxVal: Number.isFinite(maxVal) ? maxVal : null,
            maxK
        };
    };

	const extractComponentMask = (labels, componentId, N) => {
		const mask = new Uint8Array(N);
		for (let k = 0; k < N; k++) {
			if (labels[k] === componentId) mask[k] = 1;
		}
		return mask;
	};

	const extractComponentMaskAndIndices = (labels, componentId, N, expectedCount = null) => {
		const mask = new Uint8Array(N);
		const indices = expectedCount && expectedCount > 0 ? new Int32Array(expectedCount) : null;
		let cursor = 0;
		for (let k = 0; k < N; k++) {
			if (labels[k] !== componentId) continue;
			mask[k] = 1;
			if (indices) {
				if (cursor < indices.length) indices[cursor] = k;
				cursor += 1;
			}
		}
		if (indices && cursor !== indices.length) {
			return { mask, indices: indices.slice(0, cursor) };
		}
		return { mask, indices };
	};

	const computeWeightedAreaFromIndices = (indices, grid) => {
		if (!indices || !grid?.nx || !grid?.ny) return 0;
		const weights = getAreaWeights(grid);
		if (!weights) return 0;
		const nx = grid.nx;
		let area = 0;
		for (let i = 0; i < indices.length; i++) {
			const k = indices[i];
			const j = Math.floor(k / nx);
			area += weights[j] || 0;
		}
		return area;
	};

	const computeWeightedIoUFromIndices = (warningMask, warningArea, sample, grid) => {
		if (!warningMask || !sample?.indices || !grid?.nx || !grid?.ny) return 0;
		const weights = getAreaWeights(grid);
		if (!weights) return 0;
		const nx = grid.nx;
		const indices = sample.indices;
		let inter = 0;
		for (let i = 0; i < indices.length; i++) {
			const k = indices[i];
			if (warningMask[k] === 1) {
				const j = Math.floor(k / nx);
				inter += weights[j] || 0;
			}
		}
		const eventArea = Number.isFinite(sample.areaW) ? sample.areaW : computeWeightedAreaFromIndices(indices, grid);
		const union = warningArea + eventArea - inter;
		return union > 0 ? inter / union : 0;
	};

	const getWarningWeightedArea = (warning, warningMask, grid) => {
		if (!warning || !warningMask || !grid?.nx || !grid?.ny) return 0;
		const gridKey = `${grid.nx}x${grid.ny}`;
		if (Number.isFinite(warning._weightedArea) && warning._weightedAreaGridKey === gridKey) {
			return warning._weightedArea;
		}
		const weights = getAreaWeights(grid);
		if (!weights) return 0;
		const { nx, ny } = grid;
		let area = 0;
		for (let j = 0; j < ny; j++) {
			const w = weights[j] || 0;
			if (w <= 0) continue;
			const row = j * nx;
			for (let i = 0; i < nx; i++) {
				const k = row + i;
				if (warningMask[k] === 1) area += w;
			}
		}
		warning._weightedArea = area;
		warning._weightedAreaGridKey = gridKey;
		return area;
	};

	const computeBestEventIoUInWindow = (event, warningMask, warningArea, grid, windowStart, windowEnd) => {
		if (!event || !warningMask || !grid?.nx || !grid?.ny) return 0;
		const t0 = Number(windowStart);
		const t1 = Number(windowEnd);
		const start = Number.isFinite(t0) ? t0 : -Infinity;
		const end = Number.isFinite(t1) ? t1 : Infinity;
		let best = 0;
		const samples = event.footprintSamples;
		if (Array.isArray(samples) && samples.length > 0) {
			for (let i = 0; i < samples.length; i++) {
				const s = samples[i];
				if (!s) continue;
				const t = s.t;
				if (Number.isFinite(t) && (t < start || t > end)) continue;
				const iou = computeWeightedIoUFromIndices(warningMask, warningArea, s, grid);
				if (iou > best) best = iou;
			}
		}
		if (best > 0) return best;

		const masks = [];
		if (event.maskAtPeak && Number.isFinite(event.peakSimTimeSeconds) && event.peakSimTimeSeconds >= start && event.peakSimTimeSeconds <= end) {
			masks.push(event.maskAtPeak);
		}
		if (event.lastMask && Number.isFinite(event.lastSeenSimTimeSeconds) && event.lastSeenSimTimeSeconds >= start && event.lastSeenSimTimeSeconds <= end) {
			masks.push(event.lastMask);
		}
		for (let i = 0; i < masks.length; i++) {
			const iou = computeWeightedIoU(warningMask, masks[i], grid);
			if (iou > best) best = iou;
		}
		return best;
	};

    const computeMaskCentroid = (mask, grid) => {
        const { nx, ny, latDeg, lonDeg } = grid;
        let count = 0;
        let sumLat = 0;
        let sumLon = 0;
        for (let j = 0; j < ny; j++) {
            const lat = latDeg ? latDeg[j] : 90 - (j + 0.5) * (180 / ny);
            const row = j * nx;
            for (let i = 0; i < nx; i++) {
                const k = row + i;
                if (!mask[k]) continue;
                const lon = lonDeg ? lonDeg[i] : -180 + (i + 0.5) * (360 / nx);
                sumLat += lat;
                sumLon += lon;
                count += 1;
            }
        }
        if (count === 0) return { count: 0, centroid: null };
        return {
            count,
            centroid: { latDeg: sumLat / count, lonDeg: sumLon / count }
        };
    };

    const getGridLatLonFromIndex = (k, grid) => {
        if (!(k >= 0) || !grid?.nx || !grid?.ny) return null;
        const j = Math.floor(k / grid.nx);
        const i = k - j * grid.nx;
        const latDeg = grid.latDeg ? grid.latDeg[j] : 90 - (j + 0.5) * (180 / grid.ny);
        const lonDeg = grid.lonDeg ? grid.lonDeg[i] : -180 + (i + 0.5) * (360 / grid.nx);
        return { latDeg, lonDeg };
    };

    const computeMaskIoU = (maskA, maskB) => {
        let inter = 0;
        let union = 0;
        for (let k = 0; k < maskA.length; k++) {
            const a = maskA[k] === 1;
            const b = maskB[k] === 1;
            if (a || b) union += 1;
            if (a && b) inter += 1;
        }
        return union > 0 ? inter / union : 0;
    };

    const getAreaWeights = (grid) => {
        if (!grid?.ny || !grid?.nx) return null;
        const gridKey = `${grid.nx}x${grid.ny}`;
        const cache = areaWeightsRef.current;
        if (cache.gridKey === gridKey && Array.isArray(cache.weights)) {
            return cache.weights;
        }
        const weights = new Array(grid.ny);
        for (let j = 0; j < grid.ny; j++) {
            const latDeg = grid.latDeg ? grid.latDeg[j] : 90 - (j + 0.5) * (180 / grid.ny);
            const latRad = THREE.MathUtils.degToRad(latDeg);
            weights[j] = Math.max(0, Math.cos(latRad));
        }
        areaWeightsRef.current = { gridKey, weights };
        return weights;
    };

    const computeWeightedIoU = (maskA, maskB, grid) => {
        if (!maskA || !maskB || !grid?.nx || !grid?.ny) return 0;
        const weights = getAreaWeights(grid);
        if (!weights) return 0;
        let inter = 0;
        let union = 0;
        const { nx, ny } = grid;
        for (let j = 0; j < ny; j++) {
            const w = weights[j] || 0;
            const row = j * nx;
            for (let i = 0; i < nx; i++) {
                const k = row + i;
                const a = maskA[k] === 1;
                const b = maskB[k] === 1;
                if (a || b) union += w;
                if (a && b) inter += w;
            }
        }
        return union > 0 ? inter / union : 0;
    };

    const computeServiceAreaW = (grid) => {
        const serviceMask = getServiceMask(grid);
        const weights = getAreaWeights(grid);
        if (!serviceMask || !weights || !grid?.nx || !grid?.ny) return 0;
        const { nx, ny } = grid;
        let areaW = 0;
        for (let j = 0; j < ny; j++) {
            const w = weights[j] || 0;
            const row = j * nx;
            for (let i = 0; i < nx; i++) {
                const k = row + i;
                if (serviceMask[k] === 1) areaW += w;
            }
        }
        return areaW;
    };

    const computeWarningAreaFracService = (warningMask, grid, serviceMask, weights) => {
        if (!warningMask || !grid?.nx || !grid?.ny || !serviceMask || !weights) return null;
        const { nx, ny } = grid;
        const serviceAreaW = computeServiceAreaW(grid);
        if (!(serviceAreaW > 0)) return null;
        let warningAreaW = 0;
        for (let j = 0; j < ny; j++) {
            const w = weights[j] || 0;
            const row = j * nx;
            for (let i = 0; i < nx; i++) {
                const k = row + i;
                if (serviceMask[k] === 1 && warningMask[k] === 1) warningAreaW += w;
            }
        }
        return warningAreaW / serviceAreaW;
    };

    const computeMeanConfidenceInWarning = (confValues, warningMask, grid, serviceMask, weights) => {
        if (!confValues || !warningMask || !grid?.nx || !grid?.ny || !serviceMask || !weights) return null;
        const { nx, ny } = grid;
        let sum = 0;
        let sumW = 0;
        for (let j = 0; j < ny; j++) {
            const w = weights[j] || 0;
            const row = j * nx;
            for (let i = 0; i < nx; i++) {
                const k = row + i;
                if (serviceMask[k] !== 1 || warningMask[k] !== 1) continue;
                const v = confValues[k] ?? 0;
                sum += w * v;
                sumW += w;
            }
        }
        if (sumW <= 0) return null;
        return sum / sumW;
    };

    const computeWeightedMetrics = (truth, forecast, weights, serviceMask, nx, ny) => {
        if (!truth || !forecast || !weights || !serviceMask) return null;
        let sumW = 0;
        let sumT = 0;
        let sumF = 0;
        for (let j = 0; j < ny; j++) {
            const w = weights[j] || 0;
            if (w <= 0) continue;
            const row = j * nx;
            for (let i = 0; i < nx; i++) {
                const k = row + i;
                if (serviceMask[k] !== 1) continue;
                const t = truth[k] ?? 0;
                const f = forecast[k] ?? 0;
                sumW += w;
                sumT += w * t;
                sumF += w * f;
            }
        }
        if (sumW <= 0) return null;
        const meanT = sumT / sumW;
        const meanF = sumF / sumW;
        let sumAbsErr = 0;
        let sumSqErr = 0;
        let cov = 0;
        let varT = 0;
        let varF = 0;
        for (let j = 0; j < ny; j++) {
            const w = weights[j] || 0;
            if (w <= 0) continue;
            const row = j * nx;
            for (let i = 0; i < nx; i++) {
                const k = row + i;
                if (serviceMask[k] !== 1) continue;
                const t = truth[k] ?? 0;
                const f = forecast[k] ?? 0;
                const err = f - t;
                sumAbsErr += w * Math.abs(err);
                sumSqErr += w * err * err;
                const dt = t - meanT;
                const df = f - meanF;
                cov += w * dt * df;
                varT += w * dt * dt;
                varF += w * df * df;
            }
        }
        const rmse = Math.sqrt(sumSqErr / sumW);
        const mae = sumAbsErr / sumW;
        const denom = Math.sqrt(varT * varF);
        const corr = denom > 0 ? cov / denom : null;
        return { rmse, mae, corr };
    };

    const computeWeightedWindMetrics = (uArr, vArr, forecast, weights, serviceMask, nx, ny) => {
        if (!uArr || !vArr || !forecast || !weights || !serviceMask) return null;
        let sumW = 0;
        let sumT = 0;
        let sumF = 0;
        for (let j = 0; j < ny; j++) {
            const w = weights[j] || 0;
            if (w <= 0) continue;
            const row = j * nx;
            for (let i = 0; i < nx; i++) {
                const k = row + i;
                if (serviceMask[k] !== 1) continue;
                const t = Math.hypot(uArr[k] ?? 0, vArr[k] ?? 0);
                const f = forecast[k] ?? 0;
                sumW += w;
                sumT += w * t;
                sumF += w * f;
            }
        }
        if (sumW <= 0) return null;
        const meanT = sumT / sumW;
        const meanF = sumF / sumW;
        let sumAbsErr = 0;
        let sumSqErr = 0;
        let cov = 0;
        let varT = 0;
        let varF = 0;
        for (let j = 0; j < ny; j++) {
            const w = weights[j] || 0;
            if (w <= 0) continue;
            const row = j * nx;
            for (let i = 0; i < nx; i++) {
                const k = row + i;
                if (serviceMask[k] !== 1) continue;
                const t = Math.hypot(uArr[k] ?? 0, vArr[k] ?? 0);
                const f = forecast[k] ?? 0;
                const err = f - t;
                sumAbsErr += w * Math.abs(err);
                sumSqErr += w * err * err;
                const dt = t - meanT;
                const df = f - meanF;
                cov += w * dt * df;
                varT += w * dt * dt;
                varF += w * df * df;
            }
        }
        const rmse = Math.sqrt(sumSqErr / sumW);
        const mae = sumAbsErr / sumW;
        const denom = Math.sqrt(varT * varF);
        const corr = denom > 0 ? cov / denom : null;
        return { rmse, mae, corr };
    };

    const computeWeightedMean = (values, weights, serviceMask, nx, ny) => {
        if (!values || !weights || !serviceMask) return null;
        let sumW = 0;
        let sum = 0;
        for (let j = 0; j < ny; j++) {
            const w = weights[j] || 0;
            if (w <= 0) continue;
            const row = j * nx;
            for (let i = 0; i < nx; i++) {
                const k = row + i;
                if (serviceMask[k] !== 1) continue;
                const v = values[k] ?? 0;
                sumW += w;
                sum += w * v;
            }
        }
        return sumW > 0 ? sum / sumW : null;
    };

    const getWarningMaskForScoring = (warning, grid) => {
        if (!warning) return null;
        if (warning._gridMask && warning._gridMaskNx === grid.nx && warning._gridMaskNy === grid.ny) {
            return warning._gridMask;
        }
        const maskResult = buildWarningGridMask(warning.polygonLatLonDeg, grid);
        if (!maskResult) return null;
        warning._gridMask = maskResult.mask;
        warning._gridMaskNx = maskResult.nx;
        warning._gridMaskNy = maskResult.ny;
        return warning._gridMask;
    };

    const clampReputation = (value) => Math.max(0, Math.min(100, value));
    const formatMoneyDelta = (delta) => {
        const sign = delta >= 0 ? '+' : '-';
        const amount = Math.round(Math.abs(delta) / 1_000_000);
        return `${sign}$${amount}M`;
    };
    const formatRepDelta = (delta) => `${delta >= 0 ? '+' : ''}${delta}`;

    const applyPlayerScoreDelta = (player, moneyDelta, repDelta) => {
        if (!player) return;
        if (Number.isFinite(moneyDelta)) {
            player.funds += moneyDelta;
        }
        if (Number.isFinite(repDelta)) {
            const next = clampReputation((player.reputation ?? 50) + repDelta);
            player.reputation = next;
        }
    };

	const updateTruthEvents = (simTimeSeconds) => {
        if (!Number.isFinite(simTimeSeconds)) return;
        const lastSample = lastEventSampleRef.current;
        if (Number.isFinite(lastSample) && simTimeSeconds - lastSample < EVENT_SAMPLE_INTERVAL_SECONDS) return;
        lastEventSampleRef.current = simTimeSeconds;

        const earth = earthRef.current;
        const playerId = currentPlayerRef.current?.id;
        const truthCore = earth?.weatherField?.core;
        if (!earth || !playerId || !truthCore?.ready) return;
        const grid = truthCore.grid;
        const fields = truthCore.fields;
        const serviceMask = getServiceMask(grid);
        if (!serviceMask) return;

        if (!eventsByPlayerIdRef.current[playerId]) {
            eventsByPlayerIdRef.current[playerId] = { active: [], history: [] };
        }
        const store = eventsByPlayerIdRef.current[playerId];
        const hazards = getUnlockedWarningHazards(currentPlayerRef.current);
        store.active = store.active.filter(e => hazards.includes(e.hazardType));
        store.history = store.history.filter(e => hazards.includes(e.hazardType));
        const N = grid.nx * grid.ny;
        const minCells = 25;
		const matchIoUMin = 0.12;
		const footprintCutoff = simTimeSeconds - EVENT_FOOTPRINT_RETENTION_SECONDS;

		hazards.forEach((hazardType) => {
			const maskResult = buildTruthEventMask({ hazardType, grid, fields, serviceMask });
			if (!maskResult) return;

			const { labels, components } = labelConnectedComponents(maskResult.mask, grid.nx, grid.ny, maskResult.values);
			const filtered = components.filter(c => c.cellCount >= minCells);
			const activeEvents = store.active.filter(e => e.hazardType === hazardType);
			const matchedEvents = new Set();

			filtered.forEach((component) => {
				const { mask: compMask, indices: compIndices } = extractComponentMaskAndIndices(labels, component.id, N, component.cellCount);
				let bestEvent = null;
				let bestIoU = 0;
				activeEvents.forEach((event) => {
					if (!event.lastMask) return;
					const iou = computeMaskIoU(compMask, event.lastMask);
                    if (iou > bestIoU) {
                        bestIoU = iou;
                        bestEvent = event;
                    }
                });

				if (bestEvent && bestIoU >= matchIoUMin) {
					matchedEvents.add(bestEvent.id);
					bestEvent.lastMask = compMask;
					bestEvent.lastCellCount = component.cellCount;
					bestEvent.lastSeenSimTimeSeconds = simTimeSeconds;
					if (compIndices) {
						if (!Array.isArray(bestEvent.footprintSamples)) bestEvent.footprintSamples = [];
						const sample = {
							t: simTimeSeconds,
							indices: compIndices,
							cellCount: component.cellCount,
							areaW: computeWeightedAreaFromIndices(compIndices, grid)
						};
						const samples = bestEvent.footprintSamples;
						if (samples.length > 0 && samples[samples.length - 1]?.t === simTimeSeconds) {
							samples[samples.length - 1] = sample;
						} else {
							samples.push(sample);
						}
						while (samples.length > 0 && Number.isFinite(samples[0]?.t) && samples[0].t < footprintCutoff) {
							samples.shift();
						}
					}
					if (Number.isFinite(component.maxVal) && (bestEvent.maxSeverityValue == null || component.maxVal > bestEvent.maxSeverityValue)) {
						bestEvent.maxSeverityValue = component.maxVal;
						bestEvent.maxSeverityLatLonDeg = getGridLatLonFromIndex(component.maxK, grid);
						bestEvent.maskAtPeak = compMask.slice();
						bestEvent.peakSimTimeSeconds = simTimeSeconds;
						bestEvent.cellCountAtPeak = component.cellCount;
					}
                    if (!bestEvent.confirmed && simTimeSeconds - bestEvent.startSimTimeSeconds >= MIN_EVENT_DURATION_SECONDS) {
                        bestEvent.confirmed = true;
                        const stats = computeMaskCentroid(bestEvent.maskAtPeak || compMask, grid);
                        earth.logWeatherEvent?.(
                            'truthEventStart',
                            {
                                id: bestEvent.id,
                                hazardType,
                                startSimTimeSeconds: bestEvent.startSimTimeSeconds,
                                cellCount: stats.count,
                                centroid: stats.centroid,
                                maxSeverityValue: bestEvent.maxSeverityValue,
                                maxSeverityLatLonDeg: bestEvent.maxSeverityLatLonDeg
                            },
                            { simTimeSeconds: bestEvent.startSimTimeSeconds }
                        );
                    }
                    if (bestEvent.confirmed) {
                        const stats = computeMaskCentroid(compMask, grid);
                        earth.logWeatherEvent?.(
                            'truthEventUpdate',
                            {
                                id: bestEvent.id,
                                hazardType,
                                simTimeSeconds,
                                cellCount: stats.count,
                                centroid: stats.centroid,
                                maxSeverityValue: bestEvent.maxSeverityValue,
                                maxSeverityLatLonDeg: bestEvent.maxSeverityLatLonDeg
                            },
                            { simTimeSeconds }
                        );
                    }
                    return;
                }

				const eventId = `evt-${hazardType}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
				const newEvent = {
					id: eventId,
					hazardType,
					startSimTimeSeconds: simTimeSeconds,
					lastSeenSimTimeSeconds: simTimeSeconds,
					confirmed: false,
					lastMask: compMask,
					lastCellCount: component.cellCount,
					maxSeverityValue: component.maxVal,
					maxSeverityLatLonDeg: getGridLatLonFromIndex(component.maxK, grid),
					maskAtPeak: compMask.slice(),
					peakSimTimeSeconds: simTimeSeconds,
					cellCountAtPeak: component.cellCount,
					footprintSamples: compIndices ? [{
						t: simTimeSeconds,
						indices: compIndices,
						cellCount: component.cellCount,
						areaW: computeWeightedAreaFromIndices(compIndices, grid)
					}] : [],
					endSimTimeSeconds: null
				};
				store.active.push(newEvent);
			});

            store.active = store.active.filter((event) => {
                if (event.hazardType !== hazardType) return true;
                if (matchedEvents.has(event.id)) return true;
                if (simTimeSeconds - event.lastSeenSimTimeSeconds < EVENT_GAP_SECONDS) return true;
                event.endSimTimeSeconds = event.lastSeenSimTimeSeconds;
                if (event.confirmed) {
                    const stats = computeMaskCentroid(event.maskAtPeak || event.lastMask, grid);
					let matchedWarningId = null;
					let bestIoU = 0;
					if (!event.matched) {
                        if (!hazards.includes(event.hazardType)) {
                            event.matched = true;
                            event.matchedWarningId = null;
                            event.moneyDelta = null;
                            event.repDelta = null;
                        } else {
                            const warnings = warningsByPlayerIdRef.current[playerId] || [];
                            warnings.forEach((warning) => {
                                if (warning.hazardType !== event.hazardType) return;
                                const warningMask = getWarningMaskForScoring(warning, grid);
                                if (!warningMask) return;
                                const warningArea = getWarningWeightedArea(warning, warningMask, grid);
                                const warningEnd = warning.validEndSimTimeSeconds;
                                const warningStart = warning.validStartSimTimeSeconds;
                                if (warningStart > event.endSimTimeSeconds || warningEnd < event.startSimTimeSeconds) return;
                                const overlapStart = Math.max(warningStart, event.startSimTimeSeconds);
                                const overlapEnd = Math.min(warningEnd, event.endSimTimeSeconds);
                                const iou = computeBestEventIoUInWindow(event, warningMask, warningArea, grid, overlapStart, overlapEnd);
                                if (iou > bestIoU) {
                                    bestIoU = iou;
                                    matchedWarningId = warning.id;
                                }
                            });
                            if (bestIoU >= IOU_MATCH_MIN) {
                                event.matched = true;
                                event.matchedWarningId = matchedWarningId;
                            } else {
                                const player = currentPlayerRef.current;
                                const penaltyMoney = -(PENALTY.missMoney[event.hazardType] ?? 0);
                                const repDelta = PENALTY.missRep[event.hazardType] ?? 0;
                                applyPlayerScoreDelta(player, penaltyMoney, repDelta);
                                event.outcome = 'miss';
                                event.moneyDelta = penaltyMoney;
                                event.repDelta = repDelta;
                                notify(
                                    'warning',
                                    `Missed event: ${event.hazardType}, ${formatMoneyDelta(penaltyMoney)}, ${formatRepDelta(repDelta)} rep`
                                );
                            }
                        }
                    }
                    earth.logWeatherEvent?.(
                        'truthEventEnd',
                        {
                            id: event.id,
                            hazardType,
                            startSimTimeSeconds: event.startSimTimeSeconds,
                            endSimTimeSeconds: event.endSimTimeSeconds,
                            cellCount: stats.count,
                            centroid: stats.centroid,
                            maxSeverityValue: event.maxSeverityValue,
                            maxSeverityLatLonDeg: event.maxSeverityLatLonDeg,
                            matchedWarningId: event.matchedWarningId ?? null,
                            missed: event.outcome === 'miss',
                            moneyDelta: event.moneyDelta ?? null,
                            repDelta: event.repDelta ?? null
                        },
                        { simTimeSeconds: event.endSimTimeSeconds }
                    );
                }
				store.history.push(event);
				return false;
			});
		});

		if (Array.isArray(store.history) && store.history.length > 0) {
			const historyCutoff = simTimeSeconds - EVENT_HISTORY_RETENTION_SECONDS;
			store.history = store.history.filter((event) => {
				const tEnd = event.endSimTimeSeconds ?? event.lastSeenSimTimeSeconds;
				return !Number.isFinite(tEnd) || tEnd >= historyCutoff;
			});
		}
	};

    const updateForecastSkillTelemetry = () => {
        const earth = earthRef.current;
        const playerId = currentPlayerRef.current?.id;
        const truthCore = earth?.weatherField?.core;
        if (!earth || !playerId || !truthCore?.ready) return;
        const truthTimeSeconds = truthCore.timeUTC;
        if (!Number.isFinite(truthTimeSeconds)) return;
        const grid = truthCore.grid;
        const fields = truthCore.fields;
        if (!grid || !fields) return;
        const serviceMask = getServiceMask(grid);
        if (!serviceMask || serviceMask.length !== grid.nx * grid.ny) return;
        const weights = getAreaWeights(grid);
        if (!weights) return;

        let serviceCellCount = 0;
        for (let k = 0; k < serviceMask.length; k++) {
            if (serviceMask[k] === 1) serviceCellCount += 1;
        }
        if (serviceCellCount === 0) return;

        const history = earth.getForecastHistory?.(playerId) ?? [];
        if (!history.length) return;
        const summaries = forecastSkillSummaryRef.current;

        history.forEach((run) => {
            if (!run?.products || !run?.leadHours) return;
            const runId = run.runId;
            if (!runId) return;
            if (!summaries[runId]) {
                summaries[runId] = {
                    runId,
                    playerId: run.playerId,
                    baseSimTimeSeconds: run.baseSimTimeSeconds,
                    leads: {}
                };
            }
            const summary = summaries[runId];
            const leadList = Array.isArray(run.leadHours) ? run.leadHours : [];
            leadList.forEach((leadHours) => {
                const verifyTimeSeconds = run.baseSimTimeSeconds + leadHours * 3600;
                if (truthTimeSeconds < verifyTimeSeconds) return;
                run._skillVerifiedByLead = run._skillVerifiedByLead || {};
                if (run._skillVerifiedByLead[leadHours]) return;
                const leadIdx = run.leadHours.indexOf(leadHours);
                if (leadIdx < 0) return;

                const precipForecast = run.products.precipRateByLead?.[leadIdx];
                const windForecast = run.products.windSpeedByLead?.[leadIdx];
                const confForecast = run.products.confidenceByLead?.[leadIdx];
                if (!precipForecast || !windForecast || !confForecast) return;

                const precipMetrics = computeWeightedMetrics(
                    fields.precipRate,
                    precipForecast,
                    weights,
                    serviceMask,
                    grid.nx,
                    grid.ny
                );
                const windMetrics = computeWeightedWindMetrics(
                    fields.u,
                    fields.v,
                    windForecast,
                    weights,
                    serviceMask,
                    grid.nx,
                    grid.ny
                );
                const confidenceMean = computeWeightedMean(
                    confForecast,
                    weights,
                    serviceMask,
                    grid.nx,
                    grid.ny
                );
                if (!precipMetrics || !windMetrics) return;
                const skillPrecip01 = Math.max(0, Math.min(1, 1 - (precipMetrics.rmse - 0.06) / (0.22 - 0.06)));
                const skillWind01 = Math.max(0, Math.min(1, 1 - (windMetrics.rmse - 3.0) / (10.0 - 3.0)));
                const skillCombined01 = 0.6 * skillPrecip01 + 0.4 * skillWind01;
                const confMeanSafe = Math.max(0.15, Number.isFinite(confidenceMean) ? confidenceMean : 0);
                const targetScale = Math.max(0.5, Math.min(1.5, skillCombined01 / confMeanSafe));
                earth.updateConfidenceCalibration?.({ playerId: run.playerId, leadHours, targetScale });

                const payload = {
                    forecastRunId: runId,
                    playerId: run.playerId,
                    leadHours,
                    verifyTimeSeconds,
                    truthTimeSeconds,
                    serviceAreaCellCount: serviceCellCount,
                    precip: precipMetrics,
                    wind: windMetrics,
                    confidenceMean,
                    confidenceTargetScale: targetScale
                };
                earth.logWeatherEvent?.('forecastSkill', payload, { simTimeSeconds: truthTimeSeconds });

                summary.leads[leadHours] = {
                    verifyTimeSeconds,
                    truthTimeSeconds,
                    serviceAreaCellCount: serviceCellCount,
                    precip: precipMetrics,
                    wind: windMetrics,
                    confidenceMean
                };
                run._skillVerifiedByLead[leadHours] = true;
            });

            const allVerified = leadList.length > 0 && leadList.every((h) => run._skillVerifiedByLead?.[h]);
            if (allVerified && !summary.logged) {
                earth.logWeatherEvent?.(
                    'forecastSkillSummary',
                    {
                        forecastRunId: runId,
                        playerId: run.playerId,
                        baseSimTimeSeconds: run.baseSimTimeSeconds,
                        leadHours: leadList,
                        leads: summary.leads
                    },
                    { simTimeSeconds: truthTimeSeconds }
                );
                summary.logged = true;
            }
        });
    };

    const unwrapLonDeg = (lonDeg, refLonDeg) => {
        let v = lonDeg;
        while (v - refLonDeg > 180) v -= 360;
        while (v - refLonDeg < -180) v += 360;
        return v;
    };

    const unwrapPolygon = (polygon, refLonDeg) => polygon.map((p) => ({
        latDeg: p.latDeg,
        lonDeg: unwrapLonDeg(p.lonDeg, refLonDeg)
    }));

    const pointInPolygon = (latDeg, lonDeg, polygon) => {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const yi = polygon[i].latDeg;
            const xi = polygon[i].lonDeg;
            const yj = polygon[j].latDeg;
            const xj = polygon[j].lonDeg;
            const intersect = ((yi > latDeg) !== (yj > latDeg))
                && (lonDeg < (xj - xi) * (latDeg - yi) / Math.max(1e-6, (yj - yi)) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    };

    const polygonBBoxArea = (polygon) => {
        if (!polygon || polygon.length === 0) return Infinity;
        let minLat = 90;
        let maxLat = -90;
        let minLon = 180;
        let maxLon = -180;
        polygon.forEach((p) => {
            if (p.latDeg < minLat) minLat = p.latDeg;
            if (p.latDeg > maxLat) maxLat = p.latDeg;
            if (p.lonDeg < minLon) minLon = p.lonDeg;
            if (p.lonDeg > maxLon) maxLon = p.lonDeg;
        });
        return Math.max(0, maxLat - minLat) * Math.max(0, maxLon - minLon);
    };

    const findWarningAtPoint = (latDeg, lonDeg, warnings) => {
        if (!Array.isArray(warnings) || warnings.length === 0) return null;
        let best = null;
        warnings.forEach((warning) => {
            if (!Array.isArray(warning.polygonLatLonDeg) || warning.polygonLatLonDeg.length < 3) return;
            const refLon = warning.polygonLatLonDeg[0]?.lonDeg ?? 0;
            const polygon = unwrapPolygon(warning.polygonLatLonDeg, refLon);
            const lon = unwrapLonDeg(lonDeg, refLon);
            if (!pointInPolygon(latDeg, lon, polygon)) return;
            const area = polygonBBoxArea(polygon);
            if (!best || area < best.area) {
                best = { warning, area };
            }
        });
        return best ? best.warning : null;
    };

    const buildWarningGridMask = (polygonLatLonDeg, grid) => {
        if (!Array.isArray(polygonLatLonDeg) || polygonLatLonDeg.length < 3) return null;
        if (!grid?.nx || !grid?.ny) return null;
        const { nx, ny, latDeg, lonDeg } = grid;
        const N = nx * ny;
        const mask = new Uint8Array(N);
        const refLon = polygonLatLonDeg[0]?.lonDeg ?? 0;
        const polygon = unwrapPolygon(polygonLatLonDeg, refLon);
        for (let j = 0; j < ny; j++) {
            const lat = latDeg ? latDeg[j] : 90 - (j + 0.5) * (180 / ny);
            const row = j * nx;
            for (let i = 0; i < nx; i++) {
                const lon = lonDeg ? lonDeg[i] : -180 + (i + 0.5) * (360 / nx);
                const lonUnwrapped = unwrapLonDeg(lon, refLon);
                if (pointInPolygon(lat, lonUnwrapped, polygon)) {
                    mask[row + i] = 1;
                }
            }
        }
        return { mask, nx, ny };
    };

    const getVisibleWarningsForPlayer = (playerId) => {
        if (!playerId) return [];
        const list = warningsByPlayerIdRef.current[playerId] || [];
        return list.filter(w => !w.outcome);
    };

    const sampleWarningMax = (warning, truthCore) => {
        const grid = truthCore?.grid;
        const fields = truthCore?.fields;
        if (!grid || !fields) return null;
        if (!Array.isArray(warning.polygonLatLonDeg) || warning.polygonLatLonDeg.length < 3) return null;
        const { nx, ny, latDeg, lonDeg } = grid;
        if (!nx || !ny || !latDeg || !lonDeg) return null;
        const refLon = warning.polygonLatLonDeg[0]?.lonDeg ?? 0;
        const polygon = unwrapPolygon(warning.polygonLatLonDeg, refLon);

        const precip = fields.precipRate;
        const u = fields.u;
        const v = fields.v;
        let maxVal = 0;

        for (let j = 0; j < ny; j++) {
            const lat = latDeg[j];
            const rowOffset = j * nx;
            for (let i = 0; i < nx; i++) {
                const lon = unwrapLonDeg(lonDeg[i], refLon);
                if (!pointInPolygon(lat, lon, polygon)) continue;
                const k = rowOffset + i;
                let val = 0;
                if (warning.hazardType === 'heavyPrecip' || warning.hazardType === 'severeStormRisk') {
                    val = precip ? precip[k] : 0;
                } else if (warning.hazardType === 'highWinds') {
                    const uVal = u ? u[k] : 0;
                    const vVal = v ? v[k] : 0;
                    val = Math.hypot(uVal, vVal);
                }
                if (val > maxVal) maxVal = val;
            }
        }
        return maxVal;
    };

	const evaluateWarnings = (simTimeSeconds) => {
        const player = currentPlayerRef.current;
        const playerId = player?.id;
        if (!playerId) return;
        const warnings = warningsByPlayerIdRef.current[playerId];
        if (!warnings || warnings.length === 0) return;
        const truthCore = earthRef.current?.weatherField?.core;
        if (!truthCore?.ready) return;
        const grid = truthCore.grid;
        const store = eventsByPlayerIdRef.current[playerId];
        const allEvents = store ? [...store.active, ...store.history] : [];

        let changed = false;
		const nextWarnings = warnings.map((warning) => {
            if (warning.outcome) return warning;
            if (!Number.isFinite(simTimeSeconds)) return warning;
            if (simTimeSeconds < warning.validEndSimTimeSeconds) return warning;
            let warningMask = warning._gridMask;
            if (!warningMask || warning._gridMaskNx !== grid.nx || warning._gridMaskNy !== grid.ny) {
                const maskResult = buildWarningGridMask(warning.polygonLatLonDeg, grid);
                if (maskResult) {
                    warningMask = maskResult.mask;
                    warning._gridMask = maskResult.mask;
                    warning._gridMaskNx = maskResult.nx;
                    warning._gridMaskNy = maskResult.ny;
                }
            }
			if (!warningMask) return warning;
			const warningArea = getWarningWeightedArea(warning, warningMask, grid);

			const candidates = allEvents.filter((event) => {
				if (!event.confirmed) return false;
				if (event.hazardType !== warning.hazardType) return false;
                const eventEnd = event.endSimTimeSeconds ?? simTimeSeconds;
                return event.startSimTimeSeconds <= warning.validEndSimTimeSeconds
                    && eventEnd >= warning.validStartSimTimeSeconds;
            });

			let bestIoU = 0;
			let bestEvent = null;
			candidates.forEach((event) => {
				const eventEnd = event.endSimTimeSeconds ?? simTimeSeconds;
				const overlapStart = Math.max(warning.validStartSimTimeSeconds, event.startSimTimeSeconds);
				const overlapEnd = Math.min(warning.validEndSimTimeSeconds, eventEnd);
				if (overlapEnd < overlapStart) return;
				const iou = computeBestEventIoUInWindow(event, warningMask, warningArea, grid, overlapStart, overlapEnd);
				if (iou > bestIoU) {
					bestIoU = iou;
					bestEvent = event;
				}
			});

            const advanceNoticeHours = Math.max(
                0,
                (warning.validStartSimTimeSeconds - warning.issuedAtSimTimeSeconds) / 3600
            );
            const noticeFactor = Math.max(0, Math.min(1, advanceNoticeHours / 12));
            const iouFactor = Math.max(0, Math.min(1, bestIoU));

            let next = warning;
            if (bestEvent && bestIoU >= IOU_MATCH_MIN) {
                const base = PAYOUT.hitBase[warning.hazardType] ?? 0;
                let areaFracService = warning.areaFracService;
                let meanConfidence = warning.meanConfidence;
                if (!Number.isFinite(areaFracService) || !Number.isFinite(meanConfidence)) {
                    const weights = getAreaWeights(grid);
                    const serviceMask = getServiceMask(grid);
                    if (weights && serviceMask) {
                        if (!Number.isFinite(areaFracService)) {
                            areaFracService = computeWarningAreaFracService(
                                warningMask,
                                grid,
                                serviceMask,
                                weights
                            );
                        }
                        if (!Number.isFinite(meanConfidence)) {
                            const leadHours = warning.forecastLeadHours;
                            const latestForecast = earthRef.current?.latestForecastByPlayerId?.get(String(playerId));
                            const leadIdx = latestForecast?.leadHours?.indexOf(leadHours) ?? -1;
                            const confValues = leadIdx >= 0 ? latestForecast?.products?.confidenceByLead?.[leadIdx] : null;
                            if (confValues) {
                                meanConfidence = computeMeanConfidenceInWarning(
                                    confValues,
                                    warningMask,
                                    grid,
                                    serviceMask,
                                    weights
                                );
                            }
                        }
                    }
                }
                const confValue = Number.isFinite(meanConfidence) ? meanConfidence : 0;
                const areaValue = Number.isFinite(areaFracService) ? areaFracService : PRECISION_AREA_NONE_FRAC;
                const confFactor = Math.max(
                    0,
                    Math.min(1, (confValue - PRECISION_CONF_START) / (PRECISION_CONF_FULL - PRECISION_CONF_START))
                );
                const areaFactor = Math.max(
                    0,
                    Math.min(1, (PRECISION_AREA_NONE_FRAC - areaValue) / (PRECISION_AREA_NONE_FRAC - PRECISION_AREA_FULL_FRAC))
                );
                const precisionMult = 1 + PRECISION_BONUS_MAX * confFactor * areaFactor;
                const payout = base * Math.pow(iouFactor, 1.2) * (0.6 + 0.4 * noticeFactor) * precisionMult;
                const repBase = HIT_REP_BASE[warning.hazardType] ?? 2;
                const repDelta = Math.round(repBase * iouFactor * (0.6 + 0.4 * noticeFactor));
                applyPlayerScoreDelta(player, payout, repDelta);
                bestEvent.matched = true;
                next = {
                    ...warning,
                    outcome: 'hit',
                    matchedEventId: bestEvent.id,
                    iou: bestIoU,
                    advanceNoticeHours,
                    moneyDelta: payout,
                    repDelta,
                    areaFracService: Number.isFinite(areaFracService) ? areaFracService : null,
                    meanConfidence: Number.isFinite(meanConfidence) ? meanConfidence : null,
                    precisionMultiplier: precisionMult,
                    evaluatedAtSimTimeSeconds: simTimeSeconds
                };
                notify(
                    'success',
                    `Hit: ${warning.hazardType}, ${formatHoursLabel(Math.round(advanceNoticeHours))}, ${formatMoneyDelta(payout)}, ${formatRepDelta(repDelta)} rep, precision x${precisionMult.toFixed(2)}`
                );
            } else {
                const penaltyMoney = -(PENALTY.falseAlarmMoney[warning.hazardType] ?? 0);
                const repDelta = PENALTY.falseAlarmRep[warning.hazardType] ?? 0;
                applyPlayerScoreDelta(player, penaltyMoney, repDelta);
                next = {
                    ...warning,
                    outcome: 'falseAlarm',
                    iou: bestIoU,
                    advanceNoticeHours,
                    moneyDelta: penaltyMoney,
                    repDelta,
                    evaluatedAtSimTimeSeconds: simTimeSeconds
                };
                notify(
                    'warning',
                    `False alarm: ${warning.hazardType}, ${formatMoneyDelta(penaltyMoney)}, ${formatRepDelta(repDelta)} rep`
                );
            }

            earthRef.current?.logWeatherEvent?.(
                'warningScored',
                {
                    warningId: next.id,
                    playerId,
                    hazardType: next.hazardType,
                    outcome: next.outcome,
                    iou: next.iou,
                    matchedEventId: next.matchedEventId ?? null,
                    advanceNoticeHours,
                    moneyDelta: next.moneyDelta,
                    repDelta: next.repDelta,
                    meanConfidence: next.meanConfidence ?? null,
                    areaFracService: next.areaFracService ?? null,
                    precisionMultiplier: next.precisionMultiplier ?? null
                },
                { simTimeSeconds }
            );
            changed = true;
            return next;
        });

        if (changed) {
            setWarningsByPlayerId(prev => ({
                ...prev,
                [playerId]: nextWarnings
            }));
            warningsByPlayerIdRef.current = {
                ...warningsByPlayerIdRef.current,
                [playerId]: nextWarnings
            };
        }
    };

	useEffect(() => {
		const focus = warningOverlayFocusRef.current;
		const playerId = activePlayerId;
		if (!playerId) return;
		const warnings = warningsByPlayerId[playerId] || [];
		const visibleWarnings = warnings.filter(w => !w.outcome);
		if (focus.lastWarningId) {
			const stillVisible = visibleWarnings.some(w => w.id === focus.lastWarningId);
			if (!stillVisible) {
				focus.lastWarningId = null;
				setFocusedWarningInfo(null);
			}
		}
		if (focus.activeHazardType && showForecastOverlayRef.current) {
			const hasToggle = visibleWarnings.some(w => w.hazardType === focus.activeHazardType);
			if (!hasToggle) {
				focus.activeHazardType = null;
				setShowForecastOverlay(false);
			}
		}
	}, [warningsByPlayerId, activePlayerId, gameMode]);

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

    const wrapRadToPi = (rad) => {
        const twoPi = Math.PI * 2;
        let v = ((rad + Math.PI) % twoPi + twoPi) % twoPi;
        return v - Math.PI;
    };

    // Animation loop
    useEffect(() => {
        const animate = () => {
            if (!rendererRef.current) return;
            requestAnimationFrame(animate);

            const nowMs = performance.now();
            if (lastFrameMsRef.current === null) {
                lastFrameMsRef.current = nowMs;
            }
            const rawDtSeconds = (nowMs - lastFrameMsRef.current) / 1000;
            const realDtSeconds = Math.max(0, Math.min(rawDtSeconds, 0.1));
            lastFrameMsRef.current = nowMs;

            const simClock = simClockRef.current;
            simClock.tick(realDtSeconds);
            const simTimeSeconds = simClock.simTimeSeconds;
            let deltaSimSeconds = 0;
            if (Number.isFinite(lastSimTimeRef.current)) {
                deltaSimSeconds = simTimeSeconds - lastSimTimeRef.current;
            }
            if (!(deltaSimSeconds > 0)) deltaSimSeconds = 0;
            lastSimTimeRef.current = simTimeSeconds;

            const directionalLight = directionalLightRef.current;
            if (directionalLight) {
                const dayOfYear = (((simTimeSeconds / 86400) % 365) + 365) % 365;
                const decl = solarDeclination(dayOfYear);
                const sunDir = sunDirRef.current;
                sunDir.set(Math.cos(decl), Math.sin(decl), 0).normalize();
                directionalLight.position.copy(sunDir).multiplyScalar(100000);
            }

            let detectedSpheres = [];
            if (earthRef.current) {
                earthRef.current.setRotationForSimTime?.(simTimeSeconds);
            }
            satellitesRef.current.forEach(satellite => { // Update all satellites, regardless of player
                const detections = satellite.updateOrbit(
                    hqSpheresRef,
                    currentPlayerRef,
                    satellitesRef.current,
                    deltaSimSeconds
                ); // Pass the current HQ spheres
                detectedSpheres = detectedSpheres.concat(detections);
            });

            // Update Earth (after satellites + rotation)
            if (earthRef.current) {
                const earth = earthRef.current;
                const sensorGating = buildSensorGating();

                earth.update(simTimeSeconds, realDtSeconds, {
                    simSpeed: simClock.simSpeed,
                    paused: simClock.paused,
                    sensorGating
                });
                applyCloudIntelVisibility(sensorGating);
                if (cloudWatchDebugRef.current) {
                    const entries = sensorGating?.cloudWatchDebugEntries ?? [];
                    earth.setCloudWatchDebugMarkers?.(entries);
                    const nowMs = performance.now();
                    if (nowMs - cloudWatchDebugInfoRef.current.lastUpdateMs > 500) {
                        cloudWatchDebugInfoRef.current.lastUpdateMs = nowMs;
                        const uiEntries = entries.map((entry) => ({
                            satId: entry.satId,
                            footprintLatDeg: Number.isFinite(entry.footprintLatRad)
                                ? THREE.MathUtils.radToDeg(entry.footprintLatRad)
                                : null,
                            footprintLonDeg: Number.isFinite(entry.footprintLonRad)
                                ? THREE.MathUtils.radToDeg(entry.footprintLonRad)
                                : null,
                            subpointLatDeg: Number.isFinite(entry.subpointLatRad)
                                ? THREE.MathUtils.radToDeg(entry.subpointLatRad)
                                : null,
                            subpointLonDeg: Number.isFinite(entry.subpointLonRad)
                                ? THREE.MathUtils.radToDeg(entry.subpointLonRad)
                                : null,
                            separationDeg: entry.separationDeg
                        }));
                        setCloudWatchDebugInfo(uiEntries);
                    }
                }
            }

            updateTruthEvents(simTimeSeconds);
            updateForecastSkillTelemetry();
            evaluateWarnings(simTimeSeconds);

            if (anchorLockRef.current && earthRef.current && cameraRef.current && controlsRef.current) {
                const earth = earthRef.current;
                const anchor = anchorLockRef.current;
                const camera = cameraRef.current;
                const controls = controlsRef.current;
                const currentDistance = camera.position.length();
                if (Number.isFinite(currentDistance) && currentDistance > 0) {
                    anchor.distance = currentDistance;
                }
                const camLocal = anchor.localDir.clone().multiplyScalar(anchor.distance);
                const camWorld = earth.parentObject.localToWorld(camLocal);
                const targetLocal = anchor.localDir.clone().multiplyScalar(earth.earthRadiusKm);
                const targetWorld = earth.parentObject.localToWorld(targetLocal);
                if (!anchor.isDragging) {
                    const alpha = 1 - Math.exp(-4 * realDtSeconds);
                    camera.position.lerp(camWorld, alpha);
                    controls.target.lerp(targetWorld, alpha);
                    controls.update();
                }
            }


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
        if (selectionActiveRef.current) {
            updateSelectionDragRect(event);
            return;
        }
        // --- Orbit preview drag: rotate plane normal around HQ vector t ---
        if (orbitDragRef.current.active && showSatPanelRef.current) {
            if (!earthRef.current) return;
            const dragMode = orbitDragRef.current.mode || 'rotate';

            const mouse = new THREE.Vector2(
                (event.clientX / window.innerWidth) * 2 - 1,
                -(event.clientY / window.innerHeight) * 2 + 1
            );
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, cameraRef.current);

            const cam = cameraRef.current;
            const origin = cam.position.clone();
            const dir = raycaster.ray.direction.clone();

            if (dragMode === 'radius') {
                const n = previewNormalRef.current;
                if (!n) return;
                const earth = earthRef.current;

                const originLocal = origin.clone();
                const p1Local = origin.clone().add(dir);
                if (earth?.parentObject) {
                    earth.parentObject.worldToLocal(originLocal);
                    earth.parentObject.worldToLocal(p1Local);
                }
                const dirLocal = p1Local.sub(originLocal).normalize();
                const denom = dirLocal.dot(n);
                if (Math.abs(denom) < 1e-6) return;
                const tHit = -originLocal.dot(n) / denom;
                if (tHit <= 0) return;
                const hitLocal = originLocal.clone().add(dirLocal.multiplyScalar(tHit));
                const earthRadiusKm = earth.earthRadiusKm;
                const minRadius = earthRadiusKm + 10;
                const clampedRadius = Math.max(minRadius, hitLocal.length());
                const newAltKm = Math.max(0, clampedRadius - earthRadiusKm);
                if (Math.abs(parseFloat(altitudeRef.current || '0') - newAltKm) > 0.5) {
                    const nextAlt = String(Math.round(newAltKm));
                    altitudeRef.current = nextAlt;
                    setAltitude(nextAlt);
                }
                orbitDragRef.current.radius = clampedRadius;
                updateOrbitPreview();
                return;
            }

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
                    const hit = origin.clone().add(dir.clone().multiplyScalar(tHit));
                    const hitLocal = hit.clone();
                    if (earthRef.current?.parentObject) {
                        earthRef.current.parentObject.worldToLocal(hitLocal);
                    }
                    hitLocal.normalize();

                    const hq = getMainHQ();
                    if (hq) {
                        const t = hq.sphere.position.clone().normalize();

                        // Tangent direction at HQ: project hit onto plane ⟂ t
                        let d = hitLocal.clone().sub(t.clone().multiplyScalar(hitLocal.dot(t)));
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

        const earth = earthRef.current;
        if (!earth?.mesh) return;

        // --- HQ placement ghost follow (unchanged) ---
        if (showHQSphereRef.current && hqSphereRef.current) {
            const mouse = new THREE.Vector2(
                (event.clientX / window.innerWidth) * 2 - 1,
                -(event.clientY / window.innerHeight) * 2 + 1
            );

            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, cameraRef.current);

            const intersects = raycaster.intersectObject(earth.mesh);
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

        updateCursorLatLon(getEarthClickLatLonDeg(event));
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
        const speedInRadPerSec     = orbitalSpeedMPerS / orbitRadiusMeters;

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
            const earth = earthRef.current;
            if (earth?.parentObject) {
                n.applyQuaternion(earth.parentObject.quaternion);
                n.normalize();
            }

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
                const earth = earthRef.current;
                const earthRot = earth?.parentObject?.rotation?.y ?? 0;
                const worldRaan = wrapRadToPi(raan + earthRot);
                const incRad = solveIncForRAAN(worldRaan, t);
                orbit.inclination = incRad;
                const Rx = new THREE.Matrix4().makeRotationX(incRad);
                const Ry = new THREE.Matrix4().makeRotationY(worldRaan);
                const a  = new THREE.Vector3(1,0,0).applyMatrix4(Rx).applyMatrix4(Ry);
                const b  = new THREE.Vector3(0,0,1).applyMatrix4(Rx).applyMatrix4(Ry);
                const nu = Math.atan2(t.dot(b), t.dot(a));
                orbit.raan  = worldRaan;
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
            setShowSatPanel(false);
            setShowMenu(false);
            removeOrbitPreview();
        }
    };

    const runForecast = () => {
        const earth = earthRef.current;
        const player = currentPlayerRef.current;
        if (!earth || !player) return;
        if (forecastStatus.running) return;
        const runFn = async () => {
            setForecastStatus(prev => ({ ...prev, running: true, progress01: 0, message: 'Starting forecast...' }));
            const simTimeSeconds = simClockRef.current?.simTimeSeconds ?? 0;
            const unlockedLeads = getUnlockedForecastLeads(player);
            const leadList = unlockedLeads.length ? unlockedLeads : DEFAULT_FORECAST_LEADS;
            const result = await earth.runForecastForPlayer?.({
                playerId: player.id,
                simTimeSeconds,
                leadHours: leadList,
                horizonHours: Math.max(...leadList),
                onProgress: ({ progress01, message }) => {
                    setForecastStatus(prev => ({
                        ...prev,
                        running: true,
                        progress01: Number.isFinite(progress01) ? progress01 : prev.progress01,
                        message: message || prev.message
                    }));
                }
            });
            if (!result || result.ok === false) {
                notify('warning', `Forecast failed: ${result?.reason || 'unknown'}`);
                setForecastStatus(prev => ({ ...prev, running: false, progress01: 0, message: '' }));
                return;
            }
            setForecastBaseTimeSeconds(result.baseSimTimeSeconds);
            setForecastStatus({
                running: false,
                progress01: 1,
                message: 'Forecast complete',
                lastRunId: result.runId
            });
            const nextLead = leadList.includes(forecastLeadHoursRef.current)
                ? forecastLeadHoursRef.current
                : leadList[0];
            setForecastLeadHours(nextLead);
            earth.setForecastDisplayLeadHours?.(nextLead);
            earth.setForecastDisplayProduct?.(forecastProductRef.current);
            earth.setForecastOverlayVisible?.(showForecastOverlayRef.current);

            const grid = earth.weatherField?.core?.grid;
            const leadHours = result.leadHours.includes(nextLead) ? nextLead : result.leadHours[0];
            const unlockedHazards = getUnlockedWarningHazards(player);
            const autoDrafts = buildAutoWarningsFromForecast({
                forecastResult: result,
                grid,
                issuedAtSimTimeSeconds: simTimeSeconds,
                leadHours,
                allowedHazards: unlockedHazards,
                maxPolygonsPerHazard: MAX_DRAFTS_PER_HAZARD,
                mode: 'draft'
            });
            if (autoDrafts.length > 0) {
                setDraftWarningsByPlayerId(prev => ({
                    ...prev,
                    [player.id]: autoDrafts
                }));
                draftWarningsByPlayerIdRef.current = {
                    ...draftWarningsByPlayerIdRef.current,
                    [player.id]: autoDrafts
                };
            } else {
                setDraftWarningsByPlayerId(prev => ({
                    ...prev,
                    [player.id]: []
                }));
                draftWarningsByPlayerIdRef.current = {
                    ...draftWarningsByPlayerIdRef.current,
                    [player.id]: []
                };
            }

            const weights = getAreaWeights(grid);
            const confValues = result.products.confidenceByLead?.[result.leadHours.indexOf(leadHours)];
            if (weights && confValues) {
                const serviceMask = getServiceMask(grid);
                const hqLocs = getPlayerHqLatLonDegList(player.id);
                const radarMask = buildRadarCoverageMask(grid, hqLocs, DOPPLER_RADAR_RADIUS_KM);
                const restMask = serviceMask ? new Uint8Array(serviceMask.length) : null;
                if (serviceMask && restMask) {
                    for (let k = 0; k < serviceMask.length; k++) {
                        restMask[k] = serviceMask[k] === 1 && radarMask[k] !== 1 ? 1 : 0;
                    }
                }
                const radarMean = computeWeightedMeanWithMask(
                    confValues,
                    weights,
                    radarMask,
                    grid.nx,
                    grid.ny
                );
                const serviceMean = serviceMask
                    ? computeWeightedMeanWithMask(confValues, weights, serviceMask, grid.nx, grid.ny)
                    : null;
                const serviceRestMean = restMask
                    ? computeWeightedMeanWithMask(confValues, weights, restMask, grid.nx, grid.ny)
                    : null;
                if (Number.isFinite(radarMean) && Number.isFinite(serviceRestMean) && radarMean >= 0.75 && serviceRestMean < 0.55) {
                    notify('info', 'Radar confidence is high near HQ — issue a small 1–3h polygon there.');
                } else if (Number.isFinite(serviceMean) && serviceMean >= 0.6) {
                    notify('info', 'Confidence is high — smaller polygons score better. Tighten your warning.');
                } else {
                    notify('info', 'Confidence is low — stick to 1h and avoid over-precise polygons.');
                }
            }
            if (!forecastHintShownRef.current) {
                forecastHintShownRef.current = true;
                notify('info', 'Draft warnings don’t score until you Issue them.');
                notify('info', 'Use Confidence (Advanced) to find where small warnings pay more.');
            }
        };

        const registry = actionRegistryRef.current;
        if (registry?.perform) {
            const ok = registry.perform('RUN_FORECAST', player.id, { runFn });
            if (!ok) {
                notify('warning', 'Forecast blocked: not your turn, insufficient AP, or insufficient funds.');
            }
        } else {
            runFn();
        }
    };

    const upgradeForecastTech = () => {
        const player = currentPlayerRef.current;
        const earth = earthRef.current;
        if (!player) return;
        if ((player.getHQs?.().length ?? 0) === 0) {
            notify('warning', 'Place an HQ before upgrading forecast tech.');
            return;
        }
        const currentTier = getForecastTier(player);
        if (currentTier >= 4) {
            notify('info', 'Forecast tech is fully upgraded.');
            return;
        }
        const nextTier = currentTier + 1;
        const nextSpec = getTierSpec(nextTier);
        const tierCostMoney = nextSpec?.costMoney ?? 0;
        const simTimeSeconds = simClockRef.current?.simTimeSeconds ?? 0;
        const toastByTier = {
            1: 'AMVs online: storm track improves (reduces displacement errors).',
            2: 'Soundings online: intensity improves (fewer phantom storms).',
            3: 'Radar nowcast online: 1–3h precip near HQ is much more reliable.',
            4: 'Dense surface network online: synoptic skill improves. 24h unlocked with comms.'
        };
        const applyFn = () => {
            player.forecastTechTier = nextTier;
            applyTierToPlayer(player);
            setPlayers(prev => [...prev]);
            earth?.logWeatherEvent?.(
                'forecastTechUpgraded',
                { playerId: player.id, fromTier: currentTier, toTier: nextTier },
                { simTimeSeconds }
            );
            notify('info', toastByTier[nextTier] || 'Forecast tech upgraded.');
        };
        const registry = actionRegistryRef.current;
        if (registry?.perform) {
            const ok = registry.perform('UPGRADE_FORECAST_TECH', player.id, {
                moneyCost: tierCostMoney,
                applyFn
            });
            if (!ok) {
                notify('warning', 'Upgrade blocked: not your turn, insufficient AP, or insufficient funds.');
            }
        } else {
            applyFn();
        }
    };

    const issueWarning = () => {
        const player = currentPlayerRef.current;
        const earth = earthRef.current;
        if (!player || !earth) return;
        const draft = warningDraftRef.current;
        if (!draft || draft.vertices.length < 3) {
            notify('warning', 'Add at least 3 vertices to issue a warning.');
            return;
        }
        const allowedHazards = getUnlockedWarningHazards(player);
        if (allowedHazards.length && !allowedHazards.includes(draft.hazardType)) {
            notify('warning', 'This hazard is not unlocked yet.');
            return;
        }
        const startHours = Number(draft.validStartHours);
        const durHours = Number(draft.validDurationHours);
        if (!Number.isFinite(startHours) || !Number.isFinite(durHours) || durHours <= 0 || startHours < 0 || (startHours + durHours) > 24) {
            notify('warning', 'Invalid warning window (start >= 0, duration > 0, end <= 24h).');
            return;
        }
        const unlockedLeads = getUnlockedForecastLeads(player);
        if (unlockedLeads.length && !unlockedLeads.includes(startHours)) {
            notify('warning', 'This lead time is not unlocked yet.');
            return;
        }
        const latestForecast = earth.latestForecastByPlayerId?.get(String(player.id));
        if (!latestForecast) {
            notify('warning', 'Run a forecast before issuing a warning.');
            return;
        }
        const issuedAt = simClockRef.current?.simTimeSeconds ?? 0;
        const validStart = issuedAt + startHours * 3600;
        const validEnd = validStart + durHours * 3600;
        const warning = {
            id: `warn-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
            playerId: player.id,
            issuedAtSimTimeSeconds: issuedAt,
            validStartSimTimeSeconds: validStart,
            validEndSimTimeSeconds: validEnd,
            hazardType: draft.hazardType,
            polygonLatLonDeg: draft.vertices.slice(),
            forecastRunId: latestForecast.runId,
            forecastLeadHours: startHours
        };
        const grid = earth.weatherField?.core?.grid;
        const maskResult = buildWarningGridMask(warning.polygonLatLonDeg, grid);
        if (maskResult) {
            warning._gridMask = maskResult.mask;
            warning._gridMaskNx = maskResult.nx;
            warning._gridMaskNy = maskResult.ny;
        }
        if (warning._gridMask && grid) {
            const weights = getAreaWeights(grid);
            const serviceMask = getServiceMask(grid);
            const leadIdx = latestForecast.leadHours.indexOf(startHours);
            const confValues = latestForecast.products?.confidenceByLead?.[leadIdx];
            if (weights && serviceMask) {
                warning.areaFracService = computeWarningAreaFracService(
                    warning._gridMask,
                    grid,
                    serviceMask,
                    weights
                );
                warning.meanConfidence = confValues
                    ? computeMeanConfidenceInWarning(confValues, warning._gridMask, grid, serviceMask, weights)
                    : null;
            }
        }

        const addWarningFn = () => {
            setWarningsByPlayerId(prev => {
                const current = prev[player.id] || [];
                return {
                    ...prev,
                    [player.id]: [...current, warning]
                };
            });
            setWarningDrawMode(false);
            setWarningDraft(prev => ({ ...prev, vertices: [] }));
        };

        const registry = actionRegistryRef.current;
        if (registry?.perform) {
            const ok = registry.perform('ISSUE_WARNING', player.id, { addWarningFn });
            if (!ok) {
                notify('warning', 'Warning blocked: not your turn, insufficient AP, or insufficient funds.');
            }
        } else {
            addWarningFn();
        }
    };

    const issueDraftWarning = (draft) => {
        const player = currentPlayerRef.current;
        const earth = earthRef.current;
        if (!player || !earth || !draft) return;
        const issuedAt = simClockRef.current?.simTimeSeconds ?? 0;
        const leadHours = Number(draft.forecastLeadHours);
        if (!Number.isFinite(leadHours)) return;
        const durationHours = Number(warningDraftRef.current?.validDurationHours);
        const safeDuration = Number.isFinite(durationHours) && durationHours > 0 ? durationHours : 6;
        const validStart = issuedAt + leadHours * 3600;
        const validEnd = validStart + safeDuration * 3600;
        const warning = {
            id: `warn-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
            playerId: player.id,
            issuedAtSimTimeSeconds: issuedAt,
            validStartSimTimeSeconds: validStart,
            validEndSimTimeSeconds: validEnd,
            hazardType: draft.hazardType,
            polygonLatLonDeg: draft.polygonLatLonDeg.slice(),
            forecastRunId: draft.forecastRunId ?? earth.latestForecastByPlayerId?.get(String(player.id))?.runId ?? null,
            forecastLeadHours: leadHours
        };
        if (draft._gridMask && draft._gridMaskNx && draft._gridMaskNy) {
            warning._gridMask = draft._gridMask;
            warning._gridMaskNx = draft._gridMaskNx;
            warning._gridMaskNy = draft._gridMaskNy;
        } else {
            const grid = earth.weatherField?.core?.grid;
            const maskResult = buildWarningGridMask(warning.polygonLatLonDeg, grid);
            if (maskResult) {
                warning._gridMask = maskResult.mask;
                warning._gridMaskNx = maskResult.nx;
                warning._gridMaskNy = maskResult.ny;
            }
        }
        if (Number.isFinite(draft.areaFracService)) {
            warning.areaFracService = draft.areaFracService;
        }
        if (Number.isFinite(draft.meanConfidence)) {
            warning.meanConfidence = draft.meanConfidence;
        }
        if (warning._gridMask && (!Number.isFinite(warning.areaFracService) || !Number.isFinite(warning.meanConfidence))) {
            const grid = earth.weatherField?.core?.grid;
            const weights = getAreaWeights(grid);
            const serviceMask = getServiceMask(grid);
            const latestForecast = earth.latestForecastByPlayerId?.get(String(player.id));
            const leadIdx = latestForecast?.leadHours?.indexOf(leadHours) ?? -1;
            const confValues = leadIdx >= 0 ? latestForecast?.products?.confidenceByLead?.[leadIdx] : null;
            if (weights && serviceMask && grid) {
                if (!Number.isFinite(warning.areaFracService)) {
                    warning.areaFracService = computeWarningAreaFracService(
                        warning._gridMask,
                        grid,
                        serviceMask,
                        weights
                    );
                }
                if (!Number.isFinite(warning.meanConfidence) && confValues) {
                    warning.meanConfidence = computeMeanConfidenceInWarning(
                        confValues,
                        warning._gridMask,
                        grid,
                        serviceMask,
                        weights
                    );
                }
            }
        }

        const addWarningFn = () => {
            setWarningsByPlayerId(prev => {
                const current = prev[player.id] || [];
                return {
                    ...prev,
                    [player.id]: [...current, warning]
                };
            });
            setDraftWarningsByPlayerId(prev => {
                const current = prev[player.id] || [];
                return {
                    ...prev,
                    [player.id]: current.filter(d => d.id !== draft.id)
                };
            });
            earth.logWeatherEvent?.(
                'autoWarningDraftIssued',
                {
                    draftId: draft.id,
                    warningId: warning.id,
                    playerId: player.id,
                    hazardType: draft.hazardType,
                    leadHours,
                    forecastRunId: draft.forecastRunId ?? null
                },
                { simTimeSeconds: issuedAt }
            );
        };

        const registry = actionRegistryRef.current;
        if (registry?.perform) {
            const ok = registry.perform('ISSUE_WARNING', player.id, { addWarningFn });
            if (!ok) {
                notify('warning', 'Warning blocked: not your turn, insufficient AP, or insufficient funds.');
            }
        } else {
            addWarningFn();
        }
    };

    const discardDraftWarning = (draft) => {
        const player = currentPlayerRef.current;
        const earth = earthRef.current;
        if (!player || !draft) return;
        const now = simClockRef.current?.simTimeSeconds ?? 0;
        setDraftWarningsByPlayerId(prev => {
            const current = prev[player.id] || [];
            return {
                ...prev,
                [player.id]: current.filter(d => d.id !== draft.id)
            };
        });
        earth?.logWeatherEvent?.(
            'autoWarningDraftDiscarded',
            {
                draftId: draft.id,
                playerId: player.id,
                hazardType: draft.hazardType,
                leadHours: draft.forecastLeadHours ?? null,
                forecastRunId: draft.forecastRunId ?? null
            },
            { simTimeSeconds: now }
        );
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
            cloudWatch:    55_000_000,
            sar:           50_000_000
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

    const startSelectionMode = (event) => {
        if (selectionActiveRef.current) return false;
        if (!isCanvasEvent(event)) return false;
        const latLon = getEarthClickLatLonDeg(event);
        if (!latLon) return false;
        if (selectionPendingClickRef.current?.timerId) {
            clearTimeout(selectionPendingClickRef.current.timerId);
            selectionPendingClickRef.current = null;
        }
        selectionActiveRef.current = true;
        selectionAnchorRef.current = {
            x: event.clientX,
            y: event.clientY,
            latDeg: latLon.latDeg,
            lonDeg: latLon.lonDeg
        };
        selectionRectRef.current = {
            left: event.clientX,
            top: event.clientY,
            width: 0,
            height: 0
        };
        setSelectionDragRect({ ...selectionRectRef.current });
        setSelectionControlsEnabled(false);
        const dom = rendererRef.current?.domElement;
        if (dom) dom.style.cursor = 'crosshair';
        clearSelectionOutline();
        setSelectionMenu(null);
        selectionMenuRef.current = null;
        return true;
    };

    const updateSelectionDragRect = (event) => {
        if (!selectionActiveRef.current || !selectionAnchorRef.current) return;
        const anchor = selectionAnchorRef.current;
        const left = Math.min(anchor.x, event.clientX);
        const top = Math.min(anchor.y, event.clientY);
        const width = Math.abs(event.clientX - anchor.x);
        const height = Math.abs(event.clientY - anchor.y);
        const rect = { left, top, width, height };
        selectionRectRef.current = rect;
        setSelectionDragRect(rect);
    };

    const finalizeSelectionPlacement = (event) => {
        if (!selectionActiveRef.current) return;
        if (!isCanvasEvent(event)) return;
        const rect = selectionRectRef.current;
        if (!rect || rect.width < 2 || rect.height < 2) {
            clearSelection();
            return;
        }
        selectionActiveRef.current = false;
        setSelectionDragRect(null);
        setSelectionControlsEnabled(true);
        const dom = rendererRef.current?.domElement;
        if (dom) dom.style.cursor = '';

        const outlinePoints = buildSelectionOutlineFromRect(rect);
        if (!outlinePoints) {
            notify('warning', 'Selection must cover the Earth surface.');
            clearSelectionOutline();
            return;
        }
        const earth = earthRef.current;
        if (!earth?.parentObject) return;
        clearSelectionOutline();
        const geometry = new THREE.BufferGeometry().setFromPoints(outlinePoints);
        const material = new THREE.LineDashedMaterial({
            color: 0xffffff,
            dashSize: 60,
            gapSize: 30,
            transparent: true,
            opacity: 0.9
        });
        const line = new THREE.Line(geometry, material);
        line.computeLineDistances();
        line.frustumCulled = false;
        earth.parentObject.add(line);
        selectionOutlineRef.current = line;

        const stats = computeSelectionStats(outlinePoints);
        const selectionId = `sel-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
        const selection = {
            id: selectionId,
            anchorLatLonDeg: selectionAnchorRef.current
                ? { latDeg: selectionAnchorRef.current.latDeg, lonDeg: selectionAnchorRef.current.lonDeg }
                : null,
            anchorScreen: selectionAnchorRef.current
                ? { x: selectionAnchorRef.current.x, y: selectionAnchorRef.current.y }
                : null,
            rectScreen: { ...rect },
            outlineLocalPoints: outlinePoints,
            centroidLatLonDeg: stats?.centroidLatLonDeg ?? null,
            boundingRadiusKm: stats?.boundingRadiusKm ?? 0
        };
        selectionDataRef.current = selection;

        const simTimeSeconds = simClockRef.current?.simTimeSeconds ?? 0;
        const eligibility = computeSelectionEligibility(selection, simTimeSeconds);
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const menuX = Math.min(Math.max(10, centerX - 90), window.innerWidth - 200);
        const menuY = Math.min(Math.max(10, centerY - 60), window.innerHeight - 160);
        setSelectionMenu({
            x: menuX,
            y: menuY,
            selection,
            eligibility
        });
    };

    const cancelSelectionDrag = () => {
        if (!selectionActiveRef.current) return;
        selectionActiveRef.current = false;
        selectionAnchorRef.current = null;
        selectionRectRef.current = null;
        setSelectionDragRect(null);
        setSelectionControlsEnabled(true);
        const dom = rendererRef.current?.domElement;
        if (dom) dom.style.cursor = '';
        if (selectionPendingClickRef.current?.timerId) {
            clearTimeout(selectionPendingClickRef.current.timerId);
        }
        selectionPendingClickRef.current = null;
    };

    const handleSelectionAction = (actionType) => {
        const selection = selectionDataRef.current;
        if (!selection) return;
        const simTimeSeconds = simClockRef.current?.simTimeSeconds ?? 0;
        const eligibility = computeSelectionEligibility(selection, simTimeSeconds);
        const actionInfo = actionType === 'sar' ? eligibility.sar : eligibility.image;
        if (!actionInfo?.enabled) {
            notify('warning', 'No satellite can capture this area in the next 2 hours.');
            return;
        }
        const earliestMinutes = Number.isFinite(actionInfo.nextAccessSeconds)
            ? Math.round(actionInfo.nextAccessSeconds / 60)
            : null;
        const actionLabel = actionType === 'sar' ? 'SAR capture' : 'image capture';
        notify(
            'info',
            earliestMinutes != null
                ? `Requested ${actionLabel}. Next access ~${earliestMinutes}m.`
                : `Requested ${actionLabel}.`
        );
        const earth = earthRef.current;
        earth?.logWeatherEvent?.(
            'collectRequested',
            {
                actionType,
                selectionId: selection.id,
                centroidLatLonDeg: selection.centroidLatLonDeg,
                boundingRadiusKm: selection.boundingRadiusKm,
                candidateSatIds: actionInfo.candidateIds ?? [],
                earliestAccessSeconds: actionInfo.nextAccessSeconds ?? null
            },
            { simTimeSeconds }
        );
        clearSelection();
    };

    function handleSingleClick(event) {
        // Try orbit-handle drag first if Sat panel open
        if (tryStartOrbitDrag(event)) return;
        if (warningDrawModeRef.current) {
            const earth = earthRef.current;
            if (!earth?.mesh) {
                notify('error', 'Earth not ready yet.');
                return;
            }
            const latLon = getEarthClickLatLonDeg(event);
            if (!latLon) return;
            const { latDeg, lonDeg } = latLon;
            setWarningDraft(prev => ({
                ...prev,
                vertices: [...prev.vertices, { latDeg, lonDeg }]
            }));
            return;
        }
		if (!showHQSphereRef.current && !orbitDragRef.current.active) {
			const latLon = getEarthClickLatLonDeg(event);
			if (latLon) {
				const playerId = currentPlayerRef.current?.id;
				const warnings = getVisibleWarningsForPlayer(playerId);
				const matched = findWarningAtPoint(latLon.latDeg, latLon.lonDeg, warnings);
				if (matched && matched.id) {
					const focus = warningOverlayFocusRef.current;
					const nextHazard = matched.hazardType;
					const nextProduct = HAZARD_TO_FORECAST_PRODUCT[nextHazard] || forecastProductRef.current;
					const nextHours = Number.isFinite(matched.forecastLeadHours)
						? matched.forecastLeadHours
						: forecastLeadHoursRef.current;
					const toggleMatches = showForecastOverlayRef.current && focus.activeHazardType === nextHazard;

					if (toggleMatches) {
						focus.activeHazardType = null;
						setShowForecastOverlay(false);
					} else {
						focus.activeHazardType = nextHazard;
						setForecastProduct(nextProduct);
						setForecastLeadHours(nextHours);
						setShowForecastOverlay(true);
					}

					focus.lastWarningId = matched.id;
					setFocusedWarningInfo({
						id: matched.id,
						hazardType: matched.hazardType,
						issuedAtSimTimeSeconds: matched.issuedAtSimTimeSeconds,
						validStartSimTimeSeconds: matched.validStartSimTimeSeconds,
                        validEndSimTimeSeconds: matched.validEndSimTimeSeconds,
                        forecastLeadHours: matched.forecastLeadHours,
                        forecastRunId: matched.forecastRunId ?? null,
                        autoIssued: Boolean(matched.autoIssued)
                    });
                    return;
                }
            }
        }
        if (!showHQSphereRef.current) return;
        const earth = earthRef.current;
        if (!earth?.mesh) {
            notify('error', 'Earth not ready yet.');
            return;
        }
        const latLon = getEarthClickLatLonDeg(event);
        if (!latLon) {
            notify('warning', 'Click the Earth surface to place an HQ.');
            return;
        }
        const { latDeg, lonDeg } = latLon;
        const localPoint = earth._latLonToVector3?.(latDeg, lonDeg, earth.earthRadiusKm);
        const point = localPoint ? localPoint.clone() : null;
        if (point) {
            earth.parentObject.localToWorld(point);
        }
        if (!point) {
            notify('warning', 'Click the Earth surface to place an HQ.');
            return;
        }
        // Place the HQ at the clicked point on Earth
        const newHQ = earth.addHQSphere(point, hqSpheresRef, currentPlayerRef);

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

    function handleMouseClick(event) {
        if (event.button === 2) return;
        if (selectionActiveRef.current) {
            finalizeSelectionPlacement(event);
            return;
        }

        const selectionAllowed = !warningDrawModeRef.current
            && !showHQSphereRef.current
            && !orbitDragRef.current.active
            && !orbitHoveringRef.current
            && !selectionMenuRef.current;

        if (selectionAllowed && isCanvasEvent(event)) {
            const now = performance.now();
            const last = selectionPendingClickRef.current;
            const dx = last ? event.clientX - last.x : 0;
            const dy = last ? event.clientY - last.y : 0;
            const distSq = dx * dx + dy * dy;
            if (last && now - last.time < SELECTION_DOUBLE_CLICK_MS && distSq <= SELECTION_DOUBLE_CLICK_PX * SELECTION_DOUBLE_CLICK_PX) {
                if (last.timerId) clearTimeout(last.timerId);
                selectionPendingClickRef.current = null;
                if (startSelectionMode(event)) return;
            }
            const clickEvent = {
                clientX: event.clientX,
                clientY: event.clientY,
                button: event.button,
                target: event.target
            };
            const timerId = setTimeout(() => {
                selectionPendingClickRef.current = null;
                handleSingleClick(clickEvent);
            }, SELECTION_DOUBLE_CLICK_MS);
            selectionPendingClickRef.current = {
                time: now,
                x: event.clientX,
                y: event.clientY,
                timerId
            };
            return;
        }

        handleSingleClick(event);
    }

    function handleRightClick(event) {
        event.preventDefault();
        if (selectionActiveRef.current) {
            cancelSelectionDrag();
            return;
        }
        const latLon = getEarthClickLatLonDeg(event);
        if (!latLon) {
            clearAnchor();
            return;
        }
        setAnchorAtLatLon(latLon.latDeg, latLon.lonDeg);
    }

    function handleKeyDown(event) {
        if (event.key !== 'Escape') return;
        if (selectionActiveRef.current || selectionMenuRef.current) {
            clearSelection();
        }
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

        // Add only the current player's satellites back (cones for imaging/cloudWatch/sar)
        currentPlayer.getSatellites().forEach(satellite => {
            scene.add(satellite.mesh);
            if (
                (satellite.type === 'imaging' || satellite.type === 'cloudWatch' || satellite.type === 'sar')
                && satellite.viewCone
                && satellite.coneEnabled !== false
            ) {
                satellite.viewCone.visible = true;
                scene.add(satellite.viewCone);
            } else if (satellite.viewCone) {
                satellite.viewCone.visible = false;
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
        const fmtCoord = (v) => (Number.isFinite(v) ? v.toFixed(1) : '—');

        const panelStyle = {
            position: 'absolute',
            top: 150,
            right: 10,
            width: '26%',
            minWidth: 260,
            maxWidth: 420,
            height: showSatListPanel ? '40%' : 'auto',
            padding: 12,
            overflow: 'hidden',
            zIndex: 1000,
            ...panelSurfaceStyle
        };

        return (
            <Paper style={panelStyle}>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={showSatListPanel ? 1 : 0}>
                    <Typography variant="caption" style={panelTitleStyle}>Satellites</Typography>
                    <IconButton
                        size="small"
                        onClick={() => setShowSatListPanel(prev => !prev)}
                        aria-label="Toggle satellites panel"
                        sx={{
                            color: 'rgba(226,232,240,0.85)',
                            border: '1px solid rgba(148,163,184,0.3)',
                            borderRadius: 2,
                            padding: '2px',
                            '&:hover': { backgroundColor: 'rgba(30,41,59,0.8)' }
                        }}
                    >
                        {showSatListPanel ? <RemoveIcon fontSize="small" /> : <AddIcon fontSize="small" />}
                    </IconButton>
                </Box>
                {showSatListPanel && (
                    <TableContainer
                        component={Box}
                        sx={{
                            maxHeight: 'calc(40vh - 54px)',
                            overflowY: 'auto',
                            borderRadius: 2,
                            border: '1px solid rgba(148,163,184,0.2)',
                            backgroundColor: 'rgba(15,23,42,0.5)'
                        }}
                    >
                        <Table size="small" aria-label="satellites table">
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ color: 'rgba(226,232,240,0.75)', borderBottom: '1px solid rgba(148,163,184,0.2)' }}>Sat ID</TableCell>
                                    <TableCell sx={{ color: 'rgba(226,232,240,0.75)', borderBottom: '1px solid rgba(148,163,184,0.2)' }}>Owner</TableCell>
                                    <TableCell sx={{ color: 'rgba(226,232,240,0.75)', borderBottom: '1px solid rgba(148,163,184,0.2)' }}>Lat/Lon</TableCell>
                                    <TableCell sx={{ color: 'rgba(226,232,240,0.75)', borderBottom: '1px solid rgba(148,163,184,0.2)' }}>Neighbors</TableCell>
                                    <TableCell sx={{ color: 'rgba(226,232,240,0.75)', borderBottom: '1px solid rgba(148,163,184,0.2)' }}>Cone</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {playerSatellites.map(sat => (
                                    <TableRow
                                        key={sat.id}
                                        hover
                                        onClick={() => setSelectedSatelliteId(prev => (prev === sat.id ? null : sat.id))}
                                        sx={{
                                            cursor: 'pointer',
                                            backgroundColor: sat.id === selectedSatelliteId
                                                ? 'rgba(56,189,248,0.12)'
                                                : 'transparent'
                                        }}
                                    >
                                        <TableCell sx={{ color: 'white', borderBottom: '1px solid rgba(148,163,184,0.1)' }}>{sat.id}</TableCell>
                                        <TableCell sx={{ color: 'rgba(226,232,240,0.85)', borderBottom: '1px solid rgba(148,163,184,0.1)' }}>{sat.ownerId}</TableCell>
                                        <TableCell
                                            sx={{
                                                color: 'rgba(226,232,240,0.85)',
                                                borderBottom: '1px solid rgba(148,163,184,0.1)',
                                                whiteSpace: 'nowrap'
                                            }}
                                        >
                                            {`Lat: ${fmtCoord(sat.latitude)}°, Lon: ${fmtCoord(sat.longitude)}°`}
                                        </TableCell>
                                        <TableCell sx={{ color: 'rgba(226,232,240,0.75)', borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
                                            {Array.from(sat.neighbors).join(', ') || '—'}
                                        </TableCell>
                                        <TableCell sx={{ borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
                                            {(sat.type === 'imaging' || sat.type === 'cloudWatch' || sat.type === 'sar') && sat.viewCone ? (
                                                <Switch
                                                    size="small"
                                                    checked={sat.coneEnabled !== false}
                                                    onClick={(event) => event.stopPropagation()}
                                                    onChange={(_, checked) => {
                                                        sat.coneEnabled = checked;
                                                        if (sat.viewCone) sat.viewCone.visible = checked;
                                                        renderPlayerObjects();
                                                        setSatellites([...satellitesRef.current]);
                                                    }}
                                                    color="primary"
                                                />
                                            ) : (
                                                <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.6)' }}>—</Typography>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Paper>
        );
    };



    const isSinglePlayer = gameMode === 'solo';
    const panelSurfaceStyle = {
        backgroundColor: 'rgba(12,16,24,0.92)',
        border: '1px solid rgba(148,163,184,0.22)',
        borderRadius: 12,
        boxShadow: '0 14px 30px rgba(0,0,0,0.45)',
        color: 'white'
    };
    const panelTitleStyle = {
        color: 'rgba(226,232,240,0.9)',
        fontWeight: 600,
        letterSpacing: 0.3
    };
    const panelButtonSx = {
        color: 'white',
        borderColor: 'rgba(148,163,184,0.4)',
        backgroundColor: 'rgba(15,23,42,0.6)',
        textTransform: 'none',
        fontWeight: 600,
        '&:hover': {
            backgroundColor: 'rgba(30,41,59,0.8)',
            borderColor: 'rgba(148,163,184,0.7)'
        }
    };
    const panelLabelSx = {
        color: 'rgba(226,232,240,0.8)'
    };
    const panelInputSx = {
        color: 'white',
        '.MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(148,163,184,0.35)'
        },
        '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(148,163,184,0.6)'
        },
        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(56,189,248,0.9)'
        },
        '.MuiInputBase-input': {
            color: 'white'
        },
        '.MuiSelect-icon': {
            color: 'rgba(226,232,240,0.8)'
        }
    };
    const panelSliderSx = {
        color: 'rgba(125,211,252,0.9)'
    };
	const overlayProductLabel = FORECAST_PRODUCT_LABELS[forecastProduct] ?? forecastProduct;
	const overlayLabelText = showForecastOverlay
		? `Overlay: ${overlayProductLabel} — ${formatHoursLabel(forecastLeadHours)}`
		: 'Overlay: Off';
	const alertsAnchorRect = alertsButtonRef.current?.getBoundingClientRect?.();
	const alertsPanelLeft = alertsAnchorRect
		? Math.max(10, Math.min(window.innerWidth - 350, Math.round(alertsAnchorRect.left)))
		: 10;
	const alertsPanelTop = alertsAnchorRect
		? Math.round(alertsAnchorRect.bottom + 8)
		: 64;
    const currentPlayer = currentPlayerRef.current;
    const unlockedForecastLeads = getUnlockedForecastLeads(currentPlayer);
    const unlockedWarningHazards = getUnlockedWarningHazards(currentPlayer);
    const currentTier = getForecastTier(currentPlayer);
    const currentTierSpec = getTierSpec(currentTier);
    const nextTierSpec = currentTier < 4 ? getTierSpec(currentTier + 1) : null;
    const playerHasComms = getPlayerHasComms(currentPlayer?.id);
    const longRangeLocked = !playerHasComms && Array.isArray(currentPlayer?.unlockedForecastLeadsHours)
        && currentPlayer.unlockedForecastLeadsHours.some(h => h >= 12);
    const canUpgradeForecast = Boolean(
        currentPlayer
        && nextTierSpec
        && actionRegistryRef.current?.canPerform?.('UPGRADE_FORECAST_TECH', currentPlayer.id, { moneyCost: nextTierSpec.costMoney, applyFn: () => {} })
    );
    const hasHqForUpgrade = (currentPlayer?.getHQs?.().length ?? 0) > 0;
    const draftWarnings = activePlayerId ? (draftWarningsByPlayerId[activePlayerId] || []) : [];
    const formatLatLonText = (latLon) => {
        if (!latLon || !Number.isFinite(latLon.latDeg) || !Number.isFinite(latLon.lonDeg)) return '—';
        return `${latLon.latDeg.toFixed(1)}°, ${latLon.lonDeg.toFixed(1)}°`;
    };
    const formatDebugDeg = (value) => (Number.isFinite(value) ? value.toFixed(1) : '—');
    const formatDebugSep = (value) => (Number.isFinite(value) ? value.toFixed(2) : '—');
    const cursorReadout = `Cursor: ${formatLatLonText(cursorLatLon)}`;
    const anchorReadout = `Anchor: ${formatLatLonText(anchorLatLon)}`;
    const sensorHudText = (() => {
        if (!sensorHudInfo) return null;
        const cloud = sensorHudInfo.cloudIntel;
        const active = Array.isArray(sensorHudInfo.activeSensors) ? sensorHudInfo.activeSensors : [];
        const labels = {
            surfaceStations: 'Stations',
            cloudSat: 'CloudWatch',
            soundings: 'Soundings',
            amv: 'AMVs',
            hqRadar: 'HQ Radar'
        };
        const preferred = ['surfaceStations', 'cloudSat', 'soundings', 'amv', 'hqRadar'];
        const activeLabel = preferred
            .filter(id => active.includes(id))
            .map(id => labels[id])
            .filter(Boolean)
            .join(', ') || 'None';
        if (!cloud || !Number.isFinite(cloud.coverageFrac) || !Number.isFinite(cloud.observedFrac)) {
            return `Sensors: ${activeLabel}`;
        }
        const cov = Math.round(cloud.coverageFrac * 100);
        const seen = Math.round(cloud.observedFrac * 100);
        return `CloudWatch: ${cov}% live, ${seen}% seen • Sensors: ${activeLabel}`;
    })();
    const runScoreLabel = Number.isFinite(runScore)
        ? `Run: $${Math.round(runScore / 1_000_000)}M`
        : null;
    const bestScoreLabel = Number.isFinite(bestScore)
        ? `Best: $${Math.round(bestScore / 1_000_000)}M`
        : null;

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
	            <Box
	                sx={{
	                    position: 'absolute',
	                    top: 20,
	                    left: 10,
	                    zIndex: 1100,
	                    display: 'flex',
	                    alignItems: 'center',
	                    gap: 1
	                }}
	            >
	                <IconButton
	                    size="small"
	                    onClick={() => {
	                        setShowMenu(prev => {
	                            const next = !prev;
	                            if (!next) collapsePanels();   // collapsing -> hide everything
	                            return next;
	                        });
	                    }}
	                    sx={{
	                        backgroundColor: 'rgba(12,16,24,0.9)',
	                        color: 'white',
	                        border: '1px solid rgba(148,163,184,0.35)',
	                        '&:hover': {
	                            backgroundColor: 'rgba(30,41,59,0.9)'
	                        }
	                    }}
	                >
	                    {showMenu ? <RemoveIcon fontSize="small" /> : <AddIcon fontSize="small" />}
	                </IconButton>
	                <Button
	                    variant="outlined"
	                    onClick={handleEndTurnClick}
	                    onMouseEnter={() => {
	                        if (isSinglePlayer) setSkipDayHover(true);
	                    }}
	                    onMouseLeave={() => {
	                        if (isSinglePlayer) setSkipDayHover(false);
	                    }}
	                    sx={{
	                        color: 'white',
	                        borderColor: 'rgba(148,163,184,0.5)',
	                        backgroundColor: 'rgba(10,14,22,0.85)',
	                        textTransform: 'none',
	                        fontWeight: 600,
	                        minWidth: isSinglePlayer ? 170 : 120,
	                        '&:hover': {
	                            backgroundColor: 'rgba(30,41,59,0.9)',
	                            borderColor: 'rgba(148,163,184,0.8)'
	                        }
	                    }}
	                >
	                    {isSinglePlayer ? (skipDayHover ? 'Skip to Next Day' : simTimeLabel) : 'End Turn'}
	                </Button>
	                <Button
	                    variant="outlined"
	                    color="inherit"
	                    ref={alertsButtonRef}
	                    onClick={() => setShowAlertsPanel(prev => !prev)}
	                    sx={{
	                        color: 'white',
	                        borderColor: 'rgba(255,255,255,0.6)',
	                        backgroundColor: 'rgba(0,0,0,0.4)',
	                        textTransform: 'none',
	                        fontWeight: 600
	                    }}
	                >
	                    Alerts{alertsUnreadCount > 0 ? ` (${alertsUnreadCount})` : ''}
	                </Button>
	            </Box>
	            {showAlertsPanel && (
	                <Paper
	                    style={{
	                        position: 'absolute',
	                        top: alertsPanelTop,
	                        left: alertsPanelLeft,
	                        width: 340,
	                        maxHeight: '50vh',
	                        overflowY: 'auto',
	                        padding: 10,
                        zIndex: 1200,
                        backgroundColor: 'rgba(0,0,0,0.85)',
                        color: 'white'
                    }}
                >
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                        <Typography variant="caption" style={{ color: 'white', fontWeight: 600 }}>
                            Alerts
                        </Typography>
                        <Box display="flex" gap={1}>
                            <Button
                                size="small"
                                variant="outlined"
                                color="inherit"
                                onClick={() => setAlertsHistory([])}
                            >
                                Clear
                            </Button>
                            <Button
                                size="small"
                                variant="outlined"
                                color="inherit"
                                onClick={() => setShowAlertsPanel(false)}
                            >
                                Close
                            </Button>
                        </Box>
                    </Box>
                    {alertsHistory.length === 0 ? (
                        <Typography variant="caption" style={{ color: 'rgba(255,255,255,0.7)' }}>
                            No alerts yet.
                        </Typography>
                    ) : (
                        alertsHistory.slice().reverse().map((entry) => {
                            const color = getAlertColor(entry.severity);
                            const timeLabel = Number.isFinite(entry.simTimeSeconds)
                                ? formatSimTime(entry.simTimeSeconds)
                                : 'Time unknown';
                            return (
                                <Box key={entry.id} mb={1}>
                                    <Typography variant="caption" style={{ color, fontWeight: 600 }}>
                                        {String(entry.severity || 'info').toUpperCase()}
                                    </Typography>
                                    <Typography variant="caption" style={{ color: 'white', display: 'block' }}>
                                        {entry.message}
                                    </Typography>
                                    <Typography variant="caption" style={{ color: 'rgba(255,255,255,0.6)' }}>
                                        {timeLabel}
                                    </Typography>
                                </Box>
                            );
                        })
                    )}
                </Paper>
            )}

            <div ref={mountRef} style={{ width: '100vw', height: '100vh' }} />
            {selectionDragRect && (
                <div
                    style={{
                        position: 'absolute',
                        left: selectionDragRect.left,
                        top: selectionDragRect.top,
                        width: selectionDragRect.width,
                        height: selectionDragRect.height,
                        border: '1px dashed rgba(255,255,255,0.9)',
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        pointerEvents: 'none',
                        zIndex: 1500
                    }}
                />
            )}
            {selectionMenu && (
                <Paper
                    style={{
                        position: 'absolute',
                        left: selectionMenu.x,
                        top: selectionMenu.y,
                        padding: 10,
                        zIndex: 1600,
                        minWidth: 180,
                        ...panelSurfaceStyle
                    }}
                >
                    <Typography variant="caption" style={panelTitleStyle}>
                        Area Actions
                    </Typography>
                    <Box mt={1} display="flex" flexDirection="column" gap={1}>
                        <Button
                            size="small"
                            variant="outlined"
                            sx={panelButtonSx}
                            disabled={!selectionMenu.eligibility?.image?.enabled}
                            onClick={() => handleSelectionAction('image')}
                        >
                            Image
                        </Button>
                        <Button
                            size="small"
                            variant="outlined"
                            sx={panelButtonSx}
                            disabled={!selectionMenu.eligibility?.sar?.enabled}
                            onClick={() => handleSelectionAction('sar')}
                        >
                            SAR Capture
                        </Button>
                        <Button
                            size="small"
                            variant="text"
                            sx={{
                                color: 'rgba(226,232,240,0.75)',
                                textTransform: 'none'
                            }}
                            onClick={clearSelection}
                        >
                            Cancel
                        </Button>
                    </Box>
                </Paper>
            )}
            <Paper
                style={{
                    position: 'absolute',
                    bottom: 10,
                    left: 10,
                    padding: showDebugPanel ? 10 : 6,
                    zIndex: 1200,
                    backgroundColor: 'rgba(0,0,0,0.75)',
                    color: 'white',
                    maxHeight: '70vh',
                    overflow: 'hidden'
                }}
            >
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={showDebugPanel ? 1 : 0}>
                    <Typography variant="caption" style={{ color: 'white', fontWeight: 600 }}>Debug Layers</Typography>
                    <IconButton
                        size="small"
                        onClick={() => setShowDebugPanel(prev => !prev)}
                        aria-label="Toggle debug panel"
                        style={{ color: 'white' }}
                    >
                        {showDebugPanel ? <RemoveIcon fontSize="small" /> : <AddIcon fontSize="small" />}
                    </IconButton>
                </Box>
                {showDebugPanel && (
                    <Box style={{ maxHeight: 'calc(70vh - 28px)', overflowY: 'auto', paddingRight: 6 }}>
                        <FormControlLabel
                            control={
                                <Switch
                                    size="small"
                                    checked={showFogLayer}
                                    onChange={(_, v) => setShowFogLayer(v)}
                                    color="primary"
                                />
                            }
                            label={<Typography variant="caption" style={{ color: 'white' }}>Fog of War</Typography>}
                        />
                        <FormControlLabel
                            control={
                                <Switch
                                    size="small"
                                    checked={showWeatherLayer}
                                    onChange={(_, v) => setShowWeatherLayer(v)}
                                    color="primary"
                                />
                            }
                            label={<Typography variant="caption" style={{ color: 'white' }}>Weather</Typography>}
                        />
                        <FormControlLabel
                            control={
                                <Switch
                                    size="small"
                                    checked={weatherViewSource === 'analysis'}
                                    onChange={(_, v) => setWeatherViewSource(v ? 'analysis' : 'truth')}
                                    color="primary"
                                />
                            }
                            label={<Typography variant="caption" style={{ color: 'white' }}>Analysis View</Typography>}
                        />
                        <FormControlLabel
                            control={
                                <Switch
                                    size="small"
                                    checked={sensorOnlyWeather}
                                    onChange={(_, v) => setSensorOnlyWeather(v)}
                                    color="primary"
                                />
                            }
                            label={<Typography variant="caption" style={{ color: 'white' }}>Sensor-Only Weather</Typography>}
                        />
                        <Typography variant="caption" style={{ color: 'rgba(255,255,255,0.7)', marginLeft: 8 }}>
                            Hide clouds; show only sensor detections.
                        </Typography>
                        <Box mt={1}>
                            <Typography variant="caption" style={{ color: 'white', fontWeight: 600 }}>
                                Sensors
                            </Typography>
                            <FormControlLabel
                                control={
                                    <Switch
                                        size="small"
                                        checked={showStationObs}
                                        onChange={(_, v) => setShowStationObs(v)}
                                        color="primary"
                                    />
                                }
                                label={<Typography variant="caption" style={{ color: 'white' }}>Stations</Typography>}
                            />
                            <FormControlLabel
                                control={
                                    <Switch
                                        size="small"
                                        checked={showCloudObs}
                                        onChange={(_, v) => setShowCloudObs(v)}
                                        color="primary"
                                    />
                                }
                                label={<Typography variant="caption" style={{ color: 'white' }}>Cloud Sat</Typography>}
                            />
                            <FormControlLabel
                                control={
                                    <Switch
                                        size="small"
                                        checked={showRadarObs}
                                        onChange={(_, v) => setShowRadarObs(v)}
                                        color="primary"
                                    />
                                }
                                label={<Typography variant="caption" style={{ color: 'white' }}>Ground Radar</Typography>}
                            />
                            <FormControl size="small" fullWidth variant="outlined" sx={{ mt: 0.5 }}>
                                <InputLabel style={{ color: 'white' }}>Cloud Product</InputLabel>
                                <Select
                                    value={cloudObsProduct}
                                    onChange={(e) => setCloudObsProduct(e.target.value)}
                                    label="Cloud Product"
                                    sx={{
                                        color: 'white',
                                        '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' }
                                    }}
                                >
                                    <MenuItem value="tauTotal">Tau Total</MenuItem>
                                    <MenuItem value="tauHigh">Tau High</MenuItem>
                                    <MenuItem value="tauLow">Tau Low</MenuItem>
                                    <MenuItem value="cloudHigh">Cloud High</MenuItem>
                                    <MenuItem value="cloudLow">Cloud Low</MenuItem>
                                </Select>
                            </FormControl>
                        </Box>
                        <Box mt={1}>
                            <Typography variant="caption" style={{ color: 'white', fontWeight: 600 }}>
                                Warnings
                            </Typography>
                            <FormControlLabel
                                control={
                                    <Switch
                                        size="small"
                                        checked={warningDrawMode}
                                        onChange={(_, v) => setWarningDrawMode(v)}
                                        color="primary"
                                    />
                                }
                                label={<Typography variant="caption" style={{ color: 'white' }}>Draw Warning</Typography>}
                            />
                            <Typography variant="caption" style={{ color: 'rgba(255,255,255,0.7)' }}>
                                Vertices: {warningDraft.vertices.length}
                            </Typography>
                            <Box mt={0.5} display="flex" gap={1} flexWrap="wrap">
                                <Button
                                    size="small"
                                    variant="outlined"
                                    color="inherit"
                                    onClick={() => setWarningDraft(prev => ({ ...prev, vertices: prev.vertices.slice(0, -1) }))}
                                    disabled={warningDraft.vertices.length === 0}
                                >
                                    Undo
                                </Button>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    color="inherit"
                                    onClick={() => setWarningDraft(prev => ({ ...prev, vertices: [] }))}
                                    disabled={warningDraft.vertices.length === 0}
                                >
                                    Clear
                                </Button>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    color="inherit"
                                    onClick={() => setWarningDrawMode(false)}
                                >
                                    Finish
                                </Button>
                            </Box>
                            <FormControl size="small" fullWidth variant="outlined" sx={{ mt: 0.5 }}>
                                <InputLabel style={{ color: 'white' }}>Hazard</InputLabel>
                                <Select
                                    value={warningDraft.hazardType}
                                    onChange={(e) => setWarningDraft(prev => ({ ...prev, hazardType: e.target.value }))}
                                    label="Hazard"
                                    sx={{
                                        color: 'white',
                                        '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' }
                                    }}
                                >
                                    {unlockedWarningHazards.map((hazard) => (
                                        <MenuItem key={hazard} value={hazard}>
                                            {HAZARD_LABELS[hazard] ?? hazard}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <Box mt={0.5} display="flex" gap={1}>
                                <FormControl size="small" fullWidth variant="outlined" sx={{ flex: 1 }}>
                                    <InputLabel style={{ color: 'white' }}>Start (h)</InputLabel>
                                    <Select
                                        value={warningDraft.validStartHours}
                                        onChange={(e) => setWarningDraft(prev => ({ ...prev, validStartHours: Number(e.target.value) }))}
                                        label="Start (h)"
                                        sx={{
                                            color: 'white',
                                            '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' }
                                        }}
                                    >
                                        {unlockedForecastLeads.map((h) => (
                                            <MenuItem key={h} value={h}>{formatHoursLabel(h)}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <TextField
                                    size="small"
                                    label="Duration (h)"
                                    value={warningDraft.validDurationHours}
                                    onChange={(e) => setWarningDraft(prev => ({ ...prev, validDurationHours: e.target.value }))}
                                    InputLabelProps={{ style: { color: 'white' } }}
                                    inputProps={{ style: { color: 'white' } }}
                                    sx={{ flex: 1, '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' } }}
                                />
                            </Box>
                            <Box mt={0.5}>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    color="inherit"
                                    onClick={issueWarning}
                                >
                                    Issue Warning
                                </Button>
                            </Box>
                            <Box mt={0.5}>
                                {(warningsByPlayerId[activePlayerId] || []).map((w) => (
                                    <Typography key={w.id} variant="caption" style={{ color: 'rgba(255,255,255,0.7)' }}>
                                        {w.hazardType} {w.outcome ? `(${w.outcome})` : ''}
                                    </Typography>
                                ))}
                            </Box>
                        </Box>
                        <Box mt={1}>
                            <FormControl size="small" fullWidth variant="outlined">
                                <InputLabel style={{ color: 'white' }}>Weather Debug</InputLabel>
                                <Select
                                    value={weatherDebugMode}
                                    onChange={(e) => setWeatherDebugMode(e.target.value)}
                                    label="Weather Debug"
                                    sx={{
                                        color: 'white',
                                        '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' }
                                    }}
                                >
                                    {WEATHER_DEBUG_OPTIONS.map((option) => (
                                        <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Box>
                        <Box display="flex" gap={1} mt={1} flexWrap="wrap">
                            <Button
                                size="small"
                                variant="outlined"
                                color="inherit"
                                onClick={() => setSimPausedUI(prev => !prev)}
                            >
                                {simPausedUI ? 'Resume Sim' : 'Pause Sim'}
                            </Button>
                            <FormControlLabel
                                control={
                                    <Switch
                                        size="small"
                                        checked={weatherV2ConvectionEnabled}
                                        onChange={handleV2ConvectionToggle}
                                        color="primary"
                                    />
                                }
                                label={<Typography variant="caption" style={{ color: 'white' }}>V2 Convection</Typography>}
                            />
                            <Button
                                size="small"
                                variant="outlined"
                                color="inherit"
                                onClick={() => {
                                    const simClock = simClockRef.current;
                                    simClock.stepSeconds(3600);
                                    earthRef.current?.update(simClock.simTimeSeconds, 1, {
                                        simSpeed: simClock.simSpeed,
                                        paused: simClock.paused
                                    });
                                    earthRef.current?.weatherLogNow(simClock.simTimeSeconds, {
                                        simSpeed: simClock.simSpeed,
                                        paused: simClock.paused
                                    }, 'step+1h');
                                    updateWeatherDebugNow();
                                }}
                            >
                                Step +1 hour
                            </Button>
                            <Button
                                size="small"
                                variant="outlined"
                                color="inherit"
                                onClick={() => {
                                    const simClock = simClockRef.current;
                                    simClock.stepSeconds(86400);
                                    earthRef.current?.update(simClock.simTimeSeconds, 1, {
                                        simSpeed: simClock.simSpeed,
                                        paused: simClock.paused
                                    });
                                    earthRef.current?.weatherLogNow(simClock.simTimeSeconds, {
                                        simSpeed: simClock.simSpeed,
                                        paused: simClock.paused
                                    }, 'step+1d');
                                    updateWeatherDebugNow();
                                }}
                            >
                                Step +1 day
                            </Button>
                            <Button
                                size="small"
                                variant="outlined"
                                color="inherit"
                                onClick={() => {
                                    const simClock = simClockRef.current;
                                    simClock.stepSeconds(MONTH_SECONDS);
                                    earthRef.current?.update(simClock.simTimeSeconds, 1, {
                                        simSpeed: simClock.simSpeed,
                                        paused: simClock.paused
                                    });
                                    earthRef.current?.weatherLogNow(simClock.simTimeSeconds, {
                                        simSpeed: simClock.simSpeed,
                                        paused: simClock.paused
                                    }, 'step+1mo');
                                    updateWeatherDebugNow();
                                }}
                            >
                                Step +1 month
                            </Button>
                        </Box>
                        <Box mt={1}>
                            <Typography variant="caption" display="block" style={{ color: 'white' }}>
                                Sim speed: {simSpeedUI.toLocaleString()}x
                            </Typography>
                            <Slider
                                size="small"
                                min={0}
                                max={Math.log10(SIM_SPEED_MAX)}
                                step={0.1}
                                marks={SIM_SPEED_MARKS}
                                value={speedToSliderValue(simSpeedUI)}
                                onChange={handleSimSpeedChange}
                                sx={{ color: 'white' }}
                            />
                        </Box>
                        <Typography variant="caption" display="block" style={{ color: 'white', marginTop: 6 }}>
                            Sim time: {simTimeLabel}{simPausedUI ? ' (paused)' : ''}
                        </Typography>
                        <Box mt={1}>
                            <Typography variant="caption" display="block" style={{ color: 'white' }}>
                                Weather Log Capture
                            </Typography>
                            <Box display="flex" gap={1} mt={0.5} flexWrap="wrap">
                                <Button
                                    size="small"
                                    variant="outlined"
                                    color="inherit"
                                    onClick={toggleWeatherLogCapture}
                                >
                                    {weatherLogEnabled ? 'Stop Capture' : 'Start Capture'}
                                </Button>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    color="inherit"
                                    onClick={clearWeatherLogCapture}
                                >
                                    Clear
                                </Button>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    color="inherit"
                                    onClick={downloadWeatherLogCapture}
                                    disabled={weatherLogCount === 0}
                                >
                                    Download
                                </Button>
                            </Box>
                            <Box mt={1}>
                                <FormControl size="small" fullWidth variant="outlined">
                                    <InputLabel style={{ color: 'white' }}>Log Cadence</InputLabel>
                                    <Select
                                        value={weatherLogCadence}
                                        onChange={handleWeatherLogCadenceChange}
                                        label="Log Cadence"
                                        sx={{
                                            color: 'white',
                                            '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' }
                                        }}
                                    >
                                        {WEATHER_LOG_CADENCE_OPTIONS.map((option) => (
                                            <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Box>
                            <Typography variant="caption" display="block" style={{ color: 'white', marginTop: 4 }}>
                                Entries: {weatherLogCount}{weatherLogEnabled ? ' (capturing)' : ''}
                            </Typography>
                        </Box>
                        <Box mt={1}>
                            <Typography variant="caption" display="block" style={{ color: 'white' }}>
                                Zonal Mean ({weatherDebugMode})
                            </Typography>
                            <canvas
                                ref={zonalCanvasRef}
                                width={180}
                                height={120}
                                style={{ width: 180, height: 120, border: '1px solid rgba(255,255,255,0.2)' }}
                            />
                        </Box>
                        <Box display="flex" gap={1} mt={1} alignItems="center">
                            <TextField
                                size="small"
                                variant="outlined"
                                label="Seed"
                                value={weatherSeedInput}
                                onChange={handleWeatherSeedChange}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        applyWeatherSeed();
                                    }
                                }}
                                InputLabelProps={{ style: { color: 'white' } }}
                                inputProps={{ style: { color: 'white' } }}
                            />
                            <Button size="small" variant="outlined" color="inherit" onClick={applyWeatherSeed}>
                                Apply
                            </Button>
                        </Box>
                        <Typography variant="caption" display="block" style={{ color: 'white', marginTop: 4 }}>
                            Current seed: {weatherSeed || '...'}
                        </Typography>
                    </Box>
                )}
            </Paper>

	            <Box
	                sx={{
	                    position: 'absolute',
	                    top: 20,
	                    right: 10,
	                    zIndex: 1000,
	                    display: 'flex',
	                    flexDirection: 'column',
	                    alignItems: 'flex-end',
	                    textAlign: 'right',
	                    pointerEvents: 'none'
	                }}
	            >
	                <Box sx={{ display: 'flex', gap: 4, alignItems: 'baseline', justifyContent: 'flex-end' }}>
	                    <Typography variant="h6" style={{ color: 'white' }}>
	                        Funds: {'$'}{Math.round((currentPlayerRef.current?.funds ?? 0) / 1_000_000)}M
	                    </Typography>
	                    <Typography variant="h6" style={{ color: 'white' }}>
	                        Turn: {currentTurn} | AP: {actionPoints}
	                    </Typography>
	                </Box>
	                <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.85)', marginTop: 4 }}>
	                    {overlayLabelText}
	                </Typography>
	                {runScoreLabel && (
	                    <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.85)', marginTop: 2 }}>
	                        {runScoreLabel}
	                    </Typography>
	                )}
	                {bestScoreLabel && (
	                    <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.75)', marginTop: 2 }}>
	                        {bestScoreLabel}
	                    </Typography>
	                )}
                {sensorHudText && (
                    <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.7)', marginTop: 2, maxWidth: 520 }}>
                        {sensorHudText}
                    </Typography>
                )}
                {cloudWatchDebugEnabled && cloudWatchDebugInfo.length > 0 && (
                    <Box sx={{ marginTop: 1, maxWidth: 520 }}>
                        <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.75)' }}>
                            CloudWatch debug
                        </Typography>
                        {cloudWatchDebugInfo.map((entry) => (
                            <Typography
                                key={entry.satId}
                                variant="caption"
                                style={{ color: 'rgba(148,163,184,0.8)', display: 'block' }}
                            >
                                {entry.satId}: sub({formatDebugDeg(entry.subpointLatDeg)},{formatDebugDeg(entry.subpointLonDeg)})
                                {' '}fp({formatDebugDeg(entry.footprintLatDeg)},{formatDebugDeg(entry.footprintLonDeg)})
                                {' '}d={formatDebugSep(entry.separationDeg)}°
                            </Typography>
                        ))}
                    </Box>
                )}
            </Box>
            <Box
                sx={{
                    position: 'absolute',
                    bottom: 10,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 1000,
                    padding: '4px 12px',
                    borderRadius: 8,
                    backgroundColor: 'rgba(10,14,22,0.75)',
                    border: '1px solid rgba(148,163,184,0.35)'
                }}
            >
                <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.9)' }}>
                    {cursorReadout} · {anchorReadout}
                </Typography>
            </Box>

	            {showMenu && (
	                <Paper style={{ position: 'absolute', top: 64, left: 10, padding: 12, zIndex: 1100, minWidth: 160, ...panelSurfaceStyle }}>
	                    <Typography variant="caption" style={panelTitleStyle}>
	                        Operations
	                    </Typography>
	                    <Box display="flex" flexDirection="column" gap={1} mt={1}>
                        <Button
                            size="small"
                            variant="outlined"
                            sx={panelButtonSx}
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
                            size="small"
                            variant="outlined"
                            sx={panelButtonSx}
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
                            Satellites
                        </Button>

                        {gameMode === 'pvp' && (
                            <Button
                                size="small"
                                variant="outlined"
                                sx={panelButtonSx}
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
                    </Box>
                </Paper>
            )}

            {gameMode && (
                <Box
                    style={{
                        position: 'absolute',
                        bottom: 120,
                        right: 10,
                        width: 260,
                        zIndex: 1000
                    }}
                >
                    {focusedWarningInfo && (
                        <Paper style={{ padding: 10, marginBottom: 8, ...panelSurfaceStyle }}>
                            <Typography variant="caption" style={panelTitleStyle}>
                                Warning Focus
                            </Typography>
                            <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.85)', display: 'block' }}>
                                {HAZARD_LABELS[focusedWarningInfo.hazardType] || focusedWarningInfo.hazardType}
                            </Typography>
                            <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.75)', display: 'block' }}>
                                Issued: {formatSimTime(focusedWarningInfo.issuedAtSimTimeSeconds)}
                            </Typography>
                            <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.75)', display: 'block' }}>
                                Valid: {formatSimTime(focusedWarningInfo.validStartSimTimeSeconds)} → {formatSimTime(focusedWarningInfo.validEndSimTimeSeconds)}
                            </Typography>
                            <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.75)', display: 'block' }}>
                                {formatHoursLabel(focusedWarningInfo.forecastLeadHours)} {focusedWarningInfo.autoIssued ? '(auto)' : ''}
                            </Typography>
                        </Paper>
                    )}
	                    <Paper style={{ padding: 12, ...panelSurfaceStyle }}>
	                        <Typography variant="subtitle2" style={panelTitleStyle} gutterBottom>
	                            Forecast
	                        </Typography>
	                        <FormControl fullWidth size="small" sx={{ mb: 1 }}>
	                            <InputLabel sx={panelLabelSx}>In X hours</InputLabel>
	                            <Select
	                                value={forecastLeadHours}
	                                onChange={(e) => setForecastLeadHours(Number(e.target.value))}
	                                label="In X hours"
	                                sx={panelInputSx}
	                            >
	                                {unlockedForecastLeads.map((h) => (
	                                    <MenuItem key={h} value={h}>{formatHoursLabel(h)}</MenuItem>
	                                ))}
	                            </Select>
	                        </FormControl>
	                        <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
	                            <Button
	                                size="small"
	                                variant="outlined"
	                                disabled={forecastStatus.running}
	                                onClick={runForecast}
	                                sx={panelButtonSx}
	                            >
	                                {forecastStatus.running ? 'Running...' : 'Run Forecast'}
	                            </Button>
	                            <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.7)' }}>
	                                {forecastStatus.running
	                                    ? `${Math.round((forecastStatus.progress01 || 0) * 100)}% ${forecastStatus.message || ''}`
	                                    : formatHoursLabel(forecastLeadHours)}
	                            </Typography>
	                        </Box>
                        <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.7)', marginTop: 6, display: 'block' }}>
                            Base: {forecastBaseTimeSeconds != null ? formatSimTime(forecastBaseTimeSeconds) : 'n/a'}
                        </Typography>
                        <Box mt={1}>
                            <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.85)' }}>
                                Forecast Tech: Tier {currentTier} — {currentTierSpec?.name ?? 'Unknown'}
                            </Typography>
                            {nextTierSpec ? (
                                <>
                                    <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.9)', display: 'block', marginTop: 2 }}>
                                        Next: Tier {currentTier + 1} — {nextTierSpec.name} (${Math.round((nextTierSpec.costMoney ?? 0) / 1_000_000)}M, 1 AP)
                                    </Typography>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        sx={{ ...panelButtonSx, marginTop: 0.5 }}
                                        onClick={upgradeForecastTech}
                                        disabled={!canUpgradeForecast || !hasHqForUpgrade}
                                    >
                                        Upgrade
                                    </Button>
                                </>
                            ) : (
                                <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.9)', display: 'block', marginTop: 2 }}>
                                    Forecast tech is fully upgraded.
                                </Typography>
                            )}
                        </Box>
                        <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.75)', marginTop: 4, display: 'block' }}>
                            Confidence = analysis certainty here; better sensors raise it.
                        </Typography>
                        <Typography
                            variant="caption"
                            style={{
                                color: playerHasComms ? 'rgba(74,222,128,0.9)' : 'rgba(251,191,36,0.9)',
                                marginTop: 2,
                                display: 'block'
                            }}
                        >
                            Comms: {playerHasComms ? 'Online' : 'Offline'}
                        </Typography>
                        {longRangeLocked && (
                            <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.8)', marginTop: 2, display: 'block' }}>
                                Long-range (12–24h) requires a comm satellite in link.
                            </Typography>
                        )}
                        <Box mt={1}>
                            <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.8)' }}>
                                Drafts
                            </Typography>
                                {draftWarnings.length === 0 ? (
                                    <Typography variant="caption" style={{ color: 'rgba(148,163,184,0.8)', display: 'block' }}>
                                        No draft warnings yet.
                                    </Typography>
                                ) : (
                                    <Box mt={0.5} display="flex" flexDirection="column" gap={0.5}>
                                        {draftWarnings.map((draft) => (
                                            <Box key={draft.id} display="flex" alignItems="center" justifyContent="space-between" gap={1}>
                                                <Typography variant="caption" style={{ color: 'rgba(226,232,240,0.8)' }}>
                                                    {HAZARD_LABELS[draft.hazardType] ?? draft.hazardType} · {formatHoursLabel(draft.forecastLeadHours)} · {Number.isFinite(draft.areaFracService) ? `${Math.round(draft.areaFracService * 100)}%` : '—'}
                                                </Typography>
                                                <Box display="flex" gap={0.5}>
                                                    <Button
                                                        size="small"
                                                        variant="outlined"
                                                        sx={panelButtonSx}
                                                        onClick={() => issueDraftWarning(draft)}
                                                    >
                                                        Issue
                                                    </Button>
                                                    <Button
                                                        size="small"
                                                        variant="outlined"
                                                        sx={panelButtonSx}
                                                        onClick={() => discardDraftWarning(draft)}
                                                    >
                                                        Discard
                                                    </Button>
                                                </Box>
                                            </Box>
                                        ))}
                                    </Box>
                                )}
                            </Box>
	                        <Box mt={1}>
	                            <Button
	                                size="small"
	                                variant="outlined"
	                                onClick={() => setShowForecastAdvanced(prev => !prev)}
	                                endIcon={showForecastAdvanced ? <RemoveIcon fontSize="small" /> : <AddIcon fontSize="small" />}
	                                sx={panelButtonSx}
	                            >
	                                Advanced
	                            </Button>
	                        </Box>
	                        {showForecastAdvanced && (
	                            <Box mt={1}>
	                                <FormControl fullWidth size="small" sx={{ mb: 1 }}>
	                                    <InputLabel sx={panelLabelSx}>Product</InputLabel>
	                                    <Select
	                                        value={forecastProduct}
	                                        onChange={(e) => {
	                                            warningOverlayFocusRef.current.activeHazardType = null;
	                                            setForecastProduct(e.target.value);
	                                        }}
	                                        label="Product"
	                                        sx={panelInputSx}
	                                    >
	                                        {['precipRate', 'windSpeed', 'cloudTau', 'confidence'].map((value) => (
	                                            <MenuItem key={value} value={value}>
	                                                {FORECAST_PRODUCT_LABELS[value] ?? value}
	                                            </MenuItem>
	                                        ))}
	                                    </Select>
	                                </FormControl>
	                                <FormControlLabel
	                                    control={
	                                        <Switch
	                                            size="small"
	                                            checked={showForecastOverlay}
	                                            onChange={(_, v) => {
	                                                warningOverlayFocusRef.current.activeHazardType = null;
	                                                setShowForecastOverlay(v);
	                                            }}
	                                            color="primary"
	                                        />
	                                    }
	                                    label={<Typography variant="caption" style={{ color: 'rgba(226,232,240,0.8)' }}>Show overlay</Typography>}
	                                />
	                            </Box>
	                        )}
	                    </Paper>
                </Box>
            )}

            {showSatPanel && (
                <Paper style={{ position: 'absolute', top: gameMode === 'pvp' ? 270 : 240, left: 10, padding: 12, width: 260, zIndex: 1000, ...panelSurfaceStyle }}>
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                        <Typography variant="subtitle2" style={panelTitleStyle}>
                            Satellite Ops
                        </Typography>
                        <IconButton
                            size="small"
                            onClick={() => setShowSatPanel(false)}
                            sx={{
                                color: 'rgba(226,232,240,0.85)',
                                border: '1px solid rgba(148,163,184,0.3)',
                                borderRadius: 2,
                                padding: '2px',
                                '&:hover': { backgroundColor: 'rgba(30,41,59,0.8)' }
                            }}
                        >
                            <RemoveIcon fontSize="small" />
                        </IconButton>
                    </Box>
                    <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                        <InputLabel sx={panelLabelSx}>Type</InputLabel>
                        <Select
                            value={satelliteType}
                            onChange={(e) => setSatelliteType(e.target.value)}
                            label="Type"
                            sx={panelInputSx}
                        >
                            <MenuItem value="communication">Communication</MenuItem>
                            <MenuItem value="imaging">Recon Imaging</MenuItem>
                            <MenuItem value="cloudWatch">Cloud-Watch</MenuItem>
                            <MenuItem value="sar">SAR</MenuItem>
                        </Select>
                    </FormControl>
                    <TextField
                        size="small"
                        label="Altitude (km)"
                        type="number"
                        fullWidth
                        value={altitude}
                        onChange={(e) => {
                            const next = e.target.value;
                            altitudeRef.current = next;
                            setAltitude(next);
                        }}
                        sx={{ mb: 1, ...panelInputSx }}
                        InputLabelProps={{ sx: panelLabelSx }}
                    />
                    <TextField
                        size="small"
                        label="Speed (km/h)"
                        type="number"
                        fullWidth
                        value={speed}
                        onChange={(e) => setSpeed(e.target.value)}
                        sx={{ mb: 1, ...panelInputSx }}
                        InputLabelProps={{ sx: panelLabelSx }}
                    />
                    <Box sx={{ mb: 1 }}>
                        <Typography variant="caption" style={panelLabelSx}>
                            Field of View
                        </Typography>
                        <Slider
                            value={fieldOfView}
                            onChange={(e, val) => setFieldOfView(val)}
                            step={0.01}
                            min={1.69}
                            max={7.95}
                            valueLabelDisplay="auto"
                            sx={panelSliderSx}
                        />
                    </Box>
                    <TextField
                        size="small"
                        label="Initial Angle"
                        type="number"
                        fullWidth
                        value={angle}
                        onChange={(e) => setAngle(e.target.value)}
                        sx={{ mb: 1, ...panelInputSx }}
                        InputLabelProps={{ sx: panelLabelSx }}
                    />
                    <TextField
                        size="small"
                        label="Inclination"
                        type="number"
                        fullWidth
                        value={inclination}
                        onChange={(e) => setInclination(e.target.value)}
                        sx={{ mb: 1, ...panelInputSx }}
                        InputLabelProps={{ sx: panelLabelSx }}
                    />
                    <Button
                        variant="contained"
                        onClick={handleAddSatellite}
                        sx={{
                            backgroundColor: 'rgba(13,148,136,0.9)',
                            color: 'white',
                            textTransform: 'none',
                            fontWeight: 600,
                            '&:hover': {
                                backgroundColor: 'rgba(15,118,110,1)'
                            }
                        }}
                    >
                        Launch (${Math.round(launchCost / 1_000_000)}M)
                    </Button>
                    <Typography variant="caption" display="block" style={{ marginTop: 8, color: 'rgba(226,232,240,0.75)' }}>
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
