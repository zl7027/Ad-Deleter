
let video
let handPose
let hands = []

let ads = []
let adsDestroyed = 0
let nextAdTime = 0

let adInterval = 5000
let maxAds = 15

let gestureStatus = "LOADING HANDPOSE..."
let lastGestureTime = -1000

// Gesture sensitivity
let gestureCooldown = 1000

let pinchClose = 0.8
let pinchOpen = 0.85  

let stretchDistance = 0.5
let shakeStep = 2

// Gesture tracking
let pinchReady = true

let stretchStart = null

let previousHandX = null
let lastDirection = 0
let shakeCount = 0
let lastShakeTime = 0

let messages = [
    "20% OFF",
    "SPECIAL OFFER",
    "YOU WON!",
    "EXCLUSIVE DEAL",
    "LIMITED TIME",
    "FREE GIFT"
]


// -------------------------
// SETUP
// -------------------------

function preload() {

    handPose = ml5.handPose({
        maxHands: 2,
        flipped: false
    })

}

function setup() {

    let canvas = createCanvas(900, 700)
    canvas.parent("canvas-container")

    video = createCapture(VIDEO)
    video.size(320, 240)
    video.hide()

    textFont("Arial")

    handPose.detectStart(video, gotHands)

    addAd(0)
    addAd(1)
    addAd(2)

    nextAdTime = millis() + adInterval

}


// -------------------------
// DRAW
// -------------------------

function draw() {

    background(18, 21, 40)

    if (millis() > nextAdTime) {

        addAd()
        nextAdTime = millis() + adInterval

    }

    drawHeader()
    drawWebsite()

    // Update and draw ads
    for (let i = ads.length - 1; i >= 0; i--) {

        let ad = ads[i]

        if (ad.appearing < 1) {

            ad.appearing += 0.08
            ad.appearing = min(ad.appearing, 1)

        }

        if (ad.removing) {

            ad.progress += 0.06

            if (ad.progress >= 1) {

                ads.splice(i, 1)
                adsDestroyed++

                continue

            }

        }

        drawAd(ad)

    }

    detectGestures()
    drawCamera()
    drawGestureStatus()

}


// -------------------------
// HANDPOSE RESULTS
// -------------------------

function gotHands(results) {

    hands = results

}


// -------------------------
// GESTURE DETECTION
// -------------------------

function detectGestures() {

    if (hands.length === 0) {

        gestureStatus = "SHOW YOUR HANDS"

        pinchReady = true
        stretchStart = null

        previousHandX = null
        lastDirection = 0
        shakeCount = 0

        return

    }

    // Cooldown after each successful gesture
    if (millis() - lastGestureTime < gestureCooldown) {

        gestureStatus = "COOLDOWN..."

        stretchStart = null

        previousHandX = null
        lastDirection = 0
        shakeCount = 0

        return

    }


    // -------------------------
    // TWO HANDS: STRETCH
    // -------------------------

    if (hands.length >= 2) {

        let hand1 = hands[0]
        let hand2 = hands[1]

        let wrist1 = hand1.wrist
        let wrist2 = hand2.wrist

        let palm1 = hand1.middle_finger_mcp
        let palm2 = hand2.middle_finger_mcp

        let handSize1 = dist(
            wrist1.x, wrist1.y,
            palm1.x, palm1.y
        )

        let handSize2 = dist(
            wrist2.x, wrist2.y,
            palm2.x, palm2.y
        )

        let averageHandSize = (handSize1 + handSize2) / 2

        let distanceBetweenHands = abs(palm1.x - palm2.x)

        let normalizedDistance = distanceBetweenHands / max(averageHandSize, 1)

        gestureStatus = "TWO HANDS - STRETCH"

        // Begin tracking current stretch
        if (stretchStart === null) {

            stretchStart = normalizedDistance

        }

        // Update the closest distance
        if (normalizedDistance < stretchStart) {

            stretchStart = normalizedDistance

        }

        // Detect stretch
        if (normalizedDistance - stretchStart > stretchDistance) {

            removeAd(1)

            gestureStatus = "STRETCH DETECTED!"

            lastGestureTime = millis()

            // Start a new stretch after cooldown
            stretchStart = null

        }

        // Clear one-hand tracking
        previousHandX = null
        pinchReady = true

        shakeCount = 0
        lastDirection = 0

        return

    }


    // -------------------------
    // ONE HAND: SQUEEZE / SHAKE
    // -------------------------

    stretchStart = null

    let hand = hands[0]

    let thumb = hand.thumb_tip
    let index = hand.index_finger_tip

    let wrist = hand.wrist
    let palm = hand.middle_finger_mcp

    let handSize = dist(
        wrist.x, wrist.y,
        palm.x, palm.y
    )

    if (handSize < 10) {
        return
    }

    let pinchDistance = dist(
        thumb.x, thumb.y,
        index.x, index.y
    ) / handSize

    let handX = palm.x


    // -------------------------
    // SQUEEZE
    // -------------------------

    // Fingers open again
    if (pinchDistance > pinchOpen) {

        pinchReady = true

    }

    // Fingers close
    if (pinchReady && pinchDistance < pinchClose) {

        removeAd(0)

        gestureStatus = "SQUEEZE DETECTED!"

        lastGestureTime = millis()

        pinchReady = false

        previousHandX = null
        shakeCount = 0
        lastDirection = 0

        return

    }


    // -------------------------
    // SHAKE
    // -------------------------

    if (previousHandX !== null) {

        let movement = handX - previousHandX

        let direction = 0

        if (movement > shakeStep) {
            direction = 1
        }

        if (movement < -shakeStep) {
            direction = -1
        }

        if (direction !== 0) {

            if (
                lastDirection !== 0 &&
                direction !== lastDirection
            ) {

                if (millis() - lastShakeTime > 1100) {

                    shakeCount = 0

                }

                shakeCount++
                lastShakeTime = millis()

            }

            lastDirection = direction

        }

    }

    // Two direction changes = shake
    if (shakeCount >= 2) {

        removeAd(2)

        gestureStatus = "SHAKE DETECTED!"

        lastGestureTime = millis()

        shakeCount = 0
        lastDirection = 0
        previousHandX = null

        return

    }

    previousHandX = handX

    gestureStatus = "ONE HAND - TRACKING"

}


