
/*
FOX & BUNNY FOREST CLUB
p5.js + ml5.js HandPose

1 = SQUEEZE / POP-UP
2 = STRETCH / BANNER
3 = SHAKE / VIDEO
R = RESTART

NEW:
MUSHROOM POOF ANIMATION
*/

// ==========================
// GLOBAL VARIABLES
// ==========================

let video
let handPose
let hands = []

let cameraSelect
let currentStream = null
let cameraReady = false
let cameraVersion = 0
let cameraStatus = "STARTING CAMERA..."

let ads = []
let adsDestroyed = 0
let nextAdTime = 0

let adInterval = 5000
let maxAds = 15

let gestureStatus = "LOADING HANDPOSE..."
let lastGestureTime = -1000
let gestureCooldown = 1000

// ==========================
// GESTURE SETTINGS
// ==========================

// SQUEEZE
let pinchClose = 0.6
let pinchOpen = 0.8
let pinchHoldTime = 200

let pinchReady = true
let pinchStartTime = null

// STRETCH
let stretchDistance = 0.5
let stretchStart = null

// SHAKE - ORIGINAL VERSION

let shakeWindow = 1800
let shakeMinDistance = 0.22
let shakeRequiredReversals = 3
let shakeNoiseThreshold = 0.025

// Allow brief hand tracking loss
let shakeTrackingGrace = 450
let lastHandSeenTime = 0

// Extra protection against accidental movement
let shakeTotalDistance = 0
let shakeMinimumTotalDistance = 0.85

let shakePositions = []
let shakeMotion = 0
let previousHandCount = 0
let shakeDirection = 0
let shakeExtreme = null
let shakeReversals = 0
let shakeStartTime = 0

// DEBUG
let debugPinch = 0
let debugStretch = 0

// ==========================
// FOREST COLORS
// ==========================

let C = {
    cream: "#FAF4E8",
    paper: "#FFFCF6",
    brown: "#5B483C",
    muted: "#8D7B6B",
    sage: "#A7B99A",
    green: "#698266",
    paleGreen: "#E3EBD9",
    orange: "#D98B53",
    fox: "#D88A4D",
    pink: "#E9B7B7",
    red: "#D86B65",
    gold: "#E5C07B",
    blue: "#B8C7C4"
}

let messages = [
    "20% OFF",
    "SPECIAL OFFER",
    "YOU WON!",
    "EXCLUSIVE DEAL",
    "LIMITED TIME",
    "FREE GIFT"
]

// ==========================
// NEW MUSHROOM PARTICLES
// ==========================

let mushroomParticles = []

let poofColors = [
    "#E9B7B7",
    "#FAF4E8",
    "#D86B65",
    "#A7B99A",
    "#E5C07B",
    "#FFFCF6"
]

// ==========================
// PRELOAD
// ==========================

function preload() {

    handPose = ml5.handPose({
        maxHands: 2,
        flipped: false
    })

}

// ==========================
// SETUP
// ==========================

function setup() {

    let canvas = createCanvas(900, 740)

    canvas.parent("canvas-container")

    textFont("Trebuchet MS")

    cameraSelect =
        document.getElementById("camera-select")

    if (cameraSelect) {

        cameraSelect.addEventListener(
            "change",
            function() {
                startCamera(cameraSelect.value)
            }
        )

    }

    let refreshButton =
        document.getElementById("refresh-camera")

    if (refreshButton) {

        refreshButton.addEventListener(
            "click",
            function() {
                refreshCameras()
            }
        )

    }

    addAd(0)
    addAd(1)
    addAd(2)

    nextAdTime = millis() + adInterval

    initializeCamera()

}

// ==========================
// CAMERA INITIALIZATION
// ==========================

async function initializeCamera() {

    try {

        let permissionStream =
            await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false
            })

        let devices =
            await navigator.mediaDevices.enumerateDevices()

        let cameras = devices.filter(function(device) {
            return device.kind === "videoinput"
        })

        let emeet = cameras.find(function(camera) {
            return camera.label.toLowerCase().includes("emeet")
        })

        let chosenCamera = emeet || cameras[0]

        permissionStream.getTracks().forEach(function(track) {
            track.stop()
        })

        await startCamera(
            chosenCamera ? chosenCamera.deviceId : ""
        )

        await refreshCameras(false)

    } catch (error) {

        console.error(error)
        cameraStatus = "CAMERA ERROR"

    }

}

// ==========================
// REFRESH CAMERAS
// ==========================

