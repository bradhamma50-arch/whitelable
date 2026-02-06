<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Virtual Clothing Try-On

This white-label virtual try-on app embeds on customer storefronts, adds a Try-On button to every product image, and lets shoppers upload a photo to see the selected garment on themselves.

View your app in AI Studio: https://ai.studio/apps/drive/15hFr-uTHvwJJTTeWIVACMIcP6Ku68PhG

## Storefront Integration

1. Deploy the app and host `embed.js` alongside it.
2. Add the embed script to your storefront template:

```html
<script src="https://YOUR_APP_DOMAIN/embed.js" data-token="YOUR_SITE_TOKEN"></script>
```

3. The script scans product images, injects Try-On buttons, and opens the try-on experience in a full-screen overlay.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
