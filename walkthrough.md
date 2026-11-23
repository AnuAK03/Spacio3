# Security Summary

**Reviewed Files**: 8
**Issues Resolved**: 3

### Issues Resolved
| Area | File | Line | What Was Happening | Impact | Status | How It Was Fixed |
|---|---|---|---|---|---|---|
| Cross-Provider Access Control | `server.ts` & `server/domain.ts` | 1116–1348 (`server.ts`), 2311–2372 (`domain.ts`) | Any signed-in provider could modify another provider's space pricing, owner blocks, availability withdrawals, facility details, driver assignments, evidence submissions, or facility bookings because routes checked only the caller's role without verifying ownership. | High | Fixed | Added backend ownership checks (`isProviderOwnedByHost`, `isFacilityOwnedByHost`, `isSpaceOwnedByHost`, `checkHostBookingAccess`) across all provider mutation routes, rejecting unauthorized cross-provider requests with HTTP `403`. |
| Role-Scoped Data Isolation | `server/domain.ts`, `server.ts`, & `src/components/ProviderPortalView.tsx` | 2406–2670 (`domain.ts`), 245–454 (`ProviderPortalView.tsx`) | All read and mutation endpoints returned the unfiltered global platform snapshot, allowing providers to view other providers' facilities, bookings, settlements, and unrelated driver profiles, and UI fallbacks defaulted to other providers' records. | High | Fixed | Added `getSnapshotForUser(user)` on the server to filter providers, facilities, spaces, bookings, settlements, refunds, disputes, transactions, and driver data strictly to the signed-in user's role and ownership, and removed UI cross-provider fallbacks. |
| Unauthenticated Workspace Endpoint | `server.ts` & `src/App.tsx` | 183–187 (`server.ts`), 113–145 (`App.tsx`) | `GET /api/workspace` (as well as `/api/locations/select`, `/api/search`, and `/api/pooling/compare`) did not require authentication, exposing providers, bookings, wallets, and payment records to anonymous callers. | High | Fixed | Protected `/api/workspace` and related workspace endpoints with `requireAuth`, returning HTTP `401` when unauthenticated and role-filtered data when signed in; updated the frontend to send Bearer tokens only when authenticated and clear workspace state on sign-out. |

### Safeguards Verified
| Area | File | How It's Protected |
|---|---|---|
| Session & Token Verification | `server/security.ts` & `server/auth.ts` | Session tokens are HMAC-signed and verified server-side on every protected request via `requireAuth`; passwords and recovery phrases use salted hashing with per-account login rate limits. |
| Driver Booking & Wallet Isolation | `server.ts` & `server/domain.ts` | Driver booking holds, check-ins, extensions, wallet payments, disputes, and notifications verify `bk.driverEmail === user.email` on the backend and force the caller's authenticated email rather than trusting client-supplied identity fields. |
| Gateway Webhook Integrity | `server.ts` & `server/domain.ts` | Payment webhook processing validates HMAC-SHA256 signatures, enforces idempotent event handling, and no longer returns global workspace snapshots in webhook responses. |
| Dependency Security | `bun.lock` | Ran `bun audit` across 298 installed packages with 0 known vulnerabilities reported. |

---

## PoC Verification

### 1. SEC-005 — Cross-Provider Price & Facility Modification Blocked
#### Summary
| Field | Value |
|---|---|
| Issue Type | Broken Object-Level Authorization (Cross-Provider Mutation) |
| Impact | High |
| Affected File | `server.ts:1187-1208` |
| Test Scenario | Two distinct provider accounts (`Provider A` and `Provider B`) registered and each created their own facility and space. `Provider B` attempted `POST /api/spaces/<spaceAId>/pricing`, `PUT /api/facilities/<facAId>`, `DELETE /api/facilities/<facAId>`, `POST /api/facilities/<facAId>/assign`, `POST /api/spaces/<spaceAId>/owner-blocks`, `POST /api/spaces/<spaceAId>/withdraw`, and `POST /api/providers/<prvAId>/evidence`. |