// -------------------------
// HEADER + SCORE
// -------------------------

function drawHeader() {

    noStroke()
    textAlign(LEFT)

    fill(255)
    textSize(30)
    textStyle(BOLD)
    text("AD ATTACK ✳", 30, 48)

    fill(160, 170, 200)
    textSize(12)
    textStyle(NORMAL)
    text("THE INTERNET IS UNDER ATTACK", 30, 70)

    fill(40, 45, 75)
    rect(540, 15, 155, 65, 12)
    rect(710, 15, 160, 65, 12)

    fill(160, 250, 190)
    textSize(11)
    text("ADS DESTROYED", 555, 35)

    fill(255)
    textSize(28)
    textStyle(BOLD)
    text(adsDestroyed, 555, 68)

    fill(255, 160, 180)
    textSize(11)
    textStyle(NORMAL)
    text("ACTIVE ADS", 725, 35)

    fill(255)
    textSize(28)
    textStyle(BOLD)
    text(ads.length, 725, 68)

    textStyle(NORMAL)

}


// -------------------------
// MAGAZINE WEBSITE
// -------------------------

function drawWebsite() {

    push()
    noStroke()

    fill(250, 249, 246)
    rect(30, 100, 840, 470, 14)

    fill(232)
    rect(30, 100, 840, 38, 12)

    fill(255, 95, 90)
    circle(53, 119, 11)

    fill(255, 190, 65)
    circle(72, 119, 11)

    fill(80, 195, 110)
    circle(91, 119, 11)

    fill(255)
    rect(265, 107, 365, 24, 6)

    fill(120)
    textAlign(CENTER)
    textSize(12)
    text("www.the-sunday-edit.com", 447, 123)

    textAlign(LEFT)

    fill(35)
    textSize(25)
    textStyle(BOLD)
    text("THE SUNDAY EDIT.", 60, 183)

    fill(115)
    textSize(11)
    textStyle(NORMAL)
    text("LIFESTYLE   CULTURE   DESIGN   ABOUT", 550, 182)

    stroke(220)
    line(60, 202, 840, 202)
    noStroke()

    fill(155, 105, 80)
    textSize(11)
    textStyle(BOLD)
    text("FEATURED STORY / OCTOBER 2026", 60, 240)

    fill(30)
    textSize(36)
    text("The art of slowing down", 60, 290)

    fill(110)
    textSize(16)
    textStyle(NORMAL)
    text("Finding a little peace in an always-connected world.", 60, 322)

    fill(226, 210, 195)
    rect(60, 355, 230, 150, 6)

    fill(200, 215, 205)
    rect(310, 355, 230, 150, 6)

    fill(215, 205, 220)
    rect(560, 355, 230, 150, 6)

    fill(175, 130, 110)
    ellipse(175, 415, 85, 85)

    fill(120, 155, 130)
    ellipse(425, 415, 85, 85)

    fill(155, 125, 170)
    ellipse(675, 415, 85, 85)

    fill(40)
    textSize(12)
    textStyle(BOLD)

    text("SLOW LIVING", 70, 487)
    text("CREATIVE SPACES", 320, 487)
    text("EVERYDAY OBJECTS", 570, 487)

    pop()

}


