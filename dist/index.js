import fs from "node:fs";
import { spawn } from "node:child_process";
import fs$1 from "node:fs/promises";
import path from "node:path";

//#region src/bump-policy.ts
function applyNoBumpPolicy(input) {
	if (!input.changed) return {
		bump: "none",
		skipRelease: true
	};
	if (input.bumpFromCommits !== "none") return {
		bump: input.bumpFromCommits,
		skipRelease: false
	};
	if (input.noBumpPolicy === "patch") return {
		bump: "patch",
		skipRelease: false
	};
	if (input.noBumpPolicy === "keep") return {
		bump: "none",
		skipRelease: false
	};
	return {
		bump: "none",
		skipRelease: true
	};
}

//#endregion
//#region src/changelog.ts
const DEFAULT_SECTIONS = new Map([
	["feat", "Features"],
	["fix", "Bug Fixes"],
	["docs", "Documentation"],
	["perf", "Performance"],
	["refactor", "Refactoring"],
	["build", "Build / CI"],
	["ci", "Build / CI"],
	["chore", "Chores"],
	["test", "Tests"],
	["style", "Other"],
	["other", "Other"]
]);
function formatSha(sha, repo, githubServerUrl) {
	const shortSha = sha.slice(0, 7);
	if (!repo) return shortSha;
	return `[${shortSha}](${githubServerUrl.replace(/api\.github\.com\/?$/u, "github.com").replace(/\/api\/v3\/?$/u, "")}/${repo}/commit/${sha})`;
}
function sectionForType(type) {
	return DEFAULT_SECTIONS.get(type ?? "other") ?? "Other";
}
function renderChangelog(commits, repo, githubServerUrl) {
	const groups = /* @__PURE__ */ new Map();
	for (const commit of commits) {
		const section = sectionForType(commit.type);
		const scopedDescription = commit.scope ? `${commit.scope}: ${commit.description}` : commit.description;
		const shaText = formatSha(commit.sha, repo, githubServerUrl);
		const entry = `- ${scopedDescription} (thanks ${commit.displayAuthor}) (${shaText})`;
		if (!groups.has(section)) groups.set(section, []);
		groups.get(section)?.push(entry);
	}
	const orderedSections = [
		"Features",
		"Bug Fixes",
		"Documentation",
		"Performance",
		"Refactoring",
		"Build / CI",
		"Chores",
		"Tests",
		"Other"
	];
	const chunks = [];
	for (const section of orderedSections) {
		const entries = groups.get(section);
		if (!entries || entries.length === 0) continue;
		chunks.push(`## ${section}`);
		chunks.push(...entries);
		chunks.push("");
	}
	return chunks.length > 0 ? chunks.join("\n").trim() : "";
}

//#endregion
//#region src/commits.ts
const HEADER_REGEX = /^([a-zA-Z][\w-]*)(?:\(([^)]+)\))?(!)?:\s+(.+)$/u;
function detectEmoji(text) {
	const match = text.match(/\p{Extended_Pictographic}/u);
	return match ? match[0] : "";
}
function parseFooters(body) {
	const footers = {};
	for (const line of body.split(/\r?\n/u)) {
		const match = line.match(/^([A-Za-z-]+):\s+(.+)$/u);
		if (!match) continue;
		const [, key, value] = match;
		if (key && value) footers[key] = value.trim();
	}
	return footers;
}
function parseConventionalCommit(subject, body) {
	const trimmedSubject = subject.trim();
	const header = trimmedSubject.match(HEADER_REGEX);
	const footerMap = parseFooters(body);
	const hasBreakingFooter = /(^|\n)BREAKING CHANGE:\s+/u.test(body);
	if (!header) return {
		type: null,
		scope: null,
		description: trimmedSubject,
		emoji: detectEmoji(trimmedSubject),
		isBreaking: hasBreakingFooter,
		rawSubject: trimmedSubject,
		body,
		footers: footerMap,
		valid: false
	};
	const [, type = "", scope = "", bang = "", description = ""] = header;
	return {
		type: type.toLowerCase(),
		scope: scope || null,
		description: description.trim(),
		emoji: detectEmoji(description),
		isBreaking: bang === "!" || hasBreakingFooter,
		rawSubject: trimmedSubject,
		body,
		footers: footerMap,
		valid: true
	};
}
function normalizedCommitType(parsed) {
	if (!parsed.valid || !parsed.type) return "other";
	return parsed.type;
}
function assertConventionalCommitValidity(parsed, strict, targetLabel, sha, subject) {
	if (!parsed.valid && strict) throw new Error(`Invalid conventional commit for target "${targetLabel}" in strict mode: ${sha} "${subject}"`);
	return parsed;
}
function resolveBumpFromCommits(commits, bumpRules) {
	let highest = "none";
	for (const commit of commits) {
		const bump = commit.isBreaking ? "major" : bumpRules[normalizedCommitType(commit)] ?? bumpRules.other ?? "none";
		if (bump === "major") return "major";
		if (bump === "minor") highest = "minor";
		else if (bump === "patch" && highest === "none") highest = "patch";
	}
	return highest;
}

