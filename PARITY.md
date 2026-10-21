# Website and phone app parity

The website (managers and waiters) and the phone app are one product. Anything a manager or waiter can do in one,
they can do in the other, behind the same permissions. Super Admin tools are website-only by design.

## One source of truth (change it once, both update)
| What | Where it lives | Who reads it |
|---|---|---|
| Who may do what | server gate, `lib/enforce.ts` + `db/store.ts` (`access`, `orderAccess`) | every API route, for app and website alike |
| Super Admin feature switches | `app_controls` table, edited in Super Admin > Mobile app | enforced on the server; both clients hide what is off via `GET /api/app-config` |
| Plans, prices, trial length | `plans` table, edited in Super Admin > Plans & trials; `GET /api/plans` | app Plans screen, website Plan and billing, Apply page, Mira's answers |
| Mira's help answers | `lib/help-kb.ts`, served by `GET /api/help?client=app|web` | app chat and website chat (where-to-click wording differs per client) |
| Support questions and replies | `support_questions` table, `/api/support` | app chat, website chat, Super Admin Queries |
| Orders and their rules | `/api/orders` | app Orders, website Orders and waiter workspace |

## Feature map
| Feature | Website | App |
|---|---|---|
| Orders: New / In progress / Done tabs, counts, one button per order, Accept all, cancel with quick reasons, search, history | `app/team/orders-board.tsx` (managers and waiters) | `src/components/OrdersPanel.tsx` |
| Table requests (Call waiter, Bill) | `app/team/service-requests.tsx` | `src/components/ServiceRequests.tsx` |
| Menu editor | Menu manager (`team.tsx`) | Menu tab |
| Waiters: add, reset, suspend, remove | Manage waiters | Team tab |
| Sales, dish performance, reviews, daily insights | sidebar > Insights | Insights tab |
| Restaurant details and QR code | Restaurant settings, QR & customer link | side menu |
| Plan, trial countdown, request a plan | Plan and billing + header pill (`app/team/billing.tsx`) | Plans & billing + header badge |
| Ask Mira, replies from our team | header button (`app/team/help-chat.tsx`) | header orb (`MiraChat.tsx`) |
| Change password (signs out other devices) | Password button / change-password page | Account |
| Sign-in, register, 14-day trial | login page, `/apply` | login, Join |
| Super Admin (requests, directory, plans, queries, app controls) | website only | not in the app |

## Rules when you change something
1. Behaviour and permissions go in the API, never only in a screen.
2. If you change a flow in `orders-board.tsx`, change `OrdersPanel.tsx` the same day, and the other way round.
3. New answers for Mira go in `lib/help-kb.ts` (add a `WEB` wording if the click path differs).
4. A new Super Admin switch needs: the control in `lib/app-controls.ts`, a `featureOff()` check on the route, and the
   screen hidden in both clients.
5. Run the hostile test (`qa-attack.mjs`) before shipping.
