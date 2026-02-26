// Print native projection info (authoritative)
var DAYMET = ee.ImageCollection("NASA/ORNL/DAYMET_V4").first().select("prcp");
var PRISM  = ee.ImageCollection("OREGONSTATE/PRISM/AN81d").first().select("ppt");
var GRID   = ee.ImageCollection("IDAHO_EPSCOR/GRIDMET").first().select("pr");

function printProj(img, name){
  var p = img.projection();
  print(name + " proj (object):", p);
  print(name + " CRS:", p.crs());
  print(name + " nominalScale (m):", p.nominalScale());
  print(name + " transform:", p.transform());
}

printProj(DAYMET, "DAYMET");
printProj(PRISM,  "PRISM");
printProj(GRID,   "gridMET");