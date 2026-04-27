const hookInput = await readStdin();
const parsedInput = parseHookInput(hookInput);

if (parsedInput) {
	const toolName = String(parsedInput.tool_name ?? parsedInput.toolName ?? "");
	const toolArgs =
		parsedInput.tool_input ?? parsedInput.toolInput ?? parsedInput.toolArgs ?? {};
	const decision = evaluateToolUse(toolName, toolArgs);

	if (decision) {
		process.stdout.write(
			JSON.stringify({
				hookSpecificOutput: {
					hookEventName: "PreToolUse",
					permissionDecision: "deny",
					permissionDecisionReason: decision,
				},
			}),
		);
		process.exit(0);
	}
}

process.stdout.write(JSON.stringify({}));

function readStdin() {
	return new Promise((resolve) => {
		let data = "";

		process.stdin.setEncoding("utf8");
		process.stdin.on("data", (chunk) => {
			data += chunk;
		});
		process.stdin.on("end", () => {
			resolve(data);
		});
		process.stdin.resume();
	});
}

function parseHookInput(input) {
	if (!input.trim()) {
		return undefined;
	}

	try {
		const parsed = JSON.parse(input);

		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return undefined;
		}

		return parsed;
	} catch {
		return undefined;
	}
}

function evaluateToolUse(toolName, toolArgs) {
	const allArgText = collectStringValues(toolArgs).join("\n");

	if (isPatchTool(toolName)) {
		const patchDecision = evaluatePatchText(allArgText);

		if (patchDecision) {
			return patchDecision;
		}
	}

	const commandTexts = extractCommandTexts(toolName, toolArgs, allArgText);

	for (const commandText of commandTexts) {
		const commandDecision = evaluateCommandText(commandText, allArgText);

		if (commandDecision) {
			return commandDecision;
		}
	}

	return undefined;
}

function evaluatePatchText(patchText) {
	if (/(?:^|\n)\*\*\* Delete File: .*(?:^|[\\/])\.env[^\s]*/i.test(patchText)) {
		return "Policy denied deleting .env* files.";
	}

	if (
		/(?:^|\n)\*\*\* Delete File: .*packages[\\/]db[\\/]drizzle(?:[\\/]|$)/i.test(
			patchText,
		)
	) {
		return "Policy denied deleting packages/db/drizzle migration history.";
	}

	return undefined;
}

function extractCommandTexts(toolName, toolArgs, allArgText) {
	const commandTexts = [];
	const shellTool = isShellTool(toolName);

	if (!shellTool && !hasExplicitCommandField(toolArgs)) {
		return commandTexts;
	}

	collectCommandFields(toolArgs, commandTexts, "", shellTool);

	if (commandTexts.length === 0 && shellTool) {
		commandTexts.push(allArgText);
	}

	return [...new Set(commandTexts.filter((text) => text.trim().length > 0))];
}

function hasExplicitCommandField(value) {
	if (Array.isArray(value)) {
		return value.some((item) => hasExplicitCommandField(item));
	}

	if (!value || typeof value !== "object") {
		return false;
	}

	return Object.keys(value).some(
		(key) =>
			/^(bash|cmd|command|powershell|script|shell)$/i.test(key) ||
			hasExplicitCommandField(value[key]),
	);
}

function collectCommandFields(
	value,
	commandTexts,
	key = "",
	allowInput = false,
) {
	if (typeof value === "string") {
		if (isCommandFieldName(key, allowInput)) {
			commandTexts.push(value);
		}

		return;
	}

	if (Array.isArray(value)) {
		for (const item of value) {
			collectCommandFields(item, commandTexts, key, allowInput);
		}

		return;
	}

	if (!value || typeof value !== "object") {
		return;
	}

	for (const childKey of Object.keys(value).sort()) {
		collectCommandFields(value[childKey], commandTexts, childKey, allowInput);
	}
}

function isCommandFieldName(key, allowInput) {
	return (
		/^(bash|cmd|command|powershell|script|shell)$/i.test(key) ||
		(allowInput && /^input$/i.test(key))
	);
}

function isShellTool(toolName) {
	return /(?:bash|command|exec|powershell|shell|terminal)/i.test(toolName);
}

function isPatchTool(toolName) {
	return /(?:apply_patch|edit|write)/i.test(toolName);
}

