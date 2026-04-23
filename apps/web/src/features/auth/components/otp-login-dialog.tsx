import { useEffect, useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Spinner } from "@repo/ui/components/ui/spinner";
import { OTP_RATE_LIMIT_WINDOW_SECONDS } from "@repo/shared/constants/otp";
import { apiClient, ApiClientError } from "#/lib/api-client";
import { PhoneInput } from "./phone-input";
import { OtpInput } from "./otp-input";

type Step = "phone" | "otp";

interface OtpVerifySuccessData {
	userId: string;
	role: string;
	isNewUser: boolean;
}

interface OtpLoginDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess?: (data: OtpVerifySuccessData) => void;
	title?: string;
	description?: string;
}

function OtpLoginDialog({
	open,
	onOpenChange,
	onSuccess,
	title = "Sign in",
	description = "Enter your phone number to receive a verification code.",
}: OtpLoginDialogProps) {
	const [step, setStep] = useState<Step>("phone");
	const [phone, setPhone] = useState("");
	const [otp, setOtp] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [countdown, setCountdown] = useState(0);

	// Reset state when dialog closes
	useEffect(() => {
		if (!open) {
			setStep("phone");
			setPhone("");
			setOtp("");
			setLoading(false);
			setError("");
			setCountdown(0);
		}
	}, [open]);

	// Countdown timer
	useEffect(() => {
		if (countdown <= 0) {
			return;
		}

		const interval = setInterval(() => {
			setCountdown((prev) => {
				if (prev <= 1) {
					clearInterval(interval);
					return 0;
				}
				return prev - 1;
			});
		}, 1000);

		return () => {
			clearInterval(interval);
		};
	}, [countdown]);

	function startCountdown() {
		setCountdown(OTP_RATE_LIMIT_WINDOW_SECONDS);
	}

	function getErrorMessage(err: unknown): string {
		if (err instanceof ApiClientError) {
			return err.message;
		}
		if (err instanceof Error) {
			return err.message;
		}
		return "Something went wrong. Please try again.";
	}

	async function handleSendOtp() {
		if (phone.length !== 10) {
			setError("Please enter a valid 10-digit phone number.");
			return;
		}

		setLoading(true);
		setError("");

		try {
			await apiClient("/auth/otp/send", {
				method: "POST",
				body: { phone: `+91${phone}` },
			});
			setStep("otp");
			setOtp("");
			startCountdown();
		} catch (err) {
			setError(getErrorMessage(err));
		} finally {
			setLoading(false);
		}
	}

	async function handleVerifyOtp() {
		if (otp.length !== 6) {
			setError("Please enter the complete 6-digit code.");
			return;
		}

		setLoading(true);
		setError("");

		try {
			const result = await apiClient<{
				success: boolean;
				data: OtpVerifySuccessData;
			}>("/auth/otp/verify", {
				method: "POST",
				body: { phone: `+91${phone}`, otp },
			});
			onOpenChange(false);
			onSuccess?.(result.data);
		} catch (err) {
			setError(getErrorMessage(err));
		} finally {
			setLoading(false);
		}
	}

	async function handleResendOtp() {
		if (countdown > 0) return;

		setLoading(true);
		setError("");

		try {
			await apiClient("/auth/otp/send", {
				method: "POST",
				body: { phone: `+91${phone}` },
			});
			setOtp("");
			startCountdown();
		} catch (err) {
			setError(getErrorMessage(err));
		} finally {
			setLoading(false);
		}
	}

	function handlePhoneSubmit(e: React.FormEvent) {
		e.preventDefault();
		void handleSendOtp();
	}

	function handleOtpSubmit(e: React.FormEvent) {
		e.preventDefault();
		void handleVerifyOtp();
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>
						{step === "phone"
							? description
							: `Enter the 6-digit code sent to +91 ${phone}.`}
					</DialogDescription>
				</DialogHeader>

				{step === "phone" ? (
					<form onSubmit={handlePhoneSubmit} className="flex flex-col gap-4">
						<PhoneInput
							value={phone}
							onChange={(val) => {
								setPhone(val);
								setError("");
							}}
							disabled={loading}
							error={error}
							autoFocus
						/>
						<Button type="submit" disabled={loading || phone.length !== 10}>
							{loading ? (
								<>
									<Spinner className="size-4" />
									Sending…
								</>
							) : (
								"Send OTP"
							)}
						</Button>
					</form>
				) : (
					<form onSubmit={handleOtpSubmit} className="flex flex-col gap-4">
						<OtpInput
							value={otp}
							onChange={(val) => {
								setOtp(val);
								setError("");
							}}
							disabled={loading}
							error={error}
							autoFocus
						/>
						<Button type="submit" disabled={loading || otp.length !== 6}>
							{loading ? (
								<>
									<Spinner className="size-4" />
									Verifying…
								</>
							) : (
								"Verify"
							)}
						</Button>
						<div className="flex items-center justify-center gap-1 text-sm">
							<span className="text-muted-foreground">
								Didn&apos;t receive the code?
							</span>
							{countdown > 0 ? (
								<span className="text-muted-foreground">
									Resend in {String(countdown)}s
								</span>
							) : (
								<button
									type="button"
									onClick={() => void handleResendOtp()}
									disabled={loading}
									className="font-medium text-primary underline-offset-4 hover:underline disabled:pointer-events-none disabled:opacity-50"
								>
									Resend OTP
								</button>
							)}
						</div>
						<button
							type="button"
							onClick={() => {
								setStep("phone");
								setOtp("");
								setError("");
							}}
							disabled={loading}
							className="text-sm text-muted-foreground underline-offset-4 hover:underline disabled:pointer-events-none disabled:opacity-50"
						>
							Change phone number
						</button>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}

export { OtpLoginDialog };
export type { OtpLoginDialogProps };
