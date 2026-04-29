---
title: EventKart V1 — Structured Requirements Document
version: 1.1
date_created: 2026-04-19
last_updated: 2026-04-19
derived_from: docs/product-plan.md (v2.1)
owner: Product / Founding Team
---

# EventKart V1 — Requirements Document

This document translates the finalized V1 product plan into a structured build blueprint. It defines user types, UI architecture, and a phase-wise → module-wise → feature-level breakdown ordered by logical dependencies.

---

## 0. Locked V1 Scope and Guardrails

The requirements below must be interpreted within the product-plan boundaries. This document should not be used to broaden V1 beyond the locked launch wedge.

### V1 scope boundaries

- **Launch wedge:** Coimbatore-only, organizer-tool-first, single-day **paid running events**
- **Participant discovery model:** Public browsing without login; phone OTP is triggered only at booking submission
- **Commercial model:** Payment-time split with organizer-linked settlement
- **Messaging posture:** Email is the default transactional channel in V1; transactional WhatsApp is deferred
- **Reporting posture:** Basic operational dashboarding is in scope; advanced analytics and reporting are deferred

### Explicit V1 exclusions

- Cycling as an active category in V1 (adjacent expansion only after the running wedge proves out)
- Trekking, hiking, and other higher-risk categories
- Multi-day or multi-sport events
- Full native mobile apps
- First-party results publishing or certificate generation
- Participant public profiles, public fitness portfolios, or social/community layers
- Group pricing, team registrations, waitlists, resale, memberships, or subscriptions
- White-label/custom domains or broad multi-city marketplace expansion
- GPS/live tracking, race timing chip integration, or advanced analytics as core V1 functionality

### Requirements-document boundary

- This document defines product requirements and build order, not locked technology choices
- Technical architecture should remain implementation-neutral unless a separate architecture decision explicitly locks it

---

## 1. User Types and Their Roles

### 1.1 Public Visitor (Anonymous)

**Who:** Anyone browsing EventKart without logging in.

**Interactions:**

- Browse event listings for the launch city
- View full event detail pages (route, categories, pricing, organizer info, policies)
- View organizer public profile (verification badge, event history)
- Share event pages via social/messaging links

**Identity:** None required. No login wall.

### 1.2 Participant (OTP-Verified at Booking)

**Who:** A person registering for an event. Identity is established via phone OTP only at the point of booking submission — not before.

**Interactions:**

- Everything a public visitor can do
- Submit registration + payment for a paid event (triggers OTP verification)
- Receive booking confirmation email with QR ticket
- Have profile details saved for repeat bookings (name, age, blood group, emergency contact, T-shirt size)
- Pre-fill registration form on subsequent bookings
- Access lightweight post-booking conveniences such as booking history or saved details, without creating a login wall for browsing
- Receive event reminders
- Receive post-event follow-up emails with next-event prompts
- Present QR code at event-day check-in
- Request support/dispute resolution through EventKart

### 1.3 Organizer (Authenticated, Verified)

**Who:** A fitness event organizer who signs up, gets verified, and uses EventKart to create and manage events.

**Interactions:**

- Sign up and submit verification documents (Aadhaar/PAN/GST, bank proof, policy acceptance)
- Create and publish events with structured event pages
- Configure registration forms, pricing, categories, and policies
- View operations dashboard (registered/paid/checked-in counts, participant list, revenue)
- Perform QR-based check-in on event day
- Use manual search fallback for check-in
- Export participant roster for offline use
- View and manage their organizer profile page
- Receive payout via split settlement after events
- Request refund processing through EventKart ops

### 1.4 EventKart Ops / Admin (Internal)

**Who:** EventKart's internal operations team managing the platform during the pilot.

**Interactions:**

- Review and approve/reject new organizer applications
- Manually review first 3 paid events from new organizers before publish
- Process refund and dispute workflows
- Monitor split payout operations and handle exceptions
- Manage organizer suspensions for policy violations
- Access organizer verification documents (logged access)
- Provide participant support for booking issues

---

## 2. UI Architecture Decision

### Recommendation: Single Web Application with Role-Based Experiences

**Structure:**

| Surface                 | Audience           | Auth Required       |
| ----------------------- | ------------------ | ------------------- |
| **Public pages**        | Everyone           | No                  |
| **Participant flows**   | Participants       | OTP at booking only |
| **Organizer dashboard** | Organizers         | Full login          |
| **Admin panel**         | EventKart ops team | Full login          |

