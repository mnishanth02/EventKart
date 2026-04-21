import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@repo/ui/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/ui/card";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Badge } from "@repo/ui/components/ui/badge";
import { Switch } from "@repo/ui/components/ui/switch";
import { Separator } from "@repo/ui/components/ui/separator";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/ui/select";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
	return (
		<div className="mx-auto max-w-2xl space-y-8 p-8">
			<div>
				<h1 className="text-4xl font-bold">UI Component Check</h1>
				<p className="mt-2 text-muted-foreground">
					Verifying shadcn/ui + Tailwind CSS v4 from{ " " }
					<code className="rounded bg-muted px-1.5 py-0.5 text-sm">
						@repo/ui
					</code>
				</p>
			</div>

			<Separator />

			<div className="flex flex-wrap gap-2">
				<Badge>Default</Badge>
				<Badge variant="secondary">Secondary</Badge>
				<Badge variant="destructive">Destructive</Badge>
				<Badge variant="outline">Outline</Badge>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Sample Form</CardTitle>
					<CardDescription>
						Testing Input, Label, Select, and Switch components.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="name">Name</Label>
						<Input id="name" placeholder="Enter your name" />
					</div>
					<div className="space-y-2">
						<Label htmlFor="category">Category</Label>
						<Select>
							<SelectTrigger id="category">
								<SelectValue placeholder="Pick a category" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="conference">Conference</SelectItem>
								<SelectItem value="workshop">Workshop</SelectItem>
								<SelectItem value="meetup">Meetup</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="flex items-center gap-2">
						<Switch id="notifications" />
						<Label htmlFor="notifications">Enable notifications</Label>
					</div>
				</CardContent>
				<CardFooter className="flex gap-2">
					<Button>Save</Button>
					<Button variant="outline">Cancel</Button>
					<Button variant="destructive">Delete</Button>
					<Button variant="ghost">Ghost</Button>
				</CardFooter>
			</Card>
		</div>
	);
}
