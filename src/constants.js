// src/constants.js
export const COMM_RANGE_KM  = 40000; // sat <-> sat
export const HQ_RANGE_KM_IMAGING = 3000;  // sat <-> HQ (recon)
export const HQ_RANGE_KM_COMM = 50000;    // sat <-> HQ (comms)
export const HQ_RANGE_KM_CLOUDWATCH = 50000; // sat <-> HQ (cloud watch)
export const SPACE_LOS_EPS  = 1e-3;  // both endpoints in space
// LoS epsilon when one endpoint is on the ground. Slightly relaxed to avoid edge-case false occlusions
export const GROUND_LOS_EPS = 5e-2;
// --- Physics constants for cost model (SI units) ---

export const MU_EARTH     = 3.986004418e14;  // m^3/s^2
export const RE_M         = 6_371_000;       // Earth mean radius (m)
export const OMEGA_EARTH  = 7.2921150e-5;    // rad/s
export const LOSSES_MPS   = 1500;            // gravity/drag/steering lumped loss (m/s)
export const DV_REF_MPS   = 9000;            // reference Δv for scaling (m/s)
export const DV_EXPONENT  = 1.30;            // smooth steepness of cost vs Δv

// CloudWatch: grid lon is offset from world lon due to sphere UV mapping.
export const CLOUD_WATCH_GRID_LON_OFFSET_RAD = -Math.PI / 2;

// Economy constants
export const BASE_INCOME_PER_TURN       = 2_000_000;
export const INCOME_PER_IMAGING_IN_LINK = 1_500_000;
export const INCOME_PER_COMM_IN_LINK    =   500_000;
export const UPKEEP_PER_SAT             =   200_000;
