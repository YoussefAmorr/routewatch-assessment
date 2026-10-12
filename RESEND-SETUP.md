# Enable RouteWatch email alerts

RouteWatch's dashboard and in-app notifications work without Resend. Follow these steps when you want actual email delivery.

1. Create an account at https://resend.com/ and verify your account email.
2. Open https://resend.com/api-keys and create a key named RouteWatch with sending access. Copy it into your local environment file, not chat or frontend code.
3. In the RouteWatch application folder, copy `.env.example` to `.env.local`. For a first test, set:

```dotenv
RESEND_API_KEY=PASTE_YOUR_KEY_HERE
ALERT_FROM=RouteWatch <onboarding@resend.dev>
PUBLIC_BASE_URL=
```

4. Restart RouteWatch with `node scripts/dev.mjs` and open http://localhost:4173. Mission Control will indicate that email is configured. Configuration presence alone does not verify that the key or sender is valid.
5. Save a real itinerary to Mission Control and enable monitoring. Open its workflow and subscribe the **same email address associated with your Resend account**. The initial assessment establishes a baseline; messages send only after a later risk increase or significant new advisory. Keep the server running for checks. Review the Resend dashboard and RouteWatch attention queue for acceptance/failure.

The test sender `onboarding@resend.dev` can send only to the email associated with your Resend account. To email other employees, add a domain you control at https://resend.com/domains, add the DNS records Resend specifies, verify the domain, and change ALERT_FROM to an address on that verified domain. Do not change your existing mail-provider DNS records beyond the specific verification records without understanding their purpose.

PUBLIC_BASE_URL can remain empty locally. Set it to the hosted HTTPS RouteWatch origin when deployed, so notification links lead to the authenticated operations workspace. Local monitoring ends when you stop the server; hosted Cron/Queues configuration is described in OPERATIONS-GUIDE.md.

Never publish `.env.local` or paste your API key into chat. The app excludes environment files and private databases from source packages. No real email was sent during development because no Resend credentials were supplied.

Official instructions: [Test-sender restrictions](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain), [API keys](https://resend.com/docs/dashboard/api-keys/introduction), [Domain verification](https://resend.com/docs/dashboard/domains/introduction).
