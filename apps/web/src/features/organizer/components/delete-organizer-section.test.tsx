import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { createContext, useContext, type ReactNode } from "react";
import { toast } from "sonner";
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { deleteOrganizerAccount, getOrganizerDeletionPreview } from "../api";
import { DeleteOrganizerSection } from "./delete-organizer-section";

// ── Mocks ──────────────────────────────────────────────────────────────

vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
}));

vi.mock("../api", () => ({
	getOrganizerDeletionPreview: vi.fn(),
	deleteOrganizerAccount: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => mockNavigate,
}));

const mockClearSession = vi.fn();
vi.mock("#/features/auth/hooks", () => ({
	useAuthActions: () => ({ clearSession: mockClearSession }),
}));

vi.mock("@/components/design-system", () => ({
	toastRetry: vi.fn(),
}));

// AlertDialog context to propagate onOpenChange from AlertDialog → AlertDialogTrigger
const DialogCtx = createContext<((open: boolean) => void) | null>(null);

vi.mock("@repo/ui/components/ui/alert-dialog", () => ({
	AlertDialog: ({
		children,
		onOpenChange,
	}: {
		children: ReactNode;
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
	}) => (
		<DialogCtx.Provider value={onOpenChange ?? null}>
			<div>{children}</div>
		</DialogCtx.Provider>
	),
	AlertDialogAction: ({
		children,
		...props
	}: React.PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) => (
		<button {...props}>{children}</button>
	),
	AlertDialogCancel: ({
		children,
		...props
	}: React.PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) => (
		<button {...props}>{children}</button>
	),
	AlertDialogContent: ({ children }: { children: ReactNode }) => (
		<div role="dialog">{children}</div>
	),
	AlertDialogDescription: ({ children }: { children: ReactNode }) => (
		<p>{children}</p>
	),
	AlertDialogFooter: ({ children }: { children: ReactNode }) => (
		<footer>{children}</footer>
	),
	AlertDialogHeader: ({ children }: { children: ReactNode }) => (
		<header>{children}</header>
	),
	AlertDialogTitle: ({ children }: { children: ReactNode }) => (
		<h2>{children}</h2>
	),
	AlertDialogTrigger: ({
		children,
	}: {
		children: ReactNode;
		asChild?: boolean;
	}) => {
		const onOpenChange = useContext(DialogCtx);
		return (
			// biome-ignore lint/a11y/useKeyWithClickEvents: test mock only
			// biome-ignore lint/a11y/noStaticElementInteractions: test mock only
			<div data-testid="alert-trigger" onClick={() => onOpenChange?.(true)}>{children}</div>
		);
	},
}));

vi.mock("@repo/ui/components/ui/button", () => ({
	Button: ({
		children,
		variant: _variant,
		...props
	}: React.PropsWithChildren<
		React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: unknown }
	>) => <button {...props}>{children}</button>,
}));

vi.mock("@repo/ui/components/ui/card", () => ({
	Card: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
		<div {...props}>{children}</div>
	),
	CardContent: ({ children }: { children: ReactNode }) => (
		<div>{children}</div>
	),
	CardDescription: ({ children }: { children: ReactNode }) => (
		<p>{children}</p>
	),
	CardHeader: ({ children }: { children: ReactNode }) => (
		<div>{children}</div>
	),
	CardTitle: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
		<h3 {...props}>{children}</h3>
	),
}));

vi.mock("@repo/ui/components/ui/skeleton", () => ({
	Skeleton: ({ className }: { className?: string }) => (
		<div data-testid="skeleton" className={className} />
	),
}));

vi.mock("lucide-react", () => ({
	AlertTriangleIcon: () => <span data-testid="alert-triangle-icon" />,
}));

// ── Helpers ────────────────────────────────────────────────────────────

const defaultPreview = {
	businessName: "Acme Events",
	futureEvents: [
		{ title: "Marathon 2026", startAt: "2026-08-15T00:00:00.000Z" },
	],
	preservedEventCount: 3,
	hasRazorpayAccount: true,
	kycDocumentCount: 2,
};

