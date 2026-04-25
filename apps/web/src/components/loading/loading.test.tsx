import { cleanup, render, screen } from "@testing-library/react";
import type React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CardSkeleton } from "./card-skeleton";
import { FormSkeleton } from "./form-skeleton";
import { FullPageSpinner } from "./full-page-spinner";
import { PageSkeleton } from "./page-skeleton";
import { RouteLoading } from "./route-loading";
import { TableSkeleton } from "./table-skeleton";

vi.mock("@repo/ui/components/ui/skeleton", () => ({
	Skeleton: (props: React.ComponentProps<"div">) => (
		<div data-testid="skeleton" {...props} />
	),
}));

vi.mock("@repo/ui/components/ui/spinner", () => ({
	Spinner: (props: React.ComponentProps<"svg">) => (
		<svg data-testid="spinner" role="status" aria-label="Loading" {...props} />
	),
}));

vi.mock("@repo/ui/lib/utils", () => ({
	cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

afterEach(() => {
	cleanup();
});

describe("RouteLoading", () => {
	it("renders with correct aria-label", () => {
		render(<RouteLoading />);
		const progressbar = screen.getByRole("progressbar");
		expect(progressbar).toBeTruthy();
		expect(progressbar.getAttribute("aria-label")).toBe("Loading page");
	});
});

describe("FullPageSpinner", () => {
	it("renders spinner", () => {
		render(<FullPageSpinner />);
		const spinner = screen.getByTestId("spinner");
		expect(spinner).toBeTruthy();
	});

	it("renders custom label text as sr-only", () => {
		render(<FullPageSpinner label="Loading your dashboard" />);
		const label = screen.getByText("Loading your dashboard");
		expect(label).toBeTruthy();
		expect(label.className).toContain("sr-only");
	});

	it("does not render label when not provided", () => {
		const { container } = render(<FullPageSpinner />);
		const srOnly = container.querySelector(".sr-only");
		expect(srOnly).toBeNull();
	});
});

describe("PageSkeleton", () => {
	it("renders default variant with title and content blocks", () => {
		const { container } = render(<PageSkeleton />);
		expect(container.querySelector("[aria-hidden='true']")).toBeTruthy();
		const skeletons = screen.getAllByTestId("skeleton");
		// default: 1 title (h-8 w-1/3) + 3 content blocks (h-4) = 4
		expect(skeletons.length).toBe(4);
	});

	it("renders detail variant with image, title, and two-column body", () => {
		const { container } = render(<PageSkeleton variant="detail" />);
		expect(container.querySelector("[aria-hidden='true']")).toBeTruthy();
		const skeletons = screen.getAllByTestId("skeleton");
		// detail: 1 image + 1 title + 6 body blocks = 8
		expect(skeletons.length).toBe(8);
	});

	it("renders dashboard variant with stat cards and content area", () => {
		const { container } = render(<PageSkeleton variant="dashboard" />);
		expect(container.querySelector("[aria-hidden='true']")).toBeTruthy();
		const skeletons = screen.getAllByTestId("skeleton");
		// dashboard: 3 stat cards + 1 content area = 4
		expect(skeletons.length).toBe(4);
	});
});

describe("CardSkeleton", () => {
	it("renders default 3 cards", () => {
		const { container } = render(<CardSkeleton />);
		expect(container.querySelector("[aria-hidden='true']")).toBeTruthy();
		// Each card has 6 skeletons: image, category, title, subtitle, price, date
		const skeletons = screen.getAllByTestId("skeleton");
		expect(skeletons.length).toBe(18);
	});

	it("renders custom count of cards", () => {
		render(<CardSkeleton count={5} />);
		const skeletons = screen.getAllByTestId("skeleton");
		// 5 cards × 6 skeletons each = 30
		expect(skeletons.length).toBe(30);
	});

	it("renders 1 card when count is 1", () => {
		render(<CardSkeleton count={1} />);
		const skeletons = screen.getAllByTestId("skeleton");
		expect(skeletons.length).toBe(6);
	});
});

describe("TableSkeleton", () => {
	it("renders default 5 rows and 4 columns", () => {
		const { container } = render(<TableSkeleton />);
		expect(container.querySelector("[aria-hidden='true']")).toBeTruthy();
		const skeletons = screen.getAllByTestId("skeleton");
		// 1 header row (4 cols) + 5 body rows (4 cols each) = 4 + 20 = 24
		expect(skeletons.length).toBe(24);
	});

	it("renders custom rows and columns", () => {
		render(<TableSkeleton rows={3} columns={2} />);
		const skeletons = screen.getAllByTestId("skeleton");
		// 1 header row (2 cols) + 3 body rows (2 cols each) = 2 + 6 = 8
		expect(skeletons.length).toBe(8);
	});
});

describe("FormSkeleton", () => {
	it("renders default 4 fields plus button", () => {
		const { container } = render(<FormSkeleton />);
		expect(container.querySelector("[aria-hidden='true']")).toBeTruthy();
		const skeletons = screen.getAllByTestId("skeleton");
		// 4 fields × 2 (label + input) + 1 button = 9
		expect(skeletons.length).toBe(9);
	});

	it("renders custom number of fields", () => {
		render(<FormSkeleton fields={2} />);
		const skeletons = screen.getAllByTestId("skeleton");
		// 2 fields × 2 (label + input) + 1 button = 5
		expect(skeletons.length).toBe(5);
	});
});
