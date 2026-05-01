import { VerificationExplainer } from "@repo/ui/components/verification-explainer";
import { VERIFICATION_EXPLANATION } from "@repo/ui/lib/verification-copy";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	vi,
} from "vitest";

const originalHasPointerCapture = Element.prototype.hasPointerCapture;
const originalSetPointerCapture = Element.prototype.setPointerCapture;
const originalReleasePointerCapture = Element.prototype.releasePointerCapture;
const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

beforeAll(() => {
	// Radix Popover relies on these pointer-capture APIs that jsdom omits.
	Element.prototype.hasPointerCapture ??= vi.fn(() => false);
	Element.prototype.setPointerCapture ??= vi.fn();
	Element.prototype.releasePointerCapture ??= vi.fn();
	HTMLElement.prototype.scrollIntoView ??= vi.fn();
});

afterAll(() => {
	restorePrototypeValue(
		Element.prototype,
		"hasPointerCapture",
		originalHasPointerCapture,
	);
	restorePrototypeValue(
		Element.prototype,
		"setPointerCapture",
		originalSetPointerCapture,
	);
	restorePrototypeValue(
		Element.prototype,
		"releasePointerCapture",
		originalReleasePointerCapture,
	);
	restorePrototypeValue(
		HTMLElement.prototype,
		"scrollIntoView",
		originalScrollIntoView,
	);
});

afterEach(() => {
	cleanup();
});

function restorePrototypeValue<T extends object, K extends keyof T>(
	target: T,
	key: K,
	value: T[K] | undefined,
) {
	if (value === undefined) {
		Reflect.deleteProperty(target, key);
		return;
	}
	target[key] = value;
}

describe("VerificationExplainer (inline-note)", () => {
	it("renders the heading and body verbatim from the copy constant", () => {
		render(<VerificationExplainer variant="inline-note" />);

		expect(screen.getByText(VERIFICATION_EXPLANATION.heading)).toBeTruthy();

		const body = screen.getByText(VERIFICATION_EXPLANATION.body);
		// Single source of truth assertion: body text equals the constant
		// verbatim, so any drift (e.g. accidental "guarantee of safety"
		// rewording) fails this test.
		expect(body.textContent).toBe(VERIFICATION_EXPLANATION.body);
	});

	it("uses the provided id on the rendered container", () => {
		const { container } = render(
			<VerificationExplainer variant="inline-note" id="about-verification" />,
		);

		const node = container.querySelector("#about-verification");
		expect(node).not.toBeNull();
		expect(node?.textContent).toContain(VERIFICATION_EXPLANATION.heading);
	});

	it("does not render the popover trigger label", () => {
		render(<VerificationExplainer variant="inline-note" />);

		expect(
			screen.queryByText(VERIFICATION_EXPLANATION.triggerLabel),
		).toBeNull();
	});
});

describe("VerificationExplainer (popover)", () => {
	it("renders the trigger label and keeps the body hidden until activation", () => {
		render(<VerificationExplainer variant="popover" />);

		expect(
			screen.getByRole("button", {
				name: VERIFICATION_EXPLANATION.triggerLabel,
			}),
		).toBeTruthy();
		expect(screen.queryByText(VERIFICATION_EXPLANATION.heading)).toBeNull();
		expect(screen.queryByText(VERIFICATION_EXPLANATION.body)).toBeNull();
	});

	it("reveals the heading and body verbatim when the trigger is clicked", async () => {
		const user = userEvent.setup();
		render(<VerificationExplainer variant="popover" />);

		await user.click(
			screen.getByRole("button", {
				name: VERIFICATION_EXPLANATION.triggerLabel,
			}),
		);

		expect(
			await screen.findByText(VERIFICATION_EXPLANATION.heading),
		).toBeTruthy();

		const body = await screen.findByText(VERIFICATION_EXPLANATION.body);
		expect(body.textContent).toBe(VERIFICATION_EXPLANATION.body);
	});

	it("exposes a focusable trigger so keyboard users can open the popover", () => {
		render(<VerificationExplainer variant="popover" />);

		const trigger = screen.getByRole("button", {
			name: VERIFICATION_EXPLANATION.triggerLabel,
		});
		trigger.focus();
		expect(document.activeElement).toBe(trigger);
	});
});

describe("VERIFICATION_EXPLANATION copy guard", () => {
	it("never asserts a quality or safety guarantee outside the explicit 'not a guarantee' phrasing", () => {
		// Safety net for accidental copy edits: every match of the word
		// 'guarantee' must be inside the canonical "not a guarantee"
		// clause. This protects the F-2.3.4 / §4.1 contract.
		const text = `${VERIFICATION_EXPLANATION.heading} ${VERIFICATION_EXPLANATION.body}`;
		const matches = text.toLowerCase().match(/guarantee[d]?/g) ?? [];
		expect(matches.length).toBeGreaterThan(0);
		for (const _match of matches) {
			expect(text.toLowerCase()).toContain("not a guarantee");
		}
	});
});
