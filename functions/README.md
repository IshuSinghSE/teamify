# Teamify Cloud Functions

- **createInvite** (callable): Admin creates an invite; function creates the invite doc and sends email. Requires `teamId` and `email`.
- **acceptInvite** (callable): User accepts invite by token; function adds them to the team. Requires `token` (from the email link).

## Environment (Firebase config)

Set these when deploying so invite emails work:

- **ACCEPT_INVITE_BASE_URL** – Base URL of your app (e.g. `https://yourapp.com`). Used in the “Accept invite” link in the email.
- **SMTP_HOST**, **SMTP_PORT**, **SMTP_USER**, **SMTP_PASS** – SMTP for sending email (e.g. Gmail with app password, or SendGrid SMTP).
- **SMTP_FROM** (optional) – From address; defaults to SMTP_USER.

```bash
firebase functions:config:set accept_invite.base_url="https://yourapp.com"
# Or use .env (via firebase-functions config or Secret Manager) for SMTP.
```

Then deploy:

```bash
npm run build && firebase deploy --only functions
```
