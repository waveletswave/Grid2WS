# Grid2WS

**Spatial and Temporal Validation of Gridded Precipitation Products**

This repository contains the workflow to extract gridded climate data and calculate precise basin averages. The method extracts the exact pixel geometries from Google Earth Engine and calculates geometric intersections with local watershed boundaries. This preserves the conservation of mass and avoids the spatial artifacts commonly introduced by point extraction or nearest neighbor resampling.

## Motivation

Comparing coarse climate data to small local watersheds requires rigorous spatial scaling. Common methods extract pixel values at a single point or resample grids. These approaches distort the actual volume of water entering a specific basin.

This workflow solves that problem by keeping the native grid geometry intact. We extract the exact polygon footprints of pixels from DAYMET, PRISM, and gridMET. We then project these polygons and the watershed boundaries into a local metric coordinate system to calculate exact intersection areas.

## Workflow Overview

The pipeline is split into two phases.

**1. Earth Engine Extraction**
The JavaScript files in the `1_gee_extraction` folder interact with the Google Earth Engine API. The code identifies the native projection and scale for each climate product. It uses the `reduceToVectors` function to generate exact polygon footprints for all pixels overlapping the target watersheds. It then exports these polygon shapefiles along with a CSV of the daily precipitation values for each pixel.

**2. Local Python Processing**
The Jupyter Notebook `Grid2WS_Spatial_Temporal_Workflow.ipynb` handles the local spatial math and visualization.

Key steps in the notebook include:

* **Reprojection:** All spatial data is converted to NAD83 / UTM Zone 17N to ensure accurate planar area calculations in square meters.
* **Geometric Overlay:** The code calculates the exact physical intersection between the native grid polygons and the watershed polygons.
* **Area Weighting:** It assigns a weight to each pixel based on the fraction of the watershed it covers.
* **Aggregation:** The daily precipitation value for each pixel is multiplied by its weight. The sum of these weighted values provides the true daily precipitation average for the basin.

## Repository Structure

* `1_gee_extraction/`
  Code to extract native grid footprints and daily pixel values from Earth Engine.
* `2_local_processing/`
  The main Jupyter Notebook for geometric intersection, timeseries aggregation, and plotting.
* `data/`
  Directory for downloaded shapefiles and CSVs. This folder is ignored by git to prevent uploading large datasets.
* `figures/`
  Output directory for spatial maps and timeseries validation plots.

## Data Requirements

Users must provide their own spatial data. You need the watershed boundary shapefiles and the exported pixel footprint shapefiles from Earth Engine. Place these files in the appropriate local directories and update the file paths in the Jupyter Notebook to run the workflow.
