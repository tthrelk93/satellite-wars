import json, math, os
root = '/Users/agentt/.openclaw/workspace/Developer/satellite-wars'
case_root = os.path.join(root, 'weather-validation/cases/earth-suite')
fix_root = os.path.join(root, 'weather-validation/fixtures/earth-suite')
os.makedirs(case_root, exist_ok=True)
os.makedirs(fix_root, exist_ok=True)

target_grid = {
    'latitudesDeg': [60, 30, 0, -30, -60],
    'longitudesDeg': [-150, -90, -30, 30, 90, 150]
}
source_grid = {
    'latitudesDeg': [75, 25, -25, -75],
    'longitudesDeg': [-165, -105, -45, 15, 75, 135]
}
leads = [0, 12, 24]

cases = [
    ('quiescent-synoptic', 'Quiescent synoptic case', 'quiescent', 0.4, 0.15, 0.8),
    ('midlatitude-cyclone', 'Strong midlatitude cyclone', 'cyclone', 1.4, 0.55, 1.6),
    ('tropical-system', 'Tropical system case', 'tropical', 1.2, 0.45, 1.5),
    ('mountain-precip', 'Mountain precipitation case', 'mountain', 1.0, 0.40, 1.4),
    ('polar-ice', 'Polar / sea-ice case', 'polar', 0.7, 0.25, 1.0),
]

def clamp(v, lo, hi):
    return max(lo, min(hi, v))

def grid_values(grid, fn):
    out=[]
    for lat in grid['latitudesDeg']:
        lat_r = math.radians(lat)
        for lon in grid['longitudesDeg']:
            lon_r = math.radians(lon)
            out.append(round(fn(lat, lon, lat_r, lon_r), 6))
    return out

def make_reference(case_scale, lead, grid, polar=False, tropical=False, mountain=False):
    def slp_fn(lat, lon, lat_r, lon_r):
        storm = case_scale * 700 * math.exp(-((lon+40)**2)/5000 - ((lat-35)**2)/1200)
        trop = (case_scale * 500 if tropical else 0) * math.exp(-((lon+55)**2)/3000 - ((lat-15)**2)/900)
        return 101000 + 320*math.cos(lon_r*0.8) - 180*math.sin(lat_r*1.2) - storm - trop - lead*2
    def ps_fn(lat, lon, lat_r, lon_r):
        return slp_fn(lat, lon, lat_r, lon_r) - 120 - (200 if mountain and lon > 0 and lat > 0 else 0)
    def u_fn(lat, lon, lat_r, lon_r, p):
        jet = (6 + (100000-p)/8000) * math.sin(lon_r) + 2*math.cos(lat_r*1.1)
        cyclone = case_scale * 4 * math.exp(-((lon+40)**2)/4000 - ((lat-35)**2)/900)
        trop = (case_scale*3 if tropical else 0) * math.exp(-((lon+55)**2)/3500 - ((lat-15)**2)/800)
        return jet + cyclone + trop + 0.05*lead
    def v_fn(lat, lon, lat_r, lon_r, p):
        base = 3*math.cos(lon_r*0.5) - (1 + (100000-p)/20000)*math.sin(lat_r*1.3)
        cyclone = case_scale * 3 * math.exp(-((lon+40)**2)/4000 - ((lat-35)**2)/900)
        return base - cyclone
    def z_fn(lat, lon, lat_r, lon_r):
        return 5600 + 120*math.cos(lat_r) - 80*math.sin(lon_r*0.7) + lead*3 - case_scale*40*math.exp(-((lon+40)**2)/5000 - ((lat-35)**2)/1200)
    def tcw_fn(lat, lon, lat_r, lon_r):
        trop = 6 if tropical else 0
        polar_term = -6 if polar else 0
        return 20 + 8*math.cos(lat_r) + 1.5*math.sin(lon_r) + trop + polar_term + 0.08*lead
    def precip_fn(lat, lon, lat_r, lon_r):
        storm = case_scale * 2.5 * math.exp(-((lon+40)**2)/2500 - ((lat-35)**2)/700)
        orog = 2.5 if mountain and lon > 0 and lat > 0 else 0
        trop = 2.8 if tropical else 0
        return max(0.0, 0.6 + 1.0*math.sin(lon_r*0.8) + 1.2*math.cos(lat_r*1.1) + storm + orog + trop + 0.02*lead)
    def cloud_low(lat, lon, lat_r, lon_r):
        return clamp(0.25 + 0.15*math.sin(lon_r) + 0.1*math.cos(lat_r*1.3) + 0.08*(mountain and lon > 0 and lat > 0),0,1)
    def cloud_high(lat, lon, lat_r, lon_r):
        return clamp(0.18 + 0.12*math.cos(lon_r*0.8) + 0.08*math.sin(lat_r) + 0.12*case_scale,0,1)
    slp = grid_values(grid, slp_fn)
    ps = grid_values(grid, ps_fn)
    u = grid_values(grid, lambda lat, lon, lat_r, lon_r: u_fn(lat, lon, lat_r, lon_r, 100000))
    v = grid_values(grid, lambda lat, lon, lat_r, lon_r: v_fn(lat, lon, lat_r, lon_r, 100000))
    z500 = grid_values(grid, z_fn)
    tcw = grid_values(grid, tcw_fn)
    precip = grid_values(grid, precip_fn)
    cl = grid_values(grid, cloud_low)
    ch = grid_values(grid, cloud_high)
    ct = [round(1 - (1-a)*(1-b), 6) for a,b in zip(cl,ch)]
    return {
        'leadHours': lead,
        'seaLevelPressurePa': slp,
        'surfacePressurePa': ps,
        'wind10mU': u,
        'wind10mV': v,
        'geopotentialHeightMByPressurePa': {'50000': z500},
        'totalColumnWaterKgM2': tcw,
        'precipRateMmHr': precip,
        'precipAccumMm': [round(p*lead,6) for p in precip],
        'cloudLowFraction': cl,
        'cloudHighFraction': ch,
        'cloudTotalFraction': ct,
    }