**Rationale:**

1. **Speed to market** — A single responsive web product with shared design patterns is sufficient for the Coimbatore pilot; separate public, organizer, or native app surfaces would be premature.
2. **Shared surfaces** — Event pages, organizer profiles, and the booking flow are used by both public visitors and participants. Splitting these would duplicate work and fragment the experience.
3. **Distinct experiences, not distinct products** — The organizer dashboard and admin panel require different permissions and layouts, but they still sit within one role-aware web experience.
4. **Mobile-first web** — All surfaces must work on mobile browsers. Native apps are not required for V1.

**Route structure (conceptual):**

- `/` — Public home / event discovery
- `/events/:slug` — Public event detail page
- `/organizers/:slug` — Public organizer profile
- `/book/:eventId` — Registration + payment flow (OTP triggered here)
- `/my/*` — Lightweight post-booking participant conveniences such as bookings or saved profile data, if exposed
- `/org/*` — Organizer dashboard (events, participants, check-in, profile)
- `/admin/*` — EventKart ops panel (verifications, reviews, disputes)

---

## 3. Build Phases — Sequenced by Dependency

The phases below are ordered by what must exist before the next layer can work. Each phase contains modules, and each module contains features.

---

### Phase 0: Foundation

**Goal:** Set up the project skeleton, authentication, and shared infrastructure that every subsequent phase depends on.

**Why first:** Nothing can be built without auth, database, a deployable app shell, and the design system. This is the invisible foundation.

#### Module 0.1: Project Setup

- **F-0.1.1** — Initialize project structure for the web application and supporting backend services
- **F-0.1.2** — Set up database schema foundations (users, roles)
- **F-0.1.3** — Set up deployment pipeline (CI/CD to staging)
- **F-0.1.4** — Configure environment management (dev, staging, production)

#### Module 0.2: Authentication & Identity

- **F-0.2.1** — Phone OTP-based authentication (send OTP, verify OTP, issue session)
- **F-0.2.2** — Role-based access control (public, participant, organizer, admin)
- **F-0.2.3** — Session management suitable for mobile browsers and deferred participant authentication
- **F-0.2.4** — Deferred authentication pattern — allow browsing unauthenticated, trigger OTP only at booking submission

#### Module 0.3: Design System & App Shell

- **F-0.3.1** — Mobile-first responsive layout shell
- **F-0.3.2** — Core UI component library (buttons, forms, cards, modals, navigation)
- **F-0.3.3** — Role-based routing and navigation structure
- **F-0.3.4** — Error handling and loading state patterns

---

### Phase 1: Organizer Onboarding & Event Creation

**Goal:** Enable organizers to sign up, get verified, and create publishable events. This is the supply side — without events, nothing else works.

**Why second:** The entire product depends on having organizers and events in the system. Participants can't book what doesn't exist.

#### Module 1.1: Organizer Signup & Verification

- **F-1.1.1** — Organizer registration form (business name, contact details, city)
- **F-1.1.2** — Verification document upload (Aadhaar, PAN, GST certificate, bank proof)
- **F-1.1.3** — Policy acceptance workflow (platform terms, refund policy framework)
- **F-1.1.4** — Verification status tracking for organizer (pending, approved, rejected) with a target 2-business-day review SLA from complete submission
- **F-1.1.5** — Admin verification review interface (approve/reject with notes) with logged access to organizer verification documents
- **F-1.1.6** — Verification badge assignment on approval; paid-event publishing eligibility only after organizer verification

#### Module 1.2: Event Creation & Management

- **F-1.2.1** — Event creation form for V1-allowed events only (single-day, paid running events in the launch city) with name, date, time, location, description, and route details
- **F-1.2.2** — Event category and distance configuration (5K, 10K, half-marathon, etc.) with **per-category capacity** (each category sells out independently — DEC-3 v2.2; sold out is per-category, not per-event)
- **F-1.2.3** — Pricing configuration (per category, early-bird support)
- **F-1.2.4** — Registration form field configuration (standard fields + fitness-specific: blood group, T-shirt size, emergency contact), with sensitive fields optional by default unless a safety-critical reason is provided
- **F-1.2.5** — Refund and cancellation policy capture per event
- **F-1.2.6** — Event publish workflow (draft → under review → published) gated by organizer verification for paid events
- **F-1.2.7** — Admin manual review interface for the first 3 paid events from each new organizer before publish
- **F-1.2.8** — Event edit and update capabilities (pre-event)

