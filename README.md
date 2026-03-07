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

### Twitter / X

1. Go to the [X Developer Portal](https://developer.x.com) and create a project/app
2. In your app settings, generate **API Key**, **API Secret**, **Access Token**, and **Access Token Secret**
3. Ensure your app has **Read and Write** permissions
4. Enter all four values in the extension settings

### Bluesky

1. Go to Bluesky Settings > App Passwords
2. Create a new app password
3. Enter your handle (e.g., `yourname.bsky.social`) and the app password in settings

### LessWrong

1. Log into LessWrong in your browser
2. Open browser DevTools > Application > Cookies
3. Copy the value of the `loginToken` cookie
4. Paste it in the extension settings

Note: The login token may expire when you log out or after some time. You'll need to update it if that happens.

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
