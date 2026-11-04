const CPU = {
    PC: 0, MAR: 0, IR: 0, ACC: 0, B: 0, OUT: 0,
    RAM: new Array(16).fill(0),
    halted: false,
    tState: 1,
    cycleCount: 0,
    running: false,
    currentOpcode: 0,
    currentOperand: 0,
    wbusValue: 0,
    activeSignals: new Set(),
    hasProgram: false
};

const OPCODES = { LDA: 0, ADD: 1, SUB: 2, OUT: 14, HLT: 15 };
const OPCODE_NAMES = { 0: 'LDA', 1: 'ADD', 2: 'SUB', 14: 'OUT', 15: 'HLT' };

const DOM = {};
let runInterval = null;
let outputCount = 0;
let lastRecipe = "—";          // stores the last loaded formula for the receipt

// CACHE DOM
function cacheDOMReferences() {
    DOM.regPC = document.getElementById('regPC');
    DOM.regPC_dec = document.getElementById('regPC_dec');
    DOM.regMAR = document.getElementById('regMAR');
    DOM.regMAR_dec = document.getElementById('regMAR_dec');
    DOM.regIR = document.getElementById('regIR');
    DOM.irOpcode = document.getElementById('irOpcode');
    DOM.irOperand = document.getElementById('irOperand');
    DOM.regAcc = document.getElementById('regAcc');
    DOM.regAcc_hex = document.getElementById('regAcc_hex');
    DOM.regAcc_dec = document.getElementById('regAcc_dec');
    DOM.regB = document.getElementById('regB');
    DOM.regB_hex = document.getElementById('regB_hex');
    DOM.regB_dec = document.getElementById('regB_dec');
    DOM.regALU = document.getElementById('regALU');
    DOM.aluOp = document.getElementById('aluOp');
    DOM.outputHex = document.getElementById('outputHex');
    DOM.outputDec = document.getElementById('outputDec');

    DOM.leds = [];
    for (let i = 7; i >= 0; i--) {
        DOM.leds.push(document.getElementById(`led${i}`));
    }
    DOM.ledBinaryLabel = document.getElementById('ledBinaryLabel');

    DOM.wbus = document.getElementById('wbus');
    DOM.wbusValue = document.getElementById('wbusValue');
    DOM.busPC_MAR = document.getElementById('busPC_MAR');
    DOM.busIR_CTRL = document.getElementById('busIR_CTRL');

    DOM.blockPC = document.getElementById('blockPC');
    DOM.blockMAR = document.getElementById('blockMAR');
    DOM.blockIR = document.getElementById('blockIR');
    DOM.blockController = document.getElementById('blockController');
    DOM.blockAcc = document.getElementById('blockAcc');
    DOM.blockALU = document.getElementById('blockALU');
    DOM.blockB = document.getElementById('blockB');

    DOM.cpuState = document.getElementById('cpuState');
    DOM.tState = document.getElementById('tState');
    DOM.cycleCount = document.getElementById('cycleCount');

    DOM.btnStep = document.getElementById('btnStep');
    DOM.btnRun = document.getElementById('btnRun');
    DOM.btnReset = document.getElementById('btnReset');
    DOM.btnWrite = document.getElementById('btnWrite');
    DOM.btnLoadSample = document.getElementById('btnLoadSample');
    DOM.btnBuildFormula = document.getElementById('btnBuildFormula');
    DOM.btnClearLog = document.getElementById('btnClearLog');
    DOM.speedSlider = document.getElementById('speedSlider');
    DOM.speedValue = document.getElementById('speedValue');

    DOM.inputAddress = document.getElementById('inputAddress');
    DOM.inputOpcode = document.getElementById('inputOpcode');
    DOM.inputOperand = document.getElementById('inputOperand');
    DOM.operandGroup = document.getElementById('operandGroup');

    DOM.ramTableBody = document.getElementById('ramTableBody');
    DOM.logContainer = document.getElementById('logContainer');
    DOM.loaderStatus = document.getElementById('loaderStatus');
    DOM.outputHistory = document.getElementById('outputHistory');

    DOM.signals = {
        Cp: document.getElementById('sigCp'),
        Ep: document.getElementById('sigEp'),
        Lm: document.getElementById('sigLm'),
        CE: document.getElementById('sigCE'),
        Li: document.getElementById('sigLi'),
        Ei: document.getElementById('sigEi'),
        La: document.getElementById('sigLa'),
        Ea: document.getElementById('sigEa'),
        Su: document.getElementById('sigSu'),
        Eu: document.getElementById('sigEu'),
        Lb: document.getElementById('sigLb'),
        Lo: document.getElementById('sigLo')
    };
}

// UTILITIES
function toBinary4(val) { return (val & 0xF).toString(2).padStart(4, '0'); }
function toBinary8(val) {
    const bin = (val & 0xFF).toString(2).padStart(8, '0');
    return bin.substring(0, 4) + ' ' + bin.substring(4);
}
function toHex2(val) { return (val & 0xFF).toString(16).toUpperCase().padStart(2, '0'); }
function toHex1(val) { return (val & 0xF).toString(16).toUpperCase(); }

// SOUND FX
const SND = { on: false, ctx: null };
function beep(freq, delay, dur, type, vol) {
    if (!SND.on) return;
    try {
        SND.ctx = SND.ctx || new (window.AudioContext || window.webkitAudioContext)();
        if (SND.ctx.state === 'suspended') SND.ctx.resume();
        const o = SND.ctx.createOscillator(), g = SND.ctx.createGain(), t = SND.ctx.currentTime + delay;
        o.type = type; o.frequency.value = freq;
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(SND.ctx.destination);
        o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* audio unavailable */ }
}
const sfx = {
    tick: () => beep(1100, 0, 0.04, 'square', 0.04),
    ding: () => { beep(1318, 0.06, 0.35, 'sine', 0.12); beep(1760, 0.2, 0.5, 'sine', 0.12); },
    fin:  () => { beep(660, 0.06, 0.14, 'triangle', 0.14); beep(660, 0.26, 0.14, 'triangle', 0.14); }
};

// REGISTER TRANSFER GLOW
const GLOW_MAP = { Ep: 'blockPC', Lm: 'blockMAR', CE: 'panelRAM', Li: 'blockIR', Ei: 'blockIR',
                   La: 'blockAcc', Ea: 'blockAcc', Su: 'blockALU', Eu: 'blockALU', Lb: 'blockB', Lo: 'panelOUT' };
function updateGlow() {
    const on = new Set([...CPU.activeSignals].map(s => GLOW_MAP[s]).filter(Boolean));
    new Set(Object.values(GLOW_MAP)).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('active-glow', on.has(id));
    });
}

// PC QUEUE-TICKET ICON
function pcTicketFx(cls) {
    const ic = document.querySelector('#blockPC .mt-icon');
    if (!ic) return;
    const ms = Math.min(600, Math.max(150, (parseInt(DOM.speedSlider.value) || 800) * 0.8));
    ic.style.setProperty('--pcdur', ms + 'ms');
    ic.classList.remove('pc-print', 'pc-call');
    void ic.offsetWidth;
    ic.classList.add(cls);
}
function updatePCTicket() {
    const n = document.querySelector('#blockPC .pc-num');
    if (n) n.textContent = '#' + String(CPU.PC).padStart(2, '0');
    if (CPU.activeSignals.has('Cp')) pcTicketFx('pc-print');
    else if (CPU.activeSignals.has('Ep')) pcTicketFx('pc-call');
}

