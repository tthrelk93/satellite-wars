# Climatology Assets

Drop low-resolution equirectangular climatology images in this folder to override the analytic fallback.

Expected files are listed in `manifest.json`. Each image should match the manifest `size` and use 8-bit channels.

- `sst_00.png` ... `sst_11.png`: monthly sea surface temperature (grayscale)
- `ice_00.png` ... `ice_11.png`: monthly sea ice fraction (grayscale, optional)
- `topo.png`: topography (grayscale, optional)
- `albedo.png`: surface albedo (grayscale, optional)
- `soilcap.png`: soil capacity (grayscale, optional)

Optional nudging fields:
- `slp_00.png` ... `slp_11.png`: monthly mean sea-level pressure (grayscale)
- `wind_00.png` ... `wind_11.png`: monthly mean wind (RG channels, optional)
- `wind500_00.png` ... `wind500_11.png`: monthly mean wind at 500 hPa (RG channels, optional)
- `wind250_00.png` ... `wind250_11.png`: monthly mean wind at 250 hPa (RG channels, optional)
- `t2m_00.png` ... `t2m_11.png`: monthly mean 2m temperature (grayscale, K, optional)

If any referenced file is missing or fails to load, the sim falls back to an analytic climatology so development can continue without real datasets.
