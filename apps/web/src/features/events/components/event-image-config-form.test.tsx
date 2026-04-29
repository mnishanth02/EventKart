import type { EventImage } from "@repo/shared/schemas";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import type React from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	confirmEventImageUpload,
	deleteEventImage,
	requestEventImageUploadUrl,
} from "../api";
import { EventImageConfigForm } from "./event-image-config-form";

vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
		promise: vi.fn(),
	},
}));

vi.mock("../api", () => ({
	requestEventImageUploadUrl: vi.fn(),
	confirmEventImageUpload: vi.fn(),
	deleteEventImage: vi.fn(),
}));

vi.mock("@repo/ui/components/ui/badge", () => ({
	Badge: ({
		children,
		...props
	}: React.PropsWithChildren<Record<string, unknown>>) => (
		<span {...props}>{children}</span>
	),
}));

vi.mock("@repo/ui/components/ui/button", () => ({
	Button: ({
		children,
		variant: _variant,
		size: _size,
		asChild: _asChild,
		...props
	}: React.PropsWithChildren<
		Record<string, unknown> & {
			variant?: unknown;
			size?: unknown;
			asChild?: unknown;
		}
	>) => <button {...props}>{children}</button>,
}));

vi.mock("@repo/ui/components/ui/card", () => ({
	Card: ({
		children,
		...props
	}: React.PropsWithChildren<Record<string, unknown>>) => (
		<div {...props}>{children}</div>
	),
	CardContent: ({
		children,
		...props
	}: React.PropsWithChildren<Record<string, unknown>>) => (
		<div {...props}>{children}</div>
	),
	CardDescription: ({
		children,
		...props
	}: React.PropsWithChildren<Record<string, unknown>>) => (
		<div {...props}>{children}</div>
	),
	CardHeader: ({
		children,
		...props
	}: React.PropsWithChildren<Record<string, unknown>>) => (
		<div {...props}>{children}</div>
	),
	CardTitle: ({
		children,
		...props
	}: React.PropsWithChildren<Record<string, unknown>>) => (
		<div {...props}>{children}</div>
	),
}));

vi.mock("@repo/ui/components/ui/input", () => ({
	Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
		<input {...props} />
	),
}));

vi.mock("@repo/ui/components/ui/label", () => ({
	Label: (props: React.LabelHTMLAttributes<HTMLLabelElement>) => (
		// biome-ignore lint/a11y/noLabelWithoutControl: test mock receives htmlFor from the component under test.
		<label {...props} />
	),
}));

const eventId = "11111111-1111-4111-8111-111111111111";
const heroImage: EventImage = {
	id: "22222222-2222-4222-8222-222222222222",
	eventId,
	kind: "hero",
	fileName: "hero.jpg",
	contentType: "image/jpeg",
	sizeBytes: 2048,
	storageKey: "events/event-1/hero.jpg",
	status: "uploaded",
	uploadedBy: "33333333-3333-4333-8333-333333333333",
	createdAt: "2026-04-26T12:00:00.000Z",
	updatedAt: "2026-04-26T12:00:00.000Z",
};

function renderForm(images: EventImage[] = []) {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false },
		},
	});

	return render(
		<QueryClientProvider client={queryClient}>
			<EventImageConfigForm eventId={eventId} images={images} />
		</QueryClientProvider>,
	);
}

describe("EventImageConfigForm", () => {
	beforeEach(() => {
		vi.mocked(requestEventImageUploadUrl).mockReset();
		vi.mocked(confirmEventImageUpload).mockReset();
		vi.mocked(deleteEventImage).mockReset();
		vi.mocked(toast.success).mockReset();
		vi.mocked(toast.error).mockReset();
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
		vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview");
		vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("renders hero and route map upload cards with existing status", () => {
		renderForm([heroImage]);

		expect(screen.getByText("Hero image")).toBeDefined();
		expect(screen.getByText("Route map")).toBeDefined();
		expect(screen.getByText("Uploaded")).toBeDefined();
		expect(screen.getByText("hero.jpg")).toBeDefined();
		expect(screen.getByText("No route map uploaded yet.")).toBeDefined();
	});

	it("rejects invalid selected files before requesting an upload URL", () => {
		renderForm();

		fireEvent.change(screen.getByLabelText("Choose hero image file"), {
			target: {
				files: [new File(["image"], "hero.gif", { type: "image/gif" })],
			},
		});

		expect(toast.error).toHaveBeenCalledWith(
			"Only JPEG, PNG, and WebP images are accepted.",
		);
		expect(
			screen.getByText("Only JPEG, PNG, and WebP images are accepted."),
		).toBeDefined();
		expect(requestEventImageUploadUrl).not.toHaveBeenCalled();
	});

	it("uploads a selected valid file through the presigned URL flow", async () => {
		const uploadedImage = {
			...heroImage,
			contentType: "image/png",
		} satisfies EventImage;
		vi.mocked(requestEventImageUploadUrl).mockResolvedValueOnce({
			imageId: heroImage.id,
			url: "https://storage.example.com/upload",
			method: "POST",
			fields: {
				"Content-Type": "image/png",
				policy: "test-policy",
				"x-amz-signature": "test-signature",
			},
			key: "events/event-1/hero.png",
			expiresAt: "2026-04-26T12:05:00.000Z",
		});
		vi.mocked(confirmEventImageUpload).mockResolvedValueOnce(uploadedImage);
		renderForm();

		const file = new File(["image"], "hero.png", { type: "image/png" });
		fireEvent.change(screen.getByLabelText("Choose hero image file"), {
			target: { files: [file] },
		});

		expect(screen.getByAltText("Hero image preview")).toBeDefined();
		fireEvent.click(screen.getByRole("button", { name: "Upload Hero image" }));

		await waitFor(() =>
			expect(requestEventImageUploadUrl).toHaveBeenCalledWith({
				data: {
					eventId,
					kind: "hero",
					fileName: "hero.png",
					contentType: "image/png",
					sizeBytes: file.size,
				},
			}),
		);
		expect(fetch).toHaveBeenCalledWith(
			"https://storage.example.com/upload",
			expect.objectContaining({
				method: "POST",
				body: expect.any(FormData),
			}),
		);
		const uploadBody = vi.mocked(fetch).mock.calls[0]?.[1]?.body as FormData;
		expect(uploadBody.get("Content-Type")).toBe("image/png");
		expect(uploadBody.get("policy")).toBe("test-policy");
		expect(uploadBody.get("x-amz-signature")).toBe("test-signature");
		expect(uploadBody.get("file")).toBe(file);
		expect(confirmEventImageUpload).toHaveBeenCalledWith({
			data: { eventId, imageId: heroImage.id },
		});
		await waitFor(() =>
			expect(toast.success).toHaveBeenCalledWith("Hero image uploaded"),
		);
	});

	it("deletes an existing image", async () => {
		vi.mocked(deleteEventImage).mockResolvedValueOnce({
			deleted: true,
			imageId: heroImage.id,
			kind: "hero",
		});
		renderForm([heroImage]);

		fireEvent.click(screen.getByRole("button", { name: "Delete" }));

		await waitFor(() =>
			expect(deleteEventImage).toHaveBeenCalledWith({
				data: { eventId, imageId: heroImage.id },
			}),
		);
		expect(toast.success).toHaveBeenCalledWith(
			"Hero image deleted",
			expect.objectContaining({
				action: expect.objectContaining({ label: "Undo" }),
			}),
		);
	});
});