async function refreshCameras(autoSelect = true) {

    try {

        let devices =
            await navigator.mediaDevices.enumerateDevices()

        let cameras = devices.filter(function(device) {
            return device.kind === "videoinput"
        })

        if (cameraSelect) {

            cameraSelect.innerHTML = ""

            for (let i = 0; i < cameras.length; i++) {

                let option = document.createElement("option")

                option.value = cameras[i].deviceId

                option.textContent =
                    cameras[i].label || "Camera " + (i + 1)

                cameraSelect.appendChild(option)

            }

        }

        let activeId = currentStream
            ? currentStream.getVideoTracks()[0].getSettings().deviceId
            : ""

        if (cameraSelect && activeId) {
            cameraSelect.value = activeId
        }

        let emeet = cameras.find(function(camera) {
            return camera.label.toLowerCase().includes("emeet")
        })

        if (
            autoSelect &&
            emeet &&
            emeet.deviceId !== activeId
        ) {

            await startCamera(emeet.deviceId)

        }

    } catch (error) {

        console.error(error)
        cameraStatus = "CAMERA LIST ERROR"

    }

}

// ==========================
// START CAMERA
// ==========================

async function startCamera(deviceId) {

    let version = ++cameraVersion

    cameraReady = false
    cameraStatus = "CONNECTING CAMERA..."

    try {

        let constraints = {

            audio: false,

            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                frameRate: { ideal: 30 }
            }

        }

        if (deviceId) {

            constraints.video.deviceId = {
                exact: deviceId
            }

        }

        let stream =
            await navigator.mediaDevices.getUserMedia(
                constraints
            )

        if (version !== cameraVersion) {

            stream.getTracks().forEach(function(track) {
                track.stop()
            })

            return

        }

        if (!video) {

            video = createVideo([])
            video.hide()

            video.elt.autoplay = true
            video.elt.muted = true
            video.elt.playsInline = true

            video.elt.srcObject = stream

            await video.elt.play()

            currentStream = stream

            video.size(
                video.elt.videoWidth,
                video.elt.videoHeight
            )

            handPose.detectStart(video, gotHands)

        } else {

            let oldStream = currentStream

            video.elt.srcObject = stream

            await video.elt.play()

            currentStream = stream

            video.size(
                video.elt.videoWidth,
                video.elt.videoHeight
            )

            if (oldStream && oldStream !== stream) {

                oldStream.getTracks().forEach(function(track) {
                    track.stop()
                })

            }

        }

        hands = []

        resetGestureTracking()

        cameraReady = true

        cameraStatus =
            stream.getVideoTracks()[0].label +
            " CONNECTED"

        gestureStatus = "SHOW YOUR HANDS"

        let activeId =
            stream.getVideoTracks()[0].getSettings().deviceId

        if (cameraSelect && activeId) {
            cameraSelect.value = activeId
        }

    } catch (error) {

        console.error(error)
        cameraStatus = "CAMERA CONNECTION FAILED"

    }

}

// ==========================
// HANDPOSE RESULTS
// ==========================

function gotHands(results) {

    if (cameraReady) {
        hands = results
    }

}

// ==========================
// MAIN DRAW
// ==========================

function draw() {

    background(C.cream)

    drawBackgroundDecorations()
    drawHeader()
    drawWebsite()

    if (millis() > nextAdTime) {

        addAd()
        nextAdTime = millis() + adInterval

    }

    // DRAW ALL ADS

    for (let i = ads.length - 1; i >= 0; i--) {

        let ad = ads[i]

        ad.appearing = min(
            1,
            ad.appearing + 0.08
        )

        if (ad.removing) {

            ad.progress += 0.045

            // NEW:
            // Spawn mushroom spores once,
            // when the pop-up is squeezed.

            if (
                ad.type === 0 &&
                ad.progress >= 0.35 &&
                !ad.poofCreated
            ) {

                createMushroomPoof(ad)

                ad.poofCreated = true

            }

            if (ad.progress >= 1) {

                ads.splice(i, 1)
                adsDestroyed++

                continue

            }

        }

        drawAd(ad)

    }

    // Draw particles on top of ads
    updateMushroomParticles()

    detectGestures()

    drawCamera()
    drawGestureStatus()

}

// ==========================
// BACKGROUND DECORATIONS
// ==========================

function drawBackgroundDecorations() {

    noStroke()

    fill("#F0E4D4")

    ellipse(40, 80, 180, 140)
    ellipse(850, 650, 180, 160)

    for (let i = 0; i < 10; i++) {

        let x = 30 + i * 94
        let y = 86 + (i % 3) * 8

        drawTinyFlower(
            x,
            y,
            0.65,
            i % 2 === 0 ? C.pink : C.gold
        )

    }

    drawLeaf(21, 405, 0.8, -0.4)
    drawLeaf(877, 200, 0.85, 0.5)

}

// ==========================
// TINY FLOWER
// ==========================

function drawTinyFlower(
    x,
    y,
    s = 1,
    color = C.pink
) {

    push()

    translate(x, y)
    scale(s)

    noStroke()
    fill(color)

    for (let a = 0; a < 5; a++) {

        push()

        rotate(a * TWO_PI / 5)

        ellipse(0, -7, 8, 12)

        pop()

    }

    fill(C.gold)
    circle(0, 0, 7)

    pop()

}

// ==========================
// LEAF
// ==========================