// -------------------------
// CREATE ADS
// -------------------------

function addAd(type) {

    if (ads.length >= maxAds) {
        return
    }

    if (type === undefined) {
        type = floor(random(3))
    }

    let adWidth = random(180, 250)
    let adHeight = random(120, 150)

    let newAd = {

        type: type,

        x: random(70, 820 - adWidth),
        y: random(210, 535 - adHeight),

        w: adWidth,
        h: adHeight,

        message: random(messages),

        removing: false,
        progress: 0,
        appearing: 0

    }

    if (type === 1) {

        newAd.x = 65
        newAd.y = random(205, 455)
        newAd.w = 770
        newAd.h = 55

    }

    ads.push(newAd)

}


// -------------------------
// DRAW ADS + ANIMATIONS
// -------------------------

function drawAd(ad) {

    push()

    translate(ad.x + ad.w / 2, ad.y + ad.h / 2)

    let scaleX = 1
    let scaleY = 1
    let rotation = 0
    let moveX = 0
    let moveY = 0

    if (!ad.removing) {

        scaleX = ad.appearing
        scaleY = ad.appearing

    }

    if (ad.removing) {

        let p = ad.progress

        if (ad.type === 0) {

            // Squeeze
            scaleX = max(0.01, 1 - p)
            scaleY = 1 + sin(p * PI) * 0.2

        }

        if (ad.type === 1) {

            // Stretch
            scaleX = 1 + p * 0.5
            scaleY = max(0.01, 1 - p)

        }

        if (ad.type === 2) {

            // Shake
            moveX = sin(p * 65) * 15 * (1 - p)
            moveY = -p * 180

            rotation = p * PI * 1.5

            scaleX = 1 - p * 0.5
            scaleY = 1 - p * 0.5

        }

    }

    translate(moveX, moveY)
    rotate(rotation)
    scale(scaleX, scaleY)

    translate(-ad.x - ad.w / 2, -ad.y - ad.h / 2)

    noStroke()
    textAlign(LEFT)
    textStyle(NORMAL)


    // POP-UP
    if (ad.type === 0) {

        fill(0, 0, 0, 45)
        rect(ad.x + 6, ad.y + 7, ad.w, ad.h, 8)

        fill(255)
        rect(ad.x, ad.y, ad.w, ad.h, 8)

        fill(232, 202, 189)
        rect(ad.x, ad.y, ad.w, 40, 8)

        fill(120, 70, 55)
        textAlign(CENTER)
        textStyle(BOLD)
        textSize(13)
        text("EXCLUSIVE OFFER", ad.x + ad.w / 2, ad.y + 25)

        fill(80)
        textAlign(RIGHT)
        textSize(16)
        text("×", ad.x + ad.w - 10, ad.y + 17)

        fill(35)
        textAlign(CENTER)
        textSize(24)
        text(ad.message, ad.x + ad.w / 2, ad.y + 72)

        fill(110)
        textSize(10)
        textStyle(NORMAL)
        text("Sign up for exclusive offers", ad.x + ad.w / 2, ad.y + 89)

        fill(35)
        rect(ad.x + 18, ad.y + ad.h - 35, ad.w - 36, 25, 4)

        fill(255)
        textSize(10)
        textStyle(BOLD)
        text("GET MY DISCOUNT", ad.x + ad.w / 2, ad.y + ad.h - 18)

    }


    // BANNER
    if (ad.type === 1) {

        fill(25, 35, 48)
        rect(ad.x, ad.y, ad.w, ad.h, 5)

        fill(190, 150, 95)
        rect(ad.x, ad.y, 110, ad.h, 5)

        fill(235, 205, 150)
        circle(ad.x + 55, ad.y + 28, 35)

        textAlign(LEFT)

        fill(180)
        textSize(9)
        textStyle(NORMAL)
        text("SPONSORED", ad.x + 125, ad.y + 17)

        fill(255)
        textSize(18)
        textStyle(BOLD)
        text("THE WEEKEND SALE", ad.x + 125, ad.y + 39)

        fill(255, 210, 135)
        textSize(17)
        text("UP TO 70% OFF", ad.x + 390, ad.y + 35)

        fill(255)
        rect(ad.x + ad.w - 125, ad.y + 12, 105, 30, 4)

        fill(35)
        textAlign(CENTER)
        textSize(11)
        text("SHOP NOW →", ad.x + ad.w - 72, ad.y + 31)

    }


    // FLOATING VIDEO
    if (ad.type === 2) {

        fill(0, 0, 0, 50)
        rect(ad.x + 5, ad.y + 6, ad.w, ad.h, 7)

        fill(255)
        rect(ad.x, ad.y, ad.w, ad.h, 7)

        fill(50, 65, 75)
        rect(ad.x + 5, ad.y + 5, ad.w - 10, ad.h - 38, 4)

        fill(130, 160, 145)
        ellipse(ad.x + ad.w * 0.35, ad.y + 40, 45, 45)

        fill(210, 175, 150)
        ellipse(ad.x + ad.w * 0.65, ad.y + 35, 32, 32)

        fill(255, 255, 255, 220)
        circle(ad.x + ad.w / 2, ad.y + 40, 29)

        fill(45)
        triangle(
            ad.x + ad.w / 2 - 4, ad.y + 33,
            ad.x + ad.w / 2 - 4, ad.y + 47,
            ad.x + ad.w / 2 + 8, ad.y + 40
        )

        fill(160)
        rect(ad.x + 10, ad.y + ad.h - 42, ad.w - 20, 3)

        fill(225, 80, 80)
        rect(ad.x + 10, ad.y + ad.h - 42, (ad.w - 20) * 0.35, 3)

        fill(40)
        textAlign(LEFT)
        textStyle(BOLD)
        textSize(11)
        text("Discover our new collection", ad.x + 10, ad.y + ad.h - 15)

        fill(140)
        textSize(9)
        textStyle(NORMAL)
        textAlign(RIGHT)
        text("Ad", ad.x + ad.w - 10, ad.y + ad.h - 15)

    }

    pop()

}


