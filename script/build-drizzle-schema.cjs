const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const rootDir = process.cwd();
const inputFile = path.join(rootDir, "shared", "schema.ts");
const outDir = path.join(rootDir, ".drizzle");
const outFile = path.join(outDir, "schema.cjs");

if (!fs.existsSync(inputFile)) {
  console.error(`Missing schema file: ${inputFile}`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

const source = fs.readFileSync(inputFile, "utf8");
const result = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
    esModuleInterop: true,
    sourceMap: false,
    inlineSourceMap: false,
  },
  fileName: inputFile,
});

if (result.diagnostics && result.diagnostics.length) {
  // Print diagnostics but still emit, matching tsc's general behavior.
  const formatted = ts.formatDiagnosticsWithColorAndContext(
    result.diagnostics,
    {
      getCanonicalFileName: (f) => f,
      getCurrentDirectory: () => rootDir,
      getNewLine: () => "\n",
    },
  );
  console.error(formatted);
}

fs.writeFileSync(outFile, result.outputText, "utf8");
console.log(`Wrote ${path.relative(rootDir, outFile)}`);

