# Privacy Policy for Ananta New Tab

**Last updated: 20 February 2026**
**Developer: Kartik Tyagi**

## Data Collection

Ananta does **not** collect, transmit, sell, or share any personal data.

All data accessed by the extension (bookmarks, history, top sites, sessions) is read **locally within your browser** and is never sent to any external server.

## Local Storage

Ananta uses the browser's `storage.local` API solely to save your world clock city preferences. This data remains on your device and is never transmitted.

## Network Requests

The only external network request Ananta makes is to:

- **Nominatim (OpenStreetMap)** — `https://nominatim.openstreetmap.org` — used to resolve city names to timezones when you add a world clock. No personally identifiable information is included in these requests.

No user data, browser data, or identifiers are sent with this request.

## Permissions Justification

| Permission  | Justification                                |
| ----------- | -------------------------------------------- |
| `bookmarks` | Display your bookmark tree in the new tab UI |
| `history`   | Power the local Spotlight search feature     |
| `topSites`  | Display your most-visited site tiles         |
| `sessions`  | Allow Spotlight to surface recent tabs       |
| `storage`   | Persist world clock city settings locally    |

## Contact

For privacy questions, contact: **kartik@kayogen.com** ← update before publishing
