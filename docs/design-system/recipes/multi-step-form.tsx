/**
 * Recipe: Multi-Step Booking Form (RHF + Zod + URL state + view transitions)
 *
 * 3-step ticket purchase flow:
 *   1. Select tickets   2. Attendee details   3. Payment + review
 *
 * Patterns shown:
 *  - ONE `useForm` instance via RHF `<FormProvider>`; per-step zod schemas are
 *    composed into a final union for submit-time validation.
 *  - Step is reflected in URL `?step=N` so refresh preserves position.
 *  - View-transition slide between steps using the reserved
 *    `viewTransitionName: "booking-step"`.
 *  - Persistent price summary sidebar updates live via `useWatch`.
 *  - Server-returned validation errors mapped via `setError`.
 *
 * Common mistakes:
 *  - ❌ Re-creating `useForm` per step → loses state between steps.
 *  - ❌ Calling `trigger()` without scoping fields → validates the whole tree.
 *  - ❌ Forgetting to wrap step changes in `document.startViewTransition`.
 */

import { Button } from "@repo/ui/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormMessage } from "@repo/ui/components/ui/form";
import { Input } from "@repo/ui/components/ui/input";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { startTransition } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const step1 = z.object({
	qtyGA: z.number().int().min(0).max(10),
	qtyVIP: z.number().int().min(0).max(4),
});
const step2 = z.object({
	leadName: z.string().min(2, "Name required"),
	leadEmail: z.string().email("Valid email required"),
	leadPhone: z.string().min(10, "10-digit phone required"),
});
const step3 = z.object({
	upiId: z.string().regex(/^[\w.-]+@[\w]+$/, "Invalid UPI ID"),
	terms: z.literal(true, { errorMap: () => ({ message: "Required" }) }),
});

const fullSchema = step1.merge(step2).merge(step3);
type Booking = z.infer<typeof fullSchema>;

const PRICES = { GA: 999, VIP: 4999 };

function startVT(fn: () => void) {
	if (typeof document !== "undefined" && "startViewTransition" in document) {
		(document as Document & { startViewTransition: (cb: () => void) => void }).startViewTransition(fn);
	} else {
		fn();
	}
}

export function BookingMultiStepForm() {
	const navigate = useNavigate();
	const { step = 1 } = useSearch({ strict: false }) as { step?: number };

	const form = useForm<Booking>({
		resolver: zodResolver(fullSchema),
		defaultValues: { qtyGA: 1, qtyVIP: 0, leadName: "", leadEmail: "", leadPhone: "", upiId: "", terms: false as unknown as true },
		mode: "onTouched",
	});

	async function next() {
		const fields =
			step === 1 ? (["qtyGA", "qtyVIP"] as const)
			: step === 2 ? (["leadName", "leadEmail", "leadPhone"] as const)
			: ([] as const);
		const ok = await form.trigger(fields as unknown as Parameters<typeof form.trigger>[0]);
		if (!ok) return;
		startVT(() => {
			startTransition(() => {
				navigate({ search: (s) => ({ ...s, step: Math.min(3, step + 1) }) });
			});
		});
	}

	function prev() {
		startVT(() => {
			navigate({ search: (s) => ({ ...s, step: Math.max(1, step - 1) }) });
		});
	}

	async function onSubmit(values: Booking) {
		try {
			// await api.createBooking(values)
			console.log("submit", values);
		} catch (e) {
			form.setError("upiId", { type: "server", message: "Payment declined. Try another UPI ID." });
		}
	}

	return (
		<FormProvider {...form}>
			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
					<div>
						<Stepper current={step} />
						<div style={{ viewTransitionName: "booking-step" }} className="mt-6 rounded-2xl border p-6">
							{step === 1 && <StepTickets />}
							{step === 2 && <StepAttendee />}
							{step === 3 && <StepPayment />}
						</div>
						<div className="mt-4 flex justify-between">
							<Button type="button" variant="ghost" onClick={prev} disabled={step === 1}>
								Back
							</Button>
							{step < 3 ? (
								<Button type="button" onClick={next}>Continue</Button>
							) : (
								<Button type="submit">Pay & confirm</Button>
							)}
						</div>
					</div>
					<PriceSummary />
				</form>
			</Form>
		</FormProvider>
	);
}

function Stepper({ current }: { current: number }) {
	return (
		<ol className="flex gap-2 text-sm">
			{["Tickets", "Attendee", "Payment"].map((label, i) => {
				const idx = i + 1;
				const active = idx === current;
				const done = idx < current;
				return (
					<li
						key={label}
						aria-current={active ? "step" : undefined}
						className={`rounded-full px-3 py-1 ${active ? "bg-primary text-primary-foreground" : done ? "bg-muted" : "bg-muted/40 text-muted-foreground"}`}
					>
						{idx}. {label}
					</li>
				);
			})}
		</ol>
	);
}

function StepTickets() {
	return (
		<div className="grid gap-4">
			<FormField name="qtyGA" render={({ field }) => (
				<FormItem><FormLabel>General Admission (₹999)</FormLabel><Input type="number" min={0} max={10} {...field} /><FormMessage /></FormItem>
			)} />
			<FormField name="qtyVIP" render={({ field }) => (
				<FormItem><FormLabel>VIP (₹4,999)</FormLabel><Input type="number" min={0} max={4} {...field} /><FormMessage /></FormItem>
			)} />
		</div>
	);
}

function StepAttendee() {
	return (
		<div className="grid gap-4">
			<FormField name="leadName" render={({ field }) => (<FormItem><FormLabel>Lead attendee name</FormLabel><Input {...field} /><FormMessage /></FormItem>)} />
			<FormField name="leadEmail" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><Input type="email" {...field} /><FormMessage /></FormItem>)} />
			<FormField name="leadPhone" render={({ field }) => (<FormItem><FormLabel>Phone</FormLabel><Input type="tel" {...field} /><FormMessage /></FormItem>)} />
		</div>
	);
}

function StepPayment() {
	return (
		<div className="grid gap-4">
			<FormField name="upiId" render={({ field }) => (<FormItem><FormLabel>UPI ID</FormLabel><Input placeholder="name@bank" {...field} /><FormMessage /></FormItem>)} />
			<FormField name="terms" render={({ field }) => (
				<FormItem className="flex items-center gap-2">
					<input type="checkbox" checked={!!field.value} onChange={(e) => field.onChange(e.target.checked)} />
					<FormLabel>I agree to the EventKart terms.</FormLabel>
					<FormMessage />
				</FormItem>
			)} />
		</div>
	);
}

function PriceSummary() {
	const ga = useWatch({ name: "qtyGA" }) ?? 0;
	const vip = useWatch({ name: "qtyVIP" }) ?? 0;
	const subtotal = ga * PRICES.GA + vip * PRICES.VIP;
	const fees = Math.round(subtotal * 0.05);
	const fmt = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

	return (
		<aside className="sticky top-4 h-fit rounded-2xl border p-5">
			<h2 className="font-semibold">Order summary</h2>
			<dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm">
				<dt>GA × {ga}</dt><dd className="text-right tabular-nums">{fmt.format(ga * PRICES.GA)}</dd>
				<dt>VIP × {vip}</dt><dd className="text-right tabular-nums">{fmt.format(vip * PRICES.VIP)}</dd>
				<dt>Fees</dt><dd className="text-right tabular-nums">{fmt.format(fees)}</dd>
				<dt className="mt-2 font-semibold">Total</dt><dd className="mt-2 text-right font-semibold tabular-nums">{fmt.format(subtotal + fees)}</dd>
			</dl>
		</aside>
	);
}