function collectStringValues(value, strings = []) {
	if (typeof value === "string") {
		strings.push(value);
		return strings;
	}

	if (Array.isArray(value)) {
		for (const item of value) {
			collectStringValues(item, strings);
		}

		return strings;
	}

	if (!value || typeof value !== "object") {
		return strings;
	}

	for (const key of Object.keys(value).sort()) {
		collectStringValues(value[key], strings);
	}

	return strings;
}

function evaluateCommandText(commandText, allArgText) {
	for (const segment of splitCommandSegments(commandText)) {
		const tokens = tokenize(segment);

		for (const invocation of expandInvocations(tokens)) {
			const decision = evaluateInvocation(invocation, allArgText);

			if (decision) {
				return decision;
			}
		}
	}

	return undefined;
}

function evaluateInvocation(tokens, allArgText) {
	if (tokens.length === 0) {
		return undefined;
	}

	if (isNpmOrYarnCommand(tokens)) {
		return "Policy denied npm/yarn commands in this pnpm repository.";
	}

	if (isGitResetHard(tokens)) {
		return "Policy denied git reset --hard.";
	}

	if (isGitForcePush(tokens)) {
		return "Policy denied force push.";
	}

	if (isProtectedDelete(tokens)) {
		return "Policy denied deleting protected repository files.";
	}

	if (isBroadDestructiveDelete(tokens)) {
		return "Policy denied broad destructive delete on the repository root.";
	}

	if (isProductionDeploy(tokens, allArgText)) {
		return "Policy denied production deploy command without explicit deployment request.";
	}

	if (isRealPaymentCaptureOrRefund(tokens, allArgText)) {
		return "Policy denied real payment capture/refund command.";
	}

	return undefined;
}

function splitCommandSegments(commandText) {
	const segments = [];
	let current = "";
	let quote = "";

	for (let index = 0; index < commandText.length; index += 1) {
		const char = commandText[index];
		const next = commandText[index + 1];

		if (quote) {
			current += char;

			if (char === quote) {
				quote = "";
			}

			continue;
		}

		if (char === '"' || char === "'") {
			quote = char;
			current += char;
			continue;
		}

		if (
			char === "\n" ||
			char === ";" ||
			(char === "&" && next === "&") ||
			(char === "|" && next === "|")
		) {
			pushSegment(segments, current);
			current = "";

			if ((char === "&" && next === "&") || (char === "|" && next === "|")) {
				index += 1;
			}

			continue;
		}

		current += char;
	}

	pushSegment(segments, current);
	return segments;
}

function pushSegment(segments, segment) {
	const trimmed = segment.trim();

	if (trimmed) {
		segments.push(trimmed);
	}
}

function tokenize(segment) {
	const tokens = [];
	let current = "";
	let quote = "";

	for (let index = 0; index < segment.length; index += 1) {
		const char = segment[index];

		if (quote) {
			if (char === quote) {
				quote = "";
			} else {
				current += char;
			}

			continue;
		}

		if (char === '"' || char === "'") {
			quote = char;
			continue;
		}

		if (/\s/.test(char)) {
			pushToken(tokens, current);
			current = "";
			continue;
		}

		current += char;
	}

	pushToken(tokens, current);
	return tokens;
}

function pushToken(tokens, token) {
	const cleaned = token.trim();

	if (cleaned) {
		tokens.push(cleaned);
	}
}

function expandInvocations(tokens) {
	const stripped = stripShellDecorators(tokens);
	const invocations = stripped.length > 0 ? [stripped] : [];
	const executable = commandName(stripped[0] ?? "");

	if (["bash", "cmd", "pwsh", "powershell", "sh"].includes(executable)) {
		const nestedCommandIndex = findNestedCommandIndex(stripped);

		if (nestedCommandIndex >= 0) {
			const nestedTokens = stripped.slice(nestedCommandIndex + 1);

			if (nestedTokens.length > 0) {
				invocations.push(stripShellDecorators(nestedTokens));
			}
		}
	}

	if (executable === "corepack" && stripped.length > 1) {
		invocations.push(stripShellDecorators(stripped.slice(1)));
	}

	if (executable === "pnpm") {
		const execIndex = stripped.findIndex((token) =>
			["dlx", "exec"].includes(normalizeToken(token)),
		);

		if (execIndex >= 0 && stripped.length > execIndex + 1) {
			invocations.push(stripShellDecorators(stripped.slice(execIndex + 1)));
		}
	}

	return invocations.filter((invocation) => invocation.length > 0);
}

