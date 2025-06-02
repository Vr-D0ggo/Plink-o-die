document.addEventListener('DOMContentLoaded', () => {
    // --- Global Variables & Constants ---
    const rollButton = document.getElementById('rollButton');
    const diceArea = document.getElementById('dice-area');
    const sumToHoleTableBody = document.querySelector('#sumToHoleTable tbody');
    const rollResultDisplay = document.getElementById('rollResult');

    const plinkoSection = document.querySelector('.plinko-section');
    const plinkoCanvas = document.getElementById('plinkoCanvas');
    const plinkoCtx = plinkoCanvas.getContext('2d');
    const plinkoOutcomeDisplay = document.getElementById('plinkoOutcome');
    const playAgainButton = document.getElementById('playAgainButton');

    const DICE_SIZE = 100;
    const DOT_RADIUS = 8;
    const NUM_TOP_HOLES = 5;
    let PEG_RADIUS = 7; // Can be adjusted, maybe dynamically later
    let BALL_RADIUS = 9; // Can be adjusted

    const GRAVITY = 0.18; // Slightly increased gravity for full screen
    const NEW_BOUNCE_FACTOR_X = 1.0; // Reduced horizontal kick for "rolling"
    const WALL_BOUNCE_DAMPING = -0.4;

    // "Rolling" physics parameters for pegs
    const PEG_COLLISION_VY_FACTOR = 0.5; // How much vertical speed is reduced
    const PEG_COLLISION_MIN_VY = 0.8;   // Minimum downward speed after hitting a peg

    // Dynamic layout factors (relative to canvas dimensions)
    const TOP_AREA_FACTOR = 0.1; // % of height for top labels/entry
    const PEG_ROWS_AREA_FACTOR = 0.5; // % of height for all peg rows
    const SLOT_AREA_HEIGHT_FACTOR = 0.18; // % of height for prize slots

    let die1Value = 1;
    let die2Value = 1;
    let die1Canvas, die2Canvas;
    let die1Ctx, die2Ctx;

    let plinkoBall;
    let pegs = [];
    let prizeSlots = [];
    let animationFrameId;
    let gamePhase = 'dice';

    const sumToHoleMap = {
        2: 1, 3: 1, 4: 2, 5: 2, 6: 3, 7: 3, 8: 3, 9: 4, 10: 4, 11: 5, 12: 5
    };

    function init() {
        setupDiceCanvases();
        populateSumToHoleTable();
        drawDie(die1Ctx, 1);
        drawDie(die2Ctx, 1);

        rollButton.textContent = "$3 to Play"; // Update button text
        rollButton.addEventListener('click', handleRollDice);
        playAgainButton.addEventListener('click', resetGame);

        // Plinko canvas size will be set when Plinko starts
        // Initial draw of plinko board is deferred until it's sized and shown
    }

    function setupDiceCanvases() { /* ... (same as before) ... */
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
    function drawDie(ctx, value) { /* ... (same as before) ... */
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
    function animateDiceRoll() { /* ... (same as before) ... */
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
        die1Value = Math.floor(Math.random() * 6) + 1;
        die2Value = Math.floor(Math.random() * 6) + 1;
        drawDie(die1Ctx, die1Value);
        drawDie(die2Ctx, die2Value);
        const sum = die1Value + die2Value;
        const startingHole = sumToHoleMap[sum];
        rollResultDisplay.textContent = `Rolled: ${die1Value} + ${die2Value} = ${sum}. Ball starts in Hole ${startingHole}.`;

        setTimeout(() => {
            // --- Transition to Full-Screen Plinko ---
            document.body.classList.add('plinko-active');
            plinkoSection.classList.add('full-screen');
            plinkoSection.style.display = 'flex'; // Use flex for full-screen centering if needed

            plinkoCanvas.width = window.innerWidth;
            plinkoCanvas.height = window.innerHeight;

            // Adjust radii based on screen size (optional, but good for responsiveness)
            PEG_RADIUS = Math.max(5, Math.min(10, plinkoCanvas.width * 0.012));
            BALL_RADIUS = Math.max(6, Math.min(12, plinkoCanvas.width * 0.015));


            setupPlinkoBoard(); // Setup board with new dimensions
            drawPlinkoBoard();  // Draw the board (pegs, slots)

            startPlinko(startingHole);
        }, 1500);
    }

    function handleRollDice() { /* ... (same as before) ... */
        if (gamePhase !== 'dice') return; animateDiceRoll();
    }
    function populateSumToHoleTable() { /* ... (same as before) ... */
        sumToHoleTableBody.innerHTML = '';
        for (let sum = 2; sum <= 12; sum++) { const row = sumToHoleTableBody.insertRow(); const cellSum = row.insertCell(); const cellHole = row.insertCell(); cellSum.textContent = sum; cellHole.textContent = sumToHoleMap[sum] || '-';}
    }

    function setupPlinkoBoard() {
        pegs = [];
        prizeSlots = [];
        const boardWidth = plinkoCanvas.width;
        const boardHeight = plinkoCanvas.height;

        const topAreaHeight = boardHeight * TOP_AREA_FACTOR;
        const pegRowsTotalHeight = boardHeight * PEG_ROWS_AREA_FACTOR;
        const individualPegRowSpacing = pegRowsTotalHeight / 3; // For 3 main rows of pegs

        // Y positions for peg rows
        const pegRow1Y = topAreaHeight + individualPegRowSpacing * 0.5;
        const pegRow2Y = pegRow1Y + individualPegRowSpacing;
        const pegRow3Y = pegRow2Y + individualPegRowSpacing;

        // Peg Row 1: 5 pegs
        const topHoleSpacing = boardWidth / (NUM_TOP_HOLES + 1);
        for (let i = 0; i < NUM_TOP_HOLES; i++) {
            pegs.push({ x: topHoleSpacing * (i + 1), y: pegRow1Y, radius: PEG_RADIUS });
        }

        // Peg Row 2: 10 pegs
        const numPegsRow2 = 10;
        const pegRow2EffectiveWidth = boardWidth * 0.88;
        const pegRow2StartX = (boardWidth - pegRow2EffectiveWidth) / 2;
        const pegSpacingRow2 = numPegsRow2 > 1 ? pegRow2EffectiveWidth / (numPegsRow2 - 1) : 0;
        for (let i = 0; i < numPegsRow2; i++) {
            pegs.push({ x: pegRow2StartX + i * pegSpacingRow2, y: pegRow2Y, radius: PEG_RADIUS });
        }

        // Peg Row 3: 11 pegs
        const numPegsRow3 = 11;
        const pegRow3EffectiveWidth = boardWidth * 0.92;
        const pegRow3StartX = (boardWidth - pegRow3EffectiveWidth) / 2;
        const pegSpacingRow3 = numPegsRow3 > 1 ? pegRow3EffectiveWidth / (numPegsRow3 - 1) : 0;
        for (let i = 0; i < numPegsRow3; i++) {
            pegs.push({ x: pegRow3StartX + i * pegSpacingRow3, y: pegRow3Y, radius: PEG_RADIUS });
        }

        // Prize Slots
        const prizeValues = [6, 4, 3, 2, 0, 1, 0, 2, 3, 4, 6]; // Updated prize values
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

        // Peg Row 4 (Divider Pegs for Slots):
        const numPegsRow4 = numPrizeSlots - 1; // Pegs on the dividing lines
        const pegRow4Y = slotY - PEG_RADIUS * 0.8; // Position them just above/touching the slot dividers
        if (numPegsRow4 > 0) {
            for (let i = 0; i < numPegsRow4; i++) {
                pegs.push({
                    x: (i + 1) * slotWidth, // Aligned with the slot dividing line
                    y: pegRow4Y,
                    radius: PEG_RADIUS * 1.1 // Make divider pegs slightly larger
                });
            }
        }
    }

    function startPlinko(startingHoleIndex) {
        gamePhase = 'plinko';
        plinkoOutcomeDisplay.textContent = "Ball dropping...";
        playAgainButton.style.display = 'none';

        const boardWidth = plinkoCanvas.width;
        const topAreaHeight = plinkoCanvas.height * TOP_AREA_FACTOR;

        const topHoleSpacing = boardWidth / (NUM_TOP_HOLES + 1);
        const startX = topHoleSpacing * startingHoleIndex;
        const startY = topAreaHeight * 0.3; // Start ball in the upper part of the top area

        plinkoBall = {
            x: startX, y: startY, radius: BALL_RADIUS, color: 'yellow',
            vx: (Math.random() - 0.5) * 0.2, vy: 0 // Minimal initial horizontal
        };
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        gameLoopPlinko();
    }

    function drawPlinkoBoard() {
        plinkoCtx.clearRect(0, 0, plinkoCanvas.width, plinkoCanvas.height);
        const boardWidth = plinkoCanvas.width;
        const boardHeight = plinkoCanvas.height;

        // Draw Top Hole Labels
        const topAreaHeight = boardHeight * TOP_AREA_FACTOR;
        const topHoleLabelY = topAreaHeight * 0.5;
        const topHoleSpacing = boardWidth / (NUM_TOP_HOLES + 1);
        plinkoCtx.fillStyle = '#ecf0f1'; // Light color for text on dark bg
        plinkoCtx.font = `bold ${Math.min(22, boardHeight * 0.025)}px Arial`;
        plinkoCtx.textAlign = 'center';
        plinkoCtx.textBaseline = 'middle';
        for (let i = 0; i < NUM_TOP_HOLES; i++) {
            plinkoCtx.fillText(`Hole ${i + 1}`, topHoleSpacing * (i + 1), topHoleLabelY);
        }

        // Draw Pegs
        plinkoCtx.fillStyle = '#95a5a6'; // Lighter grey for pegs
        pegs.forEach(peg => {
            plinkoCtx.beginPath();
            plinkoCtx.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2);
            plinkoCtx.fill();
        });

        // Draw Prize Slots
        prizeSlots.forEach((slot, index) => {
            plinkoCtx.fillStyle = (index % 2 === 0) ? '#34495e' : '#3b536b'; // Darker slot colors
            plinkoCtx.fillRect(slot.x, slot.y, slot.width, slot.height);
            plinkoCtx.fillStyle = '#ecf0f1';
            plinkoCtx.font = `bold ${Math.min(28, slot.height * 0.35)}px Arial`;
            plinkoCtx.fillText(slot.label, slot.x + slot.width / 2, slot.y + slot.height / 2);

            if (index > 0) {
                plinkoCtx.strokeStyle = '#7f8c8d'; // Line color
                plinkoCtx.lineWidth = 2;
                plinkoCtx.beginPath();
                plinkoCtx.moveTo(slot.x, slot.y);
                plinkoCtx.lineTo(slot.x, slot.y + slot.height);
                plinkoCtx.stroke();
            }
        });
        plinkoCtx.strokeStyle = '#7f8c8d';
        plinkoCtx.lineWidth = 2;
        if (prizeSlots.length > 0) {
             plinkoCtx.strokeRect(0, prizeSlots[0].y, boardWidth, prizeSlots[0].height);
        }
        plinkoCtx.textBaseline = 'alphabetic'; // Reset baseline
    }

    function drawBall() {
        if (!plinkoBall) return;
        plinkoCtx.beginPath();
        plinkoCtx.arc(plinkoBall.x, plinkoBall.y, plinkoBall.radius, 0, Math.PI * 2);
        plinkoCtx.fillStyle = plinkoBall.color;
        plinkoCtx.fill();
        plinkoCtx.strokeStyle = 'black';
        plinkoCtx.lineWidth = 1;
        plinkoCtx.stroke();
    }

    function updateBall() {
        if (!plinkoBall || gamePhase !== 'plinko') return;

        plinkoBall.vy += GRAVITY;
        plinkoBall.y += plinkoBall.vy;
        plinkoBall.x += plinkoBall.vx;

        if (plinkoBall.x - plinkoBall.radius < 0) {
            plinkoBall.x = plinkoBall.radius;
            plinkoBall.vx *= WALL_BOUNCE_DAMPING;
        } else if (plinkoBall.x + plinkoBall.radius > plinkoCanvas.width) {
            plinkoBall.x = plinkoCanvas.width - plinkoBall.radius;
            plinkoBall.vx *= WALL_BOUNCE_DAMPING;
        }

        pegs.forEach(peg => {
            const dx = plinkoBall.x - peg.x;
            const dy = plinkoBall.y - peg.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < plinkoBall.radius + peg.radius) {
                // "Rolling" collision:
                plinkoBall.vx = (Math.random() < 0.5 ? -1 : 1) * NEW_BOUNCE_FACTOR_X * (1 + Math.abs(plinkoBall.vx * 0.1)); // Slight variation in x-kick

                // Ensure downward movement, reduce vy for "rolling" effect
                plinkoBall.vy = Math.max(PEG_COLLISION_MIN_VY, Math.abs(plinkoBall.vy * PEG_COLLISION_VY_FACTOR));

                const angle = Math.atan2(dy, dx);
                const overlap = (plinkoBall.radius + peg.radius) - distance;

                // Nudge out of collision, emphasizing downward movement if hitting from above
                let nudgeX = Math.cos(angle) * (overlap + 0.1);
                let nudgeY = Math.sin(angle) * (overlap + 0.1);

                if (plinkoBall.y < peg.y + peg.radius && dy < 0) { // Hitting top half of peg
                    nudgeY = Math.abs(nudgeY); // Ensure nudge is downwards
                }

                plinkoBall.x += nudgeX;
                plinkoBall.y += nudgeY;

                 // Extra check to prevent getting stuck on top of a peg
                if (plinkoBall.y < peg.y && Math.abs(plinkoBall.x - peg.x) < peg.radius) {
                    plinkoBall.y = peg.y + plinkoBall.radius + 0.1; // Force below
                }
            }
        });

        if (prizeSlots.length > 0 && plinkoBall.y + plinkoBall.radius >= prizeSlots[0].y && plinkoBall.y < plinkoCanvas.height) {
            for (let i = 0; i < prizeSlots.length; i++) {
                const slot = prizeSlots[i];
                if (plinkoBall.x >= slot.x && plinkoBall.x <= slot.x + slot.width) {
                    endPlinkoRun(slot.value, slot.label);
                    return;
                }
            }
        }
        if (plinkoBall.y - plinkoBall.radius > plinkoCanvas.height) {
            endPlinkoRun(0, "+0"); // Fell off bottom
        }
    }

    function endPlinkoRun(prizeValue, prizeLabel) {
        gamePhase = 'gameOver';
        plinkoOutcomeDisplay.textContent = `Ball landed! You get: ${prizeLabel}`;
        playAgainButton.style.display = 'block';
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
    }

    function gameLoopPlinko() {
        if (gamePhase !== 'plinko') return;
        updateBall();
        drawPlinkoBoard();
        drawBall();
        animationFrameId = requestAnimationFrame(gameLoopPlinko);
    }

    function resetGame() {
        gamePhase = 'dice';
        rollResultDisplay.textContent = "";
        plinkoOutcomeDisplay.textContent = "";

        document.body.classList.remove('plinko-active');
        plinkoSection.classList.remove('full-screen');
        plinkoSection.style.display = 'none'; // Hide it again

        playAgainButton.style.display = 'none';
        rollButton.disabled = false;
        drawDie(die1Ctx, 1);
        drawDie(die2Ctx, 1);

        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        plinkoBall = null;
        // No need to explicitly resize canvas back, it's hidden and will be resized on next plinko start.
    }
    
    // Optional: Resize handler if you want Plinko board to adapt if window is resized *while* Plinko is active
    window.addEventListener('resize', () => {
        if (gamePhase === 'plinko' || gamePhase === 'gameOver') {
            if (plinkoSection.classList.contains('full-screen')) {
                plinkoCanvas.width = window.innerWidth;
                plinkoCanvas.height = window.innerHeight;
                // Re-adjust radii based on new screen size
                PEG_RADIUS = Math.max(5, Math.min(10, plinkoCanvas.width * 0.012));
                BALL_RADIUS = Math.max(6, Math.min(12, plinkoCanvas.width * 0.015));
                setupPlinkoBoard(); // Recalculate all positions
                // No need to call drawPlinkoBoard here, gameLoopPlinko will handle it
            }
        }
    });

    init();
});