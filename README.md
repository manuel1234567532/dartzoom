# DartZoom

DartZoom is a Chrome extension for streaming darts on [Autodarts](https://play.autodarts.com).
It automatically zooms your board camera in OBS to the segment that matters.

**Example:** Someone is going for a 180, so the camera zooms to T20. On a checkout, it zooms to the double they need.

## Features

- Automatic zoom to the target segment (singles, doubles, trebles, bull)
- Checkout zoom with your own checkout routes
- Smooth camera movement using OBS "Move" filters
- Optional sounds when zooming
- Show or hide OBS sources automatically during a game

## What you need

- Google Chrome (or another Chromium browser)
- [OBS Studio](https://obsproject.com) 28 or newer (WebSocket is built in)
- The [Move Transition](https://obsproject.com/forum/resources/move.913/) plugin for OBS
- An Autodarts account

## Installation

1. Download this repository (green **Code** button → **Download ZIP**) and unzip it.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and choose the `extension` folder.
5. The DartZoom icon now appears in your toolbar.

## Setup

1. **OBS:** Go to *Tools → WebSocket Server Settings*, turn the server on and note the port and password.
2. **Board camera:** On your board camera source, add a "Move Source" filter for each segment.
   Name each filter exactly after its segment:
   - `Default` for the normal (zoomed-out) view
   - `S1`–`S20` for singles, `D1`–`D20` for doubles, `T1`–`T20` for trebles
   - `Bull`, `OuterBull` and `Miss`
3. **Extension:** Click the DartZoom icon and enter:
   - the OBS address (default `ws://localhost:4455`) and your WebSocket password
   - your scene name and board camera source name
   - your Autodarts username
4. Turn DartZoom on and start a game on Autodarts.

Video tutorials: [English](https://www.youtube.com/watch?v=uijDL0rxR3g) · [German](https://www.youtube.com/watch?v=Xh7R-xPH8zw)

## Project structure

| File | What it does |
|---|---|
| `extension/manifest.json` | Extension configuration |
| `extension/background.js` | Main logic: talks to OBS and decides where to zoom |
| `extension/injector.js`, `extension/pageScript.js` | Read game data from the Autodarts page |
| `extension/popup.html` / `.js` / `.css` | The settings window |

## Contributing

Contributions are welcome!

1. Fork this repository.
2. Create a branch for your change.
3. Test your change in Chrome (load the `extension` folder as shown above).
4. Open a pull request and describe what you changed.

Found a bug or have an idea? Open an [issue](../../issues) or join our [Discord](https://discord.gg/nMb3X9sWgv).

## License

DartZoom is licensed under the [GNU General Public License v3.0](LICENSE).
You may use, change and share it. If you share a changed version, it must also be open source under GPL-3.0.

*DartZoom is a community project and is not affiliated with Autodarts.*
