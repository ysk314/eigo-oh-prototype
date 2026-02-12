import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const distDir = resolve(process.cwd(), 'dist');
const indexHtmlPath = resolve(distDir, 'index.html');

const budgets = {
    jsRawKb: Number(process.env.PERF_BUDGET_JS_RAW_KB ?? 2300),
    jsGzipKb: Number(process.env.PERF_BUDGET_JS_GZIP_KB ?? 420),
    cssRawKb: Number(process.env.PERF_BUDGET_CSS_RAW_KB ?? 90),
    cssGzipKb: Number(process.env.PERF_BUDGET_CSS_GZIP_KB ?? 18),
};

function toKb(bytes) {
    return Number((bytes / 1024).toFixed(2));
}

function readAssetsFromIndexHtml(html) {
    const matches = html.match(/assets\/[^"' )>]+\.(?:js|css)/g) ?? [];
    return [...new Set(matches)];
}

function getAssetStats(assetRelativePath) {
    const absolutePath = resolve(distDir, assetRelativePath);
    const content = readFileSync(absolutePath);
    const rawBytes = statSync(absolutePath).size;
    const gzipBytes = gzipSync(content).length;
    return { rawBytes, gzipBytes };
}

function sumByType(assets) {
    return assets.reduce(
        (acc, asset) => {
            const stats = getAssetStats(asset);
            if (asset.endsWith('.js')) {
                acc.jsRaw += stats.rawBytes;
                acc.jsGzip += stats.gzipBytes;
            } else if (asset.endsWith('.css')) {
                acc.cssRaw += stats.rawBytes;
                acc.cssGzip += stats.gzipBytes;
            }
            return acc;
        },
        { jsRaw: 0, jsGzip: 0, cssRaw: 0, cssGzip: 0 }
    );
}

function assertWithinBudget(label, actual, budget, failures) {
    if (actual > budget) {
        failures.push(`${label}: ${actual.toFixed(2)}KB > ${budget.toFixed(2)}KB`);
    }
}

const indexHtml = readFileSync(indexHtmlPath, 'utf-8');
const assets = readAssetsFromIndexHtml(indexHtml);

if (assets.length === 0) {
    console.error('Performance budget check failed: no assets found in dist/index.html');
    process.exit(1);
}

const totals = sumByType(assets);
const jsRawKb = toKb(totals.jsRaw);
const jsGzipKb = toKb(totals.jsGzip);
const cssRawKb = toKb(totals.cssRaw);
const cssGzipKb = toKb(totals.cssGzip);

const failures = [];
assertWithinBudget('Initial JS (raw)', jsRawKb, budgets.jsRawKb, failures);
assertWithinBudget('Initial JS (gzip)', jsGzipKb, budgets.jsGzipKb, failures);
assertWithinBudget('Initial CSS (raw)', cssRawKb, budgets.cssRawKb, failures);
assertWithinBudget('Initial CSS (gzip)', cssGzipKb, budgets.cssGzipKb, failures);

console.log('Performance budget report');
console.log(`- Initial JS (raw):  ${jsRawKb.toFixed(2)}KB / budget ${budgets.jsRawKb.toFixed(2)}KB`);
console.log(`- Initial JS (gzip): ${jsGzipKb.toFixed(2)}KB / budget ${budgets.jsGzipKb.toFixed(2)}KB`);
console.log(`- Initial CSS (raw): ${cssRawKb.toFixed(2)}KB / budget ${budgets.cssRawKb.toFixed(2)}KB`);
console.log(`- Initial CSS (gzip): ${cssGzipKb.toFixed(2)}KB / budget ${budgets.cssGzipKb.toFixed(2)}KB`);

if (failures.length > 0) {
    console.error('Performance budget check failed:');
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
}

console.log('Performance budget check passed.');
