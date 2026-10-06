// Runs before `firebase deploy` (see "predeploy" in firebase.json). The Firebase web config is baked into
// the build, so a build made without it, with the wrong project, or with the emulators switched on would
// publish a site that cannot sign anyone in.
import { readFileSync } from "node:fs";
import nextEnv from "@next/env";

// Reads .env.local the way `next build` does, without overriding variables already set in the shell.
nextEnv.loadEnvConfig(process.cwd());

const env = process.env;
const deployProject = env.GCLOUD_PROJECT || JSON.parse(readFileSync(".firebaserc", "utf8")).projects.default;
const problems = [];

for (const name of ["API_KEY", "AUTH_DOMAIN", "PROJECT_ID", "APP_ID"]) {
  if (!env[`NEXT_PUBLIC_FIREBASE_${name}`]) problems.push(`NEXT_PUBLIC_FIREBASE_${name} is not set.`);
}
if (env.NEXT_PUBLIC_FIREBASE_PROJECT_ID && env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== deployProject) {
  problems.push(
    `NEXT_PUBLIC_FIREBASE_PROJECT_ID is "${env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}" but this deploys to "${deployProject}".`
  );
}
if (env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS === "true") {
  problems.push("NEXT_PUBLIC_FIREBASE_USE_EMULATORS is true, so the site would look for emulators on the visitor's own machine.");
}

if (problems.length > 0) {
  console.error("Not deploying:");
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error("Fix them in .env.local (see .env.local.example) and run the deploy again.");
  process.exit(1);
}
