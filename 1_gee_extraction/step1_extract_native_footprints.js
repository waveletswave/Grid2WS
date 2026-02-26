// ================================================================
// STRICT native-grid pixel footprints (exact polygons via reduceToVectors)
// + area fractions (CA/AR) + daily per-pixel native values (2017–2018)
// Products: DAYMET V4, PRISM AN81d, gridMET
// Author: Yiyun Song
// ================================================================

// ------------------------
// 0) User settings
// ------------------------
var START = '2017-01-01';
var END   = '2019-01-01';   // end-exclusive

// Basin assets (CA/AR)
var WS_CA = ee.FeatureCollection("projects/lai0121/assets/WS_CABR")
  .map(function(f){ return f.set('ws','CA'); });

var WS_AR = ee.FeatureCollection("projects/lai0121/assets/WS_ARWD")
  .map(function(f){ return f.set('ws','AR'); });

var BASINS = WS_CA.merge(WS_AR);
var BASIN_CA = WS_CA.geometry();
var BASIN_AR = WS_AR.geometry();
var BASIN_UNION = BASINS.geometry().dissolve();

// Buffer around basins for selecting pixels (meters in native projection units if meters;
// for lat/lon grids it still works well as geometry buffer in EPSG:4326 is geodesic,
// but here we only use it to define a loose region. If you want tighter control,
// we can switch to bounds in native projection.)
var BUFFER_M = 8000;

// Exports
var OUT_FOLDER = "P_nativegrid_pixels_strict";

// Keep pixels with at least this overlap (m^2)
var MIN_AREA = 1;

// Geometry maxError (meters)
var ERR = 1;

// Equal-area projection for stable m^2 areas
var EA = ee.Projection("EPSG:5070");

// ------------------------
// 1) Products (daily)
// ------------------------
var DAYMET_IC  = ee.ImageCollection("NASA/ORNL/DAYMET_V4").filterDate(START, END).select("prcp");
var PRISM_IC   = ee.ImageCollection("OREGONSTATE/PRISM/AN81d").filterDate(START, END).select("ppt");
var GRIDMET_IC = ee.ImageCollection("IDAHO_EPSCOR/GRIDMET").filterDate(START, END).select("pr");

function getNativeInfo(ic, label){
  var img = ee.Image(ic.first());
  var proj = img.projection();
  var scale = proj.nominalScale();
  print(label + " native projection:", proj);
  print(label + " nominalScale (m):", scale);
  return {img: img, proj: proj, scale: scale};
}

var DAYMET_INFO  = getNativeInfo(DAYMET_IC,  "DAYMET");
var PRISM_INFO   = getNativeInfo(PRISM_IC,   "PRISM");
var GRIDMET_INFO = getNativeInfo(GRIDMET_IC, "GRIDMET");

// ------------------------
// 2) Strict native pixel footprints via reduceToVectors
// ------------------------
function buildPixelFootprintsStrict(nativeInfo, label){
  var proj  = nativeInfo.proj;
  var scale = nativeInfo.scale;

  // Region around basins (simple and robust)
  var region = BASIN_UNION.buffer(BUFFER_M).bounds();

  // Pixel coordinate image in this projection (bands: x, y)
  var pc = ee.Image.pixelCoordinates(proj).toInt64();

  // Unique 64-bit pixel ID: (x << 32) + y
  var idImg = pc.select('x').leftShift(32).add(pc.select('y')).rename('pid')
    .reproject({crs: proj, scale: scale})
    .clip(region);

  // Vectorize: each unique pid => one polygon = exact pixel footprint
  var vectors = idImg.reduceToVectors({
    geometry: region,
    crs: proj,
    scale: scale,
    geometryType: "polygon",
    labelProperty: "pid",
    eightConnected: false,
    bestEffort: true,
    maxPixels: 1e13,
    tileScale: 4
  });

  // Basins in equal-area projection
  var caEA = BASIN_CA.transform(EA, ERR);
  var arEA = BASIN_AR.transform(EA, ERR);

  vectors = vectors.map(function(ft){
    ft = ee.Feature(ft);

    // IMPORTANT: Avoid geometry(proj, ERR) (can trigger crs=1 bug)
    var geom = ft.geometry().transform(proj, ERR);
    var ctr  = geom.centroid(ERR);

    // Sample pixel indices at centroid
    var xy = ee.Image.pixelCoordinates(proj).sample({
      region: ctr,
      projection: proj,
      scale: scale,
      numPixels: 1,
      geometries: false
    }).first();

    var col = ee.Number(ee.Feature(xy).get('x')).floor();
    var row = ee.Number(ee.Feature(xy).get('y')).floor();

    var pixel_id = ee.String(label)
      .cat("_c").cat(col.format('%d'))
      .cat("_r").cat(row.format('%d'));

    // Area fractions (equal-area)
    var geomEA = geom.transform(EA, ERR);
    var areaPix = geomEA.area(ERR);
    var areaCA  = geomEA.intersection(caEA, ERR).area(ERR);
    var areaAR  = geomEA.intersection(arEA, ERR).area(ERR);

    var fracCA = areaCA.divide(areaPix);
    var fracAR = areaAR.divide(areaPix);

    // Center lon/lat for SI plotting
    var ll = ctr.transform("EPSG:4326", ERR).coordinates();

    return ft.set({
      "product": label,
      "pixel_id": pixel_id,
      "col": col,
      "row": row,
      "scale_m": scale,
      "area_m2": areaPix,
      "area_CA": areaCA,
      "area_AR": areaAR,
      "frac_CA": fracCA,
      "frac_AR": fracAR,
      "center_lon": ee.Number(ll.get(0)),
      "center_lat": ee.Number(ll.get(1))
    });
  });

  // Keep pixels that overlap CA or AR
  vectors = vectors.filter(ee.Filter.or(
    ee.Filter.gt("area_CA", MIN_AREA),
    ee.Filter.gt("area_AR", MIN_AREA)
  ));

  print(label + " pixels intersecting basins:", vectors.size());
  Map.addLayer(vectors.style({color:"888888", fillColor:"00000000", width:1}), {}, label + " pixels");
  return vectors;
}

