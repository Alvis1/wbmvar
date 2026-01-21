async function loadBearInfo() {
    const bearInfoElems = document.querySelectorAll(".bear-info");
    let bearData = {};

    try {
        const rawJson = await fetch("data/bear-info.json");

        bearData = await rawJson.json();
    } catch (err) {
        console.error("Error loading bear info JSON:", err);
        return;
    }

    bearInfoElems.forEach((elem) => {
        const data = bearData[elem.id];

        elem.setAttribute("text", `value: ${data}`);
    });
}

loadBearInfo();
