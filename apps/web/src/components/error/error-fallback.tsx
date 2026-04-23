import * as Sentry from "@sentry/tanstackstart-react";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";

export function ErrorFallback({ error, reset }: ErrorComponentProps) {
	const isDev = import.meta.env.DEV;

	Sentry.captureException(error);

	return (
		<div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
			<div className="w-full max-w-md space-y-6">
				<div className="flex justify-center">
					<AlertTriangle className="h-16 w-16 text-destructive" />
				</div>

				<h1 className="text-2xl font-bold tracking-tight">
					Something went wrong
				</h1>

				<div className="space-y-4">
					{isDev ? (
						<details className="rounded-lg border border-border bg-muted/50 p-4 text-left">
							<summary className="cursor-pointer font-mono text-sm font-medium text-muted-foreground hover:text-foreground">
								Error details (development)
							</summary>
							<div className="mt-3 space-y-2">
								<div className="font-mono text-sm text-destructive">
									{error.message}
								</div>
								{error.stack && (
									<pre className="max-h-48 overflow-auto rounded bg-background p-3 text-xs text-muted-foreground">
										{error.stack}
									</pre>
								)}
							</div>
						</details>
					) : (
						<p className="text-sm text-muted-foreground">
							An unexpected error occurred. Please try again.
						</p>
					)}
				</div>

				<Button onClick={reset} className="w-full">
					Try Again
				</Button>
			</div>
		</div>
	);
}