#### How It Was Fixed
Every provider mutation route now resolves the target space, facility, or provider and verifies ownership via `store.isSpaceOwnedByHost`, `store.isFacilityOwnedByHost`, or `store.isProviderOwnedByHost` before applying any change. In addition, facility creation no longer falls back to a default shared provider (`PRV-05`) and rejects foreign `providerId` values.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | `Provider B` sends `POST /api/spaces/<spaceAId>/pricing` with `{ hourlyPriceInr: 999 }` and `Provider B`'s Bearer token. | `requireAuth(req, res, ['host', 'admin'])` authenticates `Provider B`. |
| 2 | Server checks `store.spaces.some(s => s.id === req.params.spaceId)` and then evaluates `store.isSpaceOwnedByHost(req.params.spaceId, user)`. | Ownership check resolves `spaceA -> facA -> prvA`, whose `contactEmail` belongs to `Provider A`, not `Provider B`. |
| 3 | Server immediately responds `403 Forbidden` without invoking `updateSpacePricingAndRestrictions`. | Live test returned HTTP `403` for all cross-provider mutation attempts; `Provider A`'s hourly rate stayed `₹50/hr`, while `Provider A` updating its own space succeeded with HTTP `200` (`₹75/hr`). |

---

### 2. SEC-001 — Cross-Provider Data Visibility Restricted
#### Summary
| Field | Value |
|---|---|
| Issue Type | Missing Tenant Filtering in API Responses |
| Impact | High |
| Affected File | `server/domain.ts:2406-2670` & `src/components/ProviderPortalView.tsx:245-454` |
| Test Scenario | `Provider B` called `GET /api/workspace` after `Provider A` and `Provider B` both registered providers and facilities. |

#### How It Was Fixed
Added `store.getSnapshotForUser(user)` and replaced all `store.getSnapshot()` calls across routes in `server.ts`. For `host` users, the backend returns only providers whose `contactEmail` matches the signed-in host, along with facilities, spaces, bookings, settlements, refunds, disputes, incidents, and audit entries scoped to those provider/facility IDs. Unrelated driver profiles, payment orders, webhook logs, and wallets are returned empty.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | `Provider B` sends authenticated `GET /api/workspace`. | `requireAuth` resolves `Provider B`'s session. |
| 2 | `store.getSnapshotForUser(user)` filters `this.providers` by `contactEmail === user.email` and restricts facilities, spaces, bookings, and settlements to owned IDs. | `Provider B` receives strictly 1 provider, 1 facility, 1 space, 0 foreign bookings/settlements, and 0 `driverProfiles`/`wallets`. |
| 3 | `ProviderPortalView` renders strictly owned facilities/settlements with no fallback to other providers. | Confirmed both `Provider A` and `Provider B` see only their own records. |

---

### 3. SEC-003 — Authentication Enforced on `/api/workspace`
#### Summary
| Field | Value |
|---|---|
| Issue Type | Missing Authentication on Workspace API |
| Impact | High |
| Affected File | `server.ts:183-187` & `src/App.tsx:113-145` |
| Test Scenario | Unauthenticated client sent `GET /api/workspace` and `POST /api/locations/select` without an `Authorization` header. |

#### How It Was Fixed
Wrapped `GET /api/workspace` (plus `/api/locations/select`, `/api/search`, and `/api/pooling/compare`) with `requireAuth(req, res)` so requests lacking a valid signed Bearer token are rejected with `401 Unauthorized`. Updated the React client so `/api/workspace` is fetched only after sign-in with the Bearer header and cleared on logout.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Anonymous caller sends `GET /api/workspace`. | `extractBearerUser(req)` returns `null`. |
| 2 | `requireAuth(req, res)` sends HTTP `401` (`Authentication required. Please sign in.`) and returns early. | Live test returned HTTP `401` for unauthenticated `GET /api/workspace` and `POST /api/locations/select`, while authenticated driver booking and dashboard flows continued to pass end-to-end. |
