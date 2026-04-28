import { render, screen } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { EventStatusBadge } from "./event-status-badge";

vi.mock("@repo/ui/components/ui/badge", () => ({
	Badge: ({
		children,
		...props
	}: React.PropsWithChildren<Record<string, unknown>>) => (
		<span {...props}>{children}</span>
	),
}));

describe("EventStatusBadge", () => {
	it("renders the under review label", () => {
		render(<EventStatusBadge status="under_review" />);
		expect(screen.getByText("Under Review")).toBeTruthy();
	});
});
