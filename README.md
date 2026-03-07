# Social Media Publisher for Roam Research

Publish content from Roam Research to Twitter/X, Bluesky, and LessWrong.

## Usage

Type one of these commands in a block, then add your content as child blocks:

- `{{publish}}` - Publish to all configured platforms
- `{{tweet}}` - Publish to Twitter/X only
- `{{bsky}}` - Publish to Bluesky only
- `{{lesswrong}}` - Publish to LessWrong only

Each child block becomes a separate post in a thread (Twitter/Bluesky) or is combined into a single quick take (LessWrong).

An icon appears next to the block. Click it to open the publish dialog. Character counts are shown inline next to each child block.

You can also right-click any block and select **Publish to Social Media**, or use the command palette.

## Platform Setup

### Twitter / X (via Buffer)

Twitter posting is done through [Buffer](https://buffer.com), which acts as a proxy to the X API.

1. Create a free [Buffer](https://buffer.com/signup) account
2. Connect your X/Twitter account in Buffer (Channels > Connect a Channel > Twitter/X)
3. Go to [buffer.com/manage](https://buffer.com/manage), click your profile icon (bottom-left) > **My Preferences** > **API**
4. Copy the **Access Token** shown on that page
5. Paste it into the **Buffer API Token** field in the extension settings

The plugin automatically finds your connected X/Twitter channel from your Buffer account.

### Bluesky

1. Log into [bsky.app](https://bsky.app)
2. Go to **Settings** > **Privacy and Security** > **App Passwords**
3. Click **Add App Password**, give it a name, and copy the generated password
4. In the extension settings, enter your handle (e.g., `yourname.bsky.social`) and the app password

### LessWrong

1. Log into [lesswrong.com](https://www.lesswrong.com) in your browser
2. Open browser DevTools (F12) > **Application** tab > **Cookies** > `https://www.lesswrong.com`
3. Find the cookie named `loginToken` and copy its value
4. Paste it into the **LessWrong Login Token** field in the extension settings

Note: The login token expires when you log out or after some time. Update it in settings if posting starts failing with auth errors.

## Character Limits

- **Twitter/X**: 280 characters per tweet
- **Bluesky**: 300 graphemes per post
- **LessWrong**: No character limit

## Development

```bash
npm install
npm run build       # Build extension.js
npm run dev         # Build with watch mode
npm run typecheck   # Type check without emitting
```