---

### Phase 2: Event Discovery & Public Pages

**Goal:** Make published events discoverable and present them professionally. This is the demand-generation layer — the pages that participants and the public will actually see.

**Why third:** Events must exist (Phase 1) before they can be displayed. These public pages are what organizers will share and what participants will land on.

#### Module 2.1: Event Detail Page

- **F-2.1.1** — Professional event page layout (structured info: route, categories, pricing, timing, location)
- **F-2.1.2** — Organizer info section with verification badge and link to organizer profile
- **F-2.1.3** — Policy display (refund policy, cancellation policy) visible before booking, alongside clear organizer identity and trust information
- **F-2.1.4** — Category and pricing breakdown display
- **F-2.1.5** — Share-optimized previews (Open Graph meta tags for social/messaging shares)
- **F-2.1.6** — Structured data markup for search engine discovery
- **F-2.1.7** — "Register Now" call-to-action linking to booking flow
- **F-2.1.8** — Mobile-first responsive event page design

#### Module 2.2: Event Discovery Surface

- **F-2.2.1** — Launch-city event listing page (Coimbatore)
- **F-2.2.2** — Basic event cards with key info (name, date, location, price range, categories)
- **F-2.2.3** — Event status indicators (upcoming, registration open/closed, sold out)
- **F-2.2.4** — Sort by date (default: upcoming first)

#### Module 2.3: Organizer Public Profile

- **F-2.3.1** — Organizer profile page with business name, description, verification badge
- **F-2.3.2** — Upcoming events listing on organizer profile
- **F-2.3.3** — Past event history on organizer profile
- **F-2.3.4** — Verification status explanation copy that describes verification as an onboarding and policy check, not a blanket guarantee of event quality or safety

---

### Phase 3: Registration, Payment & Booking

**Goal:** The core value proposition — a unified registration + payment flow that eliminates the Google Forms + payment link mismatch.

**Why fourth:** Requires events to exist (Phase 1) and event pages to be live (Phase 2). This is the single most important product flow.

#### Module 3.1: Registration Flow

- **F-3.1.1** — Category selection step (pick distance/category from event options)
- **F-3.1.2** — Registration form with pre-configured fields (name, email, phone, age, gender, city + fitness fields)
- **F-3.1.3** — OTP-based identity verification triggered at form submission
- **F-3.1.4** — Auto-fill from saved participant profile for returning participants
- **F-3.1.5** — Form validation with clear error messaging
- **F-3.1.6** — Consent capture at submission (data usage, event policies)
- **F-3.1.7** — Parental consent for minor participants (age < 18): server-side gate that requires a parent/guardian name + email and a parental consent checkbox before a booking can be submitted; stored as a fourth `parental` consent type in `consent_records` (DPDPA pre-launch gate, v2.2)

#### Module 3.2: Payment Integration

- **F-3.2.1** — Payment gateway integration (Razorpay Route or Cashfree Split) that supports payment-time split with organizer-linked settlement
- **F-3.2.2** — UPI + card payment support
- **F-3.2.3** — Split payout configuration (EventKart fee captured at payment time, remainder settled to the organizer-linked account)
- **F-3.2.4** — Payment status tracking (initiated, success, failed, refunded)
- **F-3.2.5** — Payment failure handling with retry flow
- **F-3.2.6** — Free pilot period handling (first 3 events: no platform fee split)

#### Module 3.3: Booking Confirmation

- **F-3.3.1** — Booking record creation on successful payment
- **F-3.3.2** — Booking confirmation page with summary
- **F-3.3.3** — QR code generation for the booking (used for event-day check-in)
- **F-3.3.4** — Booking confirmation email with QR ticket
- **F-3.3.5** — Booking status management (confirmed, cancelled, refunded, checked-in)

#### Module 3.4: Participant Profile

- **F-3.4.1** — Save participant details on first booking (name, age, blood group, emergency contact, T-shirt size)
- **F-3.4.2** — Profile view and edit for participants
- **F-3.4.3** — Booking history view for participants
- **F-3.4.4** — Profile data deletion request capability

---

### Phase 4: Organizer Operations Dashboard

**Goal:** Give organizers visibility into registrations, payments, and participant management for their events.

**Why fifth:** Bookings must be flowing (Phase 3) before the dashboard has meaningful data to display.

#### Module 4.1: Event Operations View

