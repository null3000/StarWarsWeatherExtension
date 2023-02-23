document.getElementById("celsius").addEventListener("click", celsius);
document.getElementById("farenheit").addEventListener("click", farenheit);

function farenheit(){
    console.log("farenheit");
    localStorage.removeItem("planet");
    localStorage.removeItem("message");
    localStorage.removeItem("description");
    localStorage.removeItem("planetName");
    localStorage.removeItem("date");
    localStorage.removeItem("unit");
    console.log("cache cleared");;
    localStorage.setItem("unit", "farenheit");
}

function celsius(){
    console.log("celsius");
    localStorage.removeItem("planet");
    localStorage.removeItem("message");
    localStorage.removeItem("description");
    localStorage.removeItem("planetName");
    localStorage.removeItem("date");
    localStorage.removeItem("unit");
    console.log("cache cleared");
    localStorage.setItem("unit", "celsius");
}

function setProperUnit(){
    let unit = localStorage.getItem("unit");
    if (unit === "celsius"){
        console.log("showing celsius");
        document.getElementById("celsius").checked = true;
        document.getElementById("farenheit").checked = false;
    } else {
        console.log("showing farenheit");
        document.getElementById("celsius").checked = false;
        document.getElementById("farenheit").checked = true;
    }
}

document.getElementById("en").addEventListener("click", english);
document.getElementById("es").addEventListener("click", spanish);

function english(){
    console.log("english");
    localStorage.removeItem("planet");
    localStorage.removeItem("message");
    localStorage.removeItem("description");
    localStorage.removeItem("planetName");
    localStorage.removeItem("date");
    localStorage.removeItem("language");
    console.log("cache cleared");
    localStorage.setItem("language", "en");
}

function spanish(){
    console.log("spanish");
    localStorage.removeItem("planet");
    localStorage.removeItem("message");
    localStorage.removeItem("description");
    localStorage.removeItem("planetName");
    localStorage.removeItem("date");
    localStorage.removeItem("language");
    console.log("cache cleared");
    localStorage.setItem("language", "es");   
}

function setProperLanguage(){
    if(localStorage.getItem("language") == null){
        language = navigator.language;
        language = language.substring(0, 2);
      } else{
        language = localStorage.getItem("language");
      }
      console.log(language);
      
    if (language === "es"){
        console.log("showing spanish");
        document.getElementById("en").checked = false;
        document.getElementById("es").checked = true;
    } else {
        console.log("showing english");
        document.getElementById("en").checked = true;
        document.getElementById("es").checked = false;
    }
}

setProperLanguage();
setProperUnit();