def perturb(lead_obj, amp):
    def mod(arr, scale, bias=0.0):
        out=[]
        for i,v in enumerate(arr):
            phase = math.sin((i+1)*0.7) + math.cos((i+1)*0.31)
            out.append(round(v + bias + scale*phase, 6))
        return out
    out = dict(lead_obj)
    out['seaLevelPressurePa'] = mod(lead_obj['seaLevelPressurePa'], 45*amp)
    out['surfacePressurePa'] = mod(lead_obj['surfacePressurePa'], 40*amp)
    out['wind10mU'] = mod(lead_obj['wind10mU'], 0.7*amp)
    out['wind10mV'] = mod(lead_obj['wind10mV'], 0.6*amp)
    out['geopotentialHeightMByPressurePa'] = {'50000': mod(lead_obj['geopotentialHeightMByPressurePa']['50000'], 8*amp)}
    out['totalColumnWaterKgM2'] = mod(lead_obj['totalColumnWaterKgM2'], 0.8*amp)
    out['precipRateMmHr'] = [round(max(0,v + 0.3*amp*math.sin((i+1)*0.4)),6) for i,v in enumerate(lead_obj['precipRateMmHr'])]
    out['precipAccumMm'] = [round(max(0,v + 0.6*amp*math.sin((i+1)*0.4)),6) for i,v in enumerate(lead_obj['precipAccumMm'])]
    out['cloudLowFraction'] = [round(clamp(v + 0.03*amp*math.sin((i+1)*0.5),0,1),6) for i,v in enumerate(lead_obj['cloudLowFraction'])]
    out['cloudHighFraction'] = [round(clamp(v + 0.02*amp*math.cos((i+1)*0.35),0,1),6) for i,v in enumerate(lead_obj['cloudHighFraction'])]
    out['cloudTotalFraction'] = [round(1 - (1-a)*(1-b),6) for a,b in zip(out['cloudLowFraction'], out['cloudHighFraction'])]
    return out

