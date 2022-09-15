// get the latitude and longitude of the user's location, needs major speed optimization
const options = {
  enableHighAccuracy: false,
  timeout: 5000,
  maximumAge: 600000,
};

function error() {
  alert("Unable to retrieve your location, make sure you have location services for your browser enabled, and whitelist this extension");
  navigator.geolocation.getCurrentPosition(getPos, error, options);
}

function getPos(position) {
  let lat = position.coords.latitude;
  let long = position.coords.longitude;
  console.log("done getting location");
  console.log(lat, long);
  getWeather(lat, long);
}

function clearcache() {
  let pasttime = localStorage.getItem("date");
  let date = new Date();
  let month = date.getMonth();
  let day = date.getDate();
  let year = date.getFullYear();
  let hour = date.getHours();
  date = month + "/" + day + "/" + year + " " + hour + ":00";
  console.log(date);
  console.log(pasttime);
  if (pasttime !== date) {
    // clear the cache
    localStorage.removeItem("planet");
    localStorage.removeItem("message");
    localStorage.removeItem("description");
    localStorage.removeItem("planetName");
    localStorage.removeItem("date");
    console.log("cache cleared");
  }
}




clearcache();
cacheData();

function cacheData() {
  let planet = localStorage.getItem("planet");
  let message = localStorage.getItem("message");
  let description = localStorage.getItem("description");
  let planetName = localStorage.getItem("planetName");
  if (planet != null) {
    console.log("using cached data");
    updateText(planetName);
    updateMessage(message);
    updateImage(planet);
    updateDescription(description);
    // get the curent time
    var today = new Date();
    let hour = today.getHours();
    let minute = today.getMinutes();
    document.getElementById("LastUpdated").innerText = "Last Updated: " + hour + ":00";
  } else {
    console.log("start");
    navigator.geolocation.getCurrentPosition(getPos, error, options);
  }
}

// get the current weather at the user's location
async function getWeather(lat, long) {
  console.log("getting weather from API");
  // this is a free API KEY, dont take mine, just get an account here https://openweathermap.org/
  const API_KEY = "API_KEY";
  const url = "https://api.openweathermap.org/data/2.5/weather?lat=" + lat + "&lon=" + long + "&appid=" + API_KEY +"&units=imperial"
  // const elevationURL ="https://api.opentopodata.org/v1/test-dataset?locations=" + lat + "," + long;

  // let elevationresponse = await fetch(elevationURL);
  // let elevationdata = await elevationresponse.json();


  let response = await fetch(url);
  let data = await response.json();


  // get the current time
  var today = new Date();
  hour = today.getHours();

  let timeofday;
  // if time of day is between 5am and 12pm set time of day to morning

  if (hour >= 5 && hour < 12) {
    timeofday = "morning";
    timeofdaydisplay = "Morning";
  }
  // if time of day is between 12pm and 5pm set time of day to afternoon
  else if (hour >= 12 && hour < 17) {
    timeofday = "afternoon";
    timeofdaydisplay = "Afternoon";
  }
  // if time of day is between 6pm and 8pm set time of day to evening
  else if (hour >= 17 && hour <= 20) {
    timeofday = "evening";
    timeofdaydisplay = "Evening";
  }
  // else set night
  else {
    timeofday = "night";
    timeofdaydisplay = "Night";
  }

  // get the temp, conditions, humidity, and wind speeds
  let temp = Math.round(data.main.temp);
  let conditions = data.weather[0].main;
  let humidity = data.main.humidity;
  let wind = data.wind.speed;
  let detailedconditions = data.weather[0].description;
  console.log(temp, conditions, humidity, wind, detailedconditions);
  // let elevation = elevationdata.results[0].elevation ;
  let elevation = 0;
  definePlanet(temp, conditions, humidity, wind, timeofday, elevation, detailedconditions);
}

