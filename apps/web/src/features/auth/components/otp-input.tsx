import { useEffect, useId, useRef } from "react";
import { cn } from "@repo/ui/lib/utils";

interface OtpInputProps {
	value: string;
	onChange: (value: string) => void;
	disabled?: boolean;
	error?: string;
	autoFocus?: boolean;
}

const OTP_LENGTH = 6;
const DIGIT_KEYS = ["otp-0", "otp-1", "otp-2", "otp-3", "otp-4", "otp-5"] as const;

function OtpInput({
	value,
	onChange,
	disabled,
	error,
	autoFocus,
}: OtpInputProps) {
	const id = useId();
	const errorId = `${id}-error`;
	const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

	useEffect(() => {
		if (autoFocus) {
			inputsRef.current[0]?.focus();
		}
	}, [autoFocus]);

	const digits = value.padEnd(OTP_LENGTH, "").slice(0, OTP_LENGTH).split("");

	function focusInput(index: number) {
		inputsRef.current[index]?.focus();
	}

	function handleChange(index: number, inputValue: string) {
		const digit = inputValue.replace(/\D/g, "").slice(-1);
		const newDigits = [...digits];
		newDigits[index] = digit;
		const newValue = newDigits.join("").replace(/ /g, "");
		onChange(newValue);

		if (digit && index < OTP_LENGTH - 1) {
			focusInput(index + 1);
		}
	}

	function handleKeyDown(index: number, e: React.KeyboardEvent) {
		if (e.key === "Backspace") {
			if (!digits[index] && index > 0) {
				e.preventDefault();
				const newDigits = [...digits];
				newDigits[index - 1] = "";
				onChange(newDigits.join("").replace(/ /g, ""));
				focusInput(index - 1);
			}
		} else if (e.key === "ArrowLeft" && index > 0) {
			e.preventDefault();
			focusInput(index - 1);
		} else if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
			e.preventDefault();
			focusInput(index + 1);
		}
	}

	function handlePaste(e: React.ClipboardEvent) {
		e.preventDefault();
		const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
		if (pasted.length > 0) {
			onChange(pasted);
			focusInput(Math.min(pasted.length, OTP_LENGTH - 1));
		}
	}

	return (
		<fieldset className="flex flex-col gap-1.5 border-none p-0">
			<legend className="text-sm font-medium">
				Verification Code
			</legend>
			<div className="flex items-center justify-center gap-2">
				{digits.map((digit, index) => (
					<input
						key={DIGIT_KEYS[index]}
						ref={(el) => {
							inputsRef.current[index] = el;
						}}
						type="text"
						inputMode="numeric"
						maxLength={1}
						value={digit === " " ? "" : digit}
						onChange={(e) => handleChange(index, e.target.value)}
						onKeyDown={(e) => handleKeyDown(index, e)}
						onPaste={handlePaste}
						disabled={disabled}
						aria-label={`Digit ${String(index + 1)} of ${String(OTP_LENGTH)}`}
						aria-invalid={error ? true : undefined}
						aria-describedby={error ? errorId : undefined}
						className={cn(
							"h-11 w-10 rounded-md border border-input bg-transparent text-center text-lg font-medium shadow-xs outline-none transition-[color,box-shadow]",
							"focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
							error &&
								"border-destructive ring-destructive/20 dark:ring-destructive/40",
							disabled && "pointer-events-none cursor-not-allowed opacity-50",
						)}
					/>
				))}
			</div>
			{error ? (
				<p id={errorId} className="text-center text-sm text-destructive" role="alert">
					{error}
				</p>
			) : null}
		</fieldset>
	);
}

export { OtpInput };
export type { OtpInputProps };