// ICON ANIMATIONS
function iconFx(host, cls) {
    const ic = document.querySelector('#' + host + ' .mt-icon');
    if (!ic) return;
    ic.style.setProperty('--fxdur', Math.min(800, Math.max(200, (parseInt(DOM.speedSlider.value) || 800) * 0.8)) + 'ms');
    ic.classList.remove(cls);
    void ic.offsetWidth;
    ic.classList.add(cls);
}
function updateOutputCup() {
    const t = document.querySelector('#panelOUT .out-tea');
    if (t) t.style.transform = 'scaleY(' + (CPU.OUT ? 0.18 + 0.82 * CPU.OUT / 255 : 0) + ')';
}
function updateAccCup() {
    const t = document.querySelector('#blockAcc .acc-tea');
    if (t) t.style.transform = 'scaleY(' + (CPU.ACC ? 0.38 + 0.62 * CPU.ACC / 255 : 0) + ')';
}
function updateIconFx() {
    if (CPU.activeSignals.has('La')) iconFx('blockAcc', 'fx-a');
    if (CPU.activeSignals.has('Eu')) {
        const ic = document.querySelector('#blockALU .mt-icon'), sub = CPU.activeSignals.has('Su');
        if (ic) { ic.classList.toggle('alu-sub', sub); ic.classList.toggle('alu-add', !sub); }
        iconFx('blockALU', 'fx-alu');
    }
    updateAccCup();
    if (CPU.activeSignals.has('Lm')) iconFx('blockMAR', 'fx-mar');
    if (CPU.activeSignals.has('Lb')) iconFx('blockB', 'fx-b');
    if (CPU.activeSignals.has('Lo')) iconFx('panelOUT', 'fx-out');
    updateOutputCup();
}

