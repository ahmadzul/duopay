# DuoPay

**Good times. Fair splits.** A browser-based AI receipt reader, cent-perfect group bill splitter, and PayPal Sandbox checkout prototype.

**Live demo:** https://duopay-jerinx.glow-work-bef.workers.dev

## Run locally

No build step, account, backend, API key, or Client Secret is required to open the app.

```bash
cd site
python3 -m http.server 8080
```

Open http://localhost:8080 in a modern browser with an internet connection. Do not open the HTML as a `file://` URL: the OCR worker and payment SDK need an HTTP origin.

## Try it

1. Click **Scan sample with AI**. The first run downloads Tesseract's engine and English model; the receipt itself stays in the browser.
2. Review the extracted lines. The sample's item subtotal is $70.00, tax is $5.60, tip is $14.00, and total is $89.60.
3. Assign an item to one or several friends, or choose **Split equally**. By-item sample shares are Alex $28.16, Maya $35.84, and Sam $25.60.
4. Select the person settling up and open PayPal checkout. Only use a **PayPal Sandbox personal/buyer account**, not a real PayPal account.
5. For merchant-attributed testing, open **Sandbox settings** and enter the public **Sandbox Client ID** of your own PayPal REST app. Never enter a Client Secret or live credential. The app keeps the Client ID in memory only.
6. A share is marked paid only after PayPal returns a completed capture whose USD amount matches the calculated share. Export the JSON summary to keep the session record.

By default, the app uses PayPal's documented `client-id=sb` testing shortcut. No user-specific PayPal credentials were supplied or invented. End-to-end buyer approval/capture has not been performed as part of this build because no Sandbox buyer account was provided.

## How the AI and PayPal integrations work

- **AI:** Tesseract.js 6.0.1 runs the trained English OCR model in a browser Web Worker using WebAssembly. This is actual image recognition, not canned AI text. The receipt parser then extracts item prices, tax, tip and printed totals from the model's text output. Receipt parsing is intentionally conservative; incorrect or unrecognized data must be corrected manually.
- **Money:** All calculations use integer cents. BigInt-backed largest-remainder allocation splits shared items, tax and tip so every share reconciles exactly. AI output never determines a trusted payment amount without deterministic calculation.
- **PayPal:** JavaScript SDK v5 client-side order helpers create and capture a Sandbox order for the selected person's calculated share. There is no real-money mode, no Client Secret, and no backend database.

## Files

- `site/index.html` — application interface and explanatory dialogs.
- `site/styles.css` — responsive styles.
- `site/app.js` — OCR, receipt parsing, deterministic split math and PayPal Sandbox integration.
- `site/sample-receipt.png` — generated fictional receipt used by the actual OCR demo.
- `tests/test-core.js` — deterministic unit and randomized reconciliation tests.

Run the tests with Node.js:

```bash
node tests/test-core.js
```

The test covers the exact sample, decimal parsing, invalid input, receipt text parsing, and 4,000 randomized by-item/equal split reconciliations.

## Important prototype limitations

This is a functional **Sandbox learning prototype**, not a production payment service. Client-side order helpers are used to fit the static-hosting constraint. Production must use a secure backend to validate amounts, create and capture orders, authenticate users, ensure idempotency, persist records, and verify PayPal webhooks.

The browser session is the source of truth here. There is no cross-device synchronization, automatic refund, split payout, multiparty routing, customer database, or persistence after refresh. The bill and merchant settings lock after a completed or unconfirmed capture, but refreshing clears the local record and does not refund a payment. Export before leaving. If capture status is unclear, inspect the existing Sandbox order before attempting another payment.

English receipts with prices ending in two decimal digits work best. Supported uploads: JPG/PNG/WebP, up to 10 MB. PDFs, discounts, complex inclusive-tax formats, currency conversion, and localization are not implemented. Tax and tip are allocated proportionally to item shares. Review every imported receipt before checkout.

Dependencies are downloaded from their official hosts/CDNs. An internet connection and permission to run Web Workers/WebAssembly are required. The first AI scan may take longer on a phone. The app itself does not upload the receipt or store credentials.

## Deployment

Publish **only the `site` directory**, never the project root. The initial temporary deployment was made in an isolated, unauthenticated environment with:

```bash
npx --yes wrangler@4.102.0 deploy --temporary --name duopay-jerinx --compatibility-date 2026-11-11 --assets site
```

Temporary hosting is not a durable judging URL until claimed and retained. Do not commit claim URLs, tokens, passwords, API keys, or Sandbox buyer credentials. The owner approved public repository publication. Hackathon registration and entry submission have not been performed.

## Hackathon demo outline (under 3 minutes)

- 0:00–0:20: Explain the problem: dinner receipts, unfair equal splits, and awkward payment follow-up.
- 0:20–1:00: Run the real AI scan on the sample receipt; review imported amounts.
- 1:00–1:35: Change an item's participants, compare equal/item splitting, and show cent-perfect totals.
- 1:35–2:25: Use your own Sandbox Client ID and buyer account to demonstrate one completed test payment.
- 2:25–2:50: Show the confirmed capture and exported summary; explain the local-privacy and production boundaries.

The official rules require an English description/materials, working build, public open-source repository with a detectable license, and a public YouTube demo shorter than three minutes. Publishing this repository is not an entry submission.

## Sources and third-party notices

- [Tesseract.js documentation and source](https://github.com/naptha/tesseract.js) — Apache-2.0; downloaded at runtime, not bundled in this archive.
- [PayPal JavaScript SDK v5 configuration](https://developer.paypal.com/sdk/js/v5/configuration) — documents the official `sb` Sandbox shortcut.
- [PayPal's client-side helper migration example](https://github.com/paypal-examples/paypal-sdk-server-side-integration/blob/main/docs/update-from-client-side-helpers-to-server-side.md) — documents `actions.order.create` and `actions.order.capture`, and why production should migrate to server-side integration.
- [PayPal Standard Checkout integration](https://developer.paypal.com/studio/checkout/standard/integrate).
- [PayPal AI Hackathon official rules](https://paypalaihackathon.devpost.com/rules).

DuoPay is an independent prototype and is not endorsed by PayPal. Third-party SDKs retain their own licenses and terms. All application source and the fictional sample receipt are released under the MIT License in `LICENSE`.
