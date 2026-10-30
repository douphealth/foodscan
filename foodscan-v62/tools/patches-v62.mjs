import { readFileSync } from 'node:fs';
const SUFFIX = JSON.parse(readFileSync(new URL('../release.json', import.meta.url), 'utf8')).suffix;
const greek = JSON.parse(readFileSync(new URL('../src/i18n-el-62.json', import.meta.url), 'utf8'));
/** Exact-match patches applied by tools/build-v62.mjs to the v61 Worker and to minified chunks. Each `find` must occur exactly once. */
export const patches = {
  worker: [
    [`async function recordFor(request, env, ctx, code) {
  try {
    const result = await productResponse(request, env, ctx, code), cache = result.headers.get("X-FoodScan-Cache") || "";
    return { status: result.status === 404 ? 404 : result.status === 200 ? 200 : 503, raw: result.ok ? (await result.json()).product : null, cache };
  } catch {
    return { status: 503, raw: null, cache: "" };
  }
}`,
    `async function recordFor(request, env, ctx, code) {
  let out;
  try {
    const result = await productResponse(request, env, ctx, code), cache = result.headers.get("X-FoodScan-Cache") || "";
    out = { status: result.status === 404 ? 404 : result.status === 200 ? 200 : 503, raw: result.ok ? (await result.json()).product : null, cache };
  } catch {
    out = { status: 503, raw: null, cache: "" };
  }
  // 62.0: when the upstream food database is busy, a shared link still opens with the bundled, dated catalogue record (never indexed).
  if (out.status === 503) {
    try {
      const local = await fs60LocalProduct(request, env, code);
      const product = local?.ok ? (await local.json())?.product : null;
      if (product) return { status: 200, raw: product, cache: "DATED-CATALOGUE" };
    } catch { /* keep the 503 */ }
  }
  return out;
}`, 'recordFor catalogue fallback'],
    ['const p = parsed(rec.raw, code), indexable = rec.status === 200 && env.INDEX_PRODUCT_PAGES !== "0" && !preview(url, env) && rec.cache !== "STALE" && indexWorthy(p).index;',
     'const p = parsed(rec.raw, code), indexable = rec.status === 200 && env.INDEX_PRODUCT_PAGES !== "0" && !preview(url, env) && rec.cache !== "STALE" && rec.cache !== "DATED-CATALOGUE" && indexWorthy(p).index;', 'dated catalogue pages are not indexable']
  ],
  chunks: [
    // 62.0: Greek for every domain message the dictionary lacked (22 of 74), so the grade explanations are Greek in the Greek interface
    { file: 'chunk-BQKWV521-{v}.js', find: '};export{e as default};', replace: ',' + Object.entries(greek).map(([k, v]) => JSON.stringify(k) + ':' + JSON.stringify(v)).join(',') + '};export{e as default};', label: 'Greek dictionary additions' }
  ],
  files: [
    // 62.0: the Fridge Challenge showed product.nutriScore (the raw source letter) for saved foods, bypassing the shared grading engine: a record
    // the report holds back, or one whose letter the engine cannot support, still got a grade there. It now asks the same engine as the report.
    { file: 'fridge-core.mjs', find: "export const STORAGE_KEY = 'foodscan.fridge.v1';", replace: "import { assessGrade } from './assets/domain-" + SUFFIX + ".mjs';\nexport const STORAGE_KEY = 'foodscan.fridge.v1';", label: 'fridge-core imports the grading engine' },
    { file: 'fridge-core.mjs', find: "const grade=!invalid && !product?.nutriScoreExcluded && /^[A-E]$/.test(String(product?.nutriScore||'')) ? product.nutriScore : null;", replace: "const verdict=assessGrade(product), grade=!invalid && !product?.nutriScoreExcluded && ['reported','estimated'].includes(verdict.status) && /^[A-E]$/.test(String(verdict.grade||'')) ? verdict.grade : null;", label: 'fridge-core grade from the shared engine' },
    { file: 'fridge-core.mjs', find: "hasWarning:invalid || (Array.isArray(product?.qualityWarnings)", replace: "hasWarning:invalid || verdict?.status==='withheld' || (Array.isArray(product?.qualityWarnings)", label: 'fridge-core warns when the engine withholds' }
  ]
};
