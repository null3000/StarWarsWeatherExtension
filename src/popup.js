document.getElementById("celsius").addEventListener("click", celsius);
document.getElementById("farenheit").addEventListener("click", farenheit);

function farenheit(){
    console.log("farenheit");
    localStorage.clear();
    localStorage.setItem("unit", "farenheit");

}

function celsius(){
    console.log("celsius");
    localStorage.clear();
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
setProperUnit();






