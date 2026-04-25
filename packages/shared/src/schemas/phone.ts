import { z } from "zod/v4";

const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

function stripPhone(raw: string): string {
	return raw.replace(/[\s-]/g, "");
}

function extractDigits(value: string): string {
	const stripped = stripPhone(value);
	if (stripped.startsWith("+91")) return stripped.slice(3);
	if (stripped.startsWith("91") && stripped.length === 12)
		return stripped.slice(2);
	if (stripped.startsWith("0")) return stripped.slice(1);
	return stripped;
}

/** Validates Indian mobile number format without transforming. */
export const phoneInputSchema = z.string().check(
	z.refine((val) => INDIAN_MOBILE_REGEX.test(extractDigits(val)), {
		message:
			"Invalid Indian mobile number. Must be 10 digits starting with 6-9.",
	}),
);

/** Validates and normalizes Indian mobile numbers to E.164 format (+91XXXXXXXXXX). */
export const phoneSchema = z
	.string()
	.check(
		z.refine((val) => INDIAN_MOBILE_REGEX.test(extractDigits(val)), {
			message:
				"Invalid Indian mobile number. Must be 10 digits starting with 6-9.",
		}),
	)
	.transform((val) => `+91${extractDigits(val)}`);

export type PhoneInput = z.input<typeof phoneSchema>;
export type Phone = z.output<typeof phoneSchema>;
