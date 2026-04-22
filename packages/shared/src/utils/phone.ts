/**
 * Normalizes an Indian phone number to E.164 format (+91XXXXXXXXXX).
 *
 * Accepted inputs:
 * - 10 digits: "9876543210"
 * - With +91: "+919876543210"
 * - With 91: "919876543210"
 * - With 0: "09876543210"
 * - With spaces/dashes: "98765 43210", "98765-43210"
 *
 * Throws Error for invalid input.
 */
export function normalizePhone(input: string): string {
	const digits = input.replace(/\D/g, "");

	let phone: string;

	if (digits.length === 10) {
		phone = digits;
	} else if (digits.length === 11 && digits.startsWith("0")) {
		phone = digits.slice(1);
	} else if (digits.length === 12 && digits.startsWith("91")) {
		phone = digits.slice(2);
	} else {
		throw new Error(`Invalid Indian phone number: "${input}"`);
	}

	const firstDigit = phone[0];
	if (!firstDigit || !"6789".includes(firstDigit)) {
		throw new Error(
			`Invalid Indian mobile number: must start with 6-9, got "${input}"`,
		);
	}

	return `+91${phone}`;
}

/**
 * Checks if a string could be a valid Indian phone number without throwing.
 */
export function isValidIndianPhone(input: string): boolean {
	try {
		normalizePhone(input);
		return true;
	} catch {
		return false;
	}
}