//#endregion
//#region src/utils/exec.ts
function runCommand(command, args, options = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			...options,
			stdio: [
				"ignore",
				"pipe",
				"pipe"
			]
		});
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (chunk) => {
			stdout += String(chunk);
		});
		child.stderr.on("data", (chunk) => {
			stderr += String(chunk);
		});
		child.on("error", (error) => {
			reject(error);
		});
		child.on("close", (code) => {
			const exitCode = Number(code ?? 0);
			if (exitCode !== 0) {
				const message = [
					`Command failed: ${command} ${args.join(" ")}`,
					stderr.trim() ? `stderr: ${stderr.trim()}` : "",
					stdout.trim() ? `stdout: ${stdout.trim()}` : ""
				].filter(Boolean).join("\n");
				reject(new Error(message));
				return;
			}
			resolve({
				stdout,
				stderr,
				code: exitCode
			});
		});
	});
}

//#endregion
//#region src/utils/paths.ts
function toPosixPath(value) {
	return value.replace(/\\/g, "/");
}
function escapeRegex(value) {
	return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}
function globToRegExp(glob) {
	const normalized = toPosixPath(glob.trim());
	if (!normalized) throw new Error("Glob cannot be empty");
	let pattern = "^";
	for (let index = 0; index < normalized.length; index += 1) {
		const char = normalized[index] ?? "";
		const next = normalized[index + 1];
		if (char === "*" && next === "*") {
			if (normalized[index + 2] === "/") {
				pattern += "(?:.*/)?";
				index += 2;
			} else {
				pattern += ".*";
				index += 1;
			}
			continue;
		}
		if (char === "*") {
			pattern += "[^/]*";
			continue;
		}
		if (char === "?") {
			pattern += "[^/]";
			continue;
		}
		pattern += escapeRegex(char);
	}
	pattern += "$";
	return new RegExp(pattern);
}
function isGlobMatch(filePath, glob) {
	return globToRegExp(glob).test(toPosixPath(filePath));
}
function uniqueSortedPosix(files) {
	return [...new Set(files.map(toPosixPath))].sort();
}