// define planet based on the temp, conditions, humidity, and wind speeds
function definePlanet(temp, conditions, humidity, wind, timeofday, elevation, detailedconditions) {
  let message;
  let description;
  let planet;
  let planetName;
  let celsius = false;
  let tempC = (temp - 32) * 5 / 9;
  tempC = Math.round(tempC * 2) / 2;
  
  // decide between celcius and fahrenheit
  let unit = localStorage.getItem("unit");
  console.log(unit);
  if (unit === "celsius") {
    celsius=true;
  }
  console.log(celsius);

  //set hoth
  if (conditions === "Snow" || temp <= 32) {
    message = temp + "°F, Wow! Cold " + timeofdaydisplay;
    if(celsius){
      message = tempC + "°C, Wow! Cold " + timeofdaydisplay;
    }
    description = "A world of Snow and Ice, Surrounded by Numerous Moons, and Home to Deadly Creatures like the Wampa.";
    planetName = "Hoth";
    if (timeofday === "morning" || timeofday === "afternoon") {
      planet = "hoth";
    } else {
      planet = "hothNight";
    }
  }
  // set kamino
  else if (conditions === "Rain" || conditions === "Drizzle" || conditions === "Thunderstorm") {
    message = temp + "°F, and a Rainy " + timeofdaydisplay;
    if(celsius){
      message = tempC + "°C, and a Rainy " + timeofdaydisplay;
    }
    description = "A Planet of Endless Oceans and Storms";
    planetName = "Kamino";
    if (timeofday === "morning" || timeofday === "afternoon") {
      planet = "kamino";
    } else {
      planet = "kaminoNight";
    }
  }
  //set endor
  else if (conditions === "Fog" || conditions === "Mist") {
    message = temp + "°F, and a Foggy " + timeofdaydisplay;
    if(celsius){
      message = tempC + "°C, and a Foggy " + timeofdaydisplay;
    }
    description = "Ewok Jerky is a Popular Snack in the Outer Rim";
    planetName = "Endor";
    if (timeofday === "morning" || timeofday === "afternoon") {
      planet = "endor";
    } else {
      planet = "endorNight";
    }
  }
  //set dagobah
  else if (humidity >= 80) {
    message = temp + "°F, and a Very Humid " + timeofdaydisplay;
    if(celsius){
      message = tempC + "°C, and a Very Humid " + timeofdaydisplay;
    }
    description = "Refuge of Master Yoda, This is.";
    planetName = "Dagobah";
    if (timeofday === "morning" || timeofday === "afternoon") {
      planet = "dagobah";
    } else {
      planet = "dagobahNight";
    }
  }
  //set bespin
  else if (wind >= 35) {
    message = temp + "°F, and It's a Very Windy " + timeofdaydisplay;
    if(celsius){
      message = tempC + "°C, and a Very Windy " + timeofdaydisplay;
    }
    description = "Famous for the cities in the clouds";
    planetName = "Bespin";
    if (timeofday === "morning" || timeofday === "afternoon") {
      planet = "bespin";
    } else {
      planet = "bespinNight";
    }
  }
  // set to scarif
  else if (temp >= 70 && temp <= 85 && (conditions === "Clear" || detailedconditions === "few clouds")) {
    description = "A Remote, Tropical Planet in the Outer Rim";
    message = temp + "°F, a Great " + timeofdaydisplay;
    if(celsius){
      message = tempC + "°C, a Great " + timeofdaydisplay;
    }
    planetName = "Scarif";
    if (timeofday === "morning" || timeofday === "afternoon") {
      planet = "scarif";
    } else {
      planet = "scarifNight";
    }
  }
  //set naboo
  else if (temp >= 33 && temp <= 49) {
    description = "This Planet is the Home of Jar-Jar Binks";
    message = temp + "°F, What a Chilly " + timeofdaydisplay;
    if(celsius){
      message = tempC + "°C, What a Chilly " + timeofdaydisplay;
    }
    planetName = "Naboo";
    if (timeofday === "morning" || timeofday === "afternoon") {
      planet = "naboo";
    } else {
      planet = "nabooNight";
    }
  }
  // set coruscant
  else if (temp >= 50 && temp < 80) {
    description = "Capital of the Galaxy";
    message = temp + "°F, a Cool " + timeofdaydisplay;
    if(temp > 70 && temp < 80){
      message = temp + "°F, a Comfortable " + timeofdaydisplay;
    }
    if(celsius){
      message = tempC + "°C, a Cool " + timeofdaydisplay;
    }
    planetName = "Coruscant";
    if (timeofday === "morning" || timeofday ==="afternoon") {
      planet = "coruscant";
    } else {
      planet = "coruscantNight";
    }
  }
  //set tatooine
  else if (temp >= 80 && temp <= 95) {
    description = "It's a Hot " + timeofday + ", Go to Mos Eisley for a Drink";
    message = temp + "°F, a Hot " + timeofdaydisplay;
    if(celsius){
      message = tempC + "°C, a Hot " + timeofdaydisplay;
    }
    planetName = "Tatooine";
    if (timeofday === "morning" || timeofday === "afternoon") {
      planet = "tatooine";
    } else {
      planet = "tatooineNight";
    }
  }
  // set mustafar
  else if (temp >= 96) {
    description = "Home of Darth Vader";
    message = temp + "°F! It's a Very Hot " + timeofdaydisplay;
    if(celsius){
      message = tempC + "°C! It's a Very Hot " + timeofdaydisplay;
    }
    planetName = "Mustafar";
    if (timeofday === "morning" || timeofday === "afternoon") {
      planet = "mustafar";
    } else {
      planet = "mustafarNight";
    }
  }

  updateText(planetName);
  updateMessage(message);
  updateImage(planet);
  updateDescription(description);

  // get current time and date

  let date = new Date();
  let month = date.getMonth();
  let day = date.getDate();
  let year = date.getFullYear();
  let hour = date.getHours();
  date = month + "/" + day + "/" + year + " " + hour + ":00";

  localStorage.setItem("date", date);
  localStorage.setItem("planetName", planetName);
  localStorage.setItem("message", message);
  localStorage.setItem("planet", planet);
  localStorage.setItem("description", description);
}

// update the image based on the planet
function updateImage(planet) {
  document.getElementById("background").className = planet;
}

// update the center text based on the planet
function updateText(planetName) {
  document.getElementById("test").style.display = "none";
  document.getElementById("planet").innerText = planetName.toUpperCase();
  document.getElementById("center1Text").innerText = "IT'S LIKE";
  document.getElementById("center3Text").innerText = "OUTSIDE";
  document.getElementById("loading").innerText = "";
}

// update the message based on the planet (top left)
function updateMessage(message) {
  document.getElementById("message").innerText = message;
}

// update the description based on the planet (bottom right)
function updateDescription(description) {
  document.getElementById("description").innerText = description;
}
