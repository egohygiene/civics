#!/usr/bin/env node

import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, "..");
const SCHEMA_DIRECTORY = path.join(REPOSITORY_ROOT, "schemas");

async function parseJson(filePath) {
  const source = await readFile(filePath, "utf8");
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`${path.relative(REPOSITORY_ROOT, filePath)} is not valid JSON: ${error.message}`);
  }
}

function collectReferences(value, references = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectReferences(item, references));
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (key === "$ref" && typeof child === "string") references.push(child);
      else collectReferences(child, references);
    }
  }
  return references;
}

async function main() {
  const schemaNames = (await readdir(SCHEMA_DIRECTORY))
    .filter((name) => name.endsWith(".json"))
    .sort();
  if (!schemaNames.length) throw new Error("No JSON schemas were found.");

  for (const schemaName of schemaNames) {
    const schemaPath = path.join(SCHEMA_DIRECTORY, schemaName);
    const schema = await parseJson(schemaPath);
    if (schema.$schema !== "https://json-schema.org/draft/2020-12/schema") {
      throw new Error(`${schemaName} must declare JSON Schema draft 2020-12.`);
    }
    for (const reference of collectReferences(schema)) {
      if (reference.startsWith("#") || reference.startsWith("https://")) continue;
      const referencePath = path.resolve(SCHEMA_DIRECTORY, reference.split("#")[0]);
      const relativePath = path.relative(SCHEMA_DIRECTORY, referencePath);
      if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
        throw new Error(`${schemaName} contains a reference outside schemas/: ${reference}`);
      }
      await access(referencePath);
    }
  }

  const counties = await parseJson(path.join(REPOSITORY_ROOT, "src", "data", "ma-counties.json"));
  if (counties.type !== "FeatureCollection" || counties.features?.length !== 14) {
    throw new Error("Massachusetts geometry must contain exactly 14 county features.");
  }

  const cname = (await readFile(path.join(REPOSITORY_ROOT, "public", "CNAME"), "utf8")).trim();
  if (cname !== "civics.egohygiene.io") {
    throw new Error("public/CNAME must contain civics.egohygiene.io.");
  }

  process.stdout.write(`Checked ${schemaNames.length} schemas, map geometry, and Pages metadata.\n`);
}

main().catch((error) => {
  process.stderr.write(`Repository check failed: ${error.message}\n`);
  process.exitCode = 1;
});
