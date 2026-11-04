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
    activeSignals: new Set()
};

const OPCODES = { LDA: 0, ADD: 1, SUB: 2, OUT: 14, HLT: 15 };
const OPCODE_NAMES = { 0: 'LDA', 1: 'ADD', 2: 'SUB', 14: 'OUT', 15: 'HLT' };

const DOM = {};
let runInterval = null;
let outputCount = 0;

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
        const opcode = (val >> 4) & 0xF;
        const operand = val & 0xF;

        let decoded = '';
        if (OPCODE_NAMES[opcode] !== undefined) {
            if (opcode === 14) decoded = 'OUT';
            else if (opcode === 15) decoded = 'HLT';
            else decoded = `${OPCODE_NAMES[opcode]} ${toHex1(operand)}H`;
        } else {
            decoded = `${toHex2(val)}H`;
        }

        tr.innerHTML = `
            <td>${toHex1(i)}H</td>
            <td>${toHex2(val)}H</td>
            <td style="font-size:0.7rem">${toBinary8(val)}</td>
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

function activateBus() { DOM.wbus.classList.add('active'); }
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
            CPU.tState = 1;
            CPU.cycleCount++;
            break;
        case OPCODES.HLT:
            CPU.halted = true;
            CPU.running = false;
            log(`HLT: Processor halted.`, 'halt');
            CPU.tState = 1;
            CPU.cycleCount++;
            updateStatusDisplay();
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
    
    // Hindi na mabubura ang history dahil tinanggal na natin ang pag-clear dito.
    
    clearBlockHighlights();
    updateAllDisplays();
    log('CPU Reset.', 'info');
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

    if (isNaN(valA) || isNaN(valB) || isNaN(valC)) {
        showLoaderStatus('Values must be valid Hex (00-FF)', 'error');
        return;
    }

    CPU.RAM.fill(0);
    const loadInstruction = 0x00 | ldaSourceAddr;
    const opCode1 = (op1 === 'ADD') ? 0x1A : 0x2A;
    const opCode2 = (op2 === 'ADD') ? 0x1B : 0x2B;

    CPU.RAM[0x0] = loadInstruction;
    CPU.RAM[0x1] = opCode1;
    CPU.RAM[0x2] = opCode2;
    CPU.RAM[0x3] = 0xEF;
    CPU.RAM[0x4] = 0xFF;
    CPU.RAM[ldaSourceAddr] = valA & 0xFF;
    CPU.RAM[0xA] = valB & 0xFF;
    CPU.RAM[0xB] = valC & 0xFF;

    resetCPU();
    const s1 = op1 === 'ADD' ? '+' : '−';
    const s2 = op2 === 'ADD' ? '+' : '−';
    showLoaderStatus(`Loaded: ${hexA}H ${s1} ${hexB}H ${s2} ${hexC}H`, 'success');
    log(`Formula loaded: ${hexA}H ${s1} ${hexB}H ${s2} ${hexC}H`, 'info');
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
    updateRAMDisplay();
    showLoaderStatus(`Wrote ${toHex2(byteValue)}H to ${toHex1(addr)}H`, 'success');
    log(`RAM[${toHex1(addr)}H] ← ${toHex2(byteValue)}H`, 'info');
}

function loadSampleProgram() {
    CPU.RAM.fill(0);
    CPU.RAM[0x0] = 0x09;
    CPU.RAM[0x1] = 0x1A;
    CPU.RAM[0x2] = 0x2B;
    CPU.RAM[0x3] = 0xEF;
    CPU.RAM[0x4] = 0xFF;
    CPU.RAM[0x9] = 0x25;
    CPU.RAM[0xA] = 0x05;
    CPU.RAM[0xB] = 0x23;
    resetCPU();
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

    updateAllDisplays();
    log('SAP-1 Simulator ready.', 'info');
}

document.addEventListener('DOMContentLoaded', init);