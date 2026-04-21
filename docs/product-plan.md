---
goal: EventKart V1 — complete product plan (vision + execution)
version: 2.1
date_created: 2026-04-19
last_updated: 2026-04-19
owner: Product / Founding Team
tags: [product, strategy, v1]
---

# EventKart V1 Product Plan

The canonical source of truth for EventKart V1. This document combines product strategy, launch scope, commercial posture, trust posture, and execution sequence.

---

## 1. Vision and Positioning

### One-line vision

EventKart is the organizer operating system for fitness events in India — starting with unified registration, payments, and event-day operations, with public discovery and participant identity compounding over time.

### Mission

Help fitness event organizers in India launch events with professional-grade tooling, eliminate manual registration-payment reconciliation, run clean event-day operations, build credibility through verification, and grow repeatable event businesses.

Help fitness participants in India discover trustworthy events, register and pay in one seamless flow, receive instant confirmation, and gradually build a reusable event identity.

### Category

Vertical SaaS for fitness event organizers, with public event-discovery surfaces that can evolve into a marketplace over time.

### Positioning statement

For Indian fitness event organizers still running on Google Forms, payment links, WhatsApp, and spreadsheets, EventKart is the organizer system of record for paid fitness events. Unlike generic ticketing tools or broad event portals, EventKart unifies registration, payment, participant management, and event-day check-in in one India-first workflow, while using public event pages to support discovery and distribution.

### What EventKart is not

- A wedding, concert, or entertainment ticketing platform
- A generic all-events marketplace
- A travel or hotel booking product
- A GPS tracking or workout logging app
- An enterprise white-label event stack
- A full social fitness network in V1

---

## 2. Who EventKart Serves

### Primary customer: Organizers

Small to mid-sized Indian fitness event organizers are the first buyer and the primary success driver for V1.

**Ideal first organizer:**

- Runs 1-10 events per month
- Hosts 50-2,000 participants per event
- Currently uses Google Forms + Razorpay + WhatsApp + Excel
- Operates in digitally active urban markets
- Cares about professionalism, operational efficiency, and repeat participation

**Best-fit early examples:**

- Running clubs organizing 5K, 10K, and half-marathon events
- Boutique endurance event brands
- Active lifestyle communities running paid city events
- Local organizers ready to migrate from Google Form + payment-link workflows

### Primary user: Participants

Participants are the end users of the booking flow and the long-term retention layer, but not the primary buyer in V1.

**They want:** trustworthy event information, one-step registration and payment, instant confirmation, a saved profile they do not re-enter every time, and confidence that the organizer is legitimate.

### Customers to avoid initially

- Large national marathon brands with enterprise requirements
- Corporate event management teams
- Music, food, or entertainment organizers
- Tour operators and travel agencies
- Organizations needing white-label customization

---

## 3. V1 Wedge and Boundary

### Core boundary

V1 is an organizer-tool-first product for single-day paid running events in Coimbatore. Participants can browse event pages publicly without logging in and complete a lightweight OTP-based identity step only when submitting a booking.

### Launch wedge

- **City:** Coimbatore
- **Category:** Single-day paid running events
- **Adjacent expansion:** Cycling, only after the running wedge shows repeat organizer pull
- **Deferred:** Trekking/hiking, multi-day events, and higher-risk categories

### In-scope organizer capabilities

- Organizer signup, approval, and verification workflow
- Event creation and publishing with a structured event page
- Unified registration and payment flow for paid events
- Basic participant operations dashboard with participant status and revenue view
- Booking confirmation and reminder emails
- QR-based check-in with manual search fallback
- Exportable roster for offline fallback
- Basic refund/dispute workflow with EventKart ops support
- Organizer profile with verification status and event history

### In-scope participant capabilities

- Public browsing of event pages without login
- OTP-based identity verification only at booking submission
- One-step registration and payment for paid events
- Saved participant details for faster repeat booking
- Booking confirmation with QR ticket
- Post-event follow-up email with organizer-provided wrap-up or results links when available, plus next-event prompts

### Explicitly out of scope for V1

- Trekking and hiking events
- Multi-sport or multi-day events
- Full native mobile apps
- GPS tracking or live participant tracking
- Race timing chip integration
- First-party results publishing and certificate generation
- Participant public profiles or public fitness portfolios
- Waitlists or ticket resale
- Group pricing or team registrations
- Club memberships or subscriptions
- Reviews and ratings
- Community feed or in-platform chat
- Personalized recommendations
- White-label or custom domain support
- Multilingual support
- Gear rental or merchandise sales
- Sponsorship management tools
- Hotel, transport, or travel booking
- Full multi-city marketplace positioning
- WhatsApp as a transactional dependency
- Advanced analytics or reporting

---

## 4. Product Principles