// ========== ORDER COMPLETE RECEIPT POPUP ==========
function showReceipt() {
    // Remove existing receipt if any
    const old = document.getElementById('mt-receipt');
    if (old) old.remove();

    const outHex = toHex2(CPU.OUT);
    const outDec = CPU.OUT;

    const overlay = document.createElement('div');
    overlay.id = 'mt-receipt';
    overlay.innerHTML = `
        <div class="receipt-card">
            <div class="receipt-header">
                <div class="receipt-logo">🧋</div>
                <h2>SAP-1 MILKTEA SHOP</h2>
                <p class="receipt-sub">Official Order Receipt</p>
            </div>

            <div class="receipt-body">
                <div class="receipt-row">
                    <span>Recipe</span>
                    <strong>${lastRecipe}</strong>
                </div>
                <div class="receipt-row highlight">
                    <span>Total Served</span>
                    <strong>${outHex}H <small>(${outDec} Boba Pearls)</small></strong>
                </div>
                <div class="receipt-row">
                    <span>Status</span>
                    <strong class="ready">Order Ready for Pickup! 🧋</strong>
                </div>
            </div>

            <div class="receipt-footer">
                <p>Thank you for computing with us!</p>
                <button class="receipt-close" id="btnCloseReceipt">Close Receipt</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    // Close button
    document.getElementById('btnCloseReceipt').addEventListener('click', () => {
        overlay.classList.add('closing');
        setTimeout(() => overlay.remove(), 280);
    });

    // Click outside to close
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.classList.add('closing');
            setTimeout(() => overlay.remove(), 280);
        }
    });
}

// Inject receipt CSS once
(function injectReceiptCSS() {
    if (document.getElementById('mt-receipt-css')) return;
    const style = document.createElement('style');
    style.id = 'mt-receipt-css';
    style.textContent = `
        #mt-receipt {
            position: fixed;
            inset: 0;
            background: rgba(45, 35, 46, 0.55);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            animation: receiptFadeIn 0.3s ease;
        }
        #mt-receipt.closing {
            animation: receiptFadeOut 0.28s ease forwards;
        }
        .receipt-card {
            background: #FFF9F0;
            width: 340px;
            border-radius: 18px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.25);
            overflow: hidden;
            border: 3px solid #FFCED8;
            animation: receiptPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .receipt-header {
            background: linear-gradient(135deg, #FFCED8, #FFE8C4);
            padding: 1.4rem 1.2rem 1rem;
            text-align: center;
        }
        .receipt-logo {
            font-size: 2.4rem;
            margin-bottom: 0.3rem;
        }
        .receipt-header h2 {
            margin: 0;
            font-size: 1.25rem;
            color: #2D232E;
            letter-spacing: 0.5px;
        }
        .receipt-sub {
            margin: 0.2rem 0 0;
            font-size: 0.75rem;
            color: #6b5b5e;
            font-weight: 600;
        }
        .receipt-body {
            padding: 1.3rem 1.4rem;
        }
        .receipt-row {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: 0.9rem;
            font-size: 0.9rem;
        }
        .receipt-row span {
            color: #6b5b5e;
            font-weight: 600;
        }
        .receipt-row strong {
            color: #2D232E;
            text-align: right;
            max-width: 60%;
        }
        .receipt-row.highlight {
            background: #FFE8C4;
            margin: 0 -0.6rem 0.9rem;
            padding: 0.7rem 0.6rem;
            border-radius: 10px;
        }
        .receipt-row.highlight strong {
            color: #c0392b;
            font-size: 1.05rem;
        }
        .receipt-row.highlight small {
            font-size: 0.75rem;
            color: #7a5c3e;
            font-weight: 600;
        }
        .ready {
            color: #27ae60 !important;
        }
        .receipt-footer {
            background: #FFF4DE;
            padding: 1rem 1.4rem 1.3rem;
            text-align: center;
            border-top: 1px dashed #FFCED8;
        }
        .receipt-footer p {
            margin: 0 0 0.9rem;
            font-size: 0.8rem;
            color: #6b5b5e;
            font-style: italic;
        }
        .receipt-close {
            background: #FF5E8E;
            color: white;
            border: none;
            padding: 0.65rem 1.8rem;
            border-radius: 999px;
            font-weight: 700;
            font-size: 0.9rem;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 4px 12px rgba(255, 94, 142, 0.35);
        }
        .receipt-close:hover {
            background: #e84a7a;
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(255, 94, 142, 0.45);
        }
        @keyframes receiptFadeIn {
            from { opacity: 0; }
            to   { opacity: 1; }
        }
        @keyframes receiptFadeOut {
            from { opacity: 1; }
            to   { opacity: 0; }
        }
        @keyframes receiptPop {
            from { transform: scale(0.7) translateY(30px); opacity: 0; }
            to   { transform: scale(1) translateY(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
})();

// DISPLAY UPDATES
function updateAllDisplays() {
    updateRegisterDisplays();
    updateRAMDisplay();
    updateOutputDisplay();
    updateStatusDisplay();
    updateSignalDisplay();
}

function updateRegisterDisplays() {
    DOM.regPC.textContent = toBinary4(CPU.PC);
    DOM.regPC_dec.textContent = CPU.PC;
    DOM.regMAR.textContent = toBinary4(CPU.MAR);
    DOM.regMAR_dec.textContent = CPU.MAR;
    DOM.regIR.textContent = toBinary8(CPU.IR);
    DOM.irOpcode.textContent = toBinary4((CPU.IR >> 4) & 0xF);
    DOM.irOperand.textContent = toBinary4(CPU.IR & 0xF);
    DOM.regAcc.textContent = toBinary8(CPU.ACC);
    DOM.regAcc_hex.textContent = toHex2(CPU.ACC);
    DOM.regAcc_dec.textContent = CPU.ACC;
    DOM.regB.textContent = toBinary8(CPU.B);
    DOM.regB_hex.textContent = toHex2(CPU.B);
    DOM.regB_dec.textContent = CPU.B;
    DOM.regALU.textContent = toBinary8(CPU.wbusValue);
    DOM.wbusValue.textContent = toBinary8(CPU.wbusValue);
}

function updateRAMDisplay() {
    DOM.ramTableBody.innerHTML = '';
    for (let i = 0; i < 16; i++) {
        const tr = document.createElement('tr');
        const val = CPU.RAM[i];

        let hexStr = '';
        let binStr = '';
        let decoded = '';

        if (!CPU.hasProgram || val !== 0) {
            hexStr = `${toHex2(val)}H`;
            binStr = toBinary8(val);

            const opcode = (val >> 4) & 0xF;
            const operand = val & 0xF;

            if (i < 5 && OPCODE_NAMES[opcode] !== undefined) {
                if (opcode === 14) decoded = 'OUT';
                else if (opcode === 15) decoded = 'HLT';
                else decoded = `${OPCODE_NAMES[opcode]} ${toHex1(operand)}H`;
            } else {
                decoded = `${toHex2(val)}H`;
            }
        }

        tr.innerHTML = `
            <td>${toHex1(i)}H</td>
            <td>${hexStr}</td>
            <td style="font-size:0.7rem">${binStr}</td>
            <td style="font-size:0.7rem">${decoded}</td>
        `;

        if (i === CPU.MAR) tr.classList.add('ram-highlight');
        DOM.ramTableBody.appendChild(tr);
    }
}

function updateOutputDisplay() {
    DOM.outputHex.textContent = toHex2(CPU.OUT) + 'H';
    DOM.outputDec.textContent = CPU.OUT;
    const bits = (CPU.OUT & 0xFF).toString(2).padStart(8, '0').split('');
    for (let i = 0; i < 8; i++) {
        if (bits[i] === '1') DOM.leds[i].classList.add('led-on');
        else DOM.leds[i].classList.remove('led-on');
    }
    DOM.ledBinaryLabel.textContent = bits.join(' ');
}

function updateStatusDisplay() {
    let phase = "";
    if (CPU.tState === 1 || CPU.tState === 2) phase = " (FETCH)";
    else if (CPU.tState === 3) phase = " (DECODE)";
    else phase = " (EXECUTE)";

    DOM.tState.textContent = `T${CPU.tState}${phase}`;
    DOM.cycleCount.textContent = CPU.cycleCount;

    DOM.cpuState.classList.remove('state-idle', 'state-running', 'state-halted');
    if (CPU.halted) {
        DOM.cpuState.textContent = 'HALTED';
        DOM.cpuState.classList.add('state-halted');
    } else if (CPU.running) {
        DOM.cpuState.textContent = 'RUNNING';
        DOM.cpuState.classList.add('state-running');
    } else {
        DOM.cpuState.textContent = 'IDLE';
        DOM.cpuState.classList.add('state-idle');
    }
}

function updateSignalDisplay() {
    Object.keys(DOM.signals).forEach(sig => {
        if (CPU.activeSignals.has(sig)) DOM.signals[sig].classList.add('signal-active');
        else DOM.signals[sig].classList.remove('signal-active');
    });
    updateGlow();
    updatePCTicket();
    updateIconFx();
    // updateBusFlow removed – no more moving boba
}

function clearBlockHighlights() {
    const blocks = [DOM.blockPC, DOM.blockMAR, DOM.blockIR, DOM.blockController,
                    DOM.blockAcc, DOM.blockALU, DOM.blockB];
    blocks.forEach(b => { if (b) b.classList.remove('active', 'reading', 'writing'); });
    DOM.wbus.classList.remove('active');
    DOM.busPC_MAR.classList.remove('active');
    DOM.busIR_CTRL.classList.remove('active');
    CPU.activeSignals.clear();
    updateSignalDisplay();
}

function highlightBlock(blockEl, type = 'active') {
    if (blockEl) blockEl.classList.add(type);
}

function activateBus() {
    const w = DOM.wbus;
    const ms = Math.min(1200, Math.max(300, (parseInt(DOM.speedSlider.value) || 800) * 0.9));
    w.style.setProperty('--belt', ms + 'ms');
    w.style.setProperty('--spin', Math.max(1, Math.round(ms / 200)));
    w.classList.remove('active');
    void w.offsetWidth;
    w.classList.add('active');
}
function activateArrow(el) { if (el) el.classList.add('active'); }

// LOGGING
function log(message, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    entry.textContent = `[T${CPU.tState}] ${message}`;
    DOM.logContainer.appendChild(entry);
    DOM.logContainer.scrollTop = DOM.logContainer.scrollHeight;
}

function clearLog() {
    DOM.logContainer.innerHTML = '<div class="log-entry log-info">Log cleared.</div>';
}

function addOutputHistory(value) {
    outputCount++;
    if (outputCount === 1) DOM.outputHistory.innerHTML = '';
    const entry = document.createElement('div');
    entry.className = 'history-entry';
    entry.innerHTML = `
        <span class="h-num">#${outputCount}</span>
        <span class="h-hex">${toHex2(value)}H</span>
        <span class="h-binary">${toBinary8(value)}</span>
    `;
    DOM.outputHistory.appendChild(entry);
}

// EXECUTION ENGINE
function executeTState() {
    if (CPU.halted) return;
    clearBlockHighlights();
    const opcode = (CPU.IR >> 4) & 0xF;
    const operand = CPU.IR & 0xF;

    switch (CPU.tState) {
        case 1:
            CPU.activeSignals.add('Ep');
            CPU.activeSignals.add('Lm');
            CPU.MAR = CPU.PC;
            CPU.wbusValue = CPU.PC;
            highlightBlock(DOM.blockPC, 'reading');
            highlightBlock(DOM.blockMAR, 'writing');
            activateArrow(DOM.busPC_MAR);
            activateBus();
            log(`FETCH: PC(${CPU.PC}) → MAR`, 'fetch');
            CPU.tState = 2;
            break;

        case 2:
            CPU.activeSignals.add('CE');
            CPU.activeSignals.add('Li');
            CPU.activeSignals.add('Cp');
            CPU.IR = CPU.RAM[CPU.MAR];
            CPU.wbusValue = CPU.IR;
            CPU.PC = (CPU.PC + 1) & 0xF;
            CPU.currentOpcode = (CPU.IR >> 4) & 0xF;
            CPU.currentOperand = CPU.IR & 0xF;
            highlightBlock(DOM.blockIR, 'writing');
            highlightBlock(DOM.blockPC, 'active');
            activateBus();
            const name = OPCODE_NAMES[CPU.currentOpcode] || '???';
            log(`FETCH: RAM[${toHex1(CPU.MAR)}H]=${toHex2(CPU.IR)}H → IR, PC++`, 'fetch');
            log(`DECODE: ${name}`, 'decode');
            CPU.tState = 3;
            break;

        case 3: executeT3(CPU.currentOpcode, CPU.currentOperand); break;
        case 4: executeT4(CPU.currentOpcode, CPU.currentOperand); break;
        case 5: executeT5(CPU.currentOpcode, CPU.currentOperand); break;
        case 6:
            CPU.tState = 1;
            CPU.cycleCount++;
            break;
    }

    sfx.tick();
    updateAllDisplays();
}

function executeT3(opcode, operand) {
    switch (opcode) {
        case OPCODES.LDA:
        case OPCODES.ADD:
        case OPCODES.SUB:
            CPU.activeSignals.add('Ei');
            CPU.activeSignals.add('Lm');
            CPU.MAR = operand;
            CPU.wbusValue = operand;
            highlightBlock(DOM.blockIR, 'reading');
            highlightBlock(DOM.blockMAR, 'writing');
            activateBus();
            log(`EXEC: IR operand(${toHex1(operand)}H) → MAR`, 'execute');
            CPU.tState = 4;
            break;
        case OPCODES.OUT:
            CPU.activeSignals.add('Ea');
            CPU.activeSignals.add('Lo');
            CPU.OUT = CPU.ACC;
            CPU.wbusValue = CPU.ACC;
            highlightBlock(DOM.blockAcc, 'reading');
            activateBus();
            log(`EXEC OUT: A(${toHex2(CPU.ACC)}H) → Output`, 'output');
            addOutputHistory(CPU.OUT);
            sfx.ding();
            CPU.tState = 1;
            CPU.cycleCount++;
            break;
        case OPCODES.HLT:
            CPU.halted = true;
            CPU.running = false;
            log(`HLT: Processor halted.`, 'halt');
            sfx.fin();
            CPU.tState = 1;
            CPU.cycleCount++;
            updateStatusDisplay();

            // 🎉 Show the cute receipt when the order is complete
            setTimeout(() => showReceipt(), 400);
            break;
    }
}

function executeT4(opcode, operand) {
    switch (opcode) {
        case OPCODES.LDA:
            CPU.activeSignals.add('CE');
            CPU.activeSignals.add('La');
            CPU.ACC = CPU.RAM[CPU.MAR];
            CPU.wbusValue = CPU.ACC;
            highlightBlock(DOM.blockAcc, 'writing');
            activateBus();
            log(`EXEC LDA: RAM[${toHex1(CPU.MAR)}H]=${toHex2(CPU.ACC)}H → A`, 'execute');
            CPU.tState = 1;
            CPU.cycleCount++;
            break;
        case OPCODES.ADD:
        case OPCODES.SUB:
            CPU.activeSignals.add('CE');
            CPU.activeSignals.add('Lb');
            CPU.B = CPU.RAM[CPU.MAR];
            CPU.wbusValue = CPU.B;
            highlightBlock(DOM.blockB, 'writing');
            activateBus();
            log(`EXEC: RAM[${toHex1(CPU.MAR)}H]=${toHex2(CPU.B)}H → B`, 'execute');
            CPU.tState = 5;
            break;
    }
}

function executeT5(opcode, operand) {
    switch (opcode) {
        case OPCODES.ADD:
            CPU.activeSignals.add('Eu');
            CPU.activeSignals.add('La');
            const addResult = (CPU.ACC + CPU.B) & 0xFF;
            CPU.wbusValue = addResult;
            DOM.aluOp.textContent = 'ADD (+)';
            highlightBlock(DOM.blockALU, 'active');
            highlightBlock(DOM.blockAcc, 'writing');
            activateBus();
            log(`EXEC ADD: ${toHex2(CPU.ACC)}H + ${toHex2(CPU.B)}H = ${toHex2(addResult)}H → A`, 'execute');
            CPU.ACC = addResult;
            CPU.tState = 1;
            CPU.cycleCount++;
            break;
        case OPCODES.SUB:
            CPU.activeSignals.add('Eu');
            CPU.activeSignals.add('La');
            CPU.activeSignals.add('Su');
            const subResult = (CPU.ACC - CPU.B) & 0xFF;
            CPU.wbusValue = subResult;
            DOM.aluOp.textContent = 'SUB (−)';
            highlightBlock(DOM.blockALU, 'active');
            highlightBlock(DOM.blockAcc, 'writing');
            activateBus();
            log(`EXEC SUB: ${toHex2(CPU.ACC)}H − ${toHex2(CPU.B)}H = ${toHex2(subResult)}H → A`, 'execute');
            CPU.ACC = subResult;
            CPU.tState = 1;
            CPU.cycleCount++;
            break;
    }
}

// CONTROLS
function stepOnce() {
    if (CPU.halted) { log('CPU halted. Reset to restart.', 'halt'); return; }
    executeTState();
}

function runProgram() {
    if (CPU.halted) { log('CPU halted. Reset to restart.', 'halt'); return; }
    if (CPU.running) {
        CPU.running = false;
        clearInterval(runInterval);
        runInterval = null;
        DOM.btnRun.textContent = '▶ Run';
        DOM.btnStep.disabled = false;
        updateStatusDisplay();
        return;
    }
    CPU.running = true;
    DOM.btnRun.textContent = '⏸ Pause';
    DOM.btnStep.disabled = true;
    updateStatusDisplay();
    const speed = parseInt(DOM.speedSlider.value);
    runInterval = setInterval(() => {
        if (CPU.halted) {
            clearInterval(runInterval);
            runInterval = null;
            CPU.running = false;
            DOM.btnRun.textContent = '▶ Run';
            DOM.btnStep.disabled = false;
            updateStatusDisplay();
            return;
        }
        executeTState();
    }, speed);
}

function resetCPU() {
    if (runInterval) { clearInterval(runInterval); runInterval = null; }
    CPU.PC = 0; CPU.MAR = 0; CPU.IR = 0; CPU.ACC = 0;
    CPU.B = 0; CPU.OUT = 0; CPU.halted = false; CPU.running = false;
    CPU.tState = 1; CPU.cycleCount = 0;
    CPU.currentOpcode = 0; CPU.currentOperand = 0; CPU.wbusValue = 0;
    CPU.activeSignals.clear();
    DOM.btnRun.textContent = '▶ Run';
    DOM.btnStep.disabled = false;
    DOM.aluOp.textContent = '—';

    clearBlockHighlights();
    updateAllDisplays();
    log('CPU Reset.', 'info');
}

function resetBuilderAndManualInputs() {
    const loadOpSelect = document.getElementById('loadOp');
    if (loadOpSelect) loadOpSelect.value = '9';

    const valA = document.getElementById('valA');
    const valB = document.getElementById('valB');
    const valC = document.getElementById('valC');
    if (valA) valA.value = '';
    if (valB) valB.value = '';
    if (valC) valC.value = '';

    const inputAddress = document.getElementById('inputAddress');
    const inputOpcode = document.getElementById('inputOpcode');
    const inputOperand = document.getElementById('inputOperand');

    if (inputAddress) inputAddress.value = '0';
    if (inputOpcode) {
        inputOpcode.value = '-1';
        handleOpcodeChange();
    }
    if (inputOperand) inputOperand.value = '';
}

function resetRAMTable() {
    CPU.RAM.fill(0);
    CPU.hasProgram = false;
    updateRAMDisplay();
}

// FORMULA BUILDER
function buildFormulaProgram() {
    const hexA = document.getElementById('valA').value.trim() || '00';
    const hexB = document.getElementById('valB').value.trim() || '00';
    const hexC = document.getElementById('valC').value.trim() || '00';

    const ldaSourceAddr = parseInt(document.getElementById('loadOp').value, 16);

    const op1 = document.getElementById('op1').value;
    const op2 = document.getElementById('op2').value;

    const valA = parseInt(hexA, 16);
    const valB = parseInt(hexB, 16);
    const valC = parseInt(hexC, 16);

    if (![hexA, hexB, hexC].every(h => /^[0-9a-f]{1,2}$/i.test(h))) {
        showLoaderStatus('Values must be valid Hex (00-FF)', 'error');
        return;
    }
    if (ldaSourceAddr < 5 || ldaSourceAddr > 13) {
        showLoaderStatus('Pick LDA 5H-DH: 0H-4H hold the program and the data needs 3 slots.', 'error');
        return;
    }

    CPU.RAM.fill(0);
    CPU.RAM[0x0] = ldaSourceAddr;
    CPU.RAM[0x1] = ((op1 === 'ADD') ? 0x10 : 0x20) | (ldaSourceAddr + 1);
    CPU.RAM[0x2] = ((op2 === 'ADD') ? 0x10 : 0x20) | (ldaSourceAddr + 2);
    CPU.RAM[0x3] = 0xEF;
    CPU.RAM[0x4] = 0xFF;
    CPU.RAM[ldaSourceAddr]     = valA & 0xFF;
    CPU.RAM[ldaSourceAddr + 1] = valB & 0xFF;
    CPU.RAM[ldaSourceAddr + 2] = valC & 0xFF;

    CPU.hasProgram = true;

    // Save recipe for the receipt
    const s1 = op1 === 'ADD' ? '+' : '−';
    const s2 = op2 === 'ADD' ? '+' : '−';
    lastRecipe = `${hexA}H ${s1} ${hexB}H ${s2} ${hexC}H`;

    resetCPU();
    updateRAMDisplay();

    showLoaderStatus(`Loaded: ${lastRecipe}`, 'success');
    log(`Formula loaded: ${lastRecipe}`, 'info');
}

function writeToRAM() {
    const addr = parseInt(DOM.inputAddress.value);
    const opcodeVal = DOM.inputOpcode.value;
    const operandStr = DOM.inputOperand.value.trim();

    if (opcodeVal === '-1') {
        showLoaderStatus('Select an instruction.', 'error');
        return;
    }

    let byteValue = 0;
    if (opcodeVal === 'data') {
        const dataVal = parseInt(operandStr, 16);
        if (isNaN(dataVal) || dataVal < 0 || dataVal > 255) {
            showLoaderStatus('Enter hex data (00-FF).', 'error');
            return;
        }
        byteValue = dataVal;
    } else {
        const opc = parseInt(opcodeVal);
        if (opc === 14 || opc === 15) {
            byteValue = (opc << 4) | 0xF;
        } else {
            const oprVal = parseInt(operandStr, 16);
            if (isNaN(oprVal) || oprVal < 0 || oprVal > 15) {
                showLoaderStatus('Operand must be 0-F.', 'error');
                return;
            }
            byteValue = (opc << 4) | oprVal;
        }
    }

    CPU.RAM[addr] = byteValue & 0xFF;
    CPU.hasProgram = true;
    updateRAMDisplay();
    showLoaderStatus(`Wrote ${toHex2(byteValue)}H to ${toHex1(addr)}H`, 'success');
    log(`RAM[${toHex1(addr)}H] ← ${toHex2(byteValue)}H`, 'info');
}

function loadSampleProgram() {
    const valA = document.getElementById('valA');
    const valB = document.getElementById('valB');
    const valC = document.getElementById('valC');
    const loadOp = document.getElementById('loadOp');
    const op1 = document.getElementById('op1');
    const op2 = document.getElementById('op2');

    if (valA) valA.value = '25';
    if (valB) valB.value = '05';
    if (valC) valC.value = '23';
    if (loadOp) loadOp.value = '9';
    if (op1) op1.value = 'ADD';
    if (op2) op2.value = 'SUB';

    CPU.RAM.fill(0);
    CPU.RAM[0x0] = 0x09;
    CPU.RAM[0x1] = 0x1A;
    CPU.RAM[0x2] = 0x2B;
    CPU.RAM[0x3] = 0xEF;
    CPU.RAM[0x4] = 0xFF;
    CPU.RAM[0x9] = 0x25;
    CPU.RAM[0xA] = 0x05;
    CPU.RAM[0xB] = 0x23;

    CPU.hasProgram = true;

    // Save recipe for the receipt
    lastRecipe = "25H + 05H − 23H";

    resetCPU();
    updateRAMDisplay();

    showLoaderStatus('Sample: 25H + 05H − 23H = 07H', 'success');
    log('Sample program loaded.', 'info');
}

function showLoaderStatus(msg, type) {
    DOM.loaderStatus.textContent = msg;
    DOM.loaderStatus.className = `status-msg ${type}`;
    setTimeout(() => {
        DOM.loaderStatus.textContent = '';
        DOM.loaderStatus.className = 'status-msg';
    }, 4000);
}

function handleOpcodeChange() {
    const val = DOM.inputOpcode.value;
    if (val === '14' || val === '15') {
        DOM.operandGroup.style.display = 'none';
        DOM.inputOperand.value = '';
    } else {
        DOM.operandGroup.style.display = 'block';
    }
}

// INIT
function init() {
    cacheDOMReferences();

    DOM.btnStep.addEventListener('click', stepOnce);
    DOM.btnRun.addEventListener('click', runProgram);
    DOM.btnReset.addEventListener('click', resetCPU);
    DOM.btnWrite.addEventListener('click', writeToRAM);
    DOM.btnLoadSample.addEventListener('click', loadSampleProgram);
    DOM.btnBuildFormula.addEventListener('click', buildFormulaProgram);
    DOM.btnClearLog.addEventListener('click', clearLog);
    DOM.inputOpcode.addEventListener('change', handleOpcodeChange);

    DOM.inputOperand.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase().replace(/[^0-9A-F]/g, '');
    });

    DOM.btnReset.addEventListener('click', () => {
        resetCPU();
        resetRAMTable();
        resetBuilderAndManualInputs();
    });

    DOM.speedSlider.addEventListener('input', () => {
        DOM.speedValue.textContent = DOM.speedSlider.value + 'ms';
        if (CPU.running && runInterval) {
            clearInterval(runInterval);
            runInterval = setInterval(() => {
                if (CPU.halted) {
                    clearInterval(runInterval);
                    runInterval = null;
                    CPU.running = false;
                    DOM.btnRun.textContent = '▶ Run';
                    DOM.btnStep.disabled = false;
                    updateStatusDisplay();
                    return;
                }
                executeTState();
            }, parseInt(DOM.speedSlider.value));
        }
    });

    const lo = document.getElementById('loadOp');
    if (lo) lo.value = '9';
    const st = document.getElementById('soundToggle');
    if (st) st.addEventListener('click', () => {
        SND.on = !SND.on;
        st.textContent = SND.on ? '🔊 Sound: ON' : '🔇 Sound: OFF';
        if (SND.on) sfx.tick();
    });

    updateAllDisplays();
    log('SAP-1 Simulator ready.', 'info');
}

