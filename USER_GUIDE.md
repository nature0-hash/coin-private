# Coin Private guide

## First sign-in

1. Open the site and either create a customer account or sign in with an existing account.
2. A customer sees the client workspace. A Management account sees the Management workspace instead.
3. New customer accounts receive the platform wallets that are enabled for them. Their balances, activity, notifications and settings are stored in the connected PostgreSQL database.

## Customer workspace

### Home

Home is the portfolio overview. It shows the total portfolio value, wallet holdings, market movement and quick actions for deposit, withdrawal, send and receive.

### Markets

Markets lists the available assets, prices and movement. Price data comes from the configured price provider. It is market information, not a promise that an order will execute on an outside exchange.

### Trade

Trade creates buy, sell or convert orders using the platform wallet balances. Completed orders appear in Activity. Orders that meet the configured risk rules can be routed to Management approval.

### Deposit, withdraw, send and receive

- **Deposit** creates an internal deposit request. Crypto deposits wait for Management approval. Bank and card flows in this project are internal recorded flows, not a live bank connection.
- **Withdraw** creates a withdrawal request and reserves funds while it awaits approval.
- **Send** supports internal transfers between platform users. An external blockchain transfer is not performed unless a real blockchain provider is integrated.
- **Receive** shows the wallet receive address and QR code.

### Activity

Activity is the customer transaction history. Use the tabs to narrow it to trades, transfers, deposits, withdrawals or ledger movements. Clicking an item opens its details, including any customer-visible source or correction information.

Posted financial activity is retained. It is not deleted from the account history because wallet balances and transaction records need to stay reconcilable.

### Notifications

The bell opens Notifications. A customer can mark one or all notifications as read, delete one notification with the trash icon on its card, or clear all notifications. Removing a notification does not alter the related trade, wallet or security record.

### Profile, security and settings

Profile links to transactions, notifications, receive, trade, security and settings. Security allows a password change and shows sign-in/device history. Security events are retained for account protection. Settings contains customer preferences available to the account.

## Management workspace

### Users and customer profiles

Open **Users**, choose a customer and open their profile. Management can edit customer identity details, login ID, contact data, password, role, verification tier and access status. Accounts can be frozen, reopened or closed while retaining their records.

### Wallet balances

Click a wallet card on the customer profile to open **Set balance**. Enter the exact available and reserved amounts, optionally add a customer-visible source, enter a reason, then save. The system posts the precise difference through the ledger and refreshes the wallet. Use **Adjust funds** for a one-time credit or debit instead of a target balance.

For customer-facing credits, Management can choose a valid label:

- Received
- Wallet credit
- Bonus credit

For debits, Management can choose Wallet debit or Service fee. Buy, sell, send and withdrawal labels are created by the corresponding trade or transfer workflow.

### Transactions and activity controls

The customer profile shows wallet balances plus ledger, orders, transfers, deposits and withdrawals. **All ledger transactions** opens the filtered transaction view for that customer. Management can inspect entries, add correction notes, reverse a posted ledger transaction, and update permitted operational details such as a pending destination or a recorded deposit source. Reversals and corrections leave a trace and update balances consistently.

### Other Management areas

- **Approvals** handles pending deposits, withdrawals and risk-held trades.
- **Wallets** and **Assets** manage platform asset and wallet views.
- **Promotions** manages promotion settings and customer eligibility tools.
- **Risk tools** controls risk settings and reviews flagged activity.
- **Audit log** records privileged actions.
- **Platform settings** controls configurable platform behavior, including registrations and promotion settings.

## Important operating boundary

This project is a persistent internal portfolio and operations platform once a PostgreSQL database is connected. It is not, by itself, a live bank, blockchain custodian or exchange. Real external money movement needs the relevant regulated provider integrations, credentials and operational processes before it can be represented as an external settlement.