1. **Make organizers more money** — If a feature does not help organizers increase paid registrations, improve fill rates, or grow repeat participation, it is not a V1 priority.
2. **Solve reconciliation first** — The registration-payment mismatch is the organizer's biggest pain. The unified flow is the core value proposition.
3. **Trust before scale** — Clear organizer policies, bounded verification, and reliable booking state matter more than feature count.
4. **Build compounding value early** — Participant history, organizer credibility, and repeat-booking convenience must start compounding from day one.
5. **Density over breadth** — Win one city and one category deeply before spreading.
6. **India-first workflows** — UPI-friendly payments, phone-based identity, and mobile-first design are essential.
7. **Mobile-first, web-first** — The product must work seamlessly on mobile browsers. Native apps are not required in V1.
8. **No login walls for discovery** — Participants must never log in for browsing. Identity verification begins only at booking submission.

---

## 5. Value Proposition and Commercial Reframe

The core V1 promise is not just “save admin time.” It is: **help organizers get more paid registrations with a cleaner booking flow, higher participant trust, and lower repeat-booking friction.**

This means V1 must improve the metrics that organizers actually care about:

| Metric                           | What moves it                                     | V1 feature                                                          |
| -------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------- |
| **Registration completion rate** | Fewer steps from event page to paid booking       | Unified registration + payment flow                                 |
| **Fill rate**                    | More credible event pages and lower abandonment   | Professional event pages with policy clarity and share optimization |
| **Repeat participant rate**      | Less friction for returning participants          | Saved profiles and fast repeat booking                              |
| **Revenue per event**            | Better pricing clarity and urgency where relevant | Structured pricing display and early-bird support                   |

### Implications for V1 prioritization

- **Elevate:** event-page conversion, trust signals, payment completion, repeat-booking convenience, and event-day reliability
- **Keep basic only:** operational dashboarding and admin tooling
- **Defer:** analytics-heavy reporting, exports as a selling point, and secondary ecosystem features

---

## 6. V1 Feature Priorities

### Tier 1 — Must ship

These are the features that make an organizer say, “EventKart helped this event convert and run better.”

1. **Unified registration + payment page**
   - Single mobile-first flow: event details → registration form → payment → instant confirmation
   - No separate form links, no payment screenshots
   - UPI + card support through the chosen payment provider

2. **Professional event pages that convert**
   - Clean, branded event page with structured info: route, categories, pricing, policies, and organizer details
   - Organizer verification badge and clear trust copy
   - Social proof and urgency only where real and supportable
   - Share-optimized previews for social and messaging links
   - Structured data for search discovery

3. **Organizer verification and policy display**
   - Visible verification badge on event pages
   - Checklist-based verification: identity docs, payout readiness, policy acceptance
   - Refund and cancellation policy shown before booking

4. **Saved participant profile + fast repeat booking**
   - OTP-based identity at booking time only
   - Save core details: name, age, blood group, emergency contact, T-shirt size
   - Pre-filled repeat booking for returning participants

5. **QR check-in with offline fallback**
   - QR scan for booking and payment verification
   - Manual search fallback for poor connectivity scenarios
   - Exportable roster as offline backup

6. **Post-event follow-up and repeat-booking nudge**
   - Follow-up email after the event
   - Include organizer-provided wrap-up or results links when available
   - Include next-event prompt for repeat booking

### Tier 2 — Should ship

1. **Basic organizer operations dashboard**
   - Registered / paid / checked-in counts
   - Participant list with status filters
   - Basic revenue view

2. **Organizer profile page**
   - Verification status, upcoming events, and past event history
   - Credibility layer for new organizers

3. **Email confirmations and reminders**
   - Booking confirmation with QR ticket
   - Event reminder before event day
   - Email as the default transactional channel in V1

4. **Basic refund/dispute tooling**
   - Organizer refund policy captured and displayed
   - EventKart ops workflow for exception handling and participant support

### Tier 3 — Defer

- CSV export as a core selling point
- Advanced analytics or reporting
- Bib number auto-assignment
- Transactional WhatsApp integration
- First-party results publishing and certificates
- Participant public portfolios or achievement profiles
- Organizer follow/notification graph
- Browse/filter discovery beyond a thin launch-city surface
- Category expansion beyond running

---

## 7. Payments and Commercial Model

### Locked product decision

V1 uses **payment-time split with organizer-linked settlement** as the commercial model. The primary implementation target is Razorpay Route. Cashfree Split is an acceptable alternative if it supports the same organizer-trust posture and execution requirements better. Gateway choice is an implementation decision, not a product-strategy blocker.

### Why split payout is the right V1 model