//#endregion
//#region src/git.ts
function trimTrailingNewline(value) {
	return value.replace(/\r?\n$/u, "");
}
async function resolveRef(ref) {
	const { stdout } = await runCommand("git", [
		"rev-parse",
		"--verify",
		ref
	]);
	return trimTrailingNewline(stdout).trim();
}
async function resolveGitRange(fromRef, toRef, logger) {
	const to = await resolveRef(toRef || "HEAD");
	let from = fromRef;
	if (!from) from = trimTrailingNewline((await runCommand("git", [
		"rev-list",
		"--max-parents=0",
		to
	])).stdout).split(/\r?\n/u).filter(Boolean)[0] ?? "";
	if (!from) throw new Error("Unable to resolve from-ref. Set input 'from-ref' explicitly.");
	try {
		from = await resolveRef(from);
	} catch (error) {
		if (fs.existsSync(".git/shallow")) throw new Error(`Failed to resolve from-ref "${fromRef}". Repository appears shallow. Use actions/checkout with fetch-depth: 0.`);
		throw error;
	}
	logger.info(`Resolved git range: ${from}..${to}`);
	return {
		from,
		to,
		expression: `${from}..${to}`
	};
}
async function listCommitFiles(sha) {
	const { stdout } = await runCommand("git", [
		"diff-tree",
		"--no-commit-id",
		"--name-only",
		"-r",
		"--first-parent",
		"-m",
		sha
	]);
	return uniqueSortedPosix(stdout.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean).map(toPosixPath));
}
async function readCommitMetadata(sha) {
	const { stdout } = await runCommand("git", [
		"show",
		"-s",
		`--format=${[
			"%H",
			"%P",
			"%s",
			"%b",
			"--RELLU--",
			"%an",
			"%ae"
		].join("%n")}`,
		sha
	]);
	const [meta = "", authorName = "", authorEmail = ""] = stdout.split("--RELLU--");
	const lines = meta.replace(/\r/g, "").split("\n");
	const parsedSha = (lines.shift() ?? "").trim();
	const parents = (lines.shift() ?? "").trim().split(" ").filter(Boolean);
	const subject = lines.shift() ?? "";
	const body = lines.join("\n").trim();
	return {
		sha: parsedSha || sha,
		parents,
		subject,
		body,
		authorName: authorName.trim(),
		authorEmail: authorEmail.trim(),
		isMerge: parents.length > 1
	};
}
async function collectCommitsInRange(range, logger) {
	const { stdout } = await runCommand("git", [
		"rev-list",
		"--reverse",
		"--first-parent",
		range
	]);
	const shas = stdout.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
	const commits = [];
	for (const sha of shas) {
		const metadata = await readCommitMetadata(sha);
		const files = await listCommitFiles(sha);
		commits.push({
			...metadata,
			files,
			githubUsername: ""
		});
	}
	logger.info(`Collected ${commits.length} commits from ${range}`);
	return commits;
}
function parseRepo$1(repo) {
	const [owner, name] = repo.split("/");
	if (!owner || !name) return null;
	return {
		owner,
		name
	};
}
async function githubGet(apiBase, token, endpoint) {
	const response = await fetch(`${apiBase.replace(/\/+$/u, "")}${endpoint}`, {
		method: "GET",
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: "application/vnd.github+json",
			"User-Agent": "rellu-action"
		}
	});
	if (!response.ok) throw new Error(`GitHub API request failed (${response.status}) for ${endpoint}`);
	return await response.json();
}
async function enrichCommitsWithGitHubUsernames(commits, repo, apiBase, token, logger) {
	if (!token) return commits;
	const parsed = parseRepo$1(repo);
	if (!parsed) return commits;
	const updated = [];
	for (const commit of commits) try {
		const payload = await githubGet(apiBase, token, `/repos/${parsed.owner}/${parsed.name}/commits/${commit.sha}`);
		const username = String(payload.author?.login ?? "").trim();
		updated.push({
			...commit,
			githubUsername: username
		});
	} catch (error) {
		logger.warn(`Could not resolve GitHub username for commit ${commit.sha}: ${String(error)}`);
		updated.push(commit);
	}
	return updated;
}

//#endregion
//#region src/semver.ts
function parseSemver(version) {
	const match = version.trim().match(/^(\d+)\.(\d+)\.(\d+)$/u);
	if (!match) throw new Error(`Invalid semantic version "${version}"`);
	return {
		major: Number(match[1]),
		minor: Number(match[2]),
		patch: Number(match[3])
	};
}
function calculateNextVersion(currentVersion, bump) {
	const parsed = parseSemver(currentVersion);
	switch (bump) {
		case "major": return `${parsed.major + 1}.0.0`;
		case "minor": return `${parsed.major}.${parsed.minor + 1}.0`;
		case "patch": return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
		case "none": return `${parsed.major}.${parsed.minor}.${parsed.patch}`;
		default: {
			const exhaustiveCheck = bump;
			throw new Error(`Unsupported bump level "${String(exhaustiveCheck)}"`);
		}
	}
}

//#endregion
//#region src/targets.ts
function matchFilesForTarget(target, files) {
	return files.filter((file) => target.paths.some((glob) => isGlobMatch(file, glob)));
}
function analyzeTargetImpacts(targets, commits) {
	return targets.map((target) => {
		const matchedFiles = /* @__PURE__ */ new Set();
		const relevantCommits = [];
		for (const commit of commits) {
			const matches = matchFilesForTarget(target, commit.files.map(toPosixPath));
			if (matches.length > 0) {
				relevantCommits.push(commit);
				for (const file of matches) matchedFiles.add(file);
			}
		}
		const matchedFilesList = uniqueSortedPosix([...matchedFiles]);
		return {
			label: target.label,
			changed: matchedFilesList.length > 0,
			matchedFiles: matchedFilesList,
			commitCount: relevantCommits.length,
			relevantCommits
		};
	});
}