function renderComponent() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false },
		},
	});

	const clearSpy = vi.spyOn(queryClient, "clear");

	render(
		<QueryClientProvider client={queryClient}>
			<DeleteOrganizerSection />
		</QueryClientProvider>,
	);

	return { queryClient, clearSpy };
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("DeleteOrganizerSection", () => {
	beforeEach(() => {
		vi.mocked(getOrganizerDeletionPreview).mockReset();
		vi.mocked(deleteOrganizerAccount).mockReset();
		vi.mocked(toast.success).mockReset();
		mockNavigate.mockReset();
		mockClearSession.mockReset();
	});

	afterEach(() => {
		cleanup();
	});

	it("renders danger zone card with delete button", () => {
		renderComponent();

		expect(screen.getByText("Danger zone")).toBeTruthy();
		expect(
			screen.getByText(
				"Permanently delete your organizer account and all associated data.",
			),
		).toBeTruthy();
		expect(
			screen.getByRole("button", { name: "Delete organizer account" }),
		).toBeTruthy();
	});

	it("shows loading skeletons when dialog opens before preview loads", async () => {
		let resolvePreview!: (value: typeof defaultPreview) => void;
		vi.mocked(getOrganizerDeletionPreview).mockReturnValue(
			new Promise((resolve) => {
				resolvePreview = resolve;
			}),
		);

		renderComponent();

		// Click to open dialog — this triggers the preview fetch via useQuery enabled: open
		fireEvent.click(
			screen.getByRole("button", { name: "Delete organizer account" }),
		);

		await waitFor(() => {
			expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
		});

		// Resolve to clean up
		resolvePreview(defaultPreview);
	});

	it("shows future events list when preview has future events", async () => {
		vi.mocked(getOrganizerDeletionPreview).mockResolvedValue(defaultPreview);

		renderComponent();
		fireEvent.click(
			screen.getByRole("button", { name: "Delete organizer account" }),
		);

		await waitFor(() => {
			expect(
				screen.getByText("Future events that will be permanently deleted:"),
			).toBeTruthy();
		});
		expect(screen.getByText(/Marathon 2026/)).toBeTruthy();
	});

	it("shows preserved event count", async () => {
		vi.mocked(getOrganizerDeletionPreview).mockResolvedValue(defaultPreview);

		renderComponent();
		fireEvent.click(
			screen.getByRole("button", { name: "Delete organizer account" }),
		);

		await waitFor(() => {
			expect(
				screen.getByText(/3 past\/active events will be preserved/),
			).toBeTruthy();
		});
	});

	it("shows KYC retention notice when kycDocumentCount > 0", async () => {
		vi.mocked(getOrganizerDeletionPreview).mockResolvedValue(defaultPreview);

		renderComponent();
		fireEvent.click(
			screen.getByRole("button", { name: "Delete organizer account" }),
		);

		await waitFor(() => {
			expect(
				screen.getByText(
					/verification documents will be retained for 365 days/,
				),
			).toBeTruthy();
		});
	});

	it("shows Razorpay note when hasRazorpayAccount is true", async () => {
		vi.mocked(getOrganizerDeletionPreview).mockResolvedValue(defaultPreview);

		renderComponent();
		fireEvent.click(
			screen.getByRole("button", { name: "Delete organizer account" }),
		);

		await waitFor(() => {
			expect(
				screen.getByText(
					"Your linked Razorpay account will be suspended.",
				),
			).toBeTruthy();
		});
	});

	it("hides Razorpay note when hasRazorpayAccount is false", async () => {
		vi.mocked(getOrganizerDeletionPreview).mockResolvedValue({
			...defaultPreview,
			hasRazorpayAccount: false,
		});

		renderComponent();
		fireEvent.click(
			screen.getByRole("button", { name: "Delete organizer account" }),
		);

		await waitFor(() => {
			expect(screen.getByText(/Acme Events/)).toBeTruthy();
		});
		expect(
			screen.queryByText("Your linked Razorpay account will be suspended."),
		).toBeNull();
	});

	it("calls deleteOrganizerAccount mutation on confirm", async () => {
		vi.mocked(getOrganizerDeletionPreview).mockResolvedValue(defaultPreview);
		vi.mocked(deleteOrganizerAccount).mockResolvedValue({
			message: "Account deleted",
			deletedEventCount: 1,
			preservedEventCount: 3,
		});

		renderComponent();
		fireEvent.click(
			screen.getByRole("button", { name: "Delete organizer account" }),
		);

		await waitFor(() => {
			expect(screen.getByText(/Acme Events/)).toBeTruthy();
		});

		fireEvent.click(
			screen.getByRole("button", { name: "Permanently delete" }),
		);

		await waitFor(() => {
			expect(deleteOrganizerAccount).toHaveBeenCalled();
		});
	});

	it("clears queryClient, clears session, and navigates on success", async () => {
		vi.mocked(getOrganizerDeletionPreview).mockResolvedValue(defaultPreview);
		vi.mocked(deleteOrganizerAccount).mockResolvedValue({
			message: "Account deleted",
			deletedEventCount: 1,
			preservedEventCount: 3,
		});

		const { clearSpy } = renderComponent();
		fireEvent.click(
			screen.getByRole("button", { name: "Delete organizer account" }),
		);

		await waitFor(() => {
			expect(screen.getByText(/Acme Events/)).toBeTruthy();
		});

		fireEvent.click(
			screen.getByRole("button", { name: "Permanently delete" }),
		);

		await waitFor(() => {
			expect(clearSpy).toHaveBeenCalled();
		});
		expect(mockClearSession).toHaveBeenCalled();
		expect(toast.success).toHaveBeenCalledWith("Organizer account deleted.");
		expect(mockNavigate).toHaveBeenCalledWith({ to: "/", replace: true });
	});

	it("shows error toast on mutation failure", async () => {
		const { toastRetry } = await import("@/components/design-system");
		vi.mocked(getOrganizerDeletionPreview).mockResolvedValue(defaultPreview);
		vi.mocked(deleteOrganizerAccount).mockRejectedValue(
			new Error("Network error"),
		);

		renderComponent();
		fireEvent.click(
			screen.getByRole("button", { name: "Delete organizer account" }),
		);

		await waitFor(() => {
			expect(screen.getByText(/Acme Events/)).toBeTruthy();
		});

		fireEvent.click(
			screen.getByRole("button", { name: "Permanently delete" }),
		);

		await waitFor(() => {
			expect(toastRetry).toHaveBeenCalledWith(
				"Failed to delete account. Please try again.",
				expect.objectContaining({ onRetry: expect.any(Function) }),
			);
		});
	});

	it("shows Deleting... text and disables button while mutation is pending", async () => {
		let resolveDelete!: (value: {
			message: string;
			deletedEventCount: number;
			preservedEventCount: number;
		}) => void;
		vi.mocked(getOrganizerDeletionPreview).mockResolvedValue(defaultPreview);
		vi.mocked(deleteOrganizerAccount).mockReturnValue(
			new Promise((resolve) => {
				resolveDelete = resolve;
			}),
		);

		renderComponent();
		fireEvent.click(
			screen.getByRole("button", { name: "Delete organizer account" }),
		);

		await waitFor(() => {
			expect(screen.getByText(/Acme Events/)).toBeTruthy();
		});

		fireEvent.click(
			screen.getByRole("button", { name: "Permanently delete" }),
		);

		await waitFor(() => {
			expect(screen.getByText("Deleting...")).toBeTruthy();
		});

		// Resolve to avoid dangling promise
		resolveDelete({
			message: "Account deleted",
			deletedEventCount: 1,
			preservedEventCount: 3,
		});
	});

	it("shows error alert when preview fetch fails", async () => {
		vi.mocked(getOrganizerDeletionPreview).mockRejectedValue(
			new Error("Server error"),
		);

		renderComponent();
		fireEvent.click(
			screen.getByRole("button", { name: "Delete organizer account" }),
		);

		await waitFor(() => {
			expect(screen.getByRole("alert")).toBeTruthy();
			expect(
				screen.getByText(
					"Failed to load deletion preview. Please close and try again.",
				),
			).toBeTruthy();
		});
	});

	it("disables confirm button while preview is loading", async () => {
		let resolvePreview!: (value: typeof defaultPreview) => void;
		vi.mocked(getOrganizerDeletionPreview).mockReturnValue(
			new Promise((resolve) => {
				resolvePreview = resolve;
			}),
		);

		renderComponent();
		fireEvent.click(
			screen.getByRole("button", { name: "Delete organizer account" }),
		);

		await waitFor(() => {
			const confirmBtn = screen.getByRole<HTMLButtonElement>("button", {
				name: "Permanently delete",
			});
			expect(confirmBtn.disabled).toBe(true);
		});

		resolvePreview(defaultPreview);
	});
});
