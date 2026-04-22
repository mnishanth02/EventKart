#!/usr/bin/env node

/**
 * Stop hook script — checks docs/impl-plan/ for fully completed implementation
 * plans that should be moved to docs/archived/.
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");

const implPlanDir = resolve(repoRoot, "docs", "impl-plan");
const progressFile = resolve(repoRoot, "progress.md");

if (!existsSync(implPlanDir)) {
	process.stdout.write(JSON.stringify({}));
	process.exit(0);
}

const files = readdirSync(implPlanDir).filter((f) => f.endsWith(".md"));

if (files.length === 0) {
	process.stdout.write(JSON.stringify({}));
	process.exit(0);
}

const completedPlans = [];
const inProgressPlans = [];

for (const file of files) {
	const content = readFileSync(resolve(implPlanDir, file), "utf8");

	// Strategy 1: Check for TASK-xxx rows with Completed column
	const taskLines = content
		.split("\n")
		.filter((line) => /^\|\s*TASK-/i.test(line));

	if (taskLines.length > 0) {
		// Split each task row by | and check the "Completed" column (3rd data column)
		const allCompleted = taskLines.every((line) => {
			const cells = line
				.split("|")
				.map((c) => c.trim())
				.filter(Boolean);
			// cells: [TASK-ID, Description, Completed, Date]
			const completedCell = cells[2] || "";
			return /✅|✓|✔|\[x\]|complete|done/i.test(completedCell);
		});

		const noneCompleted = taskLines.every((line) => {
			const cells = line
				.split("|")
				.map((c) => c.trim())
				.filter(Boolean);
			const completedCell = cells[2] || "";
			return completedCell.trim() === "";
		});

		if (allCompleted) {
			completedPlans.push(file);
		} else if (!noneCompleted) {
			inProgressPlans.push(file);
		}
		continue;
	}

	// Strategy 2: Check for explicit status markers in frontmatter or body
	if (/status:\s*complete/i.test(content)) {
		completedPlans.push(file);
	}
}

const messages = [];

if (completedPlans.length > 0) {
	messages.push(
		`⚠️ COMPLETED PLANS — These implementation plans in docs/impl-plan/ have ALL tasks completed and should be archived:\n${completedPlans.map((f) => `  - docs/impl-plan/${f} → move to docs/archived/${f}`).join("\n")}\n\nAction required: Move these files to docs/archived/ and update progress.md.`,
	);
}

// Also check if progress.md exists and is up to date
if (!existsSync(progressFile) && files.length > 0) {
	messages.push(
		"⚠️ progress.md does not exist at the repo root but there are active implementation plans. Create progress.md to track implementation progress.",
	);
}

if (messages.length > 0) {
	process.stdout.write(JSON.stringify({ systemMessage: messages.join("\n\n") }));
} else {
	process.stdout.write(JSON.stringify({}));
}
