import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

function patchMinimatch() {
  const esmPath = path.join(rootDir, "node_modules", "minimatch", "dist", "esm", "index.js");
  const cjsPath = path.join(rootDir, "node_modules", "minimatch", "dist", "commonjs", "index.js");

  if (fs.existsSync(esmPath)) {
    const esmContent = fs.readFileSync(esmPath, "utf8");
    if (!esmContent.includes("export default minimatch;")) {
      fs.appendFileSync(esmPath, "\nexport default minimatch;\n");
    }
  }

  if (fs.existsSync(cjsPath)) {
    const cjsContent = fs.readFileSync(cjsPath, "utf8");
    if (!cjsContent.includes("exports.default = exports.minimatch;")) {
      fs.appendFileSync(cjsPath, "\nexports.default = exports.minimatch;\n");
    }
  }
}

try {
  patchMinimatch();
} catch {
  // Gracefully ignore if minimatch is not installed yet
}
