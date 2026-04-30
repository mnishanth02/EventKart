import { organizerPublicProfileSchema } from "@repo/shared/schemas";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { OrganizerPublicProfile } from "../types";
import { PublicOrganizerProfile } from "./PublicOrganizerProfile";

const baseInput = {
	slug: "race-coimbatore",
	businessName: "Race Coimbatore Collective",
	isVerified: true,
	city: "Coimbatore",
	description:
		"Race Coimbatore Collective produces the city's flagship endurance events.",
} as const;

function buildFixture(
	overrides: Partial<OrganizerPublicProfile> = {},
): OrganizerPublicProfile {
	return organizerPublicProfileSchema.parse({ ...baseInput, ...overrides });
}

afterEach(() => {
	cleanup();
});

describe("PublicOrganizerProfile", () => {
	it("renders the business name, city, and description", () => {
		render(<PublicOrganizerProfile profile={buildFixture()} />);

		expect(screen.getByText("Race Coimbatore Collective")).toBeTruthy();
		expect(screen.getByText("Based in Coimbatore")).toBeTruthy();
		expect(
			screen.getByText(
				/Race Coimbatore Collective produces the city's flagship endurance events\./,
			),
		).toBeTruthy();
	});

	it("shows the verified badge when isVerified is true", () => {
		render(
			<PublicOrganizerProfile profile={buildFixture({ isVerified: true })} />,
		);

		expect(screen.getByLabelText("Verified organizer")).toBeTruthy();
	});

	it("hides the verified badge when isVerified is false", () => {
		render(
			<PublicOrganizerProfile profile={buildFixture({ isVerified: false })} />,
		);

		expect(screen.queryByLabelText("Verified organizer")).toBeNull();
	});

	it("renders a placeholder when description is null", () => {
		render(
			<PublicOrganizerProfile profile={buildFixture({ description: null })} />,
		);

		expect(
			screen.getByText("This organizer hasn’t added a description yet."),
		).toBeTruthy();
	});

	it("uses whitespace-pre-line so multi-line descriptions render with line breaks", () => {
		const description = "Line one.\nLine two.\nLine three.";
		const { container } = render(
			<PublicOrganizerProfile profile={buildFixture({ description })} />,
		);

		const paragraph = container.querySelector("p.whitespace-pre-line");
		expect(paragraph).not.toBeNull();
		expect(paragraph?.textContent).toBe(description);
	});

	it("renders a long description verbatim (no truncation in the component)", () => {
		const description = `${"x".repeat(1500)} tail`;
		render(<PublicOrganizerProfile profile={buildFixture({ description })} />);

		const node = screen.getByText(
			(_, el) => el?.textContent?.startsWith("xxxx") ?? false,
		);
		expect(node.textContent).toContain("tail");
		expect(node.textContent?.length).toBeGreaterThan(1000);
	});

	it("never renders raw HTML from the description (no dangerouslySetInnerHTML)", () => {
		const description = "<script>alert('xss')</script><b>bold</b>";
		const { container } = render(
			<PublicOrganizerProfile profile={buildFixture({ description })} />,
		);

		expect(container.querySelector("script")).toBeNull();
		expect(container.querySelector("b")).toBeNull();
		expect(container.textContent).toContain(
			"<script>alert('xss')</script><b>bold</b>",
		);
	});
});
