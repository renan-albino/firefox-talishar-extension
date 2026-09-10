# Google Apps Script Webhook for Google Sheets Integration

Directly integrating with the official Google Sheets API v4 requires OAuth2 authorization, Google Cloud Console projects, client secrets, and periodic token refreshing that adds extreme friction for end-users. We decided to use a **Google Apps Script Web App (Webhook URL)** as our primary remote integration target because it enables zero-auth, single-POST payload delivery directly into the user's private Google Sheet with zero Cloud Console setup.
