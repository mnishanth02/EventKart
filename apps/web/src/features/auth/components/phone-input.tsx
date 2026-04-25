import { Input } from "@repo/ui/components/ui/input";
import { useId } from "react";

interface PhoneInputProps {
	value: string;
	onChange: (value: string) => void;
	disabled?: boolean;
	error?: string;
	autoFocus?: boolean;
}

function PhoneInput({
	value,
	onChange,
	disabled,
	error,
	autoFocus,
}: PhoneInputProps) {
	const id = useId();
	const errorId = `${id}-error`;

	function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
		const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
		onChange(digits);
	}

	return (
		<div className="flex flex-col gap-1.5">
			<label htmlFor={id} className="text-sm font-medium">
				Phone Number
			</label>
			<div className="flex items-center gap-2">
				<span className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
					+91
				</span>
				<Input
					id={id}
					type="tel"
					inputMode="numeric"
					placeholder="9876543210"
					value={value}
					onChange={handleChange}
					disabled={disabled}
					autoFocus={autoFocus}
					aria-invalid={error ? true : undefined}
					aria-describedby={error ? errorId : undefined}
					maxLength={10}
				/>
			</div>
			{error ? (
				<p id={errorId} className="text-sm text-destructive" role="alert">
					{error}
				</p>
			) : null}
		</div>
	);
}

export type { PhoneInputProps };
export { PhoneInput };