//#endregion
//#region src/version-files.ts
async function readText(filePath) {
	try {
		return await fs$1.readFile(path.resolve(filePath), "utf8");
	} catch (error) {
		throw new Error(`Failed reading manifest "${filePath}": ${String(error)}`);
	}
}
async function writeText(filePath, content) {
	await fs$1.writeFile(path.resolve(filePath), content, "utf8");
}
function parseJsonRecord(text, filePath) {
	let parsed;
	try {
		parsed = JSON.parse(text);
	} catch (error) {
		throw new Error(`Invalid JSON in "${filePath}": ${String(error)}`);
	}
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`Expected JSON object in "${filePath}"`);
	return parsed;
}
function extractTomlSection(text, section) {
	const escapedSection = section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const sectionRegex = new RegExp(`\\[${escapedSection}\\]([\\s\\S]*?)(?=\\n\\[[^\\]]+\\]|$)`);
	return text.match(sectionRegex)?.[1] ?? "";
}
function readCargoVersion(text) {
	const match = extractTomlSection(text, "package").match(/^\s*version\s*=\s*"([^"]+)"\s*$/mu);
	if (!match) throw new Error("Cargo.toml missing [package] version = \"x.y.z\"");
	const version = match[1];
	if (!version) throw new Error("Cargo.toml missing [package] version = \"x.y.z\"");
	return version;
}
function readPyprojectVersion(text) {
	const project = extractTomlSection(text, "project");
	const poetry = extractTomlSection(text, "tool.poetry");
	const projectMatch = project.match(/^\s*version\s*=\s*"([^"]+)"\s*$/mu);
	if (projectMatch) {
		const version = projectMatch[1];
		if (version) return version;
	}
	const poetryMatch = poetry.match(/^\s*version\s*=\s*"([^"]+)"\s*$/mu);
	if (poetryMatch) {
		const version = poetryMatch[1];
		if (version) return version;
	}
	throw new Error("pyproject.toml missing supported version layout. Expected [project] version or [tool.poetry] version.");
}
function updateTomlSectionVersion(text, section, nextVersion) {
	const escapedSection = section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const sectionPattern = new RegExp(`(\\[${escapedSection}\\][\\s\\S]*?^\\s*version\\s*=\\s*")([^"]+)(")`, "m");
	if (!sectionPattern.test(text)) return text;
	return text.replace(sectionPattern, `$1${nextVersion}$3`);
}
async function readManifestVersion(filePath, type) {
	const text = await readText(filePath);
	if (type === "node-package-json") {
		const parsed = parseJsonRecord(text, filePath);
		const version = String(parsed.version ?? "").trim();
		if (!version) throw new Error(`Target manifest "${filePath}" missing package.json version field`);
		return version;
	}
	if (type === "rust-cargo-toml") return readCargoVersion(text);
	if (type === "python-pyproject-toml") return readPyprojectVersion(text);
	const exhaustiveCheck = type;
	throw new Error(`Unsupported manifest type "${String(exhaustiveCheck)}"`);
}
async function writeManifestVersion(filePath, type, nextVersion) {
	const text = await readText(filePath);
	let updated = text;
	if (type === "node-package-json") {
		const parsed = parseJsonRecord(text, filePath);
		parsed.version = nextVersion;
		updated = `${JSON.stringify(parsed, null, 2)}\n`;
		await writeText(filePath, updated);
		return;
	}
	if (type === "rust-cargo-toml") {
		updated = updateTomlSectionVersion(text, "package", nextVersion);
		if (updated === text) throw new Error(`Target manifest "${filePath}" missing [package] version field`);
		await writeText(filePath, updated);
		return;
	}
	if (type === "python-pyproject-toml") {
		const fromProject = updateTomlSectionVersion(text, "project", nextVersion);
		if (fromProject !== text) {
			await writeText(filePath, fromProject);
			return;
		}
		const fromPoetry = updateTomlSectionVersion(text, "tool.poetry", nextVersion);
		if (fromPoetry === text) throw new Error(`Target manifest "${filePath}" missing [project] version or [tool.poetry] version field`);
		await writeText(filePath, fromPoetry);
		return;
	}
	const exhaustiveCheck = type;
	throw new Error(`Unsupported manifest type "${String(exhaustiveCheck)}"`);
}

