# Architecture rules

- Apply light and dark appearance through semantic CSS variables on the root `.dark` class, because every screen must share one persistent theme system.
- Keep bottom navigation route-controlled through the shared ExpandableTabs component, so animation never desynchronizes from the active screen.- Challenge (reto) validation, closing and payout live only in database functions; client code mirrors the rules for display, because the client must never decide prizes.
- Weekly duels: pairing, results and ranks are decided only by database functions run by the hourly job; the client only reads and mirrors rules for display, so players cannot alter outcomes.
