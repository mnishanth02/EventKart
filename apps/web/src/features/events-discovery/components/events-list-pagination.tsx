import type { OffsetPaginationMeta } from "@repo/shared/schemas";
import { buttonVariants } from "@repo/ui/components/ui/button";
import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
} from "@repo/ui/components/ui/pagination";
import { cn } from "@repo/ui/lib/utils";
import { Link } from "@tanstack/react-router";

export interface EventsListPaginationProps {
	meta: OffsetPaginationMeta;
	buildPageHref: (page: number) => {
		to: string;
		search: (prev: Record<string, unknown>) => Record<string, unknown>;
	};
}

type PageItem = number | { kind: "ellipsis"; key: string };

function buildPageItems(currentPage: number, totalPages: number): PageItem[] {
	const pages = new Set<number>([1, totalPages]);
	for (
		let page = Math.max(1, currentPage - 1);
		page <= Math.min(totalPages, currentPage + 1);
		page += 1
	) {
		pages.add(page);
	}

	const sortedPages = [...pages].sort((left, right) => left - right);
	const items: PageItem[] = [];
	for (const page of sortedPages) {
		const previous = items.at(-1);
		if (typeof previous === "number" && page - previous > 1) {
			items.push({ kind: "ellipsis", key: `ellipsis-${previous}-${page}` });
		}
		items.push(page);
	}
	return items;
}

function disabledNavLink(label: string, children: React.ReactNode) {
	return (
		<button
			type="button"
			disabled
			aria-disabled="true"
			aria-label={label}
			className={cn(
				buttonVariants({ variant: "ghost", size: "default" }),
				"gap-1 px-2.5 pointer-events-none opacity-50",
			)}
		>
			{children}
		</button>
	);
}

export function EventsListPagination({
	meta,
	buildPageHref,
}: EventsListPaginationProps) {
	if (meta.totalPages <= 1) return null;

	const pageItems = buildPageItems(meta.page, meta.totalPages);
	const hasPrev = meta.page > 1;
	const hasNext = meta.page < meta.totalPages;

	return (
		<Pagination>
			<PaginationContent>
				<PaginationItem>
					{hasPrev ? (
						<Link
							{...buildPageHref(meta.page - 1)}
							aria-label="Go to previous page"
							className={cn(
								buttonVariants({ variant: "ghost", size: "default" }),
								"gap-1 px-2.5 sm:pl-2.5",
							)}
						>
							<span>Previous</span>
						</Link>
					) : (
						disabledNavLink("Go to previous page", <span>Previous</span>)
					)}
				</PaginationItem>
				{pageItems.map((item) =>
					typeof item === "object" ? (
						<PaginationItem key={item.key}>
							<PaginationEllipsis />
						</PaginationItem>
					) : (
						<PaginationItem key={item}>
							<Link
								{...buildPageHref(item)}
								aria-current={item === meta.page ? "page" : undefined}
								data-active={item === meta.page}
								className={cn(
									buttonVariants({
										variant: item === meta.page ? "outline" : "ghost",
										size: "icon",
									}),
								)}
							>
								{item}
							</Link>
						</PaginationItem>
					),
				)}
				<PaginationItem>
					{hasNext ? (
						<Link
							{...buildPageHref(meta.page + 1)}
							aria-label="Go to next page"
							className={cn(
								buttonVariants({ variant: "ghost", size: "default" }),
								"gap-1 px-2.5 sm:pr-2.5",
							)}
						>
							<span>Next</span>
						</Link>
					) : (
						disabledNavLink("Go to next page", <span>Next</span>)
					)}
				</PaginationItem>
			</PaginationContent>
		</Pagination>
	);
}