suite_cases=[]
for case_id, label, category, model_amp, analysis_amp, baseline_amp in cases:
    case_dir = os.path.join(case_root, case_id)
    fix_dir = os.path.join(fix_root, case_id)
    os.makedirs(case_dir, exist_ok=True)
    os.makedirs(fix_dir, exist_ok=True)
    polar = category == 'polar'
    tropical = category == 'tropical'
    mountain = category == 'mountain'
    case_scale = {'quiescent':0.6,'cyclone':1.5,'tropical':1.3,'mountain':1.1,'polar':0.8}[category]

    reference = {'schema':'satellite-wars.weather-validation.fields.v1','grid':source_grid,'pressureLevelsPa':[50000],'leads':[make_reference(case_scale, lead, source_grid, polar=polar, tropical=tropical, mountain=mountain) for lead in leads]}
    target_ref = [make_reference(case_scale, lead, target_grid, polar=polar, tropical=tropical, mountain=mountain) for lead in leads]
    model = {'schema':'satellite-wars.weather-validation.fields.v1','grid':target_grid,'pressureLevelsPa':[50000],'leads':[perturb(lead, model_amp) for lead in target_ref]}
    analysis = {'schema':'satellite-wars.weather-validation.fields.v1','grid':target_grid,'pressureLevelsPa':[50000],'leads':[perturb(lead, analysis_amp) for lead in target_ref]}
    climatology = {'schema':'satellite-wars.weather-validation.fields.v1','grid':target_grid,'pressureLevelsPa':[50000],'leads':[perturb(lead, baseline_amp) for lead in target_ref]}
    persistence = {'schema':'satellite-wars.weather-validation.fields.v1','grid':target_grid,'pressureLevelsPa':[50000],'leads':[]}
    for lead in leads:
        base = perturb(target_ref[0], baseline_amp*0.9)
        base['leadHours'] = lead
        persistence['leads'].append(base)
    remap_floor = {'schema':'satellite-wars.weather-validation.fields.v1','grid':target_grid,'pressureLevelsPa':[50000],'leads':[perturb(lead, 0.08) for lead in target_ref]}
    ref_track = model_track = analysis_track = None
    if category in ('cyclone','tropical'):
        base_lat = 35 if category == 'cyclone' else 15
        base_lon = -45 if category == 'cyclone' else -60
        ref_track = {'schema':'satellite-wars.weather-validation.cyclone-track.v1','tracks':[{'stormId':'ST01','points':[{'leadHours':0,'latDeg':base_lat,'lonDeg':base_lon},{'leadHours':12,'latDeg':base_lat+3,'lonDeg':base_lon+4},{'leadHours':24,'latDeg':base_lat+5,'lonDeg':base_lon+8}]}]}
        model_track = {'schema':'satellite-wars.weather-validation.cyclone-track.v1','tracks':[{'stormId':'ST01','points':[{'leadHours':0,'latDeg':base_lat+0.4,'lonDeg':base_lon+0.6},{'leadHours':12,'latDeg':base_lat+3.6,'lonDeg':base_lon+4.5},{'leadHours':24,'latDeg':base_lat+5.7,'lonDeg':base_lon+8.4}]}]}
        analysis_track = {'schema':'satellite-wars.weather-validation.cyclone-track.v1','tracks':[{'stormId':'ST01','points':[{'leadHours':0,'latDeg':base_lat+0.2,'lonDeg':base_lon+0.3},{'leadHours':12,'latDeg':base_lat+3.2,'lonDeg':base_lon+4.2},{'leadHours':24,'latDeg':base_lat+5.2,'lonDeg':base_lon+8.1}]}]}
    def dump(name,obj):
        with open(os.path.join(fix_dir,f'{name}.json'),'w',encoding='utf8') as f:
            json.dump(obj,f,indent=2); f.write('\n')
    for name,obj in [('reference-fields',reference),('model-fields',model),('analysis-fields',analysis),('climatology-fields',climatology),('persistence-fields',persistence),('remap-floor-fields',remap_floor)]:
        dump(name,obj)
    if ref_track:
        dump('reference-track', ref_track); dump('model-track', model_track); dump('analysis-track', analysis_track)
    manifest = {
      'schema':'satellite-wars.weather-validation.case.v1','caseId':case_id,'title':label,'initTime':'2026-01-15T00:00:00Z','leadHours':leads,'validationPressureLevelsPa':[50000],'simulatorGrid':target_grid,
      'outputDir':f'weather-validation/output/{case_id}',
      'model': {'fieldsPath':f'../../../fixtures/earth-suite/{case_id}/model-fields.json', **({'stormTrackPath':f'../../../fixtures/earth-suite/{case_id}/model-track.json'} if ref_track else {})},
      'analysis': {'fieldsPath':f'../../../fixtures/earth-suite/{case_id}/analysis-fields.json', **({'stormTrackPath':f'../../../fixtures/earth-suite/{case_id}/analysis-track.json'} if ref_track else {})},
      'reference': {'fieldsPath':f'../../../fixtures/earth-suite/{case_id}/reference-fields.json', **({'stormTrackPath':f'../../../fixtures/earth-suite/{case_id}/reference-track.json'} if ref_track else {})}
    }
    with open(os.path.join(case_dir,'manifest.json'),'w',encoding='utf8') as f:
        json.dump(manifest,f,indent=2); f.write('\n')
    suite_cases.append({'caseId':case_id,'label':label,'category':category,'manifestPath':f'../cases/earth-suite/{case_id}/manifest.json','baselines':{'climatology':{'fieldsPath':f'../fixtures/earth-suite/{case_id}/climatology-fields.json'},'persistence':{'fieldsPath':f'../fixtures/earth-suite/{case_id}/persistence-fields.json'},'remapFloor':{'fieldsPath':f'../fixtures/earth-suite/{case_id}/remap-floor-fields.json'}}})

suite = {'suiteId':'earth-accuracy-suite-v1','reportBasePath':'weather-validation/reports/earth-accuracy-status','thresholds':{'slpRmseHpa':{'absolute':2.5,'floorMultiplier':8},'z500RmseM':{'absolute':65,'floorMultiplier':10},'wind10RmseMs':{'absolute':3.5,'floorMultiplier':8},'totalColumnWaterRmseKgM2':{'absolute':3.0,'floorMultiplier':8},'precipBiasMmHrAbs':{'absolute':1.0,'floorMultiplier':10},'cloudTotalBiasAbs':{'absolute':0.12,'floorMultiplier':10},'cycloneTrackMeanErrorKm':{'absolute':220,'floorMultiplier':10}},'cases':suite_cases}
os.makedirs(os.path.join(root,'weather-validation/suites'), exist_ok=True)
with open(os.path.join(root,'weather-validation/suites/earth-accuracy-suite.json'),'w',encoding='utf8') as f:
    json.dump(suite,f,indent=2); f.write('\n')
print('generated suite')
