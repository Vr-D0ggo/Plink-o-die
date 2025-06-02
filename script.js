document.addEventListener('DOMContentLoaded', () => {
    // --- Global Elements ---
    const body = document.body;
    const gameTitle = document.querySelector('h1'); // Assuming your H1 is the main game title
    const gameContainer = document.querySelector('.game-container'); // The div holding dice and info
    const rollButton = document.getElementById('rollButton');
    const diceArea = document.getElementById('dice-area');
    // const infoSection = document.querySelector('.info-section'); // Covered by gameContainer hide
    const sumToHoleTableBody = document.querySelector('#sumToHoleTable tbody');
    const rollResultDisplay = document.getElementById('rollResult');

    const plinkoSection = document.querySelector('.plinko-section');
    const plinkoCanvas = document.getElementById('plinkoCanvas');
    const plinkoCtx = plinkoCanvas.getContext('2d');
    const plinkoOutcomeDisplay = document.getElementById('plinkoOutcome'); // This is now for the full-screen message
    const playAgainButton = document.getElementById('playAgainButton');

    // --- Game Constants & Variables ---
    const DICE_SIZE = 100;
    const DOT_RADIUS = 8;
    const NUM_TOP_HOLES = 5;
    let PEG_RADIUS = 7;
    let BALL_RADIUS = 9;

    let GRAVITY = 0.09; // SLOWER BALL FALL
    let ROLLING_FRICTION_X = 0.995; // For slowing horizontal movement when not on peg
    let PEG_BOUNCE_ELASTICITY_Y = 0.2; // How much vertical speed is retained/reversed on initial hit
    let PEG_GUIDE_FACTOR_X = 0.5; // How strongly pegs guide horizontally on initial hit
    let ON_PEG_ROLL_SPEED = 0.8; // Speed multiplier for rolling around a peg
    let ON_PEG_GRAVITY_FACTOR = 0.3; // Reduced gravity when "on" a peg

    const TOP_AREA_FACTOR = 0.12;
    const PEG_ROWS_AREA_FACTOR = 0.55;
    const SLOT_AREA_HEIGHT_FACTOR = 0.15;

    let die1Value = 1, die2Value = 1;
    let die1Canvas, die2Canvas, die1Ctx, die2Ctx;

    let plinkoBall;
    let pegs = [];
    let highlightedPegIndex = -1;
    let prizeSlots = [];
    let animationFrameId;
    let gamePhase = 'dice'; // 'dice', 'plinko', 'gameOverTransition', 'gameOverScreen'
    let finalPrizeLabel = ""; // To store the prize for the game over screen

    // Vibrant Colors
    const COLORS = {
        BACKGROUND: '#1A237E', // Deep Indigo
        PEG: '#FFD700',       // Gold
        PEG_HIGHLIGHT: '#00E676', // Bright Green
        PEG_DIVIDER: '#BDBDBD', // Grey for divider pegs
        BALL: '#FFEB3B',      // Vibrant Yellow
        SLOT_PRIMARY: '#E91E63',  // Pink
        SLOT_SECONDARY: '#03A9F4',// Light Blue
        TEXT_LIGHT: '#FFFFFF',
        TEXT_DARK: '#212121',
        OVERLAY: 'rgba(10, 20, 80, 0.92)', // Darker, slightly blue overlay
    };

    const sumToHoleMap = {
        2: 1, 3: 1, 4: 2, 5: 2, 6: 3, 7: 3, 8: 3, 9: 4, 10: 4, 11: 5, 12: 5
    };

    function init() {
        setupDiceCanvases();
        populateSumToHoleTable();
        drawDie(die1Ctx, 1);
        drawDie(die2Ctx, 1);

        rollButton.textContent = "$3 to Play";
        rollButton.addEventListener('click', handleRollDice);
        playAgainButton.addEventListener('click', resetGame);
        plinkoOutcomeDisplay.style.display = 'none'; // Ensure it's hidden initially
    }

    function setupDiceCanvases() {
        diceArea.innerHTML = '';
        die1Canvas = document.createElement('canvas');
        die2Canvas = document.createElement('canvas');
        [die1Canvas, die2Canvas].forEach(canvas => {
            canvas.width = DICE_SIZE;
            canvas.height = DICE_SIZE;
            canvas.classList.add('die-canvas');
            diceArea.appendChild(canvas);
        });
        die1Ctx = die1Canvas.getContext('2d');
        die2Ctx = die2Canvas.getContext('2d');
    }

    function drawDie(ctx, value) {
        ctx.clearRect(0, 0, DICE_SIZE, DICE_SIZE);
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, DICE_SIZE, DICE_SIZE);
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, DICE_SIZE - 2, DICE_SIZE - 2);
        ctx.fillStyle = 'black';
        const s = DICE_SIZE;
        const positions = {1: [[s/2, s/2]],2: [[s/4, s/4], [s*3/4, s*3/4]],3: [[s/4, s/4], [s/2, s/2], [s*3/4, s*3/4]],4: [[s/4, s/4], [s*3/4, s/4], [s/4, s*3/4], [s*3/4, s*3/4]],5: [[s/4, s/4], [s*3/4, s/4], [s/2, s/2], [s/4, s*3/4], [s*3/4, s*3/4]],6: [[s/4, s/4], [s/2, s/4], [s*3/4, s/4], [s/4, s*3/4], [s/2, s*3/4], [s*3/4, s*3/4]]};
        if (positions[value]) { positions[value].forEach(pos => { ctx.beginPath(); ctx.arc(pos[0], pos[1], DOT_RADIUS, 0, Math.PI * 2); ctx.fill(); }); }
    }

    function animateDiceRoll() {
        rollButton.disabled = true;
        rollResultDisplay.textContent = "Rolling...";
        let flashes = 0; const maxFlashes = 15; const flashInterval = 80;
        const intervalId = setInterval(() => {
            die1Value = Math.floor(Math.random() * 6) + 1; die2Value = Math.floor(Math.random() * 6) + 1;
            drawDie(die1Ctx, die1Value); drawDie(die2Ctx, die2Value);
            flashes++;
            if (flashes >= maxFlashes) { clearInterval(intervalId); finalizeRoll(); }
        }, flashInterval);
    }

    function finalizeRoll() {
        die1Value = Math.floor(Math.random() * 6) + 1; // Ensure these are set if not by animation
        die2Value = Math.floor(Math.random() * 6) + 1;
        drawDie(die1Ctx, die1Value);
        drawDie(die2Ctx, die2Value);
        const sum = die1Value + die2Value;
        const startingHole = sumToHoleMap[sum];
        rollResultDisplay.textContent = `Rolled: ${die1Value} + ${die2Value} = ${sum}. Ball enters Hole ${startingHole}.`;

        setTimeout(() => {
            if(gameTitle) gameTitle.style.display = 'none';
            if(gameContainer) gameContainer.style.display = 'none';

            body.classList.add('plinko-active');
            plinkoSection.classList.add('full-screen');
            plinkoSection.style.display = 'flex'; // Or 'block', canvas will fill

            plinkoCanvas.width = window.innerWidth;
            plinkoCanvas.height = window.innerHeight;

            PEG_RADIUS = Math.max(6, Math.min(12, plinkoCanvas.width * 0.013));
            BALL_RADIUS = Math.max(7, Math.min(14, plinkoCanvas.width * 0.016));
            GRAVITY = plinkoCanvas.height * 0.00015; // Adjusted for feel

            setupPlinkoBoard(startingHole);
            drawPlinkoBoard(); // Draw static board elements once
            startPlinko(startingHole);
        }, 1500);
    }

    function handleRollDice() {
        if (gamePhase !== 'dice') return;
        animateDiceRoll();
    }

    function populateSumToHoleTable() {
        sumToHoleTableBody.innerHTML = '';
        for (let sum = 2; sum <= 12; sum++) { const row = sumToHoleTableBody.insertRow(); const cellSum = row.insertCell(); const cellHole = row.insertCell(); cellSum.textContent = sum; cellHole.textContent = sumToHoleMap[sum] || '-';}
    }

    function setupPlinkoBoard(startingHoleForHighlight = 0) {
        pegs = [];
        prizeSlots = [];
        highlightedPegIndex = -1;
        const boardWidth = plinkoCanvas.width;
        const boardHeight = plinkoCanvas.height;

        const topAreaHeight = boardHeight * TOP_AREA_FACTOR;
        const pegRowsContainerHeight = boardHeight * PEG_ROWS_AREA_FACTOR;
        const numMainPegRows = 3;
        const uniformPegRowSpacing = pegRowsContainerHeight / (numMainPegRows); // Space between rows

        // Y positions for main peg rows
        const pegRow1Y = topAreaHeight + uniformPegRowSpacing * 0.5; // Start first row
        const pegRow2Y = pegRow1Y + uniformPegRowSpacing;
        const pegRow3Y = pegRow2Y + uniformPegRowSpacing;

        const topHoleSpacing = boardWidth / (NUM_TOP_HOLES + 1);
        for (let i = 0; i < NUM_TOP_HOLES; i++) {
            pegs.push({ x: topHoleSpacing * (i + 1), y: pegRow1Y, radius: PEG_RADIUS, id: `r1p${i}` });
            if (startingHoleForHighlight > 0 && (i + 1) === startingHoleForHighlight) {
                highlightedPegIndex = pegs.length - 1;
            }
        }

        const numPegsRow2 = 10;
        const pegRow2EffectiveWidth = boardWidth * 0.90;
        const pegRow2StartX = (boardWidth - pegRow2EffectiveWidth) / 2;
        const pegSpacingRow2 = numPegsRow2 > 1 ? pegRow2EffectiveWidth / (numPegsRow2 -1) : 0;
        for (let i = 0; i < numPegsRow2; i++) {
            pegs.push({ x: pegRow2StartX + i * pegSpacingRow2, y: pegRow2Y, radius: PEG_RADIUS, id: `r2p${i}` });
        }

        const numPegsRow3 = 11;
        const pegRow3EffectiveWidth = boardWidth * 0.95;
        const pegRow3StartX = (boardWidth - pegRow3EffectiveWidth) / 2;
        const pegSpacingRow3 = numPegsRow3 > 1 ? pegRow3EffectiveWidth / (numPegsRow3 - 1) : 0;
        for (let i = 0; i < numPegsRow3; i++) {
            pegs.push({ x: pegRow3StartX + i * pegSpacingRow3, y: pegRow3Y, radius: PEG_RADIUS, id: `r3p${i}` });
        }

        const prizeValues = [6, 4, 3, 2, 0, 1, 0, 2, 3, 4, 6];
        const numPrizeSlots = prizeValues.length;
        const slotWidth = boardWidth / numPrizeSlots;
        const slotHeight = boardHeight * SLOT_AREA_HEIGHT_FACTOR;
        const slotY = boardHeight - slotHeight;

        for (let i = 0; i < numPrizeSlots; i++) {
            prizeSlots.push({
                x: i * slotWidth, y: slotY, width: slotWidth, height: slotHeight,
                value: prizeValues[i], label: (prizeValues[i] >= 0 ? "+" : "") + prizeValues[i]
            });
        }

        const numPegsRow4 = numPrizeSlots -1; // Pegs on the dividing lines BETWEEN slots
        const pegRow4Y = slotY - PEG_RADIUS * 0.3; // Position them just above/touching the slot dividers
        if (numPegsRow4 > 0) {
            for (let i = 0; i < numPegsRow4; i++) {
                pegs.push({
                    x: (i + 1) * slotWidth,
                    y: pegRow4Y,
                    radius: PEG_RADIUS * 0.85, // Slightly smaller
                    isDivider: true,
                    id: `r4p${i}`
                });
            }
        }
    }

    function startPlinko(startingHoleIndex) {
        gamePhase = 'plinko';
        plinkoOutcomeDisplay.style.display = 'none'; // Keep this hidden until game over
        playAgainButton.style.display = 'none';

        const boardWidth = plinkoCanvas.width;
        const topAreaHeight = plinkoCanvas.height * TOP_AREA_FACTOR;
        const topHoleSpacing = boardWidth / (NUM_TOP_HOLES + 1);
        const startX = topHoleSpacing * startingHoleIndex;
        const startY = topAreaHeight * 0.25; // Slightly lower start

        plinkoBall = {
            x: startX, y: startY, radius: BALL_RADIUS, color: COLORS.BALL,
            vx: (Math.random() - 0.5) * 0.1, vy: 0,
            onPeg: null, // The peg object if currently "rolling" on one
            timeOnPeg: 0, // How long has it been "on" this peg
        };
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = requestAnimationFrame(gameLoopPlinko);
    }

    function drawPlinkoBoard() {
        plinkoCtx.fillStyle = COLORS.BACKGROUND;
        plinkoCtx.fillRect(0, 0, plinkoCanvas.width, plinkoCanvas.height);
        const boardWidth = plinkoCanvas.width;
        const boardHeight = plinkoCanvas.height;

        const topAreaHeight = boardHeight * TOP_AREA_FACTOR;
        const topHoleLabelY = topAreaHeight * 0.4;
        const topHoleSpacing = boardWidth / (NUM_TOP_HOLES + 1);
        plinkoCtx.fillStyle = COLORS.TEXT_LIGHT;
        plinkoCtx.font = `bold ${Math.min(20, boardHeight * 0.022)}px Arial`;
        plinkoCtx.textAlign = 'center';
        plinkoCtx.textBaseline = 'middle';
        for (let i = 0; i < NUM_TOP_HOLES; i++) {
            plinkoCtx.fillText(`Hole ${i + 1}`, topHoleSpacing * (i + 1), topHoleLabelY);
        }

        pegs.forEach((peg, index) => {
            plinkoCtx.fillStyle = peg.isDivider ? COLORS.PEG_DIVIDER : (index === highlightedPegIndex ? COLORS.PEG_HIGHLIGHT : COLORS.PEG);
            plinkoCtx.beginPath();
            plinkoCtx.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2);
            plinkoCtx.fill();
        });

        prizeSlots.forEach((slot, index) => {
            plinkoCtx.fillStyle = (index % 2 === 0) ? COLORS.SLOT_PRIMARY : COLORS.SLOT_SECONDARY;
            plinkoCtx.fillRect(slot.x, slot.y, slot.width, slot.height);
            plinkoCtx.fillStyle = COLORS.TEXT_LIGHT;
            plinkoCtx.font = `bold ${Math.min(26, slot.height * 0.33)}px Arial`;
            plinkoCtx.fillText(slot.label, slot.x + slot.width / 2, slot.y + slot.height / 2);
            if (index > 0) {
                plinkoCtx.strokeStyle = COLORS.BACKGROUND;
                plinkoCtx.lineWidth = 3;
                plinkoCtx.beginPath();
                plinkoCtx.moveTo(slot.x, slot.y);
                plinkoCtx.lineTo(slot.x, slot.y + slot.height);
                plinkoCtx.stroke();
            }
        });
        if (prizeSlots.length > 0) {
             plinkoCtx.strokeStyle = COLORS.BACKGROUND; plinkoCtx.lineWidth = 3;
             plinkoCtx.strokeRect(0, prizeSlots[0].y, boardWidth, prizeSlots[0].height);
        }
        plinkoCtx.textBaseline = 'alphabetic'; // Reset
    }

    function drawBall() {
        if (!plinkoBall) return;
        plinkoCtx.beginPath();
        plinkoCtx.arc(plinkoBall.x, plinkoBall.y, plinkoBall.radius, 0, Math.PI * 2);
        plinkoCtx.fillStyle = plinkoBall.color;
        plinkoCtx.fill();
        plinkoCtx.strokeStyle = COLORS.TEXT_DARK;
        plinkoCtx.lineWidth = 2;
        plinkoCtx.stroke();
    }

    function updateBall() {
        if (!plinkoBall || gamePhase !== 'plinko') return;

        if (plinkoBall.onPeg) {
            const peg = plinkoBall.onPeg;
            plinkoBall.timeOnPeg++;

            // Calculate angle from peg center to ball center
            let angleToBall = Math.atan2(plinkoBall.y - peg.y, plinkoBall.x - peg.x);

            // Determine which way to roll (simplistic: based on current vx or random if stalled)
            let rollDirection = Math.sign(plinkoBall.vx) || (Math.random() < 0.5 ? -1 : 1);
            if (Math.abs(plinkoBall.vx) < 0.1 && plinkoBall.timeOnPeg < 5) { // If stalled early, give a nudge
                rollDirection = (plinkoBall.x > peg.x) ? 1 : -1; // Nudge away from center line initially
            }


            // Target angle to move towards (e.g., 90 degrees from current angle in roll direction)
            let targetAngle = angleToBall + rollDirection * (Math.PI / 180) * ON_PEG_ROLL_SPEED * 5; // Roll a few degrees

            // New position on the circumference
            const combinedRadii = plinkoBall.radius + peg.radius;
            plinkoBall.x = peg.x + Math.cos(targetAngle) * combinedRadii;
            plinkoBall.y = peg.y + Math.sin(targetAngle) * combinedRadii;

            // Apply a bit of gravity effect to eventually pull it off
            plinkoBall.y += GRAVITY * ON_PEG_GRAVITY_FACTOR;

            // Check if it should fall off
            // Condition: if ball's bottom is below peg's horizontal midline + a bit OR timer expires
            if (plinkoBall.y > peg.y + peg.radius * 0.3 || plinkoBall.timeOnPeg > 50) { // 50 frames max on peg
                plinkoBall.onPeg = null;
                plinkoBall.timeOnPeg = 0;
                // Give a slight push based on last rolling direction
                plinkoBall.vx = rollDirection * ON_PEG_ROLL_SPEED * 0.5;
                plinkoBall.vy = GRAVITY * 2; // Ensure it starts falling
            }

        } else { // Not on a peg, normal falling and collision
            plinkoBall.vy += GRAVITY;
            plinkoBall.y += plinkoBall.vy;
            plinkoBall.x += plinkoBall.vx;
            plinkoBall.vx *= ROLLING_FRICTION_X;

            if (plinkoBall.x - plinkoBall.radius < 0) {
                plinkoBall.x = plinkoBall.radius; plinkoBall.vx *= -0.5;
            } else if (plinkoBall.x + plinkoBall.radius > plinkoCanvas.width) {
                plinkoBall.x = plinkoCanvas.width - plinkoBall.radius; plinkoBall.vx *= -0.5;
            }

            for (let peg of pegs) {
                const dx = plinkoBall.x - peg.x;
                const dy = plinkoBall.y - peg.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const combinedRadii = plinkoBall.radius + peg.radius;

                if (distance < combinedRadii) {
                    plinkoBall.onPeg = peg; // Attach to peg
                    plinkoBall.timeOnPeg = 0;

                    // Position ball exactly on contact surface
                    const collisionAngle = Math.atan2(dy, dx);
                    plinkoBall.x = peg.x + Math.cos(collisionAngle) * combinedRadii;
                    plinkoBall.y = peg.y + Math.sin(collisionAngle) * combinedRadii;

                    // Simplified initial velocity adjustment
                    plinkoBall.vy *= -PEG_BOUNCE_ELASTICITY_Y; // Lose some vertical speed or bounce up slightly
                    let horizontalPush = PEG_GUIDE_FACTOR_X;
                    if (plinkoBall.x < peg.x) horizontalPush *= -1; // Push away from center
                    else if (Math.abs(dx) < peg.radius * 0.2) horizontalPush = (Math.random() - 0.5) * PEG_GUIDE_FACTOR_X * 2; // Central hit, more random
                    plinkoBall.vx = horizontalPush;

                    break; // Handle one peg collision at a time if it attaches
                }
            }
        }

        // Check for landing in prize slots
        if (!plinkoBall.onPeg && prizeSlots.length > 0 && plinkoBall.y + plinkoBall.radius >= prizeSlots[0].y && plinkoBall.y < plinkoCanvas.height) {
            for (let i = 0; i < prizeSlots.length; i++) {
                const slot = prizeSlots[i];
                if (plinkoBall.x >= slot.x && plinkoBall.x <= slot.x + slot.width) {
                    endPlinkoRun(slot.value, slot.label);
                    return;
                }
            }
        }
        if (!plinkoBall.onPeg && plinkoBall.y - plinkoBall.radius > plinkoCanvas.height + plinkoBall.radius * 2) {
            endPlinkoRun(0, "+0"); // Fell off bottom
        }
    }

    function endPlinkoRun(prizeValue, prizeLabel) {
        if (gamePhase === 'plinko') {
            gamePhase = 'gameOverTransition';
            finalPrizeLabel = prizeLabel;
            if (plinkoBall) { // Ensure ball exists
                plinkoBall.vx = 0; // Stop ball movement
                plinkoBall.vy = 0;
            }
            // The game loop will continue to draw the ball in its final spot during transition

            setTimeout(() => {
                gamePhase = 'gameOverScreen';
                plinkoOutcomeDisplay.style.display = 'block'; // Show the HTML element for text
                plinkoOutcomeDisplay.innerHTML = `You won ${finalPrizeLabel}!<br>Thanks for playing!`; // Set text here
                playAgainButton.style.display = 'block';

                // We can stop the canvas animation loop if the outcome is now handled by HTML elements,
                // or keep it running if we want to draw over the canvas.
                // For this setup, let's draw the overlay once and then let HTML take over.
                drawGameOverOverlay(); // Draw it once
                if (animationFrameId) cancelAnimationFrame(animationFrameId);
                animationFrameId = null;

            }, 1500); // Delay before showing final message
        }
    }

    function drawGameOverOverlay() {
        // This function is called once when transitioning to gameOverScreen
        // if we want to draw the overlay and text on canvas.
        // However, the current endPlinkoRun sets text in an HTML element (plinkoOutcomeDisplay)
        // So, we might just need the dark overlay drawn on canvas.

        plinkoCtx.fillStyle = COLORS.OVERLAY;
        plinkoCtx.fillRect(0, 0, plinkoCanvas.width, plinkoCanvas.height);

        // If text were on canvas:
        // plinkoCtx.fillStyle = COLORS.TEXT_LIGHT;
        // plinkoCtx.textAlign = 'center';
        // plinkoCtx.textBaseline = 'middle';
        // let mainMessageFontSize = Math.min(60, plinkoCanvas.width * 0.07);
        // plinkoCtx.font = `bold ${mainMessageFontSize}px Arial`;
        // plinkoCtx.fillText(`You won ${finalPrizeLabel}!`, plinkoCanvas.width / 2, plinkoCanvas.height / 2 - 30);
        // let subMessageFontSize = Math.min(30, plinkoCanvas.width * 0.035);
        // plinkoCtx.font = `${subMessageFontSize}px Arial`;
        // plinkoCtx.fillText("Thanks for playing!", plinkoCanvas.width / 2, plinkoCanvas.height / 2 + mainMessageFontSize * 0.6);
    }


    function gameLoopPlinko() {
        if (gamePhase === 'plinko' || gamePhase === 'gameOverTransition') {
            if (gamePhase === 'plinko') { // Only update ball physics if in 'plinko' phase
                updateBall();
            }
            drawPlinkoBoard();
            drawBall();
            animationFrameId = requestAnimationFrame(gameLoopPlinko);
        } else if (gamePhase === 'gameOverScreen') {
            // The overlay and text are now handled by drawGameOverOverlay() being called once
            // and HTML elements taking over for the text and button.
            // So, this part of the loop might not be strictly necessary if we stop the animation.
            // If kept, ensure it doesn't conflict with HTML elements.
        }
    }

    function resetGame() {
        gamePhase = 'dice';
        if(gameTitle) gameTitle.style.display = 'block';
        if(gameContainer) gameContainer.style.display = 'block';

        body.classList.remove('plinko-active');
        plinkoSection.classList.remove('full-screen');
        plinkoSection.style.display = 'none';

        playAgainButton.style.display = 'none';
        plinkoOutcomeDisplay.style.display = 'none';
        plinkoOutcomeDisplay.innerHTML = ""; // Clear text
        rollResultDisplay.textContent = "";
        rollButton.disabled = false;

        highlightedPegIndex = -1;

        drawDie(die1Ctx, 1);
        drawDie(die2Ctx, 1);

        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        plinkoBall = null;
    }

    window.addEventListener('resize', () => {
        if (plinkoSection.classList.contains('full-screen') && (gamePhase === 'plinko' || gamePhase === 'gameOverTransition' || gamePhase === 'gameOverScreen')) {
            plinkoCanvas.width = window.innerWidth;
            plinkoCanvas.height = window.innerHeight;
            PEG_RADIUS = Math.max(6, Math.min(12, plinkoCanvas.width * 0.013));
            BALL_RADIUS = Math.max(7, Math.min(14, plinkoCanvas.width * 0.016));
            GRAVITY = plinkoCanvas.height * 0.00015;

            let currentStartingHole = 0;
            if (plinkoBall) { // Try to determine the original starting hole if game is in progress
                 // This logic might be tricky if dice values are not easily accessible here
                 // For simplicity, we might just use a default or not re-highlight perfectly on resize
                 // Or, store initialDiceSum globally if needed for this.
            }
            setupPlinkoBoard(currentStartingHole); // Re-highlight might need original dice sum

            if (gamePhase !== 'gameOverScreen' || (gamePhase === 'gameOverScreen' && !animationFrameId)) {
                // If gameOverScreen and animation is stopped, redraw the overlay if needed.
                // Otherwise, the running loop (if any) or next drawPlinkoBoard will handle it.
                drawPlinkoBoard();
                 if (gamePhase === 'gameOverScreen') {
                    drawGameOverOverlay(); // Redraw overlay if text is on canvas.
                 }
            }
        }
    });

    init();
});