function stripShellDecorators(tokens) {
	let index = 0;

	while (index < tokens.length) {
		const executable = commandName(tokens[index]);

		if (["command", "sudo"].includes(executable)) {
			index += 1;
			continue;
		}

		if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[index])) {
			index += 1;
			continue;
		}

		if (executable === "env") {
			index += 1;

			while (
				index < tokens.length &&
				/^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[index])
			) {
				index += 1;
			}

			continue;
		}

		break;
	}

	return tokens.slice(index);
}

function findNestedCommandIndex(tokens) {
	const executable = commandName(tokens[0] ?? "");

	if (["bash", "pwsh", "powershell", "sh"].includes(executable)) {
		return tokens.findIndex(
			(token, index) =>
				index > 0 && ["-c", "-command"].includes(normalizeToken(token)),
		);
	}

	if (executable === "cmd") {
		return tokens.findIndex(
			(token, index) =>
				index > 0 && ["/c", "-c"].includes(normalizeToken(token)),
		);
	}

	return -1;
}

function isNpmOrYarnCommand(tokens) {
	return ["npm", "yarn"].includes(commandName(tokens[0] ?? ""));
}

function isGitResetHard(tokens) {
	if (commandName(tokens[0] ?? "") !== "git") {
		return false;
	}

	const resetIndex = tokens.findIndex(
		(token) => normalizeToken(token) === "reset",
	);

	return (
		resetIndex > 0 &&
		tokens
			.slice(resetIndex + 1)
			.some((token) => normalizeToken(token) === "--hard")
	);
}

function isGitForcePush(tokens) {
	if (commandName(tokens[0] ?? "") !== "git") {
		return false;
	}

	const pushIndex = tokens.findIndex(
		(token) => normalizeToken(token) === "push",
	);

	if (pushIndex <= 0) {
		return false;
	}

	return tokens.slice(pushIndex + 1).some((token) => {
		const normalized = normalizeToken(token);
		return (
			normalized === "-f" ||
			normalized === "--force" ||
			normalized.startsWith("--force-with-lease") ||
			normalized.startsWith("+")
		);
	});
}

function isProtectedDelete(tokens) {
	if (!isDeleteCommand(tokens)) {
		return false;
	}

	return deleteTargets(tokens).some(
		(target) => isEnvPath(target) || isDrizzleMigrationPath(target),
	);
}

function isBroadDestructiveDelete(tokens) {
	if (!isDeleteCommand(tokens)) {
		return false;
	}

	if (!hasRecursiveFlag(tokens) || !hasForceFlag(tokens)) {
		return false;
	}

	return deleteTargets(tokens).some((target) => isRepoRootTarget(target));
}

function isDeleteCommand(tokens) {
	return [
		"del",
		"erase",
		"rd",
		"ri",
		"rm",
		"rmdir",
		"remove-item",
		"unlink",
	].includes(commandName(tokens[0] ?? ""));
}

function deleteTargets(tokens) {
	const targets = [];
	const optionNamesWithValues = new Set([
		"--exclude",
		"--filter",
		"--include",
		"--interactive",
		"--preserve-root",
		"--regex",
		"--root",
		"-exclude",
		"-filter",
		"-include",
		"-literalpath",
		"-path",
	]);

	for (let index = 1; index < tokens.length; index += 1) {
		const token = tokens[index];
		const normalized = normalizeToken(token);

		if (optionNamesWithValues.has(normalized)) {
			if (index + 1 < tokens.length) {
				targets.push(tokens[index + 1]);
				index += 1;
			}

			continue;
		}

		if (normalized.startsWith("-")) {
			continue;
		}

		targets.push(token);
	}

	return targets;
}

function hasRecursiveFlag(tokens) {
	return tokens.some((token) => {
		const normalized = normalizeToken(token);
		return (
			normalized === "-r" ||
			normalized === "--recursive" ||
			normalized === "-recurse" ||
			/^-[a-z]*r[a-z]*$/.test(normalized)
		);
	});
}

