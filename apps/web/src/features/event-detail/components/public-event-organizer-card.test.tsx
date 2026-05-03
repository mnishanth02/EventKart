import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { VERIFICATION_EXPLANATION } from "@repo/ui/lib/verification-copy";
import type { EventPublicOrganizerSummary } from "../types";
import { PublicEventOrganizerCard } from "./public-event-organizer-card";

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		to,
		params,
		...rest
	}: {
		children: ReactNode;
		to: string;
		params?: Record<string, string>;
	} & Record<string, unknown>) => {
		let href = to;
		if (params) {
			for (const [key, value] of Object.entries(params)) {
				href = href.replace(`$${key}`, String(value));
			}
		}
		return (
			<a href={href} {...rest}>
				{children}
			</a>
		);
	},
}));

beforeAll(() => {
	// Radix Popover relies on these pointer-capture APIs that jsdom omits.
	Element.prototype.hasPointerCapture ??= vi.fn(() => false);
	Element.prototype.setPointerCapture ??= vi.fn();
	Element.prototype.releasePointerCapture ??= vi.fn();
	HTMLElement.prototype.scrollIntoView ??= vi.fn();
});

afterEach(() => {
	cleanup();
});

function buildOrganizer(
	overrides: Partial<EventPublicOrganizerSummary> = {},
): EventPublicOrganizerSummary {
	return {
		slug: "acme-events",
		businessName: "Acme Events Inc",
		isVerified: true,
		city: "Chennai",
		description: "We organize great events.",
		...overrides,
	} as EventPublicOrganizerSummary;
}

describe("PublicEventOrganizerCard — isActive handling", () => {
	it("renders profile link when isActive is true", () => {
		render(
			<PublicEventOrganizerCard
				organizer={buildOrganizer({ isActive: true })}
			/>,
		);

		const link = screen.getByRole("link", {
			name: /View profile of Acme Events Inc/i,
		});
		expect(link.getAttribute("href")).toBe("/organizers/acme-events");
	});

	it("renders profile link when isActive is omitted (backward compat)", () => {
		const org = buildOrganizer();
		// Ensure isActive is not present at all
		delete (org as Record<string, unknown>).isActive;

		render(<PublicEventOrganizerCard organizer={org} />);

		const link = screen.getByRole("link", {
			name: /View profile of Acme Events Inc/i,
		});
		expect(link.getAttribute("href")).toBe("/organizers/acme-events");
	});

	it("shows inactive notice when isActive is false", () => {
		render(
			<PublicEventOrganizerCard
				organizer={buildOrganizer({ isActive: false })}
			/>,
		);

		expect(
			screen.getByText("This organizer is no longer active on EventKart."),
		).toBeTruthy();
	});

	it("does NOT render profile link when isActive is false", () => {
		render(
			<PublicEventOrganizerCard
				organizer={buildOrganizer({ isActive: false })}
			/>,
		);

		expect(
			screen.queryByRole("link", {
				name: /View profile of Acme Events Inc/i,
			}),
		).toBeNull();
	});

	it("does NOT render VerificationExplainer when isActive is false (even if verified)", () => {
		render(
			<PublicEventOrganizerCard
				organizer={buildOrganizer({ isActive: false, isVerified: true })}
			/>,
		);

		expect(
			screen.queryByRole("button", {
				name: VERIFICATION_EXPLANATION.triggerLabel,
			}),
		).toBeNull();
		expect(screen.queryByLabelText("Verified organizer")).toBeNull();
	});

	it("renders VerificationExplainer when isActive is true and verified", () => {
		render(
			<PublicEventOrganizerCard
				organizer={buildOrganizer({ isActive: true, isVerified: true })}
			/>,
		);

		expect(
			screen.getByRole("button", {
				name: VERIFICATION_EXPLANATION.triggerLabel,
			}),
		).toBeTruthy();
	});

	it("hides VerificationExplainer when isActive is true but unverified", () => {
		render(
			<PublicEventOrganizerCard
				organizer={buildOrganizer({ isActive: true, isVerified: false })}
			/>,
		);

		expect(
			screen.queryByRole("button", {
				name: VERIFICATION_EXPLANATION.triggerLabel,
			}),
		).toBeNull();
	});

	it("renders the organizer business name regardless of isActive", () => {
		const { rerender } = render(
			<PublicEventOrganizerCard
				organizer={buildOrganizer({ isActive: true })}
			/>,
		);
		expect(screen.getByText("Acme Events Inc")).toBeTruthy();

		rerender(
			<PublicEventOrganizerCard
				organizer={buildOrganizer({ isActive: false })}
			/>,
		);
		expect(screen.getByText("Acme Events Inc")).toBeTruthy();
	});

	it("does not show inactive notice when isActive is true", () => {
		render(
			<PublicEventOrganizerCard
				organizer={buildOrganizer({ isActive: true })}
			/>,
		);

		expect(
			screen.queryByText(
				"This organizer is no longer active on EventKart.",
			),
		).toBeNull();
	});
});