// -------------------------
// CAMERA + HAND LANDMARKS
// -------------------------

function drawCamera() {

    noStroke()

    fill(40, 45, 75)
    rect(30, 590, 250, 90, 12)

    // Mirrored camera preview
    push()

    translate(190, 598)
    scale(-1, 1)

    image(video, 0, 0, 150, 75)

    pop()

    // Draw tracked hand points
    for (let hand of hands) {

        for (let point of hand.keypoints) {

            let x = map(point.x, 0, 320, 150, 0) + 40
            let y = map(point.y, 0, 240, 0, 75) + 598

            fill(120, 255, 160)
            noStroke()
            circle(x, y, 4)

        }

    }

    fill(255)
    textAlign(LEFT)
    textSize(11)
    text("LIVE CAMERA", 195, 618)

    fill(160, 170, 200)
    textSize(10)
    text(hands.length + " HAND(S)", 195, 640)

}


// -------------------------
// GESTURE DEBUG PANEL
// -------------------------

function drawGestureStatus() {

    noStroke()

    fill(40, 45, 75)
    rect(295, 590, 575, 90, 12)

    fill(255)
    textSize(14)
    textStyle(BOLD)
    textAlign(LEFT)
    text("GESTURE DEBUG", 315, 615)

    fill(160, 250, 190)
    textSize(15)
    text(gestureStatus, 315, 645)

    fill(180)
    textSize(11)
    text("1 SQUEEZE   |   2 STRETCH   |   3 SHAKE   |   R RESET", 315, 665)

    textStyle(NORMAL)

}


// -------------------------
// REMOVE AD
// -------------------------

function removeAd(type) {

    for (let i = ads.length - 1; i >= 0; i--) {

        if (ads[i].type === type && !ads[i].removing) {

            ads[i].removing = true
            ads[i].progress = 0

            break

        }

    }

}


// -------------------------
// KEYBOARD BACKUP
// -------------------------

function keyPressed() {

    if (key === '1') {
        removeAd(0)
    }

    if (key === '2') {
        removeAd(1)
    }

    if (key === '3') {
        removeAd(2)
    }

    if (key === 'r' || key === 'R') {
        restartGame()
    }

}


// -------------------------
// RESTART
// -------------------------

function restartGame() {

    ads = []
    adsDestroyed = 0

    addAd(0)
    addAd(1)
    addAd(2)

    pinchReady = true
    stretchStart = null

    previousHandX = null
    lastDirection = 0
    shakeCount = 0
    lastShakeTime = 0

    lastGestureTime = millis()

    gestureStatus = "GAME RESTARTED"

    nextAdTime = millis() + adInterval

}