function drawLeaf(x, y, s = 1, a = 0) {

    push()

    translate(x, y)
    rotate(a)
    scale(s)

    noStroke()
    fill(C.sage)

    ellipse(-7, 0, 24, 12)
    ellipse(9, -9, 24, 12)

    stroke(C.green)
    strokeWeight(1.5)

    line(-19, 8, 21, -18)

    pop()

}

// ==========================
// MUSHROOM CHARACTER
// ==========================

function drawMushroom(x, y, s = 1) {

    push()

    translate(x, y)
    scale(s)

    noStroke()

    fill("#F6E8D6")
    rect(-9, -2, 18, 27, 7)

    fill(C.red)
    arc(0, 0, 48, 39, PI, TWO_PI, CHORD)

    fill(C.paper)

    circle(-13, -10, 6)
    circle(3, -16, 8)
    circle(15, -8, 5)

    fill(C.brown)

    circle(-4, 11, 2.5)
    circle(5, 11, 2.5)

    pop()

}

// ==========================
// BUNNY CHARACTER
// ==========================

function drawBunny(x, y, s = 1) {

    push()

    translate(x, y)
    scale(s)

    noStroke()

    fill(C.paper)

    ellipse(-15, -42, 22, 64)
    ellipse(15, -42, 22, 64)

    fill(C.pink)

    ellipse(-15, -42, 10, 43)
    ellipse(15, -42, 10, 43)

    fill(C.paper)

    ellipse(0, 12, 70, 70)
    ellipse(0, -2, 65, 59)

    fill(C.brown)

    circle(-12, -4, 5)
    circle(12, -4, 5)

    fill(C.pink)

    ellipse(-21, 8, 12, 7)
    ellipse(21, 8, 12, 7)

    triangle(-4, 5, 4, 5, 0, 10)

    stroke(C.brown)
    strokeWeight(1.5)
    noFill()

    arc(-4, 11, 8, 7, 0, PI)
    arc(4, 11, 8, 7, 0, PI)

    pop()

}

// ==========================
// FOX CHARACTER
// ==========================

function drawFox(x, y, s = 1) {

    push()

    translate(x, y)
    scale(s)

    noStroke()

    fill(C.fox)

    triangle(-34, -23, -27, -68, -5, -39)
    triangle(34, -23, 27, -68, 5, -39)

    fill(C.pink)

    triangle(-26, -37, -24, -56, -14, -37)
    triangle(26, -37, 24, -56, 14, -37)

    fill(C.fox)

    ellipse(0, 0, 83, 74)

    fill(C.paper)

    ellipse(-17, 13, 37, 35)
    ellipse(17, 13, 37, 35)

    fill(C.brown)

    circle(-17, -5, 5)
    circle(17, -5, 5)

    triangle(-5, 12, 5, 12, 0, 17)

    fill(C.pink)

    ellipse(-29, 12, 11, 7)
    ellipse(29, 12, 11, 7)

    pop()

}

// ==========================
// GAME HEADER
// ==========================

function drawHeader() {

    noStroke()
    textAlign(LEFT)

    fill(C.brown)
    textStyle(BOLD)
    textSize(27)

    text("the little forest club", 35, 43)

    fill(C.green)
    textStyle(NORMAL)
    textSize(12)

    text(
        "✿ FOX & BUNNY / INTERNET RESCUE",
        37,
        66
    )

    fill(C.paleGreen)
    rect(572, 17, 140, 60, 14)

    fill("#F7E2D9")
    rect(723, 17, 143, 60, 14)

    fill(C.green)
    textSize(10)
    textStyle(BOLD)

    text("ADS CLEARED", 586, 37)

    fill(C.brown)
    textSize(27)

    text(adsDestroyed, 586, 66)

    fill("#AD6B61")
    textSize(10)

    text("FOREST INVADERS", 736, 37)

    fill(C.brown)
    textSize(27)

    text(ads.length, 736, 66)

    textStyle(NORMAL)

}

// ==========================
// FOREST WEBSITE
// ==========================

