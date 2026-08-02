# StarWarsWeather
Open a new tab page display a star wars background based on the weather!
This extension is for Firefox and Chrome

## Background
A while back there was a website by Tom Scott that would get the weather in an area and compare it to a Star Wars planet. This website has since stopped working due to reasons listed [here](https://www.tomscott.com/weather/starwars/). My project revives and expands on this idea, there are now 13 planets, and each one has 2 images for day and night. This also uses more data about the climate like humidity, wind speeds and elevation. This extension has options for Fahrenheit and Celsius.

## How does it work?
1. This extension gets the user's location (or uses a saved manual city if you've configured one in the popup/options).
2. Get the sunrise and sunset times for that location and determine day or night.
3. Gives the location info to a [Weather API](https://openweathermap.org/).
4. This API gather the following data temperature, conditions, humidity, wind.
5. It use these parameters to deterime the planet. See exact details below.
6. It gets the image (depending on time of day), description and message and edits the HTML to display them.

## How it Determines which Planet
The rules in `src/planets.js` are checked **in order**, and the first one that matches wins.

| # | Planet | Matches when |
|---|--------|--------------|
| 1 | **Hoth** | Snow, or temps at or below 32°F |
| 2 | **Kamino** | Rain, drizzle, or thunderstorms |
| 3 | **Endor** | Fog or mist |
| 4 | **Ahch-To** | Squalls |
| 5 | **Bespin** | Wind at or above 35 mph |
| 6 | **Geonosis** | Sand or dust storms |
| 7 | **Scarif** | 70–85°F with clear skies or few clouds |
| 8 | **Dagobah** | Humidity at or above 93% and temps at or above 80°F |
| 9 | **Nevarro** | Volcanic ash, smoke, or haze |
| 10 | **Naboo** | 33–54°F |
| 11 | **Coruscant** | 55–79°F |
| 12 | **Tatooine** | 80–95°F |
| 13 | **Mustafar** | 96°F and hotter |

Coruscant is also the fallback when nothing matches.

## Privacy
Privacy is incredibly important, that's why this project is open source. This extension is ran on the machine which installed it. This extension does NOT store any location data. Any stored data is on the users machine and not accessible anywhere else.

## Development

### Prerequisites
- [Bun](https://bun.sh/) - Fast JavaScript runtime & package manager

### Installation
```bash
bun install  # Install dependencies
```

### Running the Extension
No build step required - load the unpacked extension directly:
- **Chrome**: `chrome://extensions` → "Load unpacked" → select project root
- **Firefox**: `about:debugging` → "Load Temporary Add-on" → select manifest.json

### Testing
```bash
bun test  # Run tests with Bun's built-in test runner
```

### Scripts
- `bun install` - Install dependencies
- `bun test` - Run tests
- `bun run dev` - Run with watch mode for development

### CI/CD
Pushes to `main` automatically upload and publish the extension to the Chrome Web Store via a GitHub Actions workflow using [cws-cli](https://github.com/vaughnbosu/cws-cli).

## Contributing
Like the project? Please consider contributing to this project, lots of improvements and optimizations can be made.

[![Available in the Chrome Web Store](https://user-images.githubusercontent.com/19192015/132961666-64cf372a-ad35-47ad-b378-4de4b4a07d6d.png)](https://chrome.google.com/webstore/detail/star-wars-weather/hjphhbgleggdljkdlmlblbamlnkmdgag)

## Mozilla Add-on Store Status: APPROVED
Working [Link](https://addons.mozilla.org/en-US/firefox/addon/star-wars-weather/)
