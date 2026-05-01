import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		to,
		...rest
	}: {
		children: ReactNode;
		to: string;
	} & Record<string, unknown>) => (
		<a href={to} {...rest}>
			{children}
		</a>
	),
}));

import { PublicFooter } from "./public-footer";

afterEach(() => {
	cleanup();
});

describe("PublicFooter", () => {
	it("renders the brand link pointing to '/'", () => {
		render(<PublicFooter />);
		const brand = screen.getByRole("link", { name: /^eventkart$/i });
		expect(brand.getAttribute("href")).toBe("/");
	});

	it.each([
		["About", "/about"],
		["FAQ", "/faq"],
		["Contact", "/contact"],
		["Privacy", "/privacy"],
		["Terms", "/terms"],
	])("renders the %s link pointing to %s", (label, href) => {
		render(<PublicFooter />);
		const link = screen.getByRole("link", {
			name: new RegExp(`^${label}$`, "i"),
		});
		expect(link.getAttribute("href")).toBe(href);
	});

	it("renders the three column headings: Discover, Company, Legal", () => {
		render(<PublicFooter />);
		expect(
			screen.getByRole("heading", { level: 2, name: /discover/i }),
		).toBeDefined();
		expect(
			screen.getByRole("heading", { level: 2, name: /company/i }),
		).toBeDefined();
		expect(
			screen.getByRole("heading", { level: 2, name: /legal/i }),
		).toBeDefined();
	});

	it("renders at least three labelled <nav> regions", () => {
		render(<PublicFooter />);
		const navs = screen.getAllByRole("navigation");
		expect(navs.length).toBeGreaterThanOrEqual(3);
	});

	it("renders a mailto: link using SUPPORT_EMAIL (support@eventkart.run)", () => {
		const { container } = render(<PublicFooter />);
		const mailto = container.querySelector(
			'a[href="mailto:support@eventkart.run"]',
		);
		expect(mailto).not.toBeNull();
	});

	it("renders the copyright with the current year", () => {
		render(<PublicFooter />);
		const year = new Date().getFullYear();
		expect(
			screen.getByText(
				new RegExp(`©\\s*${year}\\s*EventKart\\. All rights reserved\\.`, "i"),
			),
		).toBeDefined();
	});
});