//#endregion
//#region src/analyze.ts
function displayAuthor(commit) {
	if (commit.githubUsername) return `@${commit.githubUsername}`;
	return commit.authorName || "unknown";
}
async function analyzeRepository(config, logger) {
	const range = await resolveGitRange(config.fromRef, config.toRef, logger);
	const commits = await enrichCommitsWithGitHubUsernames(await collectCommitsInRange(range.expression, logger), config.repo, config.githubServerUrl, config.githubToken, logger);
	const commitsWithConventional = commits.map((commit) => ({
		...commit,
		conventional: parseConventionalCommit(commit.subject, commit.body)
	}));
	const impacts = analyzeTargetImpacts(config.targets, commitsWithConventional);
	const targetByLabel = new Map(config.targets.map((target) => [target.label, target]));
	const results = [];
	for (const impact of impacts) {
		const target = targetByLabel.get(impact.label);
		if (!target) continue;
		const currentVersion = await readManifestVersion(target.version.file, target.version.type);
		const relevantParsed = impact.relevantCommits.map((commit) => {
			const parsed = assertConventionalCommitValidity(commit.conventional, config.strictConventionalCommits, target.label, commit.sha, commit.subject);
			const normalizedType = normalizedCommitType(parsed);
			return {
				...commit,
				conventional: {
					...parsed,
					type: normalizedType
				}
			};
		});
		const bumpFromCommits = resolveBumpFromCommits(relevantParsed.map((commit) => commit.conventional), config.bumpRules);
		const policyOutcome = applyNoBumpPolicy({
			changed: impact.changed,
			bumpFromCommits,
			noBumpPolicy: config.noBumpPolicy
		});
		if (impact.changed && bumpFromCommits === "none") logger.info(`Target ${target.label} has no bump-worthy commits. Applying no-bump policy "${config.noBumpPolicy}".`);
		const nextVersion = policyOutcome.skipRelease ? currentVersion : calculateNextVersion(currentVersion, policyOutcome.bump);
		const outputCommits = relevantParsed.map((commit) => ({
			sha: commit.sha,
			type: commit.conventional.type,
			scope: commit.conventional.scope,
			description: commit.conventional.description,
			isBreaking: commit.conventional.isBreaking,
			rawSubject: commit.subject,
			body: commit.body,
			author: {
				name: commit.authorName,
				username: commit.githubUsername || "",
				display: displayAuthor(commit)
			}
		}));
		const changelogMarkdown = renderChangelog(outputCommits.map((entry) => ({
			sha: entry.sha,
			description: entry.description,
			scope: entry.scope,
			type: entry.type,
			displayAuthor: entry.author.display
		})), config.repo, config.githubServerUrl);
		const result = {
			label: target.label,
			changed: impact.changed,
			matchedFiles: impact.matchedFiles,
			commitCount: impact.commitCount,
			currentVersion,
			nextVersion,
			bump: policyOutcome.bump,
			commits: outputCommits,
			changelog: { markdown: changelogMarkdown },
			versionSource: target.version,
			skipRelease: policyOutcome.skipRelease
		};
		results.push(result);
		logger.info(`Target ${target.label}: changed=${String(impact.changed)}, commits=${impact.commitCount}, bump=${policyOutcome.bump}, nextVersion=${nextVersion}`);
	}
	return {
		range: range.expression,
		commitCount: commits.length,
		results
	};
}

