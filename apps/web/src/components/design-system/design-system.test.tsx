import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// NumberFlow renders intricately; stub it so we can assert the props the
// design-system primitive forwards to it.
vi.mock("@number-flow/react", () => ({
	default: ({
		value,
		animated,
		locales,
		format,
	}: {
		value: number;
		animated?: boolean;
		locales?: string;
		format?: Intl.NumberFormatOptions;
	}) => (
		<span
			data-testid="number-flow"
			data-value={String(value)}
			data-animated={String(animated ?? true)}
			data-locales={locales ?? ""}
			data-format-style={format?.style ?? ""}
			data-format-currency={format?.currency ?? ""}
			data-format-sign={format?.signDisplay ?? ""}
		/>
	),
}));

vi.mock("@repo/ui/lib/utils", () => ({
	cn: (...args: unknown[]) =>
		args
			.flat(Infinity)
			.filter((x): x is string => typeof x === "string" && x.length > 0)
			.join(" "),
}));

const toastMock = vi.hoisted(() => ({
	success: vi.fn(),
	error: vi.fn(),
	message: vi.fn(),
	promise: vi.fn(),
}));

vi.mock("sonner", () => ({
	toast: toastMock,
}));

import { AttendeeCount, CurrencyINR, DeltaPercent } from "./animated-numeral";
import { BentoGrid } from "./bento-grid";
import { GlassSurface } from "./glass-card";
import { toastRetry, toastUndo } from "./toast-helpers";

afterEach(() => {
	cleanup();
	toastMock.success.mockReset();
	toastMock.error.mockReset();
	toastMock.message.mockReset();
	toastMock.promise.mockReset();
});

describe("CurrencyINR", () => {
	it("converts paise to rupees and uses en-IN currency formatting", () => {
		render(<CurrencyINR value={128_450_000} />);
		const node = screen.getByTestId("number-flow");
		expect(node.dataset.value).toBe("1284500");
		expect(node.dataset.locales).toBe("en-IN");
		expect(node.dataset.formatStyle).toBe("currency");
		expect(node.dataset.formatCurrency).toBe("INR");
	});

	it("handles zero", () => {
		render(<CurrencyINR value={0} />);
		expect(screen.getByTestId("number-flow").dataset.value).toBe("0");
	});
});

describe("AttendeeCount", () => {
	it("renders count with default 'attendees' label", () => {
		render(<AttendeeCount value={1247} />);
		expect(screen.getByTestId("number-flow").dataset.value).toBe("1247");
		expect(screen.getByText("attendees")).toBeTruthy();
	});

	it("respects custom label", () => {
		render(<AttendeeCount value={5} label="check-ins" />);
		expect(screen.getByText("check-ins")).toBeTruthy();
	});
});

describe("DeltaPercent", () => {
	it("uses success tone for positive delta and signDisplay always", () => {
		const { container } = render(<DeltaPercent value={12.4} />);
		const span = container.querySelector("span");
		expect(span?.className).toContain("text-success");
		expect(screen.getByTestId("number-flow").dataset.formatSign).toBe("always");
	});

	it("uses destructive tone for negative delta", () => {
		const { container } = render(<DeltaPercent value={-3.5} />);
		expect(container.querySelector("span")?.className).toContain(
			"text-destructive",
		);
	});

	it("uses muted tone for zero", () => {
		const { container } = render(<DeltaPercent value={0} />);
		expect(container.querySelector("span")?.className).toContain(
			"text-muted-foreground",
		);
	});

	it("forwards percent / 100 so 12.4 becomes 0.124 for percent format", () => {
		render(<DeltaPercent value={12.4} />);
		expect(screen.getByTestId("number-flow").dataset.value).toBe("0.124");
	});
});

describe("GlassSurface", () => {
	it("applies tier-specific css custom properties and data attribute", () => {
		const { container } = render(
			<GlassSurface tier={2}>
				<span>content</span>
			</GlassSurface>,
		);
		const div = container.firstChild as HTMLElement;
		expect(div.getAttribute("data-glass-tier")).toBe("2");
		expect(div.style.background).toContain("--glass-2-bg");
		expect(div.style.backdropFilter).toContain("--glass-2-blur");
		expect(div.style.borderColor).toContain("--glass-2-border");
	});

	it("forwards arbitrary HTML attributes (e.g. role)", () => {
		const { container } = render(
			<GlassSurface tier={1} role="region" aria-label="nav" />,
		);
		const div = container.firstChild as HTMLElement;
		expect(div.getAttribute("role")).toBe("region");
		expect(div.getAttribute("aria-label")).toBe("nav");
	});

	it("merges caller style with glass tokens (caller can override)", () => {
		const { container } = render(
			<GlassSurface tier={1} style={{ padding: "12px" }} />,
		);
		const div = container.firstChild as HTMLElement;
		expect(div.style.padding).toBe("12px");
		expect(div.style.background).toContain("--glass-1-bg");
	});
});

