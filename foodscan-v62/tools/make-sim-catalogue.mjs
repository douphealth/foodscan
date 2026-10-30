#!/usr/bin/env node
/** Rehearsal of a refresh: turns the shipped records back into an Open Food Facts-shaped CSV and runs the real builder on it.
 * node tools/make-sim-catalogue.mjs <out dir> [exported-at]   (used to check that a catalogue the builder makes drives the app like the shipped one) */
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { catalogue } from '../tests/helpers.mjs';
import { buildCatalogue } from './build-catalogue.mjs';
const LISTS = ['categories_tags', 'labels_tags', 'countries_tags', 'allergens_tags', 'traces_tags', 'additives_tags', 'ingredients_analysis_tags', 'data_quality_errors_tags'];
const TEXTS = ['product_name', 'brands', 'generic_name', 'quantity', 'serving_size', 'ingredients_text', 'pnns_groups_1', 'pnns_groups_2', 'stores', 'image_front_url', 'image_front_small_url', 'nutriscore_grade'];
const NUMS = ['last_modified_t', 'serving_quantity', 'product_quantity', 'nutriscore_score', 'nova_group', 'additives_n'];
const { records } = catalogue(), clean = v => String(v).replace(/[\t\r\n]+/g, ' ');
const nutrients = [...new Set(records.flatMap(r => Object.keys(r.raw.nutriments)))].sort(), header = ['code', ...TEXTS, ...LISTS, ...NUMS, ...nutrients];
const rows = [header.join('\t'), ...records.map(({ raw }) => header.map(h => h === 'code' ? raw.code : LISTS.includes(h) ? clean((raw[h] || []).join(',')) : TEXTS.includes(h) ? clean(raw[h] ?? '') : NUMS.includes(h) ? (raw[h] ?? '') : (raw.nutriments[h] ?? '')).join('\t'))];
const csv = join(mkdtempSync(join(tmpdir(), 'fs-sim-')), 'export.csv'); writeFileSync(csv, rows.join('\n') + '\n');
console.log(JSON.stringify(await buildCatalogue({ csv, country: 'greece', out: resolve(process.argv[2]), exportedAt: process.argv[3] || '2026-10-29T17:14:36.024Z', version: 'sim' })));