function drawWebsite() {

    push()

    noStroke()

    fill("#E6DCCB")
    rect(32, 102, 840, 470, 17)

    fill(C.paper)
    rect(29, 98, 840, 470, 17)

    fill("#E8E8DA")
    rect(29, 98, 840, 38, 17)

    fill(C.red)
    circle(52, 116, 10)

    fill(C.gold)
    circle(70, 116, 10)

    fill(C.sage)
    circle(88, 116, 10)

    fill(C.paper)
    rect(270, 105, 357, 23, 11)

    fill(C.muted)
    textAlign(CENTER)
    textSize(11)

    text(
        "www.foxandbunnyforest.club",
        448,
        121
    )

    textAlign(LEFT)

    fill(C.green)
    textSize(10)
    textStyle(BOLD)

    text(
        "✿ WELCOME TO OUR LITTLE WORLD",
        54,
        161
    )

    fill(C.brown)
    textFont("Georgia")
    textSize(25)

    text("Fox & Bunny", 54, 193)

    textFont("Trebuchet MS")

    fill(C.muted)
    textSize(10)
    textStyle(NORMAL)

    text(
        "HOME     FOREST STORIES     LITTLE SHOP     ABOUT US",
        490,
        183
    )

    stroke("#E8DCCB")
    line(54, 207, 844, 207)
    noStroke()

    // HERO SECTION

    fill(C.paleGreen)
    rect(54, 222, 790, 186, 17)

    fill("#D1DDC4")

    ellipse(740, 402, 280, 160)
    ellipse(615, 404, 230, 120)

    fill("#B7CCAB")
    ellipse(815, 406, 190, 100)

    drawMushroom(567, 363, 0.85)
    drawMushroom(810, 355, 0.55)

    drawBunny(700, 327, 1.02)
    drawFox(786, 337, 0.90)

    drawTinyFlower(596, 389, 0.7, C.pink)
    drawTinyFlower(832, 392, 0.6, C.gold)

    fill(C.green)
    textAlign(LEFT)
    textSize(10)
    textStyle(BOLD)

    text(
        "A COZY CORNER OF THE INTERNET",
        77,
        253
    )

    fill(C.brown)
    textFont("Georgia")
    textSize(27)
    textStyle(NORMAL)

    text("A little more forest,", 77, 296)
    text("a little less noise.", 77, 330)

    textFont("Trebuchet MS")

    fill(C.muted)
    textSize(11)

    text(
        "Help us keep this woodland world peaceful.",
        78,
        355
    )

    fill(C.orange)
    rect(77, 369, 139, 25, 13)

    fill(C.paper)
    textAlign(CENTER)
    textStyle(BOLD)
    textSize(10)

    text(
        "EXPLORE THE FOREST",
        146,
        385
    )

    drawStoryCard(
        54, 425, 248, 125,
        "MUSHROOM MEADOW",
        "A tiny world under the trees",
        0
    )

    drawStoryCard(
        325, 425, 248, 125,
        "FOX'S CORNER",
        "Slow mornings & warm sunshine",
        1
    )

    drawStoryCard(
        596, 425, 248, 125,
        "BUNNY'S GARDEN",
        "Little flowers, big feelings",
        2
    )

    pop()

}

// ==========================
// FOREST STORY CARDS
// ==========================

function drawStoryCard(
    x, y, w, h,
    title, subtitle, kind
) {

    noStroke()

    fill("#F5EEE2")
    rect(x, y, w, h, 11)

    if (kind === 0) {

        fill("#DCE5D5")
        rect(x + 9, y + 9, 73, 106, 8)

        drawMushroom(
            x + 46,
            y + 68,
            0.9
        )

    }

    if (kind === 1) {

        fill("#F4DEC9")
        rect(x + 9, y + 9, 73, 106, 8)

        drawFox(
            x + 46,
            y + 75,
            0.62
        )

    }

    if (kind === 2) {

        fill("#F1E2E2")
        rect(x + 9, y + 9, 73, 106, 8)

        drawBunny(
            x + 46,
            y + 74,
            0.61
        )

    }

    fill(C.green)
    textAlign(LEFT)
    textSize(9)
    textStyle(BOLD)

    text(
        "FOREST JOURNAL",
        x + 94,
        y + 34
    )

    fill(C.brown)
    textSize(12)

    text(title, x + 94, y + 58)

    fill(C.muted)
    textSize(10)
    textStyle(NORMAL)

    text(
        subtitle,
        x + 94,
        y + 80,
        w - 105,
        40
    )

}

// ==========================
// CREATE ADS
// ==========================

function addAd(type) {

    if (ads.length >= maxAds) {
        return
    }

    if (type === undefined) {
        type = floor(random(3))
    }

    let adWidth = random(185, 245)
    let adHeight = random(125, 152)

    let ad = {

        type: type,

        x: random(70, 820 - adWidth),
        y: random(210, 530 - adHeight),

        w: adWidth,
        h: adHeight,

        message: random(messages),

        removing: false,
        progress: 0,
        appearing: 0,

        // NEW
        poofCreated: false

    }

    if (type === 1) {

        ad.x = 63
        ad.y = random(230, 470)
        ad.w = 775
        ad.h = 58

    }

    ads.push(ad)

}

// ==========================
// DRAW ADS
// ==========================