- **F-4.1.1** — Registered / paid / checked-in count summary per event
- **F-4.1.2** — Participant list with status filters (registered, paid, checked-in)
- **F-4.1.3** — Individual participant booking detail view
- **F-4.1.4** — Basic revenue view per event (total collected, EventKart fee, net to organizer)
- **F-4.1.5** — Participant roster export (CSV for offline fallback)

#### Module 4.2: Multi-Event Overview

- **F-4.2.1** — Organizer home showing all their events (upcoming, past)
- **F-4.2.2** — Event status summary cards (draft, published, completed)
- **F-4.2.3** — Quick-access links to event operations

---

### Phase 5: Event-Day Operations

**Goal:** Enable smooth event-day execution with QR check-in and offline fallback.

**Why sixth:** Requires bookings with QR codes (Phase 3) and the organizer dashboard (Phase 4). This is the event-day reliability layer.

#### Module 5.1: QR Check-In

- **F-5.1.1** — QR code scanner interface for organizers (camera-based, mobile browser)
- **F-5.1.2** — Scan result display: participant name, category, payment status, check-in status
- **F-5.1.3** — Check-in confirmation action (mark as checked in)
- **F-5.1.4** — Duplicate scan detection (already checked in warning)
- **F-5.1.5** — Sensitive field suppression (blood group, medical info not shown on scan by default)

#### Module 5.2: Manual Search Fallback

- **F-5.2.1** — Search participants by name or phone number
- **F-5.2.2** — Search results with booking and payment status
- **F-5.2.3** — Manual check-in action from search results

#### Module 5.3: Offline Roster

- **F-5.3.1** — Downloadable participant roster (PDF or print-friendly format)
- **F-5.3.2** — Roster includes: name, category, payment status, and bib only if assigned outside EventKart
- **F-5.3.3** — Sensitive fields included only if marked safety-critical by organizer
- **F-5.3.4** — Delete-after-event instruction included with export

---

### Phase 6: Communications & Retention

**Goal:** Close the loop after booking and after the event. Drive repeat participation.

**Why seventh:** Requires completed bookings (Phase 3) and event completion (Phase 5) to trigger the right messages at the right time.

#### Module 6.1: Transactional Emails

> **Note (v2.2 relocation):** F-6.1.1 (email service integration) and F-6.1.2 (booking confirmation email) have been moved to **Phase 3 Module 3.3** as `I-3.3.1` and `I-3.3.5` because they are on the critical path for booking confirmation. They are listed below for traceability only — do not schedule them under Phase 6.

- **F-6.1.1** — _[Moved to Phase 3 — see I-3.3.1]_ Email service integration and template system
- **F-6.1.2** — _[Moved to Phase 3 — see I-3.3.5]_ Booking confirmation email (event details, QR ticket, policies)
- **F-6.1.3** — Event reminder email (1-2 days before event)
- **F-6.1.4** — Booking cancellation/refund confirmation email

#### Module 6.2: Post-Event & Retention

- **F-6.2.1** — Post-event follow-up email to participants
- **F-6.2.2** — Include organizer-provided wrap-up or external results links when available; first-party results hosting remains out of scope for V1
- **F-6.2.3** — Next-event prompt for repeat booking in follow-up email
- **F-6.2.4** — Organizer interface to add post-event content (results link, photos link, next event link)

---

### Phase 7: Refunds, Disputes & Admin Operations

**Goal:** Handle the exception paths — refunds, disputes, and platform-level administration.

**Why eighth:** The happy path must work first (Phases 1-6). This phase hardens the product for real-world edge cases during the pilot.

#### Module 7.1: Refund Workflow

- **F-7.1.1** — Refund request initiation (participant-side or organizer-initiated)
- **F-7.1.2** — Refund processing through payment gateway (reverse split)
- **F-7.1.3** — Refund status tracking and communication to participant
- **F-7.1.4** — Handling for already-settled funds (organizer responsibility, EventKart mediation)

#### Module 7.2: Dispute & Support

- **F-7.2.1** — Participant issue reporting mechanism (contact/form-based)
- **F-7.2.2** — Admin dispute queue and management interface
- **F-7.2.3** — 2-business-day first-response SLA tracking
- **F-7.2.4** — Organizer suspension workflow for repeated violations

#### Module 7.3: Admin Operations Panel

