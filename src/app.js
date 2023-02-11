// get the latitude and longitude of the user's location, needs major speed optimization
const options = {
  enableHighAccuracy: false,
  timeout: 5000,
  maximumAge: 600000,
};

function error() {
  if (localStorage.getItem("alerted") == "true") {
    console.log("error");
    location.reload();
    console.log("reloaded");
    return;
  } else{
    alert("Unable to retrieve your location, make sure you have location services for your browser enabled, and whitelist this extension");
  }
  localStorage.setItem("alerted", "true");
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
  const API_KEY = "";
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
  language = "en";
  language = localStorage.getItem("language");
  console.log(language);
  let jsonURL;
  if (language == "en") {
    jsonURL = chrome.runtime.getURL('_locales/en.json');
  } else if (language == "es") {
    jsonURL = chrome.runtime.getURL('_locales/es.json');
  }

  if (hour >= 5 && hour < 12) {
    timeofday = "morning";
    timeofdaydisplay = "Morning";
    if(language =="es"){
      timeofdaydisplay = "Mañana";
    }
  }
  // if time of day is between 12pm and 5pm set time of day to afternoon
  else if (hour >= 12 && hour < 17) {
    timeofday = "afternoon";
    timeofdaydisplay = "Afternoon";
    if(language =="es"){
      timeofdaydisplay = "Tarde";
    }
  }
  // if time of day is between 6pm and 8pm set time of day to evening
  else if (hour >= 17 && hour <= 20) {
    timeofday = "evening";
    timeofdaydisplay = "Evening";
    if(language =="es"){
      timeofdaydisplay = "Tarde";
    }
  }
  // else set night
  else {
    timeofday = "night";
    timeofdaydisplay = "Night";
    if(language =="es"){
      timeofdaydisplay = "Noche";
    }
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
async function definePlanet(temp, conditions, humidity, wind, timeofday, elevation, detailedconditions) {
  let message;
  let description;
  let planet;
  let planetName;
  let celsius = false;
  let tempC = (temp - 32) * 5 / 9;
  tempC = Math.round(tempC * 2) / 2;


  let language;
  
  if(localStorage.getItem("language") == null){
    language = navigator.language;
    language = language.substring(0, 2);
  } else{
    language = localStorage.getItem("language");
  }
  console.log(language);
  let jsonURL;
   if (language == "es") {
    jsonURL = chrome.runtime.getURL('localization/es.json');
  }  else {
    jsonURL = chrome.runtime.getURL('localization/en.json');
  }
  let response = await fetch(jsonURL);
  let data = await response.json();
  console.log(data);
  
  // decide between celcius and fahrenheit
  let unit = localStorage.getItem("unit");
  console.log(unit);
  if (unit == "celsius") {
    celsius = true;
  }
  if(language == "es"){
    const spanish = true;
  }
  console.log(celsius);

  //set hoth
  if (conditions === "Snow" || temp <= 32) {
    if(celsius){
      message = tempC + "°C" + data.messages.hoth.message;
    } else{
      message = temp + "°F" + data.messages.hoth.message;
    }
    message = message.replace("()", timeofdaydisplay);
    description = data.messages.hoth.description;
    planetName = "Hoth";
    if (timeofday === "morning" || timeofday === "afternoon") {
      planet = "hoth";
    }
    else {
      planet = "hothNight"
    }
  }
  // set kamino
  else if (conditions === "Rain" || conditions === "Drizzle" || conditions === "Thunderstorm") {
    if(celsius){
      message = tempC + "°C" + data.messages.kamino.message;
    } else{
      message = temp + "°F" + data.messages.kamino.message;
    }
    message = message.replace("()", timeofdaydisplay);
    description = data.messages.kamino.description;
    planetName = "Kamino";
    if (timeofday === "morning" || timeofday === "afternoon") {
      planet = "kamino";
    } else {
      planet = "kaminoNight";
    }
  }
  //set endor
  else if (conditions === "Fog" || conditions === "Mist") {
    if(celsius){
      message = tempC + "°C" + data.messages.endor.message;
    } else{
      message = temp + "°F" + data.messages.endor.message;
    }
    message = message.replace("()", timeofdaydisplay);
    description = data.messages.endor.description;
    planetName = "Endor";
    if (timeofday === "morning" || timeofday === "afternoon") {
      planet = "endor";
    } else {
      planet = "endorNight";
    }
  }
  //set dagobah
  else if (humidity >= 80) {
    if(celsius){
      message = tempC + "°C" + data.messages.dagobah.message;
    } else{
      message = temp + "°F" + data.messages.dagobah.message;
    }
    message = message.replace("()", timeofdaydisplay);
    description = data.messages.dagobah.description;
    planetName = "Dagobah";
    if (timeofday === "morning" || timeofday === "afternoon") {
      planet = "dagobah";
    } else {
      planet = "dagobahNight";
    }
  }
  //set bespin
  else if (wind >= 35) {
    if(celsius){
      message = tempC + "°C" + data.messages.bespin.message;
    } else{
      message = temp + "°F" + data.messages.bespin.message;
    }
    message = message.replace("()", timeofdaydisplay);
    description = data.messages.bespin.description;
    planetName = "Bespin";
    if (timeofday === "morning" || timeofday === "afternoon") {
      planet = "bespin";
    } else {
      planet = "bespinNight";
    }
  }
  // set to scarif
  else if (temp >= 70 && temp <= 85 && (conditions === "Clear" || detailedconditions === "few clouds")) {
    if(celsius){
      message = tempC + "°C" + data.messages.scarif.message;
    } else{
      message = temp + "°F" + data.messages.scarif.message;
    }
    message = message.replace("()", timeofdaydisplay);
    description = data.messages.scarif.description;
    planetName = "Scarif";
    if (timeofday === "morning" || timeofday === "afternoon") {
      planet = "scarif";
    } else {
      planet = "scarifNight";
    }
  }
  //set naboo
  else if (temp >= 33 && temp <= 49) {
    if(celsius){
      message = tempC + "°C" + data.messages.naboo.message;
    } else{
      message = temp + "°F" + data.messages.naboo.message;
    }
    message = message.replace("()", timeofdaydisplay);
    description = data.messages.naboo.description;
    planetName = "Naboo";
    if (timeofday === "morning" || timeofday === "afternoon") {
      planet = "naboo";
    } else {
      planet = "nabooNight";
    }
  }
  // set coruscant
  else if (temp >= 50 && temp < 80) {
    if(celsius){
      message = tempC + "°C" + data.messages.coruscant.message;
    } else{
      message = temp + "°F" + data.messages.coruscant.message;
    }
    message = message.replace("()", timeofdaydisplay);
    description = data.messages.coruscant.description; 
    planetName = "Coruscant";
    if (timeofday === "morning" || timeofday ==="afternoon") {
      planet = "coruscant";
    } else {
      planet = "coruscantNight";
    }
  }
  //set tatooine
  else if (temp >= 80 && temp <= 95) {
    if(celsius){
      message = tempC + "°C" + data.messages.tatooine.message;
    } else{
      message = temp + "°F" + data.messages.tatooine.message;
    }
    message = message.replace("()", timeofdaydisplay);
    description = data.messages.tatooine.description;
    planetName = "Tatooine";
    if (timeofday === "morning" || timeofday === "afternoon") {
      planet = "tatooine";
    } else {
      planet = "tatooineNight";
    }
  }
  // set mustafar
  else if (temp >= 96) {
    if(celsius){
      message = tempC + "°C" + data.messages.mustafar.message;
    } else{
      message = temp + "°F" + data.messages.mustafar.message;
    }
    message = message.replace("()", timeofdaydisplay);
    description = data.messages.mustafar.description;
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
