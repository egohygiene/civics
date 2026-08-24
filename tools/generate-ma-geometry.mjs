import { readFile, writeFile } from "node:fs/promises";
import { feature } from "topojson-client";

const topology = JSON.parse(await readFile(new URL("../node_modules/us-atlas/counties-10m.json", import.meta.url), "utf8"));
const counties = feature(topology, topology.objects.counties).features.filter((county) =>
  String(county.id).padStart(5, "0").startsWith("25"),
);

await writeFile(
  new URL("../src/data/ma-counties.json", import.meta.url),
  `${JSON.stringify({
    type: "FeatureCollection",
    metadata: {
      source: "U.S. Census Bureau cartographic boundaries via us-atlas@3.0.1",
      generated: true,
    },
    features: counties,
  })}\n`,
  "utf8",
);
