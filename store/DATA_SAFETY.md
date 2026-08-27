# Play Console — Data safety answers

Copy these into the Data safety form. They are written to match what the app
actually does; check them again if you ever add a network feature.

## Data collection and sharing

| Question | Answer |
| --- | --- |
| Does your app collect or share any of the required user data types? | **No** |
| Is all of the user data collected by your app encrypted in transit? | Not applicable — no data is collected |
| Do you provide a way for users to request that their data is deleted? | **Yes** — in-app reset, and uninstalling removes everything |

Google's definition of "collect" is *transmitted off the device*. Bulk Clock
stores a great deal on the device and transmits none of it, so every data type
is answered **No**.

### Where the two network calls sit

Neither the barcode lookup nor the food-photo fetch sends user data. A barcode
number is a property of a product on a shelf, not of the user; an article title
is a property of a food. Google's guidance treats this as **not** collection, but
the app's privacy policy documents both anyway.

## Permissions declaration

| Permission | Declaration |
| --- | --- |
| `SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM` | Core feature: meal and training reminders must land at a specific minute. Users who take these at fixed times cannot use the app if reminders drift by an hour. |
| `USE_FULL_SCREEN_INTENT` | Reminders shown over the lock screen, like a calendar alert. Android 14+ requires an in-app request; the app explains before asking. |
| `CAMERA` | Barcode scanning and meal/progress photos. Both user-initiated. |
| `READ_MEDIA_IMAGES` | Choosing an existing photo for a meal, profile or progress entry. |
| `POST_NOTIFICATIONS` | All reminders. |
| `RECEIVE_BOOT_COMPLETED` | Re-arming scheduled reminders after a restart, otherwise they are silently lost. |

## Content rating questionnaire

- No violence, sexuality, profanity, gambling or controlled substances
- Contains **health and fitness information** — answer yes where asked about
  health-related content, and cite the in-app disclaimer
- No user-generated content, no social features, no chat
- No advertising, no in-app purchases

Expected rating: **Everyone / PEGI 3**.

## Ads and purchases

- Contains ads: **No**
- In-app purchases: **No**

## Account deletion URL

Not applicable — the app has no accounts. If the form insists on a URL, point it
at the privacy policy section headed "Your rights", which documents in-app
deletion.
