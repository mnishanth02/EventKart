import { render, screen } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { PublishChecklist } from "./publish-checklist";

vi.mock("@repo/ui/components/ui/alert", () => ({
	Alert: ({
		children,
		...props
	}: React.PropsWithChildren<Record<string, unknown>>) => (
		<div {...props}>{children}</div>
	),
	AlertDescription: ({ children }: React.PropsWithChildren) => (
		<p>{children}</p>
	),
	AlertTitle: ({ children }: React.PropsWithChildren) => <h3>{children}</h3>,
}));

vi.mock("@repo/ui/components/ui/card", () => ({
	Card: ({
		children,
		...props
	}: React.PropsWithChildren<Record<string, unknown>>) => (
		<section {...props}>{children}</section>
	),
	CardContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
	CardDescription: ({ children }: React.PropsWithChildren) => <p>{children}</p>,
	CardHeader: ({ children }: React.PropsWithChildren) => (
		<header>{children}</header>
	),
	CardTitle: ({ children }: React.PropsWithChildren) => <h2>{children}</h2>,
}));

describe("PublishChecklist", () => {
	it("renders readiness items and admin review messaging", () => {
		render(
			<PublishChecklist
				readiness={{
					ready: false,
					eventStatus: "draft",
					isPaid: true,
					requiresRazorpay: true,
					wouldRequireAdminReview: true,
					items: [
						{
							check: "organizer_verified",
							passed: true,
							message: "Organizer verified",
							severity: "error",
						},
						{
							check: "hero_image_uploaded",
							passed: false,
							message: "Upload a hero image",
							severity: "error",
						},
					],
				}}
			/>,
		);

		expect(screen.getByText("Publish readiness")).toBeTruthy();
		expect(screen.getByText("Admin review required")).toBeTruthy();
		expect(screen.getByText("Upload a hero image")).toBeTruthy();
	});
});