function drawAd(ad) {

    push()

    translate(
        ad.x + ad.w / 2,
        ad.y + ad.h / 2
    )

    let scaleX = ad.appearing
    let scaleY = ad.appearing

    let rotation = 0
    let moveX = 0
    let moveY = 0

    if (ad.removing) {

        let p = ad.progress

        // ======================
        // NEW SQUEEZE ANIMATION
        // ======================

        if (ad.type === 0) {

            // First compress the ad.
            // Then it disappears as
            // mushroom spores burst out.

            if (p < 0.35) {

                let squeeze =
                    p / 0.35

                scaleX = 1 - squeeze * 0.9

                scaleY =
                    1 + sin(squeeze * PI) * 0.25

            } else {

                scaleX = 0.01
                scaleY = 0.01

            }

        }

        // STRETCH - ORIGINAL

        if (ad.type === 1) {

            scaleX = 1 + p * 0.5
            scaleY = max(0.01, 1 - p)

        }

        // SHAKE - ORIGINAL

        if (ad.type === 2) {

            moveX =
                sin(p * 65) *
                15 *
                (1 - p)

            moveY = -p * 180

            rotation = p * PI * 1.5

            scaleX = 1 - p * 0.5
            scaleY = scaleX

        }

    }

    translate(moveX, moveY)
    rotate(rotation)
    scale(scaleX, scaleY)

    translate(
        -ad.w / 2,
        -ad.h / 2
    )

    noStroke()
    textAlign(LEFT)
    textStyle(NORMAL)

    // ======================
    // POP-UP AD
    // ======================

    if (ad.type === 0) {

        fill(167, 141, 124, 100)
        rect(5, 7, ad.w, ad.h, 11)

        fill("#FFF9F5")
        rect(0, 0, ad.w, ad.h, 11)

        fill("#F9A9A1")
        rect(0, 0, ad.w, 38, 11)

        fill("#7A3E40")
        textSize(12)
        textStyle(BOLD)
        textAlign(CENTER)

        text(
            "EXCLUSIVE OFFER!",
            ad.w / 2,
            24
        )

        textSize(17)

        text("×", ad.w - 15, 18)

        fill("#A83E4E")
        textSize(24)

        text(
            ad.message,
            ad.w / 2,
            74
        )

        fill(C.muted)
        textStyle(NORMAL)
        textSize(10)

        text(
            "You have been selected!",
            ad.w / 2,
            94
        )

        fill("#C94F66")

        rect(
            16,
            ad.h - 36,
            ad.w - 32,
            27,
            6
        )

        fill(255)
        textStyle(BOLD)
        textSize(10)

        text(
            "CLAIM YOUR DEAL!",
            ad.w / 2,
            ad.h - 18
        )

    }

    // ======================
    // BANNER AD
    // ======================

    if (ad.type === 1) {

        fill("#342D40")
        rect(0, 0, ad.w, ad.h, 7)

        fill("#FFCC5B")
        rect(0, 0, 108, ad.h, 7)

        fill("#F47B4C")
        circle(53, ad.h / 2, 39)

        fill("#FFF6E5")
        textAlign(CENTER)
        textSize(25)
        textStyle(BOLD)

        text("%", 53, ad.h / 2 + 9)

        fill("#FFC9C0")
        textAlign(LEFT)
        textSize(9)

        text("SPONSORED", 125, 19)

        fill(255)
        textSize(20)

        text("FLASH SALE!", 125, 43)

        fill("#FFDC70")
        textSize(19)

        text("UP TO 70% OFF", 345, 38)

        fill("#FF6B7A")

        rect(
            ad.w - 133,
            12,
            114,
            33,
            6
        )

        fill(255)
        textAlign(CENTER)
        textSize(11)

        text(
            "BUY NOW",
            ad.w - 76,
            33
        )

    }

    // ======================
    // VIDEO AD
    // ======================

    if (ad.type === 2) {

        fill(142, 126, 120, 100)
        rect(5, 6, ad.w, ad.h, 9)

        fill("#FFF9F5")
        rect(0, 0, ad.w, ad.h, 9)

        fill("#2C3940")
        rect(5, 5, ad.w - 10, ad.h - 40, 6)

        fill("#5B817A")
        ellipse(ad.w * 0.35, 44, 57, 57)

        fill("#E1A27F")
        ellipse(ad.w * 0.68, 38, 44, 44)

        fill(255)
        circle(ad.w / 2, 43, 34)

        fill("#2C3940")

        triangle(
            ad.w / 2 - 4, 35,
            ad.w / 2 - 4, 51,
            ad.w / 2 + 10, 43
        )

        fill("#B7B7B7")
        rect(12, ad.h - 44, ad.w - 24, 3)

        fill("#F06363")

        rect(
            12,
            ad.h - 44,
            (ad.w - 24) * 0.4,
            3
        )

        fill(C.brown)
        textAlign(LEFT)
        textStyle(BOLD)
        textSize(11)

        text(
            "DON'T MISS THIS VIDEO!",
            10,
            ad.h - 15
        )

        fill(C.muted)
        textAlign(RIGHT)
        textSize(9)

        text(
            "Ad",
            ad.w - 10,
            ad.h - 15
        )

    }

    pop()

}

// ==========================
// NEW: CREATE MUSHROOM POOF
// ==========================