var PIX_DAYMET  = buildPixelFootprintsStrict(DAYMET_INFO,  "DAYMET");
var PIX_PRISM   = buildPixelFootprintsStrict(PRISM_INFO,   "PRISM");
var PIX_GRIDMET = buildPixelFootprintsStrict(GRIDMET_INFO, "GRIDMET");

// Basins on map
Map.centerObject(BASINS, 11);
Map.addLayer(BASINS.style({color:"FF00FF", fillColor:"00000000", width:2}), {}, "Basins");

// ------------------------
// 3) Export footprint tables (geometry preserved)
// ------------------------
Export.table.toDrive({
  collection: PIX_DAYMET,
  description: "DAYMET_STRICT_nativegrid_pixel_footprints_CA_AR",
  folder: OUT_FOLDER,
  fileFormat: "SHP"
});

Export.table.toDrive({
  collection: PIX_PRISM,
  description: "PRISM_STRICT_nativegrid_pixel_footprints_CA_AR",
  folder: OUT_FOLDER,
  fileFormat: "SHP"
});

Export.table.toDrive({
  collection: PIX_GRIDMET,
  description: "GRIDMET_STRICT_nativegrid_pixel_footprints_CA_AR",
  folder: OUT_FOLDER,
  fileFormat: "SHP"
});

// ------------------------
// 4) Export daily per-pixel native values (2017–2018)
// ------------------------
function exportDailyPerPixel(ic, nativeInfo, pixels, label, outName){
  var proj  = nativeInfo.proj;
  var scale = nativeInfo.scale;
  var band  = ee.Image(ic.first()).bandNames().get(0);

  // pixel centers
  var centers = pixels.map(function(f){
    var geom = ee.Feature(f).geometry().transform(proj, ERR);
    var c = geom.centroid(ERR);
    return ee.Feature(c).copyProperties(f, [
      "pixel_id","product","col","row","frac_CA","frac_AR","area_m2","area_CA","area_AR","scale_m"
    ]);
  });

  var perDay = ic.map(function(img){
    var date = img.date().format("yyyy-MM-dd");

    var samp = img.sampleRegions({
      collection: centers,
      properties: ["pixel_id","product","col","row","frac_CA","frac_AR","area_m2","area_CA","area_AR","scale_m"],
      scale: scale,
      projection: proj,
      geometries: false,
      tileScale: 4
    }).map(function(f){
      return ee.Feature(f).set({
        "Date": date,
        "P_mm": ee.Feature(f).get(band)
      });
    });

    return samp;
  }).flatten();

  perDay = perDay.filter(ee.Filter.notNull(["P_mm","pixel_id","Date"]));
  print(label + " daily rows:", perDay.size());

  Export.table.toDrive({
    collection: perDay,
    description: outName,
    folder: OUT_FOLDER,
    fileFormat: "CSV",
    selectors: ["Date","product","pixel_id","col","row","P_mm","scale_m","area_m2","area_CA","area_AR","frac_CA","frac_AR"]
  });
}

exportDailyPerPixel(DAYMET_IC,  DAYMET_INFO,  PIX_DAYMET,  "DAYMET",  "DAYMET_STRICT_nativegrid_pixels_daily_2017_2018");
exportDailyPerPixel(PRISM_IC,   PRISM_INFO,   PIX_PRISM,   "PRISM",   "PRISM_STRICT_nativegrid_pixels_daily_2017_2018");
exportDailyPerPixel(GRIDMET_IC, GRIDMET_INFO, PIX_GRIDMET, "GRIDMET", "GRIDMET_STRICT_nativegrid_pixels_daily_2017_2018");

print("All strict-native-grid export tasks created. Run them in the Tasks tab.");