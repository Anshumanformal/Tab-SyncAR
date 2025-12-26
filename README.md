# Tab Syncer

A self-hosted, open-source browser extension and backend system to sync browser tabs and URLs in real-time across devices.

## Features

- **Real-time Sync**: Syncs open tabs and URLs instantly using WebSockets.
- **Cross-Device**: Works on Chrome, Firefox (Desktop), and Firefox Android.
- **Privacy First**: Self-hosted, no tracking, no proprietary services.
- **Convenience**: Auto-syncs tabs, supports manual URL addition, and multi-select deletion.
- **Secure**: OAuth authentication (Google/GitHub) with JWT.
- **Lightweight**: Single-process Node.js backend with in-memory event bus (no Redis required).

## Project Structure

- `server/`: Node.js/Express backend with PostgreSQL.
- `extension/`: Cross-browser WebExtension (Manifest V3).

## Prerequisites

- Docker & Docker Compose
- Node.js (v18+)
- Google/GitHub OAuth Credentials

## Setup Instructions

### 1. Backend Setup

1.  **Clone the repository** (if not already done).
2.  **Configure Environment Variables**:
    - Copy `.env.example` to `server/.env`:
      ```bash
      cp .env.example server/.env
      ```
    - Edit `server/.env` and add your OAuth credentials:
      - **Google**: Create credentials at [Google Cloud Console](https://console.cloud.google.com/). Set redirect URI to `http://localhost:3000/auth/google/callback`.
      - **GitHub**: Create an OAuth App at [GitHub Developer Settings](https://github.com/settings/developers). Set callback URL to `http://localhost:3000/auth/github/callback`.

3.  **Start Services**:
    ```bash
    docker-compose up -d
    ```
    *Note: This starts PostgreSQL. The Node.js server runs separately or can be containerized.*

4.  **Install Dependencies & Migrate Database**:
    ```bash
    cd server
    npm install
    npm run migrate
    npm start
    ```
    The server should now be running on `http://localhost:3000`.

### 2. Extension Setup

1.  **Chrome**:
    - Go to `chrome://extensions`.
    - Enable "Developer mode" (top right).
    - Click "Load unpacked".
    - Select the `extension` directory.

2.  **Firefox**:
    - Go to `about:debugging#/runtime/this-firefox`.
    - Click "Load Temporary Add-on...".
    - Select `extension/manifest.json`.

3.  **Firefox Android**:
    - Follow [Mozilla's guide](https://extensionworkshop.com/documentation/develop/developing-extensions-for-firefox-for-android/) to load via USB debugging or web-ext.

## Architecture Notes

### In-Memory Event Bus
This system uses `cache-manager` as an in-memory coordination layer for real-time events.
- **Single Instance**: The backend is designed to run as a single process. Horizontal scaling is not supported without re-introducing a distributed Pub/Sub (like Redis).
- **Reliability**: Events are best-effort. Clients re-fetch authoritative state from the REST API upon reconnection.
- **Why No Redis?**: To keep the hosting requirements minimal and free.

## Usage

1.  Click the extension icon.
2.  Login with Google or GitHub.
3.  Your open tabs will automatically sync (Desktop).
4.  View synced URLs and connected devices in the popup.
5.  Manually add the current tab or delete selected URLs.

## Development

- **Server**: Run `npm run dev` in `server/` for hot-reloading.
- **Extension**: Reload the extension in the browser after making changes.

## License

MIT