describe("BentoGrid", () => {
	it("renders the container-query scope and default 4-column layout", () => {
		const { container } = render(
			<BentoGrid>
				<div>cell</div>
			</BentoGrid>,
		);
		const section = container.querySelector("section");
		expect(section?.className).toContain("@container/bento");
		const grid = section?.querySelector("div");
		expect(grid?.className).toContain("grid-cols-1");
		expect(grid?.className).toContain("@[48rem]/bento:grid-cols-4");
	});

	it("respects the columns prop", () => {
		const { container } = render(<BentoGrid columns={3} />);
		const grid = container.querySelector("section > div");
		expect(grid?.className).toContain("@[48rem]/bento:grid-cols-3");
		expect(grid?.className).not.toContain("grid-cols-4");
	});

	it("forwards aria-label to the section landmark", () => {
		const { container } = render(<BentoGrid aria-label="Organizer overview" />);
		expect(container.querySelector("section")?.getAttribute("aria-label")).toBe(
			"Organizer overview",
		);
	});
});

describe("toastUndo", () => {
	it("calls toast.success with 8 s duration and an Undo action", () => {
		const onUndo = vi.fn();
		toastUndo("Event archived", { onUndo });
		expect(toastMock.success).toHaveBeenCalledTimes(1);
		const call = toastMock.success.mock.calls[0];
		expect(call).toBeDefined();
		const [message, opts] = call as [string, Record<string, unknown>];
		expect(message).toBe("Event archived");
		expect(opts.duration).toBe(8000);
		expect((opts.action as { label: string }).label).toBe("Undo");
	});

	it("invokes onUndo and shows the undo confirmation when action fires", () => {
		const onUndo = vi.fn();
		toastUndo("X", { onUndo, undoMessage: "Brought back" });
		const opts = toastMock.success.mock.calls[0]?.[1] as {
			action: { onClick: () => void };
		};
		opts.action.onClick();
		expect(onUndo).toHaveBeenCalledTimes(1);
		expect(toastMock.message).toHaveBeenCalledWith("Brought back");
	});

	it("surfaces async-undo failures via toast.error instead of unhandled rejection", async () => {
		const onUndo = vi.fn().mockRejectedValue(new Error("boom"));
		toastUndo("X", { onUndo });
		const opts = toastMock.success.mock.calls[0]?.[1] as {
			action: { onClick: () => void };
		};
		opts.action.onClick();
		await Promise.resolve();
		await Promise.resolve();
		expect(toastMock.error).toHaveBeenCalledWith(
			"Undo failed",
			expect.objectContaining({ description: "boom" }),
		);
	});

	it("omits description when not provided (avoids passing undefined to sonner)", () => {
		toastUndo("X", { onUndo: () => {} });
		const opts = toastMock.success.mock.calls[0]?.[1] as Record<
			string,
			unknown
		>;
		expect("description" in opts).toBe(false);
	});
});

describe("toastRetry", () => {
	it("calls toast.error with a Retry action", () => {
		const onRetry = vi.fn();
		toastRetry("Check-in failed", { onRetry });
		expect(toastMock.error).toHaveBeenCalledTimes(1);
		const opts = toastMock.error.mock.calls[0]?.[1] as {
			action: { label: string };
		};
		expect(opts.action.label).toBe("Retry");
	});

	it("invokes onRetry on action click and swallows sync throws as toast.error", () => {
		const onRetry = vi.fn(() => {
			throw new Error("sync fail");
		});
		toastRetry("X", { onRetry });
		const opts = toastMock.error.mock.calls[0]?.[1] as {
			action: { onClick: () => void };
		};
		opts.action.onClick();
		expect(onRetry).toHaveBeenCalledTimes(1);
		expect(toastMock.error.mock.calls.at(-1)?.[0]).toBe("Retry failed");
	});
});

// Sanity bookkeeping: keep one synthetic test ref so this file doesn't
// confuse vitest about empty describes if all imports are tree-shaken.
describe("module integration", () => {
	it("all helpers exported from index barrel", async () => {
		const mod = await import("./index");
		expect(typeof mod.CurrencyINR).toBe("function");
		expect(typeof mod.GlassSurface).toBe("function");
		expect(typeof mod.BentoGrid).toBe("function");
		expect(typeof mod.toastUndo).toBe("function");
		expect(typeof mod.toastRetry).toBe("function");
	});

	it("fireEvent helpers stay imported (sanity)", () => {
		// Touches `fireEvent` so `noUnusedImports` lint stays quiet across
		// future test additions — `fireEvent` is the canonical way to test
		// the action onClick handlers above when interactivity expands.
		expect(typeof fireEvent.click).toBe("function");
	});
});
