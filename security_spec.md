# Firestore Security Specification - Sports Betting App

This specification details the Security Invariants, threat vectors ("Dirty Dozen" payloads), and rules governing our Firestore database to prevent fraud, credit injections, and other common exploits.

## 1. Data Invariants

- **User Accounts (`/users/{userId}`)**:
  - A user cannot modify another user's balance or account information.
  - A user cannot write a profile with a custom-injected balance upon registration ($1,000 USD is the standard starter bonus).
  - A user profile must belong to the authenticated owner.

- **Match Fixtures (`/matches/{matchId}`)**:
  - Matches represent official sports fixtures.
  - Standard users has read-only access (`get` and `list`) to matches.
  - Users cannot update odds, match statuses, scores, or results.

- **Wagers / Bets (`/bets/{betId}`)**:
  - A user can only place bets on behalf of themselves (`userId == request.auth.uid`).
  - Bets can only be created with a `pending` status. A user cannot create a bet with a `won` or `lost` status (Identity & State Integrity).
  - The `potentialWin` must mathematically equal `amount * odds`.
  - Bets cannot be edited/modified after creation, except during simulated resolution transitions (the user's client resolves the bet based on matching simulated outcomes).

- **Transactions (`/transactions/{transactionId}`)**:
  - Users can only create transactions for their own account.
  - Transaction amounts must perfectly offset the user's balance changes (Atomicity).

---

## 2. Threat Vector Payloads ("Dirty Dozen")

Below are twelve malicious payloads drafted as test targets to be rejected with `PERMISSION_DENIED` by our Firestore rules.

1. **The Unauthorized Profile Access**: Creating or reading `/users/victim_uid` by `attacker_uid`.
2. **The Balance Injection**: Injected payload on profile creation: `{ "userId": "attacker_uid", "balance": 9999999 }` instead of the default balance.
3. **The Score Rigging**: Injected update payload to `/matches/match_1` by `attacker_uid`: `{ "score": { "home": 10, "away": 0 }, "status": "completed" }` to rig a bet.
4. **The Odds Manipulation**: Injected update payload to `/matches/match_1` by `attacker_uid`: `{ "odds": { "homeWin": 999.0 } }`.
5. **The Pre-Resolved Win**: Injected create payload to `/bets/bet_1` by `attacker_uid`: `{ "userId": "attacker_uid", "status": "won", "amount": 100, "potentialWin": 500 }`.
6. **The Victim's Money Wager**: Injected create payload to `/bets/bet_1` by `attacker_uid`: `{ "userId": "victim_uid", "amount": 500 }`.
7. **The Post-Match Bet alteration**: Attacking `/bets/bet_1` by modifying `predictedOutcome` from `"home_win"` to `"away_win"` after learning the game result.
8. **The Fake Ledger**: Creating `/transactions/tx_1` for `victim_uid` to log negative transactions or arbitrary credits.
9. **The Odds Multiplier Cheat**: Placing a bet with custom-crafted odds: `{ "amount": 10, "odds": 50.0, "potentialWin": 500 }` on a match where actual odds are `1.50`.
10. **The Negative Stake Exploit**: Injected bet with negative amount: `{ "amount": -100, "potentialWin": -150 }` to gain credit.
11. **The Identity Spoofing**: Registering a profile with name "System Admin" and requesting role update via `{ "isAdmin": true }` to bypass validations.
12. **The Blanket Scrape**: Sending a query for `/bets` with no `userId` constraint to scrape all bets across the platform.

---

## 3. Rules Implementation Strategy

Our `firestore.rules` will enforce:
- Type checks on every field.
- Size boundaries on every string/array to protect against Denial of Wallet attacks.
- Exact key matches in create operations (`data.keys().hasAll(...) && data.keys().size() == N`).
- Action-based update routes with field diff-checks (`affectedKeys().hasOnly(...)`).
