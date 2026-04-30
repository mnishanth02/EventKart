import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventsListPagination } from "./events-list-pagination";

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		to,
		search,
		...rest
	}: {
		children: ReactNode;
		to: string;
		search: (prev: Record<string, unknown>) => Record<string, unknown>;
	} & Record<string, unknown>) => (
		<a
			href={to}
			data-search={JSON.stringify(search({ keep: "yes" }))}
			{...rest}
		>
			{children}
		</a>
	),
}));

afterEach(() => {
	cleanup();
});

const meta = {
	page: 1,
	limit: 20,
	total: 60,
	totalPages: 3,
	hasNext: true,
	hasPrev: false,
};

function buildPageHref(page: number) {
	return {
		to: "/",
		search: (prev: Record<string, unknown>) => ({ ...prev, page }),
	};
}

describe("EventsListPagination", () => {
	it("renders nothing when there is only one page", () => {
		const { container } = render(
			<EventsListPagination
				meta={{ ...meta, total: 20, totalPages: 1, hasNext: false }}
				buildPageHref={buildPageHref}
			/>,
		);

		expect(container.firstChild).toBeNull();
	});

	it("renders prev/next controls and page numbers", () => {
		render(<EventsListPagination meta={meta} buildPageHref={buildPageHref} />);

		expect(
			screen
				.getByLabelText("Go to previous page")
				.getAttribute("aria-disabled"),
		).toBe("true");
		expect(screen.getByLabelText("Go to next page")).toBeTruthy();
		expect(screen.getByRole("link", { name: "1" })).toBeTruthy();
		expect(screen.getByRole("link", { name: "2" })).toBeTruthy();
		expect(screen.getByRole("link", { name: "3" })).toBeTruthy();
	});

	it("marks the active page with aria-current", () => {
		render(
			<EventsListPagination
				meta={{ ...meta, page: 2, hasPrev: true }}
				buildPageHref={buildPageHref}
			/>,
		);

		const active = screen.getByRole("link", { name: "2" });
		expect(active.getAttribute("aria-current")).toBe("page");
		expect(active.getAttribute("data-active")).toBe("true");
	});

	it("disables next on the last page", () => {
		render(
			<EventsListPagination
				meta={{ ...meta, page: 3, hasNext: false, hasPrev: true }}
				buildPageHref={buildPageHref}
			/>,
		);

		expect(
			screen.getByLabelText("Go to next page").getAttribute("aria-disabled"),
		).toBe("true");
	});

	it("renders page links from buildPageHref", async () => {
		const user = userEvent.setup();
		const hrefBuilder = vi.fn(buildPageHref);

		render(
			<EventsListPagination
				meta={{ ...meta, page: 2, hasPrev: true }}
				buildPageHref={hrefBuilder}
			/>,
		);

		const pageThree = screen.getByRole("link", { name: "3" });
		await user.click(pageThree);

		expect(hrefBuilder).toHaveBeenCalledWith(3);
		expect(pageThree.getAttribute("href")).toBe("/");
		expect(pageThree.getAttribute("data-search")).toBe(
			JSON.stringify({ keep: "yes", page: 3 }),
		);
	});
});
