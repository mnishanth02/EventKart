#!/usr/bin/env node

/**
 * SessionStart hook script — injects implementation progress tracking rules
 * and current progress.md state into the agent's context.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");

const progressFile = resolve(repoRoot, "progress.md");

const rules = `## Implementation Progress Tracking Rules

You MUST follow these rules when implementing features from the docs/ folder:

### When to Update progress.md (repo root)
- When you implement work from any file in docs/impl-plan/
- When you implement a module or phase from docs/v1-implementation-plan.md
- Do NOT add entries for small discussions, minor fixes, or exploratory work
- Only track significant implementation work (new features, infrastructure, refactoring from plans)

### When to Update docs/v1-implementation-plan.md
- Update the "Current State" table when a component status changes (e.g., Not started → In progress → Complete)
- Mark individual feature IDs (I-x.x.x) as complete when their implementation is done

### Sync Rules — All Three Documents Must Stay Consistent
- progress.md tracks WHAT is being worked on and WHAT is done
- docs/v1-implementation-plan.md "Current State" reflects actual completion status
- docs/impl-plan/*.md task tables have completion markers (✅) for finished tasks with completion dates

### Archiving Completed Plans
- When ALL tasks in a docs/impl-plan/ file are complete, move it to docs/archived/
- Update progress.md to reflect the new archived location
- Update any cross-references in other documents`;

let currentProgress = "";
if (existsSync(progressFile)) {
	currentProgress = readFileSync(progressFile, "utf8");
}

const systemMessage = currentProgress
	? `${rules}\n\n## Current Progress State\n\n${currentProgress}`
	: `${rules}\n\n## Current Progress State\n\nprogress.md does not exist yet at the repo root. Create it when you start implementing features. Use the format documented in the existing progress.md template.`;

const output = JSON.stringify({
	hookSpecificOutput: {
		hookEventName: "SessionStart",
		additionalContext: systemMessage,
	},
});
process.stdout.write(output);
