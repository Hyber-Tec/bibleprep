#!/usr/bin/env node
/**
 * Add shadcn/ui components, then switch their icons to react-icons.
 *
 *   npm run ui:add -- sheet dialog
 *
 * shadcn generates lucide-react imports; this app uses react-icons only, whose `lu`
 * set contains the same Lucide icons (CheckIcon -> LuCheck). Run without arguments
 * to just convert existing components. If TypeScript then reports a missing icon,
 * its react-icons name differs: add it to ALIASES.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const UI = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src", "components", "ui");

// lucide-react names that are aliases of an icon with a different canonical name
const ALIASES = { Loader2Icon: "LuLoaderCircle" };

const args = process.argv.slice(2);
if (args.length) execFileSync("npx", ["shadcn", "add", ...args], { stdio: "inherit" });

for (const file of readdirSync(UI).filter((f) => f.endsWith(".tsx"))) {
  const path = resolve(UI, file);
  const source = readFileSync(path, "utf8");
  const match = source.match(/import \{([^}]+)\} from "lucide-react"/);
  if (!match) continue;

  const names = match[1].split(",").map((n) => n.trim()).filter(Boolean);
  const renames = names.map((n) => [n, ALIASES[n] ?? `Lu${n.replace(/Icon$/, "")}`]);
  let converted = source.replace(
    match[0],
    `import { ${renames.map(([, to]) => to).join(", ")} } from "react-icons/lu"`
  );
  for (const [from, to] of renames) converted = converted.replace(new RegExp(`\\b${from}\\b`, "g"), to);
  writeFileSync(path, converted);
  console.log(`icons -> react-icons/lu: ${file}`);
}