| Criteria          | Split payout                                     | Post-invoice              | Merchant of record |
| ----------------- | ------------------------------------------------ | ------------------------- | ------------------ |
| Fee enforcement   | Automatic on every transaction                   | Weak                      | Strong             |
| Organizer trust   | High — money settles to organizer-linked account | Medium                    | Lower              |
| Refund control    | Moderate to strong                               | Weak                      | Strong             |
| Compliance burden | Moderate                                         | Low                       | High               |
| Adoption friction | Low                                              | Low                       | High               |
| Fit for V1        | Best balance                                     | Weak monetization control | Too heavy          |

### Pilot commercial posture

- First 3 events are free for organizer onboarding
- After the free period, EventKart captures its fee at payment time via split payout
- Target pilot fee band: **3-5%** on paid registrations
- Final public pricing can be published in a separate commercial memo before broad rollout
- Post-event invoicing is not the primary V1 model

### Refund posture

- The organizer owns the published refund policy for each event
- If the organizer cancels and refundable funds are still under platform or provider control, EventKart initiates the refund workflow
- If funds have already settled, the organizer remains economically responsible and EventKart mediates support and enforcement
- Target dispute first-response SLA: **2 business days** during the pilot

---

## 8. Compounding Value and Switching Costs

EventKart becomes harder to replace when it compounds organizer value over time, not when it merely saves admin hours.

### Layer 1 — Participant history inside EventKart

- Every registration builds the organizer's participant database inside EventKart
- Returning participants can be recognized across the organizer's past events
- Switching away means losing structured repeat-participant visibility

### Layer 2 — Saved profiles reduce repeat-booking friction

- Participants save their details once and rebook faster
- Organizers benefit because repeat runners face less form friction

### Layer 3 — Public organizer credibility

- Organizer profile shows verification status and event history
- Event pages become assets the organizer can keep sharing

### Layer 4 — Post-event reactivation

- Post-event email nudges participants toward the organizer's next event
- Repeat booking becomes an intentional workflow, not an ad hoc WhatsApp blast

### Layer 5 — Density-driven discovery (post-V1)

- As local supply grows, participants begin browsing across organizers
- Cross-organizer discovery becomes more valuable only after density exists

In practical terms, an organizer who has run multiple events on EventKart has more than a booking tool: they have participant history, public credibility, reusable event pages, and a repeat-booking funnel.

---

## 9. Trust and Participant Protection

### Prevention

- Organizer verification is mandatory for paid events
- Every paid event must display organizer identity, refund policy, cancellation policy, and core event details before booking
- During the pilot, the first 3 paid events from every new organizer are manually reviewed before publish
- Target organizer verification SLA: **2 business days** from complete submission

### Transparency

- Event pages clearly state who is organizing the event
- Verification is explained as a EventKart onboarding and policy check, not a blanket quality guarantee
- Participants see refund and cancellation terms before payment

### Response

- Participants can report issues through EventKart support, not only through the organizer
- EventKart mediates refund and dispute workflows during the pilot
- Repeated organizer complaints or policy violations can trigger suspension

### Boundaries of EventKart's promise

- EventKart is not a guarantor of event safety or event quality
- EventKart does not provide blanket marketplace-style protection for every event outcome
- EventKart does provide stronger trust signals, policy transparency, booking-state reliability, and dispute escalation than a typical Google Form flow

---

## 10. Go-to-Market and Pilot Motion

### Core pitch

EventKart helps organizers get more paid registrations with professional event pages, instant payment confirmation, and lower repeat-booking friction.

### Organizer acquisition motion

1. **Target organizers already feeling pain**
   - Prioritize organizers who have lost conversions, dealt with payment mismatches, or look unprofessional with current tools

2. **Run side-by-side proof where needed**
   - Compare EventKart conversion against the organizer's Google Form + payment-link flow on a comparable event

3. **Reduce adoption friction early**
   - First 3 events free
   - High-touch onboarding in Coimbatore

### Density target for Coimbatore

- **Month 1-2:** 5 organizers, 10+ events
- **Month 3-4:** 10 organizers, 20+ events
- **Month 5-6:** 15+ organizers, 30+ events

### Expansion criteria for the next city

Expand beyond Coimbatore only after:

- 15+ active organizers in Coimbatore
- At least 3 organizers have run 3+ events on EventKart
- EventKart has proven conversion improvement versus the old flow
- Split payout operations are stable in production

---

## 11. Success Criteria and Metric Definitions

| Metric                           | Definition                                                                                                                                                                       | V1 target                            |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| **Conversion proof**             | At least 3 organizers show higher registration completion rate on EventKart than on their previous comparable Google Form + payment-link flow, or in an agreed side-by-side test | Achieve by pilot close               |
| **Registration completion rate** | Paid bookings ÷ started registrations on EventKart                                                                                                                               | Improve versus organizer baseline    |
| **Repeat organizer usage**       | Organizers who publish 3+ events on EventKart within 6 months                                                                                                                    | At least 5 organizers                |
| **Repeat participant rate**      | Participants who complete a second paid booking on EventKart within 6 months of their first paid booking                                                                         | At least 20%                         |
| **Revenue capture reliability**  | Successful paid registrations where EventKart fee is captured automatically without manual invoicing                                                                             | At least 95%                         |
| **Trust baseline**               | Organizer-initiated cancellation cases that receive refund or documented policy-based resolution within the stated support SLA                                                   | Zero unresolved cases at pilot close |