document.addEventListener('DOMContentLoaded', init);


/* ===== MILKTEA THEME ===== */
(() => {
  const svg = (b) => `<svg viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="#2D232E" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${b}</svg>`;
  const pearls = (pts, r = 2.4) => `<g fill="#4a2f2a" stroke="none">${pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`;
  const ICONS = {
    pc: svg('<defs><clipPath id="pc-clip"><rect x="0" y="10" width="48" height="38"/></clipPath></defs><g clip-path="url(#pc-clip)"><g class="pc-ticket"><path d="M5 14h38v8a4 4 0 0 0 0 8v8H5v-8a4 4 0 0 0 0-8z" fill="#FFCED8"/><path d="M16 14v24" stroke-dasharray="2 3"/><circle cx="10.5" cy="26" r="1.6" fill="#FF5E8E" stroke="none"/><text class="pc-num" x="30" y="31" text-anchor="middle" font-size="11" font-weight="700" fill="#2D232E" stroke="none" font-family="Consolas,monospace">#00</text></g></g><rect x="3" y="5" width="42" height="6" rx="3" fill="#2D232E"/>'),
    mar: svg('<rect x="5" y="32" width="38" height="10" rx="3" fill="#FF5E8E"/><g class="mar-bell"><path d="M13 32a11 11 0 0 1 22 0z" fill="#FFE8C4"/><path d="M24 21v-3"/><circle cx="24" cy="15.5" r="2.5" fill="#FFCED8"/></g><g class="mar-waves" stroke="#FF5E8E"><path d="M9 17l-4-3M39 17l4-3M7 25H3M41 25h4"/></g>'),
    ram: svg('<path d="M6 22h36M6 40h36"/><rect x="9" y="8" width="7" height="14" rx="1.5" fill="#FFCED8"/><rect x="17" y="11" width="7" height="11" rx="1.5" fill="#FF5E8E"/><rect x="25" y="8" width="7" height="14" rx="1.5" fill="#FFE8C4"/><path d="M35 22l3-12 5 1-3 11z" fill="#FFCED8"/><rect x="9" y="27" width="10" height="13" rx="2" fill="#FFF4DE"/><path d="M11 27v-3h6v3"/><rect x="24" y="30" width="16" height="10" rx="1.5" fill="#FFE8C4"/><path d="M27 34h10M27 37h6"/>'),
    ir: svg('<path d="M11 5h26v38l-4.3-3-4.3 3-4.4-3-4.3 3-4.3-3z" fill="#fff"/><path d="M11 5h26v8H11z" fill="#FFCED8"/><path d="M16 20h16M16 26h16M16 32h9" stroke="#FF5E8E"/>'),
    a: svg('<defs><clipPath id="acc-clip"><path d="M11 14h26l-3 29H14z"/></clipPath></defs><g class="acc-cup"><path class="acc-straw" d="M31 11l4-8" stroke="#FF5E8E" stroke-width="3"/><path d="M11 14h26l-3 29H14z" fill="#FFF4DE"/><g clip-path="url(#acc-clip)"><rect class="acc-tea" x="8" y="24" width="34" height="19" fill="#E8C4A0" stroke="none"/></g>' + pearls([[19, 38], [25, 39], [30, 37], [22, 33], [28, 32]]).replace('<g ', '<g class="acc-pearls" ') + '<path d="M11 14h26l-3 29H14z"/><rect x="9" y="10" width="30" height="5" rx="2.5" fill="#FF5E8E"/></g>'),
    alu: svg('<g class="alu-shaker"><path d="M17 20h14l2 22H15z" fill="#FFE8C4"/><path d="M18 20v-6h12v6z" fill="#FF5E8E"/><path d="M21 14V9h6v5z" fill="#FFCED8"/><path class="alu-plus" d="M20 28h8M24 24v8"/><path class="alu-minus" d="M20 38h8"/></g><g class="alu-drops" fill="#FF5E8E" stroke="none"><circle cx="11" cy="14" r="1.8"/><circle cx="38" cy="11" r="1.8"/><circle cx="41" cy="21" r="1.4"/><circle cx="8" cy="24" r="1.4"/></g>'),
    b: svg('<g class="b-bowl"><path d="M6 26h36a18 16 0 0 1-36 0z" fill="#FFCED8"/>' + pearls([[15, 21], [22, 18], [29, 21], [35, 18], [25, 23]], 3) + '<path d="M6 26h36"/></g><rect x="31" y="5" width="7" height="7" rx="1.5" fill="#FF5E8E" transform="rotate(12 34 9)"/>' + pearls([[14, 4], [21, 2], [28, 4]], 3).replace('<g ', '<g class="b-drop" ')),
    ctrl: svg('<path d="M10 14l4 3M38 14l-4 3" stroke="#FF5E8E" stroke-width="3"/><circle cx="24" cy="28" r="14" fill="#fff"/><path d="M24 28v-9M24 28l6 3"/><rect x="21" y="7" width="6" height="4" rx="1" fill="#FF5E8E"/><path d="M24 11v3"/>'),
    bus: svg('<rect x="4" y="32" width="40" height="9" rx="4.5" fill="#2D232E"/><g fill="#FFE8C4"><circle cx="9" cy="36.5" r="3"/><circle cx="24" cy="36.5" r="3"/><circle cx="39" cy="36.5" r="3"/></g><path d="M19 15h10l-1.2 17h-7.6z" fill="#FFF4DE"/><rect x="18" y="12" width="12" height="4" rx="2" fill="#FF5E8E"/><path d="M34 21l5 4-5 4" stroke="#FF5E8E"/>'),
    out: svg('<defs><clipPath id="out-clip"><path d="M12 14h24l-3 22H15z"/></clipPath></defs><g class="out-cup"><path d="M33 8l3-6" stroke="#FF5E8E" stroke-width="3"/><path d="M12 14h24l-3 22H15z" fill="#FFF4DE"/><g clip-path="url(#out-clip)"><rect class="out-tea" x="8" y="21" width="32" height="15" fill="#E8C4A0" stroke="none"/></g><path d="M12 14h24l-3 22H15z"/><path d="M10 14a14 8 0 0 1 28 0z" fill="#FFCED8"/><path d="M24 31c-4-3-6-5-6-7a3 3 0 0 1 6-1 3 3 0 0 1 6 1c0 2-2 4-6 7z" fill="#FF5E8E" stroke="none"/></g><g class="out-pearls" fill="#FF5E8E" stroke="none"><circle cx="14" cy="42" r="3"/><circle cx="24" cy="42" r="3"/><circle cx="34" cy="42" r="3"/></g><path class="out-spark" d="M40 20l1.5 3 3 1.5-3 1.5L40 29l-1.5-3-3-1.5 3-1.5z" fill="#FFB3C1" stroke="none"/>'),
  };
  const TARGETS = [
    ['blockPC', 'pc', 'Customer Queue Ticket'], ['blockMAR', 'mar', 'Order Counter'], ['panelRAM', 'ram', 'Recipe Storage Shelf'],
    ['blockIR', 'ir', 'Current Order Ticket'], ['blockAcc', 'a', 'Main Mixing Cup / Blender'], ['blockALU', 'alu', 'Flavor & Topping Mixer'],
    ['blockB', 'b', 'Extra Toppings Slot'], ['blockController', 'ctrl', 'Master Barista / Timing Unit'],
    ['wbus', 'bus', 'Conveyor Belt / Serving Counter'], ['panelOUT', 'out', 'Final Served Cup & Pearl Indicators'],
  ];
  const css = document.createElement('style');
  css.textContent = `.mt-icon{display:block;width:54px;height:54px;margin:0 auto 6px;background:#FFF4DE;border:2px solid #FFCED8;border-radius:16px;padding:3px;box-shadow:0 3px 8px rgba(255,94,142,.25)}
.mt-icon.inline{display:inline-block;width:38px;height:38px;margin:0 8px 0 0;vertical-align:middle}.mt-icon svg{width:100%;height:100%;display:block}
.mt-name{display:inline-block;background:#FFF4DE;color:#2D232E;border-radius:999px;padding:2px 12px;font-weight:700;letter-spacing:.4px}
.mt-sub{display:inline-block;background:#FFE8C4;color:#2D232E;border:1px solid #FFCED8;border-radius:999px;padding:1px 10px;font-size:.68rem;font-weight:600;margin:3px 0 6px;text-transform:none;letter-spacing:normal}
.bus-arrow.active .arrow-line{background:#FF5E8E}.bus-arrow.active .arrow-head{color:#FF5E8E}
.wbus{position:relative;overflow:hidden;flex-wrap:wrap;min-width:380px}.wbus.active{border-color:#FF5E8E;box-shadow:0 0 18px rgba(255,94,142,.6)}
.mt-belt{position:relative;flex:0 0 100%;height:38px}
.mt-track{position:absolute;left:8px;right:8px;bottom:3px;height:9px;border-radius:5px;background:repeating-linear-gradient(90deg,#2D232E 0 10px,#5a4660 10px 20px);background-size:20px 100%}
.mt-roller{position:absolute;bottom:0;width:15px;height:15px;border-radius:50%;background:#FFE8C4;border:2px solid #2D232E}.mt-roller.l{left:0}.mt-roller.r{right:0}
.mt-cup{position:absolute;bottom:12px;left:12px;width:22px;height:26px}.mt-cup svg{display:block}
.wbus.active .mt-track{animation:belt-move .2s linear var(--spin,3)}
.wbus.active .mt-cup{animation:cup-ride var(--belt,800ms) linear 1 forwards}
@keyframes belt-move{to{background-position:20px 0}}
@keyframes cup-ride{from{left:12px}to{left:calc(100% - 34px)}}
@media(prefers-reduced-motion:reduce){.wbus.active .mt-track,.wbus.active .mt-cup{animation:none}}
.mar-bell,.b-bowl,.b-drop circle,.out-cup,.out-pearls circle,.out-spark,.out-tea{transform-box:fill-box}
.mar-bell{transform-origin:50% 100%}.mar-waves,.b-drop{opacity:0}.out-tea{transform-origin:50% 100%;transition:transform .6s ease-out}
.fx-mar .mar-bell{animation:bell-ring var(--fxdur,600ms) ease-in-out}.fx-mar .mar-waves{animation:fx-fade var(--fxdur,600ms) ease-out}
.fx-b .b-drop{opacity:1}.fx-b .b-drop circle{animation:pearl-fall var(--fxdur,600ms) ease-in both}
.fx-b .b-drop circle:nth-child(2){animation-delay:calc(var(--fxdur,600ms)*.15)}.fx-b .b-drop circle:nth-child(3){animation-delay:calc(var(--fxdur,600ms)*.3)}
.fx-b .b-bowl{animation:bowl-bump calc(var(--fxdur,600ms)*1.3) ease-out}
.fx-out .out-cup{animation:cup-hop var(--fxdur,600ms) ease-out}.fx-out .out-spark{animation:spark var(--fxdur,600ms) ease-out}
.fx-out .out-pearls circle{animation:pearl-bob var(--fxdur,600ms) ease-out}.fx-out .out-pearls circle:nth-child(2){animation-delay:80ms}.fx-out .out-pearls circle:nth-child(3){animation-delay:160ms}
@keyframes bell-ring{0%,100%{transform:rotate(0)}15%{transform:rotate(-16deg)}35%{transform:rotate(14deg)}55%{transform:rotate(-9deg)}75%{transform:rotate(5deg)}}
@keyframes fx-fade{0%{opacity:0}25%{opacity:1}100%{opacity:0}}
@keyframes pearl-fall{0%{transform:translateY(-26px);opacity:1}80%{opacity:1}100%{transform:translateY(15px);opacity:0}}
@keyframes bowl-bump{0%,65%{transform:scale(1)}80%{transform:scale(1.05,.93)}100%{transform:scale(1)}}
@keyframes cup-hop{0%,100%{transform:translateY(0)}40%{transform:translateY(-3px)}}
@keyframes spark{0%,100%{transform:scale(1)}50%{transform:scale(1.9) rotate(20deg)}}
@keyframes pearl-bob{0%,100%{transform:translateY(0)}40%{transform:translateY(-4px)}}
@media(prefers-reduced-motion:reduce){.fx-mar .mar-bell,.fx-mar .mar-waves,.fx-b .b-drop circle,.fx-b .b-bowl,.fx-out .out-cup,.fx-out .out-spark,.fx-out .out-pearls circle{animation:none}.out-tea{transition:none}}
.acc-cup,.acc-straw,.acc-pearls circle,.acc-tea,.alu-shaker,.alu-plus,.alu-minus{transform-box:fill-box}
.acc-tea{transform-origin:50% 100%;transition:transform .6s ease-out}.acc-straw{transform-origin:0% 100%}.alu-shaker{transform-origin:50% 80%}.alu-plus,.alu-minus{transform-origin:center}.alu-drops{opacity:0}
.fx-a .acc-cup{animation:cup-hop var(--fxdur,600ms) ease-out}.fx-a .acc-straw{animation:straw-wiggle var(--fxdur,600ms) ease-in-out}
.fx-a .acc-pearls circle{animation:pearl-bob var(--fxdur,600ms) ease-out}.fx-a .acc-pearls circle:nth-child(2n){animation-delay:70ms}.fx-a .acc-pearls circle:nth-child(3n){animation-delay:140ms}
.fx-alu .alu-shaker{animation:shake var(--fxdur,600ms) ease-in-out}.fx-alu .alu-drops{animation:fx-fade var(--fxdur,600ms) ease-out}
.fx-alu.alu-add .alu-plus,.fx-alu.alu-sub .alu-minus{stroke:#FF5E8E;stroke-width:3;animation:op-pop var(--fxdur,600ms) ease-out}
.fx-alu.alu-add .alu-minus,.fx-alu.alu-sub .alu-plus{opacity:.25}
@keyframes straw-wiggle{0%,100%{transform:rotate(0)}30%{transform:rotate(14deg)}60%{transform:rotate(-10deg)}}
@keyframes shake{0%,100%{transform:rotate(0)}10%{transform:rotate(-14deg)}25%{transform:rotate(12deg)}40%{transform:rotate(-10deg)}55%{transform:rotate(8deg)}70%{transform:rotate(-5deg)}85%{transform:rotate(3deg)}}
@keyframes op-pop{0%{transform:scale(1)}40%{transform:scale(1.6)}100%{transform:scale(1)}}
@media(prefers-reduced-motion:reduce){.fx-a .acc-cup,.fx-a .acc-straw,.fx-a .acc-pearls circle,.fx-alu .alu-shaker,.fx-alu .alu-drops,.fx-alu .alu-plus,.fx-alu .alu-minus{animation:none}.acc-tea{transition:none}}
.wbus.rev.active .mt-cup{animation-name:cup-ride-rev}.wbus.rev.active .mt-track{animation-name:belt-move-rev}
@keyframes cup-ride-rev{from{left:calc(100% - 34px)}to{left:12px}}
@keyframes belt-move-rev{to{background-position:-20px 0}}
.pc-ticket,.pc-num{transform-box:fill-box;transform-origin:center}
.pc-print .pc-ticket{animation:pc-print var(--pcdur,500ms) cubic-bezier(.2,.8,.3,1)}
.pc-print .pc-num{animation:pc-pop var(--pcdur,500ms) ease-out}
.pc-call .pc-ticket{animation:pc-call var(--pcdur,500ms) ease-in-out}
@keyframes pc-print{from{transform:translateY(-28px)}to{transform:translateY(0)}}
@keyframes pc-pop{0%,40%{transform:scale(.3);opacity:0}100%{transform:scale(1);opacity:1}}
@keyframes pc-call{0%,100%{transform:rotate(0) scale(1)}25%{transform:rotate(-8deg) scale(1.08)}60%{transform:rotate(7deg) scale(1.08)}}
@media(prefers-reduced-motion:reduce){.pc-print .pc-ticket,.pc-print .pc-num,.pc-call .pc-ticket{animation:none}}`;
  document.head.append(css);

  function themeOne([id, key, sub]) {
    const host = document.getElementById(id);
    const label = host && host.querySelector('.reg-label, .panel-header h2, .wbus-label');
    if (!label || host.dataset.mt) return;
    host.dataset.mt = 1;
    const tn = [...label.childNodes].find((n) => n.nodeType === 3 && n.textContent.trim());
    if (tn) {
      const name = document.createElement('span');
      name.className = 'mt-name';
      name.textContent = tn.textContent.replace(/^[^A-Za-z0-9(]+/, '').trim();
      tn.replaceWith(name);
    }
    let s = label.querySelector('.theme-subtitle');
    if (!s) { s = document.createElement('span'); label.append(s); }
    s.className = 'mt-sub';
    s.removeAttribute('style');
    s.textContent = sub;
    const ic = document.createElement('span');
    ic.className = 'mt-icon';
    ic.innerHTML = ICONS[key];
    if (label.matches('.reg-label')) label.before(ic);
    else { ic.classList.add('inline'); label.prepend(ic); }
  }
  function applyTheme() {
    TARGETS.forEach(themeOne);
    const bus = document.getElementById('wbus');
    if (bus && !bus.querySelector('.mt-belt')) {
      bus.insertAdjacentHTML('beforeend', '<div class="mt-belt" aria-hidden="true"><div class="mt-track"></div><span class="mt-roller l"></span><span class="mt-roller r"></span><div class="mt-cup"><svg viewBox="0 0 24 28" width="22" height="26" fill="none" stroke="#2D232E" stroke-width="1.6" stroke-linejoin="round"><path d="M17 5l2-4" stroke="#FF5E8E" stroke-width="2.4"/><path d="M4 7h16l-2 19H6z" fill="#FFF4DE"/><path d="M4.8 14h14.4l-1.2 12H6z" fill="#E8C4A0" stroke="none"/><path d="M4 7h16l-2 19H6z"/><rect x="3" y="4" width="18" height="4" rx="2" fill="#FF5E8E"/><g fill="#4a2f2a" stroke="none"><circle cx="9" cy="22" r="1.7"/><circle cx="13" cy="23" r="1.7"/><circle cx="16" cy="21" r="1.7"/></g></svg></div></div>');
    }
    const tea = document.querySelector('#panelOUT .out-tea');
    if (tea) { tea.setAttribute('y', 14); tea.setAttribute('height', 22); updateOutputCup(); }
    const acc = document.querySelector('#blockAcc .acc-tea');
    if (acc) { acc.setAttribute('y', 14); acc.setAttribute('height', 29); updateAccCup(); }
    const chip = document.querySelector('.chip-icon');
    if (chip) chip.innerHTML = '<span class="mt-icon inline" style="margin:0">' + ICONS.out + '</span>';
    let fav = document.querySelector('link[rel~="icon"]');
    if (!fav) { fav = document.createElement('link'); fav.rel = 'icon'; document.head.append(fav); }
    fav.href = 'data:image/svg+xml,' + encodeURIComponent(ICONS.out.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyTheme); else applyTheme();
})();

// === FLOATING BUBBLES BACKGROUND GENERATOR ===
document.addEventListener("DOMContentLoaded", () => {
    // Tinitiyak na may container sa bawat load ng page
    let activeContainer = document.getElementById("bubblesContainer");
    
    if (!activeContainer) {
        const bgDiv = document.createElement("div");
        bgDiv.className = "floating-bg";
        bgDiv.innerHTML = '<div class="bubbles-container" id="bubblesContainer"></div>';
        document.body.prepend(bgDiv);
        activeContainer = document.getElementById("bubblesContainer");
    }

    if (activeContainer && activeContainer.children.length === 0) {
        const bubbleCount = 30; // Bilang ng mga bula sa background
        for (let i = 0; i < bubbleCount; i++) {
            createBubble(activeContainer);
        }
    }
});

function createBubble(container) {
    const bubble = document.createElement("div");
    bubble.classList.add("bubble");

    const size = Math.random() * 40 + 10; // Laki mula 10px hanggang 50px
    const left = Math.random() * 100;    // Posisyon pahalang (%)
    const duration = Math.random() * 8 + 5; // Bilis ng pag-angat (5s hanggang 13s)
    const delay = Math.random() * 5;     // Delayed start para hindi sabay-sabay

    bubble.style.width = `${size}px`;
    bubble.style.height = `${size}px`;
    bubble.style.left = `${left}%`;
    bubble.style.animationDuration = `${duration}s`;
    bubble.style.animationDelay = `${delay}s`;

    container.appendChild(bubble);

    bubble.addEventListener("animationiteration", () => {
        bubble.style.left = `${Math.random() * 100}%`;
    });
}