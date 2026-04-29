import { eventPublicOrganizerSummarySchema } from "@repo/shared/schemas";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { EventPublicOrganizerSummary } from "../types";
import { PublicEventPolicySection } from "./public-event-policy-section";

afterEach(() => {
	cleanup();
});

const baseOrganizer: EventPublicOrganizerSummary =
	eventPublicOrganizerSummarySchema.parse({
		slug: "race-coimbatore",
		businessName: "Race Coimbatore Collective",
		isVerified: true,
		city: "Coimbatore",
		description: null,
	});

const REFUND = "Refunds are available until 14 days before race day.";
const CANCEL =
	"If the race is cancelled, all registered runners receive a transfer option.";

describe("PublicEventPolicySection", () => {
	it("renders both policies as stacked subsections with per-policy anchors", () => {
		const { container } = render(
			<PublicEventPolicySection
				refundPolicy={REFUND}
				cancellationPolicy={CANCEL}
				organizer={baseOrganizer}
			/>,
		);

		const wrapper = container.querySelector("section#policies");
		expect(wrapper).not.toBeNull();
		expect(wrapper?.getAttribute("aria-labelledby")).toBe("policies-heading");

		const heading = screen.getByRole("heading", {
			level: 2,
			name: "Before you book",
		});
		expect(heading.id).toBe("policies-heading");

		const refundSection = container.querySelector("section#refund-policy");
		expect(refundSection).not.toBeNull();
		expect(
			within(refundSection as HTMLElement).getByRole("heading", {
				level: 3,
				name: "Refund policy",
			}),
		).toBeTruthy();
		expect(refundSection?.textContent).toContain(REFUND);

		const cancelSection = container.querySelector(
			"section#cancellation-policy",
		);
		expect(cancelSection).not.toBeNull();
		expect(
			within(cancelSection as HTMLElement).getByRole("heading", {
				level: 3,
				name: "Cancellation policy",
			}),
		).toBeTruthy();
		expect(cancelSection?.textContent).toContain(CANCEL);
	});

	it("includes the organizer business name in the trust description", () => {
		render(
			<PublicEventPolicySection
				refundPolicy={REFUND}
				cancellationPolicy={CANCEL}
				organizer={baseOrganizer}
			/>,
		);

		expect(
			screen.getByText(
				/Review Race Coimbatore Collective's refund and cancellation terms before booking\./,
			),
		).toBeTruthy();
	});

	it("renders only the refund subsection when cancellation policy is null", () => {
		const { container } = render(
			<PublicEventPolicySection
				refundPolicy={REFUND}
				cancellationPolicy={null}
				organizer={baseOrganizer}
			/>,
		);

		expect(container.querySelector("section#refund-policy")).not.toBeNull();
		expect(container.querySelector("section#cancellation-policy")).toBeNull();
		expect(
			screen.queryByRole("heading", {
				level: 3,
				name: "Cancellation policy",
			}),
		).toBeNull();
		expect(screen.getByText(REFUND)).toBeTruthy();
	});

	it("renders only the cancellation subsection when refund policy is null", () => {
		const { container } = render(
			<PublicEventPolicySection
				refundPolicy={null}
				cancellationPolicy={CANCEL}
				organizer={baseOrganizer}
			/>,
		);

		expect(
			container.querySelector("section#cancellation-policy"),
		).not.toBeNull();
		expect(container.querySelector("section#refund-policy")).toBeNull();
		expect(
			screen.queryByRole("heading", {
				level: 3,
				name: "Refund policy",
			}),
		).toBeNull();
		expect(screen.getByText(CANCEL)).toBeTruthy();
	});

	it("renders an explicit fallback card when both policies are null", () => {
		const { container } = render(
			<PublicEventPolicySection
				refundPolicy={null}
				cancellationPolicy={null}
				organizer={baseOrganizer}
			/>,
		);

		expect(container.querySelector("section#policies")).not.toBeNull();
		expect(container.querySelector("section#refund-policy")).toBeNull();
		expect(container.querySelector("section#cancellation-policy")).toBeNull();
		expect(
			screen.queryByRole("heading", { level: 3, name: "Refund policy" }),
		).toBeNull();
		expect(
			screen.queryByRole("heading", { level: 3, name: "Cancellation policy" }),
		).toBeNull();
		expect(
			screen.getByText(
				"Race Coimbatore Collective has not published refund or cancellation policies for this event.",
			),
		).toBeTruthy();
	});

	it("normalizes empty-string policy values as missing", () => {
		const { container } = render(
			<PublicEventPolicySection
				refundPolicy=""
				cancellationPolicy=""
				organizer={baseOrganizer}
			/>,
		);

		expect(container.querySelector("section#refund-policy")).toBeNull();
		expect(container.querySelector("section#cancellation-policy")).toBeNull();
		expect(
			screen.getByText(
				"Race Coimbatore Collective has not published refund or cancellation policies for this event.",
			),
		).toBeTruthy();
	});

	it("renders policy text as escaped React text nodes (no HTML injection)", () => {
		const xssPayload = "Trusted <script>alert(1)</script> & <b>fast</b> refunds";
		const { container } = render(
			<PublicEventPolicySection
				refundPolicy={xssPayload}
				cancellationPolicy={CANCEL}
				organizer={baseOrganizer}
			/>,
		);

		expect(container.querySelectorAll("script")).toHaveLength(0);
		expect(container.querySelectorAll("b")).toHaveLength(0);
		expect(screen.getByText(xssPayload)).toBeTruthy();
	});

	it("preserves multi-line policy text via whitespace-pre-line", () => {
		const multiline = "Line 1\nLine 2\nLine 3";
		const { container } = render(
			<PublicEventPolicySection
				refundPolicy={multiline}
				cancellationPolicy={CANCEL}
				organizer={baseOrganizer}
			/>,
		);

		const refundSection = container.querySelector("section#refund-policy");
		const paragraph = refundSection?.querySelector("p");
		expect(paragraph).not.toBeNull();
		expect(paragraph?.className).toContain("whitespace-pre-line");
		expect(paragraph?.textContent).toBe(multiline);
	});
});