function hasForceFlag(tokens) {
	return tokens.some((token) => {
		const normalized = normalizeToken(token);
		return (
			normalized === "-f" ||
			normalized === "--force" ||
			normalized === "-force" ||
			/^-[a-z]*f[a-z]*$/.test(normalized)
		);
	});
}

function isEnvPath(target) {
	return /^\.env(?:$|[.\w*-])/.test(pathBaseName(target));
}

function isDrizzleMigrationPath(target) {
	return normalizePath(target).includes("packages/db/drizzle");
}

function isRepoRootTarget(target) {
	const normalizedTarget = normalizePath(target).replace(/\/\*$/, "");
	const normalizedRepoRoot = normalizePath(process.cwd());

	return (
		["", ".", "./", "$pwd", "$" + "{pwd}", "/", "\\", "*"].includes(
			normalizedTarget,
		) || normalizedTarget === normalizedRepoRoot
	);
}

function isProductionDeploy(tokens, allArgText) {
	if (deploymentWasRequested(allArgText)) {
		return false;
	}

	const executable = commandName(tokens[0] ?? "");
	const normalizedTokens = tokens.map(normalizeToken);
	const joined = normalizedTokens.join(" ");
	const hasDeploy = normalizedTokens.some(
		(token) =>
			token === "deploy" || /^deploy[:.-]?(prod|production)?$/.test(token),
	);
	const hasProduction = normalizedTokens.some((token) =>
		["--prod", "--production", "-production", "prod", "production"].includes(
			token,
		),
	);

	if (/deploy[:.-]?(prod|production)\b/.test(joined)) {
		return true;
	}

	if (hasDeploy && hasProduction) {
		return true;
	}

	if (executable === "vercel" && normalizedTokens.includes("--prod")) {
		return true;
	}

	if (
		["fly", "flyctl", "netlify", "railway", "wrangler"].includes(executable) &&
		hasDeploy &&
		hasProduction
	) {
		return true;
	}

	if (
		["firebase", "pulumi", "serverless", "sls", "sst", "terraform"].includes(
			executable,
		)
	) {
		const productionAction = normalizedTokens.some((token) =>
			["apply", "deploy"].includes(token),
		);
		return productionAction && hasProduction;
	}

	if (
		executable === "gh" &&
		normalizedTokens.includes("workflow") &&
		normalizedTokens.includes("run")
	) {
		return (
			normalizedTokens.some((token) => token.includes("deploy")) &&
			hasProduction
		);
	}

	return false;
}

function deploymentWasRequested(allArgText) {
	return /\b(?:deploy(?:ment)?\s+(?:approved|requested)|requested\s+(?:a\s+)?(?:production\s+)?deploy|user\s+(?:asked|requested)\s+.*deploy)\b/i.test(
		allArgText,
	);
}

function isRealPaymentCaptureOrRefund(tokens, allArgText) {
	const provider = commandName(tokens[0] ?? "");

	if (
		!["adyen", "braintree", "paypal", "razorpay", "stripe"].includes(provider)
	) {
		return false;
	}

	const joined = tokens.map(normalizeToken).join(" ");
	const hasPaymentAction = /\b(capture|captures|refund|refunds)\b/.test(joined);
	const hasLiveIndicator =
		/\b(?:live|production|prod|sk_live_|rzp_live_|--live)\b/i.test(allArgText);
	const hasSafeIndicator = /\b(?:dry-run|mock|sandbox|sk_test_|test)\b/i.test(
		allArgText,
	);

	return hasPaymentAction && hasLiveIndicator && !hasSafeIndicator;
}

function commandName(token) {
	const withoutPath = pathBaseName(token).toLowerCase();
	return withoutPath.replace(/\.(?:cmd|exe|ps1)$/i, "");
}

function normalizeToken(token) {
	return String(token).trim().toLowerCase();
}

function pathBaseName(path) {
	const normalized = normalizePath(path);
	const parts = normalized.split("/");
	return parts[parts.length - 1] ?? "";
}

function normalizePath(path) {
	return String(path)
		.trim()
		.replace(/^["']|["']$/g, "")
		.replace(/[),]+$/g, "")
		.replace(/\\/g, "/")
		.replace(/\/+$/g, "")
		.toLowerCase();
}
