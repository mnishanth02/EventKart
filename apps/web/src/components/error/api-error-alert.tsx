import { AlertCircle, X } from "lucide-react";
import {
	Alert,
	AlertTitle,
	AlertDescription,
} from "@repo/ui/components/ui/alert";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { ApiClientError } from "#/lib/api-client.shared";

export interface ApiErrorAlertProps {
	error: ApiClientError | Error | null;
	onDismiss?: () => void;
	className?: string;
}

export function ApiErrorAlert({
	error,
	onDismiss,
	className,
}: ApiErrorAlertProps) {
	if (!error) {
		return null;
	}

	const getMessage = (): { title: string; code?: string } => {
		if (error instanceof ApiClientError) {
			let title: string;

			switch (error.status) {
				case 401:
					title = "Please sign in to continue";
					break;
				case 403:
					title = "You don't have permission to perform this action";
					break;
				case 404:
					title = "The requested resource was not found";
					break;
				case 409:
					title = "This action conflicts with existing data";
					break;
				case 422:
					title = "Please check your input and try again";
					break;
				case 429:
					title = "Too many requests. Please wait a moment and try again.";
					break;
				default:
					if (error.status >= 500) {
						title = "Something went wrong on our end. Please try again later.";
					} else {
						title = error.message;
					}
					break;
			}

			return {
				title,
				code: error.code,
			};
		}

		return {
			title: error.message,
		};
	};

	const { title, code } = getMessage();

	return (
		<Alert
			variant="destructive"
			className={cn(onDismiss && "relative pr-10", className)}
		>
			<AlertCircle className="h-4 w-4" />
			<AlertTitle>{title}</AlertTitle>
			{code && (
				<AlertDescription className="text-xs font-mono mt-2">
					Error code: {code}
				</AlertDescription>
			)}
			{onDismiss && (
				<Button
					variant="ghost"
					size="icon"
					onClick={onDismiss}
					className="absolute right-2 top-2 h-6 w-6"
					aria-label="Dismiss"
				>
					<X className="h-4 w-4" />
				</Button>
			)}
		</Alert>
	);
}
