// script.js
document.addEventListener('DOMContentLoaded', () => {
    // --- Global Elements ---
    const body = document.body;
    const gameTitle = document.querySelector('h1');
    const gameContainer = document.querySelector('.game-container');
    const rollButton = document.getElementById('rollButton');
    const diceArea = document.getElementById('dice-area');
    const sumToHoleTableBody = document.querySelector('#sumToHoleTable tbody');
    const rollResultDisplay = document.getElementById('rollResult');

    const plinkoSection = document.querySelector('.plinko-section');
    const plinkoCanvas = document.getElementById('plinkoCanvas');
    const plinkoCtx = plinkoCanvas.getContext('2d');
    const plinkoOutcomeDisplay = document.getElementById('plinkoOutcome');
    const playAgainButton = document.getElementById('playAgainButton');

    // --- Game Constants & Variables ---
    const DICE_SIZE = 100;
    const DOT_RADIUS = 8;
    const NUM_TOP_HOLES = 5;

    let BALL_RADIUS = 9;
    let TRIANGLE_BASE_WIDTH_UNIFIED; // All main triangles will use this base width
    let TRIANGLE_HEIGHT_UNIFIED;   // All main triangles will use this height

    // Remove or comment out these as they are no longer used for main rows:
    // let TRIANGLE_ROW2_SIZE_MULTIPLIER = 0.9;
    // let TRIANGLE_ROW3_SIZE_MULTIPLIER = 0.8;
    // let ROW2_HEIGHT_BOOST_FACTOR = 1.15;
    // let ROW3_HEIGHT_BOOST_FACTOR = 1.25;

    let GRAVITY = 0.06;
    let MAX_VX = 1.8;
    let MAX_VY = 2.5;
    let COLLISION_VX_DAMPING = 0.8;
    let COLLISION_VY_DAMPING = -0.25;

    const TOP_AREA_FACTOR = 0.1;
    const PEG_ROWS_AREA_FACTOR = 0.55;
    const SLOT_AREA_HEIGHT_FACTOR = 0.15;

    let die1Value = 1, die2Value = 1;
    let die1Canvas, die2Canvas, die1Ctx, die2Ctx;

    let plinkoBall;
    let triangles = [];
    let prizeSlots = [];
    let animationFrameId;
    let gamePhase = 'dice';
    let finalPrizeLabel = "";
    let ballInSlotTargetY = 0;

    const COLORS = {
        BACKGROUND: '#34495e',
        TRIANGLE: '#1abc9c',
        TRIANGLE_OUTLINE: '#16a085',
        TRIANGLE_DIVIDER: '#27ae60',
        TRIANGLE_DIVIDER_OUTLINE: '#229954',
        BALL: '#f39c12',
        BALL_OUTLINE: '#d35400',
        SLOT_PRIMARY: '#8e44ad',
        SLOT_SECONDARY: '#2980b9',
        TEXT_LIGHT: '#ecf0f1',
        TEXT_DARK: '#2c3e50',
        OVERLAY_FILL: 'rgba(20, 30, 40, 0.85)',
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
        plinkoOutcomeDisplay.style.display = 'none';
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
        ctx.fillStyle = '#f8f9f9';
        ctx.beginPath();
        const radius = 10;
        ctx.moveTo(radius, 0);
        ctx.lineTo(DICE_SIZE - radius, 0);
        ctx.quadraticCurveTo(DICE_SIZE, 0, DICE_SIZE, radius);
        ctx.lineTo(DICE_SIZE, DICE_SIZE - radius);
        ctx.quadraticCurveTo(DICE_SIZE, DICE_SIZE, DICE_SIZE - radius, DICE_SIZE);
        ctx.lineTo(radius, DICE_SIZE);
        ctx.quadraticCurveTo(0, DICE_SIZE, 0, DICE_SIZE - radius);
        ctx.lineTo(0, radius);
        ctx.quadraticCurveTo(0, 0, radius, 0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#bdc3c7';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#34495e';
        const s = DICE_SIZE;
        const positions = { 1: [[s / 2, s / 2]], 2: [[s / 4, s / 4], [s * 3 / 4, s * 3 / 4]], 3: [[s / 4, s / 4], [s / 2, s / 2], [s * 3 / 4, s * 3 / 4]], 4: [[s / 4, s / 4], [s * 3 / 4, s / 4], [s / 4, s * 3 / 4], [s * 3 / 4, s * 3 / 4]], 5: [[s / 4, s / 4], [s * 3 / 4, s / 4], [s / 2, s / 2], [s / 4, s * 3 / 4], [s * 3 / 4, s * 3 / 4]], 6: [[s / 4, s / 4], [s / 2, s / 4], [s * 3 / 4, s / 4], [s / 4, s * 3 / 4], [s / 2, s * 3 / 4], [s * 3 / 4, s * 3 / 4]] };
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
        die1Value = Math.floor(Math.random() * 6) + 1;
        die2Value = Math.floor(Math.random() * 6) + 1;
        drawDie(die1Ctx, die1Value);
        drawDie(die2Ctx, die2Value);
        const sum = die1Value + die2Value;
        const startingHole = sumToHoleMap[sum];
        rollResultDisplay.textContent = `Rolled: ${die1Value} + ${die2Value} = ${sum}. Ball enters Funnel ${startingHole}.`;

        setTimeout(() => {
            if (gameTitle) gameTitle.style.display = 'none';
            if (gameContainer) gameContainer.style.display = 'none';
            body.classList.add('plinko-active');
            plinkoSection.classList.add('full-screen');
            plinkoSection.style.display = 'flex';

            plinkoCanvas.width = window.innerWidth;
            plinkoCanvas.height = window.innerHeight;

            BALL_RADIUS = Math.max(7, Math.min(12, plinkoCanvas.width * 0.012));
            GRAVITY = plinkoCanvas.height * 0.00012; // Adjusted gravity scaling too

            setupPlinkoBoard();
            drawPlinkoBoard();
            startPlinko(startingHole);
        }, 1500);
    }

    function handleRollDice() {
        if (gamePhase !== 'dice') return;
        animateDiceRoll();
    }

    function populateSumToHoleTable() {
        sumToHoleTableBody.innerHTML = '';
        for (let sum = 2; sum <= 12; sum++) { const row = sumToHoleTableBody.insertRow(); const cellSum = row.insertCell(); const cellHole = row.insertCell(); cellSum.textContent = sum; cellHole.textContent = sumToHoleMap[sum] || '-'; }
    }

    function setupPlinkoBoard() {
        triangles = [];
        prizeSlots = [];
        const boardWidth = plinkoCanvas.width;
        const boardHeight = plinkoCanvas.height;

        const topEntryAreaHeight = boardHeight * TOP_AREA_FACTOR;
        const triangleRowsTotalHeight = boardHeight * PEG_ROWS_AREA_FACTOR;
        const numMainTriangleRows = 3; // 5, 10, 11
        const effectiveRowSpacing = triangleRowsTotalHeight / numMainTriangleRows;

        const triangleCounts = [5, 10, 11];

        // Determine UNIFIED triangle base width.
        // This size MUST allow the row with 11 triangles to fit.
        const mostConstrainedCount = 11;
        const minChannelWidth = BALL_RADIUS * 1.8; // Decent channel around the small triangles

        let spaceForTrianglesAndChannels = boardWidth * 0.98; // Use almost full width
        TRIANGLE_BASE_WIDTH_UNIFIED = (spaceForTrianglesAndChannels - (mostConstrainedCount + 1) * minChannelWidth) / mostConstrainedCount;
        TRIANGLE_BASE_WIDTH_UNIFIED = Math.max(BALL_RADIUS * 1.5, TRIANGLE_BASE_WIDTH_UNIFIED); // Min base
        // Cap max width to prevent them from being huge if board is wide and count is low (though 11 is high)
        TRIANGLE_BASE_WIDTH_UNIFIED = Math.min(boardWidth / (mostConstrainedCount * 0.8), TRIANGLE_BASE_WIDTH_UNIFIED);
        TRIANGLE_HEIGHT_UNIFIED = TRIANGLE_BASE_WIDTH_UNIFIED * 0.866; // Equilateral aspect ratio

        let previousRowTriangles = [];

        for (let r = 0; r < numMainTriangleRows; r++) {
            const numTrianglesThisRow = triangleCounts[r];
            let currentRowTriangles = [];

            // All main rows now use the UNIFIED size
            const currentTriangleBaseWidth = TRIANGLE_BASE_WIDTH_UNIFIED;
            const currentTriangleHeight = TRIANGLE_HEIGHT_UNIFIED;

            const yPos = topEntryAreaHeight + (r * effectiveRowSpacing) + effectiveRowSpacing / 2;

            const totalOccupiedByTriangles = numTrianglesThisRow * currentTriangleBaseWidth;
            const totalSpaceForChannels = boardWidth - totalOccupiedByTriangles;
            const individualChannelWidthThisRow = Math.max(BALL_RADIUS * 0.6, totalSpaceForChannels / (numTrianglesThisRow + 1));

            let currentX = individualChannelWidthThisRow;

            if (r === 0) { // First row of 5 triangles, align under funnels
                const funnelSpacing = boardWidth / (NUM_TOP_HOLES + 1);
                for (let i = 0; i < numTrianglesThisRow; i++) {
                    const funnelCenterX = funnelSpacing * (i + 1);
                    const centerX = funnelCenterX;
                    const bottomY = yPos + currentTriangleHeight / 2;
                    const topY = yPos - currentTriangleHeight / 2;
                    const newTri = {
                        id: `r${r}t${i}`, cx: centerX, cy: yPos,
                        p1: { x: centerX, y: topY }, p2: { x: centerX + currentTriangleBaseWidth / 2, y: bottomY },
                        p3: { x: centerX - currentTriangleBaseWidth / 2, y: bottomY },
                        baseWidth: currentTriangleBaseWidth, height: currentTriangleHeight, isDivider: false
                    };
                    triangles.push(newTri);
                    currentRowTriangles.push(newTri);
                }
            } else { // Subsequent main rows (row 1 with 10, row 2 with 11)
                for (let i = 0; i < numTrianglesThisRow; i++) {
                    const centerX = currentX + currentTriangleBaseWidth / 2;
                    if (centerX < -currentTriangleBaseWidth / 2 || centerX > boardWidth + currentTriangleBaseWidth / 2) {
                        currentX += currentTriangleBaseWidth + individualChannelWidthThisRow;
                        continue;
                    }
                    const bottomY = yPos + currentTriangleHeight / 2;
                    const topY = yPos - currentTriangleHeight / 2;
                    const newTri = {
                        id: `r${r}t${i}`, cx: centerX, cy: yPos,
                        p1: { x: centerX, y: topY }, p2: { x: centerX + currentTriangleBaseWidth / 2, y: bottomY },
                        p3: { x: centerX - currentTriangleBaseWidth / 2, y: bottomY },
                        baseWidth: currentTriangleBaseWidth, height: currentTriangleHeight, isDivider: false
                    };
                    triangles.push(newTri);
                    currentRowTriangles.push(newTri);
                    currentX += currentTriangleBaseWidth + individualChannelWidthThisRow;
                }
            }
            previousRowTriangles = currentRowTriangles;
        }

        // Prize Slots
        const prizeValues = [6, 4, 3, 2, 0, 1, 0, 2, 3, 4, 6];
        const numPrizeSlots = prizeValues.length;
        const slotWidth = boardWidth / numPrizeSlots;
        const slotAreaActualHeight = boardHeight * SLOT_AREA_HEIGHT_FACTOR;
        const slotY = boardHeight - slotAreaActualHeight;

        for (let i = 0; i < numPrizeSlots; i++) {
            prizeSlots.push({
                x: i * slotWidth, y: slotY, width: slotWidth, height: slotAreaActualHeight,
                value: prizeValues[i], label: (prizeValues[i] >= 0 ? "+" : "") + prizeValues[i],
                bottomFloorY: slotY + slotAreaActualHeight - BALL_RADIUS
            });
        }

        // Final row of 10 dividers, resting on slots
        const numDividers = 10;
        // Divider size can be relative to the UNIFIED triangle height or fixed
        const dividerTriangleHeight = TRIANGLE_HEIGHT_UNIFIED * 0.5; // Half the height of main triangles
        const dividerTriangleBase = Math.max(BALL_RADIUS * 0.25, TRIANGLE_BASE_WIDTH_UNIFIED * 0.1); // Very thin

        for (let i = 0; i < numDividers; i++) {
            const centerX = (i + 1) * slotWidth;
            const adjustedBottomY = slotY;
            const adjustedTopY = slotY - dividerTriangleHeight;
            const adjustedCenterY = slotY - dividerTriangleHeight / 2;
            triangles.push({
                id: `div${i}`, cx: centerX, cy: adjustedCenterY,
                p1: { x: centerX, y: adjustedTopY },
                p2: { x: centerX + dividerTriangleBase / 2, y: adjustedBottomY },
                p3: { x: centerX - dividerTriangleBase / 2, y: adjustedBottomY },
                baseWidth: dividerTriangleBase, height: dividerTriangleHeight,
                isDivider: true
            });
        }
    }

    function startPlinko(startingHoleIndex) {
        gamePhase = 'plinko';
        plinkoOutcomeDisplay.style.display = 'none';
        playAgainButton.style.display = 'none';
        ballInSlotTargetY = 0;

        const boardWidth = plinkoCanvas.width;
        const topAreaHeight = plinkoCanvas.height * TOP_AREA_FACTOR;
        const funnelSpacing = boardWidth / (NUM_TOP_HOLES + 1);
        const startX = funnelSpacing * startingHoleIndex;
        const startY = topAreaHeight * 0.15;

        plinkoBall = {
            x: startX, y: startY, radius: BALL_RADIUS, color: COLORS.BALL,
            vx: (Math.random() - 0.5) * 0.15, vy: 0.05, // Slower initial vx, slight initial vy
            inSlotPhysicsOverride: false,
            settledInSlot: false
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
        const topLabelY = topAreaHeight * 0.35;
        const funnelSpacing = boardWidth / (NUM_TOP_HOLES + 1);
        plinkoCtx.fillStyle = COLORS.TEXT_LIGHT;
        plinkoCtx.font = `bold ${Math.min(18, boardHeight * 0.02)}px Arial`;
        plinkoCtx.textAlign = 'center';
        plinkoCtx.textBaseline = 'middle';
        for (let i = 0; i < NUM_TOP_HOLES; i++) {
            plinkoCtx.fillText(`Funnel ${i + 1}`, funnelSpacing * (i + 1), topLabelY);
        }

        triangles.forEach(tri => {
            plinkoCtx.fillStyle = tri.isDivider ? COLORS.TRIANGLE_DIVIDER : COLORS.TRIANGLE;
            plinkoCtx.strokeStyle = tri.isDivider ? COLORS.TRIANGLE_DIVIDER_OUTLINE : COLORS.TRIANGLE_OUTLINE;
            plinkoCtx.lineWidth = tri.isDivider ? 1.5 : 2;

            plinkoCtx.beginPath();
            plinkoCtx.moveTo(tri.p1.x, tri.p1.y);
            plinkoCtx.lineTo(tri.p2.x, tri.p2.y);
            plinkoCtx.lineTo(tri.p3.x, tri.p3.y);
            plinkoCtx.closePath();
            plinkoCtx.fill();
            plinkoCtx.stroke();
        });

        prizeSlots.forEach((slot, index) => {
            plinkoCtx.fillStyle = (index % 2 === 0) ? COLORS.SLOT_PRIMARY : COLORS.SLOT_SECONDARY;
            plinkoCtx.fillRect(slot.x, slot.y, slot.width, slot.height);
            plinkoCtx.fillStyle = COLORS.TEXT_LIGHT;
            plinkoCtx.font = `bold ${Math.min(26, slot.height * 0.33)}px Arial`;
            plinkoCtx.fillText(slot.label, slot.x + slot.width / 2, slot.y + slot.height / 2 + 5);
            if (index > 0) {
                plinkoCtx.strokeStyle = COLORS.BACKGROUND; plinkoCtx.lineWidth = 3;
                plinkoCtx.beginPath(); plinkoCtx.moveTo(slot.x, slot.y);
                plinkoCtx.lineTo(slot.x, slot.y + slot.height); plinkoCtx.stroke();
            }
        });
        if (prizeSlots.length > 0) {
            plinkoCtx.strokeStyle = COLORS.BACKGROUND; plinkoCtx.lineWidth = 3;
            plinkoCtx.strokeRect(0, prizeSlots[0].y, boardWidth, prizeSlots[0].height);
        }
        plinkoCtx.textBaseline = 'alphabetic';
    }

    function drawBall() {
        if (!plinkoBall) return;
        plinkoCtx.beginPath();
        plinkoCtx.arc(plinkoBall.x, plinkoBall.y, plinkoBall.radius, 0, Math.PI * 2);
        plinkoCtx.fillStyle = plinkoBall.color;
        plinkoCtx.fill();
        plinkoCtx.strokeStyle = COLORS.BALL_OUTLINE;
        plinkoCtx.lineWidth = 2;
        plinkoCtx.stroke();
    }

    function lineIntersectsCircle(p1, p2, circleCenter, radius) {
        const dxLine = p2.x - p1.x;
        const dyLine = p2.y - p1.y;
        const lenSq = dxLine * dxLine + dyLine * dyLine;

        if (lenSq === 0) return Math.sqrt((circleCenter.x - p1.x) ** 2 + (circleCenter.y - p1.y) ** 2) < radius;

        let t = ((circleCenter.x - p1.x) * dxLine + (circleCenter.y - p1.y) * dyLine) / lenSq;
        t = Math.max(0, Math.min(1, t));

        const closestX = p1.x + t * dxLine;
        const closestY = p1.y + t * dyLine;
        const distSq = (circleCenter.x - closestX) ** 2 + (circleCenter.y - closestY) ** 2;
        return distSq < radius * radius;
    }

    function updateBall() {
        if (!plinkoBall || gamePhase !== 'plinko') return;

        if (plinkoBall.inSlotPhysicsOverride) {
            plinkoBall.vx *= 0.75;
            if (Math.abs(plinkoBall.vx) < 0.05) plinkoBall.vx = 0;

            if (plinkoBall.y < ballInSlotTargetY) {
                plinkoBall.vy += GRAVITY * 1.2; // Slower, controlled fall in slot
                if (plinkoBall.vy > MAX_VY * 0.6) plinkoBall.vy = MAX_VY * 0.6; // Cap speed in slot
                plinkoBall.y += plinkoBall.vy;
                if (plinkoBall.y >= ballInSlotTargetY) {
                    plinkoBall.y = ballInSlotTargetY;
                    plinkoBall.vy = 0;
                }
            } else {
                plinkoBall.y = ballInSlotTargetY;
                plinkoBall.vy = 0;
                plinkoBall.vx = 0;
            }
            const currentSlot = prizeSlots.find(s => plinkoBall.x >= s.x && plinkoBall.x <= s.x + s.width && plinkoBall.y >= s.y);
            if (currentSlot) {
                if (plinkoBall.x - plinkoBall.radius < currentSlot.x) {
                    plinkoBall.x = currentSlot.x + plinkoBall.radius; plinkoBall.vx = 0;
                } else if (plinkoBall.x + plinkoBall.radius > currentSlot.x + currentSlot.width) {
                    plinkoBall.x = currentSlot.x + currentSlot.width - plinkoBall.radius; plinkoBall.vx = 0;
                }
            }

        } else {
            plinkoBall.vy += GRAVITY;
            if (plinkoBall.vy > MAX_VY) plinkoBall.vy = MAX_VY;
            if (plinkoBall.vy < -MAX_VY * 0.5) plinkoBall.vy = -MAX_VY * 0.5; // Limit upward bounce significantly

            plinkoBall.y += plinkoBall.vy;
            plinkoBall.x += plinkoBall.vx;

            if (plinkoBall.vx > MAX_VX) plinkoBall.vx = MAX_VX;
            if (plinkoBall.vx < -MAX_VX) plinkoBall.vx = -MAX_VX;


            if (plinkoBall.x - plinkoBall.radius < 0) {
                plinkoBall.x = plinkoBall.radius; plinkoBall.vx *= -0.3;
            } else if (plinkoBall.x + plinkoBall.radius > plinkoCanvas.width) {
                plinkoBall.x = plinkoCanvas.width - plinkoBall.radius; plinkoBall.vx *= -0.3;
            }

            let collisionOccurredThisFrame = false;
            for (let tri of triangles) {
                if (collisionOccurredThisFrame) break;

                if (plinkoBall.y + plinkoBall.radius < tri.p1.y - plinkoBall.radius * 1.5 ||
                    plinkoBall.y - plinkoBall.radius > tri.p3.y + plinkoBall.radius * 1.5) {
                    continue;
                }
                const triMinX = Math.min(tri.p1.x, tri.p3.x) - plinkoBall.radius;
                const triMaxX = Math.max(tri.p1.x, tri.p2.x) + plinkoBall.radius;
                if (plinkoBall.x + plinkoBall.radius < triMinX || plinkoBall.x - plinkoBall.radius > triMaxX) {
                    continue;
                }

                const sides = [
                    { p1: tri.p1, p2: tri.p2, name: "right_slant" },
                    { p1: tri.p2, p2: tri.p3, name: "bottom_base" },
                    { p1: tri.p3, p2: tri.p1, name: "left_slant" }
                ];

                for (let side of sides) {
                    if (lineIntersectsCircle(side.p1, side.p2, plinkoBall, plinkoBall.radius)) {
                        let normal;
                        let dx_s = side.p2.x - side.p1.x;
                        let dy_s = side.p2.y - side.p1.y;
                        normal = { x: -dy_s, y: dx_s };

                        let midX = (side.p1.x + side.p2.x) / 2;
                        let midY = (side.p1.y + side.p2.y) / 2;
                        let vecToCentroidX = tri.cx - midX;
                        let vecToCentroidY = tri.cy - midY;
                        let dotProductWithCentroid = normal.x * vecToCentroidX + normal.y * vecToCentroidY;
                        if (dotProductWithCentroid > 0) {
                            normal.x *= -1; normal.y *= -1;
                        }

                        const len = Math.sqrt(normal.x * normal.x + normal.y * normal.y);
                        if (len > 0) { normal.x /= len; normal.y /= len; }
                        else { normal = { x: 0, y: 1 }; }


                        const dot = plinkoBall.vx * normal.x + plinkoBall.vy * normal.y;
                        let newVx = plinkoBall.vx - 2 * dot * normal.x;
                        let newVy = plinkoBall.vy - 2 * dot * normal.y;

                        plinkoBall.vx = newVx * COLLISION_VX_DAMPING;
                        plinkoBall.vy = newVy * (1 + COLLISION_VY_DAMPING);

                        let nudgeDistance = plinkoBall.radius * 0.25;
                        plinkoBall.x += normal.x * nudgeDistance;
                        plinkoBall.y += normal.y * nudgeDistance;

                        collisionOccurredThisFrame = true;
                        break;
                    }
                }
            }
        }

        if (!plinkoBall.inSlotPhysicsOverride && prizeSlots.length > 0 &&
            plinkoBall.y + plinkoBall.radius >= prizeSlots[0].y &&
            plinkoBall.y - plinkoBall.radius < plinkoCanvas.height) {
            for (let slot of prizeSlots) {
                if (plinkoBall.x >= slot.x && plinkoBall.x <= slot.x + slot.width) {
                    plinkoBall.inSlotPhysicsOverride = true;
                    ballInSlotTargetY = slot.bottomFloorY;
                    endPlinkoRun(slot.value, slot.label);
                    return;
                }
            }
        }

        if (!plinkoBall.inSlotPhysicsOverride && plinkoBall.y - plinkoBall.radius > plinkoCanvas.height + 50) {
            endPlinkoRun(0, "+0");
        }
    }

    function endPlinkoRun(prizeValue, prizeLabel) {
        if (gamePhase === 'plinko' && (!plinkoBall || !plinkoBall.settledInSlot)) { // Ensure plinkoBall exists
            if (plinkoBall) plinkoBall.settledInSlot = true;

            gamePhase = 'gameOverTransition';
            finalPrizeLabel = prizeLabel;

            let settlingTime = (plinkoBall && plinkoBall.inSlotPhysicsOverride) ? 1000 : 0;
            let totalDelay = 1500 + settlingTime;

            setTimeout(() => {
                gamePhase = 'gameOverScreen';
                plinkoOutcomeDisplay.innerHTML = `You won ${finalPrizeLabel}!<br>Thanks for playing!`;
                plinkoOutcomeDisplay.style.display = 'block';
                playAgainButton.style.display = 'block';

                plinkoCtx.fillStyle = COLORS.OVERLAY_FILL;
                plinkoCtx.fillRect(0, 0, plinkoCanvas.width, plinkoCanvas.height);

                if (animationFrameId) cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }, totalDelay);
        }
    }

    function gameLoopPlinko() {
        if (gamePhase === 'plinko' || gamePhase === 'gameOverTransition') {
            if (gamePhase === 'plinko' || (gamePhase === 'gameOverTransition' && plinkoBall && plinkoBall.inSlotPhysicsOverride && plinkoBall.y < ballInSlotTargetY)) {
                updateBall();
            }

            drawPlinkoBoard();
            if (plinkoBall) drawBall();
            animationFrameId = requestAnimationFrame(gameLoopPlinko);
        }
    }

    function resetGame() {
        gamePhase = 'dice';
        if (gameTitle) gameTitle.style.display = 'block';
        if (gameContainer) gameContainer.style.display = 'block';

        body.classList.remove('plinko-active');
        plinkoSection.classList.remove('full-screen');
        plinkoSection.style.display = 'none';

        playAgainButton.style.display = 'none';
        plinkoOutcomeDisplay.style.display = 'none';
        plinkoOutcomeDisplay.innerHTML = "";
        rollResultDisplay.textContent = "";
        rollButton.disabled = false;
        ballInSlotTargetY = 0;

        drawDie(die1Ctx, 1);
        drawDie(die2Ctx, 1);

        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        if (plinkoBall) {
            plinkoBall.inSlotPhysicsOverride = false;
            plinkoBall.settledInSlot = false;
        }
        plinkoBall = null;
        triangles = [];
    }

    window.addEventListener('resize', () => {
        if (plinkoSection.classList.contains('full-screen') &&
            (gamePhase === 'plinko' || gamePhase === 'gameOverTransition' || gamePhase === 'gameOverScreen')) {

            const oldCanvasWidth = plinkoCanvas.width;
            const oldCanvasHeight = plinkoCanvas.height;

            plinkoCanvas.width = window.innerWidth;
            plinkoCanvas.height = window.innerHeight;

            if (plinkoBall && oldCanvasWidth > 0 && oldCanvasHeight > 0) {
                plinkoBall.x = (plinkoBall.x / oldCanvasWidth) * plinkoCanvas.width;
                plinkoBall.y = (plinkoBall.y / oldCanvasHeight) * plinkoCanvas.height;
            }

            BALL_RADIUS = Math.max(7, Math.min(12, plinkoCanvas.width * 0.012));
            GRAVITY = plinkoCanvas.height * 0.00012; // Adjusted gravity scaling

            setupPlinkoBoard();

            if (plinkoBall && plinkoBall.inSlotPhysicsOverride) {
                const currentSlotIndex = prizeSlots.findIndex(s => plinkoBall.x >= s.x && plinkoBall.x <= s.x + s.width);
                if (currentSlotIndex !== -1) {
                    ballInSlotTargetY = prizeSlots[currentSlotIndex].bottomFloorY;
                } else { // Ball might be outside slot X range after resize, reset override
                    plinkoBall.inSlotPhysicsOverride = false;
                    plinkoBall.settledInSlot = false;
                }
            }

            if (gamePhase === 'plinko' || gamePhase === 'gameOverTransition') {
                drawPlinkoBoard();
            } else if (gamePhase === 'gameOverScreen') {
                drawPlinkoBoard();
                if (plinkoBall && plinkoBall.x !== undefined) drawBall();
                plinkoCtx.fillStyle = COLORS.OVERLAY_FILL;
                plinkoCtx.fillRect(0, 0, plinkoCanvas.width, plinkoCanvas.height);
            }
        }
    });

    init();
});