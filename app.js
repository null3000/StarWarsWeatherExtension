// get the latitude and longitude of the user's location, needs major speed optimization
const options = {
  enableHighAccuracy: false,
  timeout: 5000,
  maximumAge: 0,
};
function error() {
  navigator.geolocation.getCurrentPosition(getPos, error, options);
}

function getPos(position) {
  let lat = position.coords.latitude;
  let long = position.coords.longitude;
  console.log("done getting location");

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
    localStorage.clear();
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
  } else {
    console.log("start");
    navigator.geolocation.getCurrentPosition(getPos, error, options);
  }
}

// get the current weather at the user's location
async function getWeather(lat, long) {
  console.log("getting weather from API");
  // this is a free API KEY, dont take mine, just get an account here https://www.weatherapi.com/
  const API_KEY = "API_KEY";
  const url = "http://api.weatherapi.com/v1/current.json?key=" + API_KEY + "&q=" + lat + "," +long + "&aqi=no";
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
  // if time of day is between 12pm and 4pm set time of day to afternoon
  else if (hour >= 12 && hour < 16) {
    timeofday = "afternoon";
    timeofdaydisplay = "Afternoon";
  }
  // if time of day is between 5pm and 8pm set time of day to evening
  else if (hour >= 16 && hour < 20) {
    timeofday = "evening";
    timeofdaydisplay = "Evening";
  }
  // else set night
  else {
    timeofday = "night";
    timeofdaydisplay = "Night";
  }

  // get the temp, conditions, humidity, and wind speeds
  let temp = Math.round(data.current.temp_f);
  let conditions = data.current.condition.text;
  conditions = conditions.toLowerCase();
  let humidity = data.current.humidity;
  let wind = data.current.wind_mph;
  // let elevation = elevationdata.results[0].elevation ;
  let elevation = 0;
  definePlanet(temp, conditions, humidity, wind, timeofday, elevation);
}

// define planet based on the temp, conditions, humidity, and wind speeds
function definePlanet(temp, conditions, humidity, wind, timeofday, elevation) {
  let message;
  let description;
  let planet;
  let planetName;


  //set hoth
  if (conditions.includes("snow") || conditions.includes("sleet") || conditions.includes("ice") || conditions.includes("hail") || conditions === "blizzard" || temp <= 32) {
    message = temp + "°F, Wow! Cold " + timeofdaydisplay;
    description = "A world of Snow and Ice, Surrounded by Numerous Moons, and Home to Deadly Creatures like the Wampa.";
    planetName = "Hoth";
    if (timeofday === "morning" || timeofday === "afternoon") {
      planet = "hoth";
    } else {
      planet = "hothNight";
    }
  }
  //set endor
  if (conditions === "fog" || conditions === "mist") {
    message = temp + "°F, and a Foggy " + timeofdaydisplay;
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
    description = "Famous for the cities in the clouds";
    planetName = "Bespin";
    if (timeofday === "morning" || timeofday === "afternoon") {
      planet = "bespin";
    } else {
      planet = "bespinNight";
    }
  }
  // set kamino
  else if (conditions.includes("rain") || conditions.includes("thundery")) {
    message = temp + "°F, and a Rainy " + timeofdaydisplay;
    description = "A Planet of Endless Oceans and Storms";
    planetName = "Kamino";
    if (timeofday === "morning" || timeofday === "afternoon") {
      planet = "kamino";
    } else {
      planet = "kaminoNight";
    }
  }
  //set naboo
  else if (temp >= 33 && temp <= 49) {
    description = "This Planet is the Home of Jar-Jar Binks";
    message = temp + "°F, What a Chilly " + timeofdaydisplay;
    planetName = "Naboo";
    if (timeofday === "morning" || timeofday === "afternoon") {
      planet = "naboo";
    } else {
      planet = "nabooNight";
    }
  }
  // set coruscant
  else if (temp >= 50 && temp <= 69) {
    description = "Capital of the Galaxy";
    message = temp + "°F, Quite a Cool " + timeofdaydisplay;
    planetName = "Coruscant";
    if (timeofday === "morning" || timeofday ==="afternoon") {
      planet = "coruscant";
    } else {
      planet = "coruscantNight";
    }
  }
  // set to scarif
  else if (temp >= 70 && temp <= 85) {
    description = "A Remote, Tropical Planet in the Outer Rim";
    message = temp + "°F, a Great " + timeofdaydisplay;
    planetName = "Scarif";
    if (timeofday === "morning" || timeofday === "afternoon") {
      planet = "scarif";
    } else {
      planet = "scarifNight";
    }
  }
  //set tatooine
  else if (temp >= 85 && temp <= 95) {
    description = "It's a Hot " + timeofday + ", Go to Mos Eisley for a Drink";
    message = temp + "°F, a Hot " + timeofdaydisplay;
    planetName = "Tatooine";
    if (timeofday === "morning" || timeofday === "afternoon") {
      planet = "tatooine";
    } else {
      planet = "tatooineNight";
    }
  }
  // set mustafar
  else if (temp >= 96) {
    description = "Fortress Vader has 0/5 Stars on Yelp";
    message = temp + "°F! It's a Very Hot " + timeofdaydisplay;
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
