import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LegalPageLayout } from "./legal-page-layout";

afterEach(() => {
	cleanup();
});

describe("LegalPageLayout", () => {
	it("renders the title as an <h1>", () => {
		render(
			<LegalPageLayout title="Privacy Policy">
				<p>body</p>
			</LegalPageLayout>,
		);
		const heading = screen.getByRole("heading", {
			level: 1,
			name: "Privacy Policy",
		});
		expect(heading).toBeDefined();
	});

	it("renders the children inside the layout", () => {
		render(
			<LegalPageLayout title="Terms">
				<p>distinctive-body-text</p>
			</LegalPageLayout>,
		);
		expect(screen.getByText("distinctive-body-text")).toBeDefined();
	});

	it("renders an <article> root with the max-w-3xl container utility", () => {
		const { container } = render(
			<LegalPageLayout title="About">
				<p>body</p>
			</LegalPageLayout>,
		);
		const article = container.querySelector("article");
		expect(article).not.toBeNull();
		expect(article?.className).toContain("max-w-3xl");
	});

	it("omits the version line when neither version nor effectiveDate is provided", () => {
		render(
			<LegalPageLayout title="FAQ">
				<p>body</p>
			</LegalPageLayout>,
		);
		expect(screen.queryByText(/Version /)).toBeNull();
		expect(screen.queryByText(/Last updated /)).toBeNull();
	});

	it("omits the version line when only one of version/effectiveDate is provided", () => {
		const onlyVersion = render(
			<LegalPageLayout title="FAQ" version="1.0.0">
				<p>body</p>
			</LegalPageLayout>,
		);
		expect(onlyVersion.queryByText(/Version /)).toBeNull();
		cleanup();

		render(
			<LegalPageLayout title="FAQ" effectiveDate="2026-01-15">
				<p>body</p>
			</LegalPageLayout>,
		);
		expect(screen.queryByText(/Last updated /)).toBeNull();
	});

	it("renders the version + effective-date line when both are provided", () => {
		render(
			<LegalPageLayout
				title="Privacy Policy"
				version="1.0.0"
				effectiveDate="2026-01-15"
			>
				<p>body</p>
			</LegalPageLayout>,
		);
		const meta = screen.getByText(/Version 1\.0\.0.*Last updated 2026-01-15/);
		expect(meta).toBeDefined();
	});
});
