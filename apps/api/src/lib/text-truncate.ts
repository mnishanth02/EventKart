/**
 * Truncate `value` to at most `maxCodeUnits` UTF-16 code units while never
 * leaving an unpaired high surrogate at the tail.
 *
 * `String.prototype.slice` is code-unit-based, so slicing in the middle of a
 * surrogate pair (e.g. an emoji or any astral-plane code point) yields a
 * dangling high surrogate that renders as a replacement glyph downstream.
 * For a pessimistic public-text boundary we accept losing one full astral
 * code point in that edge case.
 *
 * Shared by the public event detail (`apps/api/src/modules/events/public-detail-service.ts`)
 * and the public organizer profile (`apps/api/src/modules/organizer/public-profile-service.ts`)
 * to keep their description truncation behavior identical.
 */
export function truncateNoSurrogateSplit(
	value: string,
	maxCodeUnits: number,
): string {
	if (value.length <= maxCodeUnits) {
		return value;
	}
	const sliced = value.slice(0, maxCodeUnits);
	const lastCodeUnit = sliced.charCodeAt(sliced.length - 1);
	// 0xD800–0xDBFF is the high-surrogate range; if the boundary lands there
	// we drop it so the truncated string remains well-formed UTF-16.
	if (lastCodeUnit >= 0xd800 && lastCodeUnit <= 0xdbff) {
		return sliced.slice(0, -1);
	}
	return sliced;
}
