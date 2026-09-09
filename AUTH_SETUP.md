# Email authentication setup

LeeTec Engine uses email/password authentication with mandatory email verification. Manus OAuth is not used.

Add these Vercel variables:

```env
JWT_SECRET=long-random-session-secret
RESEND_API_KEY=re_your_api_key
RESEND_FROM_EMAIL=LeeTec Engine <noreply@your-verified-domain.com>
APP_URL=https://your-production-domain.com
```

The first registered account becomes the initial administrator. Later accounts are regular developers. A user cannot sign in until the verification link sent by Resend is opened.

`RESEND_FROM_EMAIL` must use a sender/domain verified in Resend. Keep `APP_URL` set to the public HTTPS URL so verification links return to the deployed application.