- **F-7.3.1** — Organizer verification queue (pending applications, approve/reject)
- **F-7.3.2** — Event review queue (new organizer events pending manual review)
- **F-7.3.3** — Payout monitoring dashboard (split payout status, exceptions)
- **F-7.3.4** — Audit log for sensitive data access (verification docs, participant sensitive fields)

---

## 4. Trust, Privacy, and Data Handling Requirements

These requirements apply across phases and should be treated as product guardrails, not optional implementation details.

### 4.1 Trust and participant protection

- Organizer verification is mandatory for paid events
- Every paid event must display organizer identity, refund policy, cancellation policy, and core event details before booking
- The first 3 paid events from every new organizer require manual review before publish during the pilot
- Verification must be explained as a EventKart onboarding and policy check, not a blanket guarantee of event quality or safety
- Participants must be able to report issues through EventKart support, not only through the organizer
- Repeated organizer complaints or policy violations must support suspension workflows

### 4.2 Data minimization and access rules

- Collect only the participant data needed for registration, booking management, and event-day operations
- Sensitive participant fields such as blood group or medical details are optional by default unless the organizer provides a safety-critical reason to require them
- Organizers may access participant data only for their own events
- Sensitive participant data should be restricted to event-day workflows and offline fallback where needed
- Organizer verification documents must be stored separately from participant booking data
- Access to organizer verification documents and sensitive participant data must be logged

### 4.3 Retention and deletion posture

- Participant profile data must support deletion requests
- Booking and payment records may need retention for financial or audit requirements; where deletion is not possible, anonymization should be supported instead
- Sensitive event-day data should be removed after the required retention window unless legally required otherwise
- Offline roster exports must include delete-after-event handling guidance

### 4.4 Regulatory and messaging posture

- Consent must be captured at booking submission with no pre-checked boxes
- V1 should follow a DPDPA-aware posture based on data minimization, purpose limitation, and consent
- Email is the default transactional communication channel in V1
- Transactional WhatsApp is explicitly deferred and must not be treated as a V1 dependency

---

## 5. Dependency Map (Simplified)

```
Phase 0: Foundation
    └── Phase 1: Organizer Onboarding & Event Creation
            └── Phase 2: Event Discovery & Public Pages
                    └── Phase 3: Registration, Payment & Booking
                            ├── Phase 4: Organizer Operations Dashboard
                            ├── Phase 5: Event-Day Operations
                            └── Phase 6: Communications & Retention
                                    └── Phase 7: Refunds, Disputes & Admin Ops
```

**Key dependencies:**

- Phase 0 blocks everything
- Phase 1 blocks Phase 2 (can't show events that don't exist)
- Phase 2 blocks Phase 3 (booking flow needs an event page to land on)
- Phase 3 blocks Phases 4, 5, 6 (all need bookings to exist)
- Phase 6 can partially overlap with Phase 5 (emails can be built while check-in is developed)
- Phase 7 can start once Phase 3 payment flow is working (doesn't need Phases 4-6)

**Parallelization opportunities:**

- Phases 4, 5, and 6 can be built in parallel after Phase 3
- Module 6.1 (transactional emails) can start during Phase 3 since booking confirmation email is part of the booking flow
- Module 7.3 (admin panel) can start during Phase 1 since organizer verification review is needed early

---

## 6. Feature Count Summary

| Phase                                          | Modules | Features |
| ---------------------------------------------- | ------- | -------- |
| Phase 0: Foundation                            | 3       | 12       |
| Phase 1: Organizer Onboarding & Event Creation | 2       | 14       |
| Phase 2: Event Discovery & Public Pages        | 3       | 12       |
| Phase 3: Registration, Payment & Booking       | 4       | 21       |
| Phase 4: Organizer Operations Dashboard        | 2       | 8        |
| Phase 5: Event-Day Operations                  | 3       | 12       |
| Phase 6: Communications & Retention            | 2       | 8        |
| Phase 7: Refunds, Disputes & Admin Ops         | 3       | 12       |
| **Total**                                      | **22**  | **99**   |

---

## 7. What This Document Does NOT Cover

This is a build-order blueprint, not an implementation spec. The following are deferred to per-feature implementation planning:

- Tech stack selection
- Database schema design
- API contract definitions
- UI/UX wireframes and detailed interaction design
- Third-party vendor selection (payment gateway, email provider, OTP provider)
- Performance requirements and SLAs
- Testing strategy
- Deployment architecture

Each feature (e.g., F-3.2.1) will be expanded into a detailed implementation spec when its phase begins.