function createMushroomPoof(ad) {

    let centerX =
        ad.x + ad.w / 2

    let centerY =
        ad.y + ad.h / 2

    // Create 35 particles

    for (let i = 0; i < 35; i++) {

        let angle = random(TWO_PI)

        let speed = random(2, 7)

        let particle = {

            x: centerX,
            y: centerY,

            vx: cos(angle) * speed,
            vy: sin(angle) * speed - 1.5,

            size: random(5, 15),

            color: random(poofColors),

            life: 255,

            rotation: random(TWO_PI),
            rotationSpeed: random(-0.1, 0.1),

            type: floor(random(3))

        }

        mushroomParticles.push(particle)

    }

    // A few larger flowers

    for (let i = 0; i < 7; i++) {

        let angle = random(TWO_PI)

        mushroomParticles.push({

            x: centerX,
            y: centerY,

            vx: cos(angle) * random(2, 5),
            vy: sin(angle) * random(2, 5) - 2,

            size: random(12, 20),

            color: random([
                C.pink,
                C.gold,
                C.sage
            ]),

            life: 255,

            rotation: random(TWO_PI),
            rotationSpeed: random(-0.06, 0.06),

            type: 3

        })

    }

}

// ==========================
// NEW: UPDATE PARTICLES
// ==========================

function updateMushroomParticles() {

    for (
        let i = mushroomParticles.length - 1;
        i >= 0;
        i--
    ) {

        let p = mushroomParticles[i]

        p.x += p.vx
        p.y += p.vy

        // Gentle gravity

        p.vy += 0.045

        // Slow down gradually

        p.vx *= 0.985
        p.vy *= 0.985

        p.rotation += p.rotationSpeed

        p.life -= 5

        if (p.life <= 0) {

            mushroomParticles.splice(i, 1)
            continue

        }

        drawMushroomParticle(p)

    }

}

// ==========================
// NEW: DRAW PARTICLES
// ==========================

function drawMushroomParticle(p) {

    push()

    translate(p.x, p.y)
    rotate(p.rotation)

    let alpha =
        constrain(p.life / 255, 0, 1)

    let col = color(p.color)
    col.setAlpha(p.life)

    noStroke()
    fill(col)

    // Type 0: Round spore

    if (p.type === 0) {

        circle(0, 0, p.size)

    }

    // Type 1: Tiny mushroom cap

    if (p.type === 1) {

        arc(
            0,
            0,
            p.size,
            p.size * 0.8,
            PI,
            TWO_PI,
            CHORD
        )

        fill(255, 255, 255, p.life)

        circle(
            -p.size * 0.15,
            -p.size * 0.12,
            p.size * 0.18
        )

    }

    // Type 2: Small star

    if (p.type === 2) {

        drawPoofStar(
            0,
            0,
            p.size * 0.5,
            p.size
        )

    }

    // Type 3: Tiny flower

    if (p.type === 3) {

        for (let a = 0; a < 5; a++) {

            push()

            rotate(a * TWO_PI / 5)

            ellipse(
                0,
                -p.size * 0.3,
                p.size * 0.35,
                p.size * 0.55
            )

            pop()

        }

        fill(229, 192, 123, p.life)

        circle(
            0,
            0,
            p.size * 0.3
        )

    }

    pop()

}

// ==========================
// NEW: DRAW STAR
// ==========================

function drawPoofStar(x, y, r1, r2) {

    beginShape()

    for (let i = 0; i < 10; i++) {

        let angle =
            -HALF_PI + i * PI / 5

        let radius =
            i % 2 === 0 ? r2 : r1

        vertex(
            x + cos(angle) * radius,
            y + sin(angle) * radius
        )

    }

    endShape(CLOSE)

}

// ==========================
// GET HAND POINT
// ==========================

function getHandPoint(hand, name, index) {

    if (hand[name]) {
        return hand[name]
    }

    if (
        hand.keypoints &&
        hand.keypoints[index]
    ) {

        return hand.keypoints[index]

    }

    return null

}

// ==========================
// RESET SHAKE TRACKING
// ==========================


function resetShakeTracking() {

    shakePositions = []
    shakeMotion = 0

    previousHandCount = 0
    shakeDirection = 0
    shakeExtreme = null
    shakeReversals = 0
    shakeStartTime = 0

    shakeTotalDistance = 0
    lastHandSeenTime = 0
}


// ==========================
// RESET ALL GESTURES
// ==========================

function resetGestureTracking() {

    pinchReady = true
    pinchStartTime = null

    stretchStart = null

    resetShakeTracking()

    lastGestureTime = millis()

}

// ==========================
// DETECT GESTURES
// ==========================

