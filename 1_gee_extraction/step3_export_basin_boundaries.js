// Basin assets (CA/AR)
var WS_CA = ee.FeatureCollection("projects/lai0121/assets/WS_CABR")
  .map(function(f){ return f.set('ws','CA'); });

var WS_AR = ee.FeatureCollection("projects/lai0121/assets/WS_ARWD")
  .map(function(f){ return f.set('ws','AR'); });

// --- CRS audit: export basin assets from GEE ---
Export.table.toDrive({
  collection: WS_CA,
  description: "GEE_WS_CABR_export_for_CRS_audit",
  fileFormat: "SHP"
});

Export.table.toDrive({
  collection: WS_AR,
  description: "GEE_WS_ARWD_export_for_CRS_audit",
  fileFormat: "SHP"
});

print("CRS audit export tasks created. Run them in the Tasks tab.");