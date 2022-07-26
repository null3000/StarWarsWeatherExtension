# StarWarsWeather
Open a new tab page display a star wars background based on the weather!
This extension is for Firefox and Chrome

## Background
A while back there was a website by Tom Scott that would get the weather in an area and compare it to a Star Wars planet. This website has since stopped working due to reasons listed [here](https://www.tomscott.com/weather/starwars/). My project revives and expands on this idea, there are now 10 planets, and each one has 2 images for day and night. This also uses more data about the climate like humidity, wind speeds and elevation. This extension has options for Fahrenheit and Celsius.

## How does it work?
1. This extension gets the users location.
2. Get the time and deterime day or night.
3. Gives the location info to two APIS found here: [Elevation API](https://www.open-elevation.com/) as well as [Weather API](https://www.weatherapi.com/).
4. These two API gather the following data temperature, conditions, humidity, wind, elevation.
5. It use these parameters to deterime the planet. See exact details below.
6. It gets the image (depending on time of day), description and message and edits the HTML to display them.

## How it Determines which Planet
Each planet has specific reasons for when it will be used here they are:  

**Hoth**: used when snow, hail, ice or a blizzard is present. Or if temps are below freezing  
**Endor**: used when it is misty or foggy  
**Dagobah**: used when humidity is above 80%  
**Bespin**: used when elevation is above 6000ft AND wind speeds are above 8mph  
**Kamino**: used when it is raining or there is a storm  
**Naboo** used when temps are between 33-49F  
**Coruscant** used when temps are between 50-69F  
**Scariff** used when temps are between 70-84F  
**Tatooine** used when temps are between 85-96F  
**Mustafar** used when temps are above 96F  

## Privacy
Privacy is incredibly important, that's why this project is open source. This extension is ran on the machine which installed it. This extension does NOT store any location data. Any stored data is on the users machine and not accessible anywher else.

## Contributing
Like the project? Please consider contributing to this project, lots of improvements and optimazations can be made

## Mozilla Add-on Store Status: APPROVED
Working [Link](https://addons.mozilla.org/en-US/firefox/addon/star-wars-weather/)

## Chrome Web Store Status: APPROVED
Working [Link](https://chrome.google.com/webstore/detail/star-wars-weather/hjphhbgleggdljkdlmlblbamlnkmdgag)