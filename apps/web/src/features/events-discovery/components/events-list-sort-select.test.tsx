import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { EventsListSortSelect } from "./events-list-sort-select";

beforeAll(() => {
	Element.prototype.hasPointerCapture ??= vi.fn(() => false);
	Element.prototype.setPointerCapture ??= vi.fn();
	Element.prototype.releasePointerCapture ??= vi.fn();
	HTMLElement.prototype.scrollIntoView ??= vi.fn();
});

afterEach(() => {
	cleanup();
});

describe("EventsListSortSelect", () => {
	it("renders both sort options and exposes an accessible combobox label", async () => {
		const user = userEvent.setup();

		render(<EventsListSortSelect value="startAtAsc" onChange={vi.fn()} />);

		const trigger = screen.getByRole("combobox", { name: "Sort events by" });
		expect(trigger).toBeTruthy();
		expect(screen.getByText("Upcoming first")).toBeTruthy();

		await user.click(trigger);

		expect(
			await screen.findByRole("option", { name: "Upcoming first" }),
		).toBeTruthy();
		expect(screen.getByRole("option", { name: "Latest first" })).toBeTruthy();
	});

	it("calls onChange with the selected sort value", async () => {
		const user = userEvent.setup();
		const onChange = vi.fn();

		render(<EventsListSortSelect value="startAtAsc" onChange={onChange} />);

		await user.click(screen.getByRole("combobox", { name: "Sort events by" }));
		await user.click(
			await screen.findByRole("option", { name: "Latest first" }),
		);

		expect(onChange).toHaveBeenCalledWith("startAtDesc");
	});
});