function detectGestures() {

    
if (!cameraReady || hands.length === 0) {

    pinchStartTime = null
    stretchStart = null

    if (
        lastHandSeenTime > 0 &&
        millis() - lastHandSeenTime < shakeTrackingGrace
    ) {

        gestureStatus = "KEEP SHAKING!"

    } else {

        gestureStatus = "SHOW YOUR HANDS"
        resetShakeTracking()
    }

    return
}

// Remember the last time a hand was visible
lastHandSeenTime = millis()

    if (
        millis() - lastGestureTime <
        gestureCooldown
    ) {

        gestureStatus = "COOLDOWN..."

        pinchStartTime = null
        stretchStart = null

        resetShakeTracking()

        return

    }

    let hand1 = hands[0]

    let palm1 = getHandPoint(
        hand1,
        "middle_finger_mcp",
        9
    )

    let wrist1 = getHandPoint(
        hand1,
        "wrist",
        0
    )

    if (!palm1 || !wrist1) {
        return
    }

    let handCenterX = palm1.x

    let handSize1 = dist(
        wrist1.x,
        wrist1.y,
        palm1.x,
        palm1.y
    )

    // ==========================
    // TWO HANDS: STRETCH
    // ==========================

    if (hands.length >= 2) {

        pinchStartTime = null

        let hand2 = hands[1]

        let palm2 = getHandPoint(
            hand2,
            "middle_finger_mcp",
            9
        )

        let wrist2 = getHandPoint(
            hand2,
            "wrist",
            0
        )

        if (!palm2 || !wrist2) {
            return
        }

        handCenterX =
            (palm1.x + palm2.x) / 2

        let handSize2 = dist(
            wrist2.x,
            wrist2.y,
            palm2.x,
            palm2.y
        )

        let averageHandSize =
            (handSize1 + handSize2) / 2

        let distanceBetweenHands = dist(
            palm1.x,
            palm1.y,
            palm2.x,
            palm2.y
        )

        let normalizedDistance =
            distanceBetweenHands /
            max(averageHandSize, 1)

        if (
            stretchStart === null ||
            normalizedDistance < stretchStart
        ) {

            stretchStart = normalizedDistance

        }

        debugStretch =
            normalizedDistance - stretchStart

        if (debugStretch > stretchDistance) {

            if (removeAd(1)) {

                gestureStatus = "STRETCH DETECTED!"
                lastGestureTime = millis()

                stretchStart = null

                resetShakeTracking()

                return

            }

        }

        gestureStatus = "TWO HANDS - TRACKING"

    } else {

        // ==========================
        // ONE HAND: SQUEEZE
        // ==========================

        stretchStart = null
        debugStretch = 0

        let thumb = getHandPoint(
            hand1,
            "thumb_tip",
            4
        )

        let index = getHandPoint(
            hand1,
            "index_finger_tip",
            8
        )

        if (
            thumb &&
            index &&
            handSize1 > 10
        ) {

            let pinchDistance = dist(
                thumb.x,
                thumb.y,
                index.x,
                index.y
            ) / handSize1

            debugPinch = pinchDistance

            if (pinchDistance > pinchOpen) {

                pinchReady = true
                pinchStartTime = null

            }

            if (
                pinchReady &&
                pinchDistance < pinchClose
            ) {

                if (pinchStartTime === null) {
                    pinchStartTime = millis()
                }

                let holdingTime =
                    millis() - pinchStartTime

                gestureStatus =
                    "SQUEEZING " +
                    min(
                        100,
                        floor(
                            holdingTime /
                            pinchHoldTime * 100
                        )
                    ) +
                    "%"

                if (
                    holdingTime >= pinchHoldTime
                ) {

                    if (removeAd(0)) {

                        gestureStatus =
                            "SQUEEZE DETECTED!"

                        lastGestureTime = millis()

                        pinchReady = false
                        pinchStartTime = null

                        resetShakeTracking()

                        return

                    }

                }

            } else {

                pinchStartTime = null
                gestureStatus = "ONE HAND - TRACKING"

            }

        } else {

            pinchStartTime = null
            gestureStatus = "ONE HAND - TRACKING"

        }

    }

    // ==========================
    // SHAKE
    // ==========================

    detectShake(
        handCenterX,
        hands.length,
        handSize1
    )

}

// ==========================
// ORIGINAL SHAKE DETECTION
// ==========================


function detectShake(x, handCount, handSize) {

    let now = millis()

    if (
        previousHandCount !== 0 &&
        previousHandCount !== handCount
    ) {
        resetShakeTracking()
    }

    previousHandCount = handCount

    // Normalize movement by hand size
    let normalizedX = x / max(handSize, 1)

    shakePositions.push({
        x: normalizedX,
        time: now
    })

    shakePositions = shakePositions.filter(function(point) {
        return now - point.time <= shakeWindow
    })

    if (shakePositions.length < 2) {
        return
    }

    // Reset if the movement takes too long
    if (
        shakeStartTime > 0 &&
        now - shakeStartTime > shakeWindow
    ) {

        resetShakeTracking()

        previousHandCount = handCount

        shakePositions.push({
            x: normalizedX,
            time: now
        })

        return
    }

    let latest =
        shakePositions[shakePositions.length - 1]

    let previous =
        shakePositions[shakePositions.length - 2]

    let movement = latest.x - previous.x

    shakeMotion = abs(movement)

    // Ignore tiny tracking jitter
    if (abs(movement) < shakeNoiseThreshold) {
        return
    }

    let direction = movement > 0 ? 1 : -1

    // Start tracking the first movement
    if (shakeDirection === 0) {

        shakeDirection = direction
        shakeExtreme = previous.x
        shakeStartTime = now

        return
    }

    // Continue in the same direction
    if (direction === shakeDirection) {

        if (direction === 1) {
            shakeExtreme = max(shakeExtreme, latest.x)
        } else {
            shakeExtreme = min(shakeExtreme, latest.x)
        }

        return
    }

    // Direction changed
    let reverseDistance =
        abs(latest.x - shakeExtreme)

    if (reverseDistance >= shakeMinDistance) {

        shakeReversals++

        shakeTotalDistance += reverseDistance

        shakeDirection = direction
        shakeExtreme = latest.x

        gestureStatus =
            "SHAKING " +
            shakeReversals +
            " / " +
            shakeRequiredReversals
    }

    // Only trigger after repeated movement
    if (
        shakeReversals >= shakeRequiredReversals &&
        shakeTotalDistance >= shakeMinimumTotalDistance
    ) {

        if (removeAd(2)) {

            gestureStatus = "FOREST BREEZE!"

            lastGestureTime = now

            resetShakeTracking()

            return
        }
    }
}


    let reverseDistance =
        abs(latest.x - shakeExtreme)

    if (
        reverseDistance >=
        shakeMinDistance
    ) {

        shakeReversals++

        shakeDirection = direction
        shakeExtreme = latest.x

    }

    if (
        shakeReversals >=
        shakeRequiredReversals
    ) {

        if (removeAd(2)) {

            gestureStatus = "SHAKE DETECTED!"
            lastGestureTime = millis()

            resetShakeTracking()

        }

    }


