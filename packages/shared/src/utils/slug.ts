export const EVENT_SLUG_MIN_LENGTH = 1;
export const EVENT_SLUG_MAX_LENGTH = 96;
export const EVENT_SLUG_FALLBACK = "event";
export const EVENT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface EventSlugOptions {
	fallback?: string;
	maxLength?: number;
}

const COMBINING_MARKS_PATTERN = /[\u0300-\u036f]/g;
const APOSTROPHE_PATTERN = /['’‘`´]/g;
const UNSUPPORTED_CHARS_PATTERN = /[^a-z0-9]+/g;
const TRIM_SEPARATORS_PATTERN = /^-+|-+$/g;
const NON_DECOMPOSED_LATIN_REPLACEMENTS: Readonly<Record<string, string>> = {
	ß: "ss",
	ẞ: "SS",
	Æ: "AE",
	æ: "ae",
	Œ: "OE",
	œ: "oe",
	Ø: "O",
	ø: "o",
	Đ: "D",
	đ: "d",
	Ð: "D",
	ð: "d",
	Þ: "Th",
	þ: "th",
	Ł: "L",
	ł: "l",
};

function getMaxLength(maxLength = EVENT_SLUG_MAX_LENGTH): number {
	if (!Number.isSafeInteger(maxLength) || maxLength < EVENT_SLUG_MIN_LENGTH) {
		throw new RangeError(
			`Slug maxLength must be an integer >= ${EVENT_SLUG_MIN_LENGTH}.`,
		);
	}

	return maxLength;
}

function replaceNonDecomposedLatin(value: string): string {
	return value.replace(
		/[ßẞÆæŒœØøĐđÐðÞþŁł]/g,
		(char) => NON_DECOMPOSED_LATIN_REPLACEMENTS[char] ?? "",
	);
}

function toSlug(value: string): string {
	return replaceNonDecomposedLatin(value.normalize("NFKD"))
		.replace(COMBINING_MARKS_PATTERN, "")
		.toLowerCase()
		.trim()
		.replace(APOSTROPHE_PATTERN, "")
		.replace(UNSUPPORTED_CHARS_PATTERN, "-")
		.replace(TRIM_SEPARATORS_PATTERN, "");
}

function truncateSlug(slug: string, maxLength: number): string {
	return slug.slice(0, maxLength).replace(TRIM_SEPARATORS_PATTERN, "");
}

export function normalizeEventSlug(
	input: string,
	options: EventSlugOptions = {},
): string {
	const maxLength = getMaxLength(options.maxLength);
	const normalized = truncateSlug(toSlug(input), maxLength);

	if (normalized.length > 0) return normalized;

	const fallback = truncateSlug(
		toSlug(options.fallback ?? EVENT_SLUG_FALLBACK),
		maxLength,
	);

	return fallback.length > 0
		? fallback
		: EVENT_SLUG_FALLBACK.slice(0, maxLength);
}

export function appendEventSlugSuffix(
	slug: string,
	suffix: number,
	options: EventSlugOptions = {},
): string {
	if (!Number.isSafeInteger(suffix) || suffix < 1) {
		throw new RangeError("Slug suffix must be a positive safe integer.");
	}

	const maxLength = getMaxLength(options.maxLength);
	const suffixText = `-${suffix}`;

	if (suffixText.length >= maxLength) {
		throw new RangeError(
			`Slug suffix "${suffix}" does not leave room for slug content.`,
		);
	}

	const base = normalizeEventSlug(slug, {
		fallback: options.fallback ?? EVENT_SLUG_FALLBACK,
		maxLength: maxLength - suffixText.length,
	});

	return `${base}${suffixText}`;
}
