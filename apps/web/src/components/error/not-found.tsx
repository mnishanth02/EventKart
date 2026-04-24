import { Link } from "@tanstack/react-router";
import { Button } from "@repo/ui/components/ui/button";
import { SearchX } from "lucide-react";

export function NotFoundPage() {
	return (
		<div className="flex min-h-[50vh] flex-col items-center justify-center px-4 py-12 text-center">
			<div className="w-full max-w-md space-y-6">
				<div className="flex justify-center">
					<SearchX className="h-16 w-16 text-muted-foreground/50" />
				</div>

				<h1 className="text-7xl font-bold text-muted-foreground/20 md:text-8xl">
					404
				</h1>

				<div className="space-y-2">
					<h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
						Page not found
					</h2>
					<p className="text-sm text-muted-foreground md:text-base">
						The page you&apos;re looking for doesn&apos;t exist or has been
						moved.
					</p>
				</div>

				<Button asChild>
					<Link to="/">Go Home</Link>
				</Button>
			</div>
		</div>
	);
}