// ==========================
// CAMERA PREVIEW
// ==========================

function drawCamera() {

    noStroke()

    fill(C.paper)
    rect(30, 589, 250, 132, 15)

    fill(C.paleGreen)
    rect(39, 598, 162, 122, 9)

    let previewX = 40
    let previewY = 599
    let previewW = 160
    let previewH = 120

    if (
        video &&
        video.elt.readyState >= 2
    ) {

        let sourceW =
            video.elt.videoWidth

        let sourceH =
            video.elt.videoHeight

        push()

        translate(
            previewX + previewW,
            previewY
        )

        scale(-1, 1)

        image(
            video,
            0,
            0,
            previewW,
            previewH
        )

        pop()

        for (let hand of hands) {

            if (!hand.keypoints) {
                continue
            }

            for (let point of hand.keypoints) {

                let x =
                    previewX +
                    previewW -
                    (point.x / sourceW) *
                    previewW

                let y =
                    previewY +
                    (point.y / sourceH) *
                    previewH

                fill("#B8FF9A")
                noStroke()

                circle(x, y, 5)

            }

        }

    }

    fill(C.brown)
    textAlign(LEFT)
    textStyle(BOLD)
    textSize(10)

    text(
        "LIVE FOREST CAM",
        207,
        615
    )

    fill(C.green)
    textStyle(NORMAL)
    textSize(10)

    text(
        hands.length + " HAND(S)",
        207,
        635
    )

    drawTinyFlower(
        242,
        682,
        0.7,
        C.pink
    )

}

// ==========================
// FOREST STATUS PANEL
// ==========================

function drawGestureStatus() {

    noStroke()

    fill(C.paper)
    rect(294, 589, 575, 132, 15)

    fill(C.brown)
    textAlign(LEFT)
    textStyle(BOLD)
    textSize(14)

    text(
        "✿ FOREST RESCUE STATUS",
        312,
        615
    )

    fill(C.green)
    textSize(13)

    text(
        gestureStatus,
        312,
        639
    )

    fill(C.muted)
    textStyle(NORMAL)
    textSize(11)

    text(
        "SHAKE: " +
        shakeReversals +
        " / " +
        shakeRequiredReversals,
        312,
        660
    )

    text(
        "PINCH: " +
        debugPinch.toFixed(2) +
        "     STRETCH: " +
        debugStretch.toFixed(2),
        312,
        679
    )

    textSize(10)

    text(
        cameraStatus.slice(0, 72),
        312,
        699
    )

    drawMushroom(
        827,
        680,
        0.48
    )

}

// ==========================
// REMOVE AD
// ==========================

function removeAd(type) {

    for (
        let i = ads.length - 1;
        i >= 0;
        i--
    ) {

        if (
            ads[i].type === type &&
            !ads[i].removing
        ) {

            ads[i].removing = true
            ads[i].progress = 0

            return true

        }

    }

    return false

}

// ==========================
// KEYBOARD SHORTCUTS
// ==========================

function keyPressed() {

    if (key === "1") {
        removeAd(0)
    }

    if (key === "2") {
        removeAd(1)
    }

    if (key === "3") {
        removeAd(2)
    }

    if (
        key === "r" ||
        key === "R"
    ) {

        restartGame()

    }

}

// ==========================
// RESTART GAME
// ==========================

function restartGame() {

    ads = []
    adsDestroyed = 0

    mushroomParticles = []

    addAd(0)
    addAd(1)
    addAd(2)

    resetGestureTracking()

    gestureStatus = "FOREST RESET!"

    nextAdTime =
        millis() + adInterval

}