//#endregion
//#region src/config.ts
const SUPPORTED_MANIFEST_TYPES = new Set([
	"node-package-json",
	"rust-cargo-toml",
	"python-pyproject-toml"
]);
const SUPPORTED_BUMP_LEVELS = new Set([
	"major",
	"minor",
	"patch",
	"none"
]);
const SUPPORTED_NO_BUMP_POLICIES = new Set([
	"skip",
	"keep",
	"patch"
]);
const DEFAULT_BUMP_RULES = {
	feat: "minor",
	fix: "patch",
	perf: "patch",
	refactor: "patch",
	docs: "none",
	chore: "none",
	test: "none",
	build: "none",
	ci: "none",
	style: "none",
	other: "none"
};
function readInput(name) {
	const normalized = name.replace(/[ -]/g, "_").toUpperCase();
	return String(process.env[`INPUT_${normalized}`] ?? "").trim();
}
function toBoolean(value, fallback) {
	if (!value) return fallback;
	if (value === "true") return true;
	if (value === "false") return false;
	throw new Error(`Invalid boolean value "${value}"`);
}
function parseJson(input) {
	try {
		return JSON.parse(input);
	} catch (error) {
		throw new Error(`Invalid JSON input: ${String(error)}`);
	}
}
function asRecord(value) {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected an object");
	return value;
}
function asOptionalString(value) {
	return typeof value === "string" ? value.trim() : "";
}
function loadConfigFile(filePath) {
	const absolute = path.resolve(filePath);
	if (!fs.existsSync(absolute)) throw new Error(`Config file not found: ${absolute}`);
	const extension = path.extname(absolute).toLowerCase();
	if (extension !== ".json") throw new Error(`Unsupported config file extension "${extension}". Use JSON config files.`);
	return asRecord(parseJson(fs.readFileSync(absolute, "utf8")));
}
function parseTarget(targetValue, index) {
	const target = asRecord(targetValue);
	const label = asOptionalString(target.label);
	if (!label) throw new Error(`Target at index ${index} is missing required field: label`);
	const pathsValue = target.paths;
	if (!Array.isArray(pathsValue) || pathsValue.length === 0) throw new Error(`Target "${label}" must define at least one path glob`);
	const paths = pathsValue.map((value) => String(value).trim());
	for (const glob of paths) {
		if (!glob) throw new Error(`Target "${label}" has an empty path glob`);
		try {
			globToRegExp(glob);
		} catch (error) {
			throw new Error(`Target "${label}" has invalid glob "${glob}": ${String(error)}`);
		}
	}
	const version = asRecord(target.version);
	const file = asOptionalString(version.file);
	const type = asOptionalString(version.type);
	if (!file) throw new Error(`Target "${label}" is missing version.file`);
	if (!SUPPORTED_MANIFEST_TYPES.has(type)) throw new Error(`Target "${label}" has unsupported version.type "${type}". Supported: node-package-json, rust-cargo-toml, python-pyproject-toml.`);
	return {
		label,
		paths: paths.map((entry) => toPosixPath(entry)),
		version: {
			file: toPosixPath(file),
			type
		}
	};
}
function resolveTargets(rawTargets, fileConfig) {
	const fromFile = fileConfig.targets ?? fileConfig.apps;
	const source = rawTargets ? parseJson(rawTargets) : fromFile;
	if (!Array.isArray(source) || source.length === 0) throw new Error("No targets provided. Set input 'targets' or provide targets/apps in config-file.");
	return source.map((target, index) => parseTarget(target, index));
}
function parseBumpRules(value) {
	const record = asRecord(value);
	const merged = { ...DEFAULT_BUMP_RULES };
	for (const [commitType, rawLevel] of Object.entries(record)) {
		const level = asOptionalString(rawLevel);
		if (!SUPPORTED_BUMP_LEVELS.has(level)) throw new Error(`Unsupported bump level "${level}" for commit type "${commitType}"`);
		merged[commitType] = level;
	}
	return merged;
}
function validateUniqueTargetLabels(targets) {
	const seen = /* @__PURE__ */ new Set();
	for (const target of targets) {
		if (seen.has(target.label)) throw new Error(`Duplicate target label "${target.label}"`);
		seen.add(target.label);
	}
}
function loadConfig() {
	const configFileInput = readInput("config-file");
	const fileConfig = configFileInput ? loadConfigFile(configFileInput) : {};
	const targets = resolveTargets(readInput("targets"), fileConfig);
	validateUniqueTargetLabels(targets);
	const rawBumpRules = readInput("bump-rules");
	const bumpRules = parseBumpRules(rawBumpRules ? parseJson(rawBumpRules) : fileConfig.bumpRules ?? {});
	const fromRef = readInput("from-ref") || asOptionalString(fileConfig.fromRef);
	const toRef = readInput("to-ref") || asOptionalString(fileConfig.toRef) || "HEAD";
	const noBumpPolicyRaw = readInput("no-bump-policy") || asOptionalString(fileConfig.noBumpPolicy) || "skip";
	if (!SUPPORTED_NO_BUMP_POLICIES.has(noBumpPolicyRaw)) throw new Error(`Invalid no-bump-policy "${noBumpPolicyRaw}". Expected skip, keep, or patch.`);
	const strictRaw = readInput("strict-conventional-commits") || asOptionalString(fileConfig.strictConventionalCommits);
	const createReleasePrsRaw = readInput("create-release-prs") || asOptionalString(fileConfig.createReleasePrs);
	const releaseBranchPrefix = readInput("release-branch-prefix") || asOptionalString(fileConfig.releaseBranchPrefix) || "rellu/release";
	const baseBranch = readInput("base-branch") || asOptionalString(fileConfig.baseBranch) || "main";
	const repo = readInput("repo") || asOptionalString(fileConfig.repo) || asOptionalString(process.env.GITHUB_REPOSITORY);
	const githubServerUrl = readInput("github-server-url") || asOptionalString(fileConfig.githubServerUrl) || "https://api.github.com";
	const githubToken = asOptionalString(process.env.GITHUB_TOKEN) || asOptionalString(process.env.INPUT_GITHUB_TOKEN);
	return {
		fromRef,
		toRef,
		strictConventionalCommits: toBoolean(strictRaw, false),
		bumpRules,
		noBumpPolicy: noBumpPolicyRaw,
		createReleasePrs: toBoolean(createReleasePrsRaw, false),
		releaseBranchPrefix,
		baseBranch,
		repo,
		githubServerUrl,
		githubToken,
		targets
	};
}