---

## 12. Implementation Sequence

### Phase 1: Core booking engine (Week 1-6)

- Event creation and professional event page
- Registration form with fitness-specific fields
- Unified registration + payment flow with split payout integration
- OTP-based participant identity at booking
- Booking confirmation email with QR ticket
- Basic organizer operations dashboard

### Phase 2: Trust and payments hardening (Week 4-8, overlaps)

- Organizer signup and verification workflow
- Refund/cancellation policy capture and display
- Split payout operations and exception handling
- Manual review workflow for new organizers

### Phase 3: Event-day operations and retention (Week 6-10)

- QR check-in with payment verification
- Manual search fallback
- Exportable offline roster
- Organizer profile page with event history
- Saved participant profiles for faster repeat booking
- Post-event follow-up email with next-event prompt

### Phase 4: Pilot and prove (Week 8-12)

- Onboard first 5 organizers in Coimbatore
- Run side-by-side conversion tests where required
- Collect support and product feedback
- Validate split payout reliability
- Measure conversion and repeat-booking performance

---

## 13. Privacy and Data Handling

This section defines the target V1 posture. Legal and policy review should validate it before scale.

### Data classes

| Data class                       | Examples                                           | Access                                              | Target retention                                                        |
| -------------------------------- | -------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------- |
| **Participant profile**          | Name, phone, email, age, gender, city              | Participant + booked organizers                     | Until account deletion or 3 years of inactivity                         |
| **Booking data**                 | Event, category, payment status, QR ticket         | Participant + organizer + EventKart ops             | 5 years for financial and audit needs                                   |
| **Sensitive participant fields** | Emergency contact, blood group, medical conditions | Participant + organizer on event-day workflows only | Delete 30 days after event completion unless legally required otherwise |
| **Payment data**                 | Transaction ID, amount, split details              | EventKart ops + payment gateway                     | 5 years for financial and audit needs                                   |
| **Organizer verification docs**  | Aadhaar, PAN, GST certificate, bank proof          | EventKart ops only                                  | Until 1 year after organizer account closure                            |

### Core rules

1. **Data minimization** — Collect only what is needed for registration and event-day operations.
2. **Sensitive fields are optional by default** — Medical conditions and blood group are opt-in unless the organizer provides a safety reason for requiring them.
3. **Consent at collection** — Participants explicitly consent at booking submission. No pre-checked boxes.
4. **Scoped organizer access** — Organizers see only participant data for their own events. Sensitive fields are restricted to event-day workflows and offline fallback where needed.
5. **Separate storage for verification docs** — Organizer KYC documents are stored separately from participant booking data.
6. **Deletion rights** — Participant profile data can be deleted on request; booking records may be anonymized rather than erased where financial records must be retained.
7. **DPDPA-aware posture** — V1 follows data minimization, purpose limitation, and consent principles aligned with India's Digital Personal Data Protection Act.

### Event-day handling

- Offline rosters include only the minimum event-day data needed
- Medical disclosures appear on offline rosters only if marked safety-critical
- Offline roster exports should carry a delete-after-event instruction
- QR check-in should not expose sensitive fields by default on-screen

### Incident posture

- V1 prioritizes prevention through access control and data minimization
- If an incident occurs, EventKart follows applicable notification requirements, including regulator or CERT-In reporting where required
- Access to organizer verification documents and sensitive participant data should be logged

---

## 14. Finalized Decisions for V1

- **Launch wedge is locked:** Coimbatore, single-day paid running events, organizer-tool-first
- **Discovery/auth model is locked:** public browsing with OTP-based identity only at booking submission
- **Core monetization model is locked:** payment-time split with organizer-linked settlement
- **Pilot commercial posture is locked:** first 3 events free, then split-captured fee on paid registrations
- **Operational reporting scope is locked:** basic dashboard in scope; advanced analytics and reporting are deferred
- **Messaging scope is locked:** email is the default transactional channel; transactional WhatsApp integration is deferred
- **Results scope is locked:** first-party results publishing and certificates are deferred; post-event emails may include organizer-provided or timing-partner links when available
- **Event-size rule is locked:** no hard minimum event size, but best-fit early events remain roughly 50-2,000 participants with manual onboarding
- **Tech stack is not a product-plan blocker:** implementation should optimize for speed to market, but the product plan does not depend on a specific stack decision

This version is the finalized V1 plan. Remaining work is implementation, vendor selection inside the chosen model, and legal/commercial operationalization — not further scope definition.
