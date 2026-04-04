# Weather validation summary: fixture-synoptic

- Init time: 2026-01-15T00:00:00Z
- Leads (hours): 0, 6, 12
- Output JSON: weather-validation/output/fixture-synoptic/summary.json

## Aggregate metrics

- SLP RMSE mean: 0.915 hPa
- 500 hPa height RMSE mean: 29.409 m
- 10 m wind RMSE mean: 1.942 m/s
- Total column water RMSE mean: 1.287 kg/m²
- Precip bias mean: 0.504 mm/hr
- Total cloud bias mean: -0.0060

## Cyclone track error

- Mean error: 69.84 km
- Max error: 92.69 km

## Lead +0h

- SLP RMSE: 0.925 hPa
- 500 hPa height RMSE: 29.409 m
- 10 m wind RMSE: 1.942 m/s
- Total column water RMSE: 1.287 kg/m²
- Precip bias: 0.504 mm/hr
- Cloud bias (low/high/total): 0.0062 / -0.0162 / -0.0068

| Threshold (mm/hr) | Hits | Misses | False alarms | Frequency bias | POD | FAR | CSI |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0.1 | 12 | 0 | 0 | 1.000 | 1.000 | 0.000 | 1.000 |
| 1.0 | 10 | 0 | 0 | 1.000 | 1.000 | 0.000 | 1.000 |
| 5.0 | 0 | 0 | 0 | n/a | n/a | n/a | n/a |

## Lead +6h

- SLP RMSE: 0.915 hPa
- 500 hPa height RMSE: 29.409 m
- 10 m wind RMSE: 1.942 m/s
- Total column water RMSE: 1.287 kg/m²
- Precip bias: 0.504 mm/hr
- Cloud bias (low/high/total): 0.0062 / -0.0162 / -0.0060

| Threshold (mm/hr) | Hits | Misses | False alarms | Frequency bias | POD | FAR | CSI |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0.1 | 12 | 0 | 0 | 1.000 | 1.000 | 0.000 | 1.000 |
| 1.0 | 10 | 2 | 0 | 0.833 | 0.833 | 0.000 | 0.833 |
| 5.0 | 0 | 0 | 0 | n/a | n/a | n/a | n/a |

## Lead +12h

- SLP RMSE: 0.906 hPa
- 500 hPa height RMSE: 29.409 m
- 10 m wind RMSE: 1.942 m/s
- Total column water RMSE: 1.287 kg/m²
- Precip bias: 0.504 mm/hr
- Cloud bias (low/high/total): 0.0062 / -0.0162 / -0.0052

| Threshold (mm/hr) | Hits | Misses | False alarms | Frequency bias | POD | FAR | CSI |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0.1 | 12 | 0 | 0 | 1.000 | 1.000 | 0.000 | 1.000 |
| 1.0 | 12 | 0 | 0 | 1.000 | 1.000 | 0.000 | 1.000 |
| 5.0 | 0 | 0 | 0 | n/a | n/a | n/a | n/a |