//#endregion
//#region src/output.ts
function setOutput(name, value) {
	const outputFile = process.env.GITHUB_OUTPUT;
	if (!outputFile) {
		console.log(`::set-output name=${name}::${value}`);
		return;
	}
	const block = `${name}<<__RELLU_EOF__\n${value}\n__RELLU_EOF__\n`;
	fs.appendFileSync(outputFile, block, "utf8");
}
function writeActionOutputs(payload) {
	setOutput("changed-targets", JSON.stringify(payload.changedTargets));
	setOutput("has-changes", String(payload.hasChanges));
	setOutput("result-json", payload.resultJson);
	setOutput("release-prs-created", String(payload.releasePrsCreated));
}

//#endregion
//#region src/release-pr.ts
function parseRepo(repo) {
	const [owner, name] = repo.split("/");
	if (!owner || !name) return null;
	return {
		owner,
		name
	};
}
async function githubRequest(apiBase, token, method, endpoint, body) {
	const requestInit = {
		method,
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: "application/vnd.github+json",
			"User-Agent": "rellu-action",
			"Content-Type": "application/json"
		},
		body: body === void 0 ? null : JSON.stringify(body)
	};
	const response = await fetch(`${apiBase.replace(/\/+$/u, "")}${endpoint}`, { ...requestInit });
	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`GitHub API ${method} ${endpoint} failed (${response.status}): ${errorText}`);
	}
	if (response.status === 204) return null;
	return await response.json();
}
function getReleaseBranchName(prefix, label) {
	return `${prefix.replace(/\/+$/u, "")}/${label}`;
}
async function findOpenReleasePr(repo, apiBase, token, branch, base, titlePrefix) {
	const params = new URLSearchParams({
		state: "open",
		head: `${repo.owner}:${branch}`,
		base
	});
	const byBranch = await githubRequest(apiBase, token, "GET", `/repos/${repo.owner}/${repo.name}/pulls?${params.toString()}`);
	if (Array.isArray(byBranch) && byBranch.length > 0) return byBranch[0] ?? null;
	return (await githubRequest(apiBase, token, "GET", `/repos/${repo.owner}/${repo.name}/pulls?state=open&base=${encodeURIComponent(base)}&per_page=100`)).find((pull) => String(pull.head?.ref ?? "") === branch || String(pull.title ?? "").startsWith(titlePrefix)) ?? null;
}
async function regenerateReleaseBranch(baseBranch, branch, target, logger) {
	await runCommand("git", [
		"fetch",
		"origin",
		baseBranch
	]);
	await runCommand("git", [
		"checkout",
		"-B",
		branch,
		`origin/${baseBranch}`
	]);
	await runCommand("git", [
		"config",
		"user.name",
		"rellu[bot]"
	]);
	await runCommand("git", [
		"config",
		"user.email",
		"rellu-bot@users.noreply.github.com"
	]);
	await writeManifestVersion(target.versionSource.file, target.versionSource.type, target.nextVersion);
	await runCommand("git", ["add", target.versionSource.file]);
	if (!(await runCommand("git", [
		"status",
		"--porcelain",
		"--",
		target.versionSource.file
	])).stdout.trim()) {
		logger.info(`No version file changes for ${target.label}; branch regeneration skipped commit.`);
		return;
	}
	await runCommand("git", [
		"commit",
		"-m",
		`release(${target.label}): v${target.nextVersion}`,
		"--no-verify"
	]);
	await runCommand("git", [
		"push",
		"origin",
		`+${branch}`
	]);
}
async function createOrUpdateReleasePr(target, config, repo, logger) {
	const branch = getReleaseBranchName(config.releaseBranchPrefix, target.label);
	const title = `release(${target.label}): v${target.nextVersion}`;
	const body = target.changelog.markdown || "_No changelog entries._";
	await regenerateReleaseBranch(config.baseBranch, branch, target, logger);
	const existing = await findOpenReleasePr(repo, config.githubServerUrl, config.githubToken, branch, config.baseBranch, `release(${target.label})`);
	if (existing) {
		const updated = await githubRequest(config.githubServerUrl, config.githubToken, "PATCH", `/repos/${repo.owner}/${repo.name}/pulls/${existing.number}`, {
			title,
			body
		});
		return {
			enabled: true,
			branch,
			title,
			number: updated.number,
			url: updated.html_url
		};
	}
	const created = await githubRequest(config.githubServerUrl, config.githubToken, "POST", `/repos/${repo.owner}/${repo.name}/pulls`, {
		title,
		head: branch,
		base: config.baseBranch,
		body
	});
	return {
		enabled: true,
		branch,
		title,
		number: created.number,
		url: created.html_url
	};
}
async function maybeManageReleasePrs(config, results, logger) {
	if (!config.createReleasePrs) return {
		updatedResults: results,
		anyCreatedOrUpdated: false
	};
	const repo = parseRepo(config.repo);
	if (!repo) {
		logger.warn("Release PR mode enabled but repository slug is missing. Skipping PR automation.");
		return {
			updatedResults: results,
			anyCreatedOrUpdated: false
		};
	}
	if (!config.githubToken) {
		logger.warn("Release PR mode enabled but GITHUB_TOKEN is missing. Skipping PR automation.");
		return {
			updatedResults: results,
			anyCreatedOrUpdated: false
		};
	}
	let anyCreatedOrUpdated = false;
	const updatedResults = [];
	for (const result of results) {
		if (!(result.changed && result.nextVersion !== result.currentVersion && !result.skipRelease)) {
			if (result.changed) logger.warn(`Skipping release PR for ${result.label}: non-releasable target under current policy.`);
			updatedResults.push({
				...result,
				releasePr: {
					enabled: true,
					branch: getReleaseBranchName(config.releaseBranchPrefix, result.label),
					title: `release(${result.label}): v${result.nextVersion}`
				}
			});
			continue;
		}
		logger.info(`Managing release PR for ${result.label} on branch ${getReleaseBranchName(config.releaseBranchPrefix, result.label)}`);
		const releasePr = await createOrUpdateReleasePr(result, config, repo, logger);
		updatedResults.push({
			...result,
			releasePr
		});
		anyCreatedOrUpdated = true;
	}
	return {
		updatedResults,
		anyCreatedOrUpdated
	};
}

//#endregion
//#region src/utils/log.ts
const defaultLogger = {
	info(message) {
		console.log(message);
	},
	warn(message) {
		console.warn(message);
	},
	error(message) {
		console.error(message);
	}
};

//#endregion
//#region src/index.ts
async function run() {
	const config = loadConfig();
	defaultLogger.info(`Loaded ${config.targets.length} configured targets.`);
	const analysis = await analyzeRepository(config, defaultLogger);
	defaultLogger.info(`Analysis complete. Range=${analysis.range} commits=${analysis.commitCount}`);
	const releaseOutcome = await maybeManageReleasePrs(config, analysis.results, defaultLogger);
	const results = releaseOutcome.updatedResults;
	const changedTargets = results.filter((result) => result.changed).map((result) => result.label);
	const resultJson = JSON.stringify(results, null, 2);
	writeActionOutputs({
		changedTargets,
		hasChanges: changedTargets.length > 0,
		resultJson,
		releasePrsCreated: releaseOutcome.anyCreatedOrUpdated
	});
	defaultLogger.info(`Changed targets: ${changedTargets.length > 0 ? changedTargets.join(", ") : "(none)"}`);
}
run().catch((error) => {
	const message = error instanceof Error ? error.stack ?? error.message : String(error);
	console.error(message);
	process.exitCode = 1;
});

//#endregion
export {  };