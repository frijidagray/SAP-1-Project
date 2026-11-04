# SAP-1 Architecture Simulator

A web-based interactive simulator for the **Simple-As-Possible 1 (SAP-1)** computer architecture. This tool visually demonstrates the fetch-decode-execute instruction cycle, micro-control signals, register operations, and W-BUS data flow in real-time.

---

## 🌐 Live Website & Repository
* **Live Simulator:** https://frijidagray.github.io/SAP-1-Project/
* **GitHub Repository:** https://github.com/frijidagray/SAP-1-Project

---

## 🛠️ Technology Stack & Justification

* **Frontend:** HTML5, CSS3, JavaScript (Vanilla - ES6+)
* **Framework Used:** None (No Framework)

### Justification:
The SAP-1 is a minimalist 8-bit computer architecture designed to teach low-level hardware fundamentals. We chose **Vanilla HTML/CSS/JavaScript** without heavy frameworks (like React or Vue) for the following reasons:
1. **Direct DOM Manipulation & Low Overhead:** Real-time updates to register displays, LED indicators, and control signal highlights happen directly at the micro-operation level without virtual DOM diffing overhead.
2. **Zero Dependencies & High Portability:** Runs directly in any modern browser without needing build steps or external bundlers.
3. **Architectural Clarity:** The code structure maps cleanly to the physical SAP-1 block diagram components (PC, MAR, IR, Controller-Sequencer, ALU, A/B Registers, W-BUS).

---

## 📖 Supported SAP-1 Instruction Set

| Mnemonic | Opcode (Binary) | Description |
| :--- | :---: | :--- |
| **LDA** | `0000` | Load Accumulator with data from RAM address |
| **ADD** | `0001` | Add RAM address content to Accumulator |
| **SUB** | `0010` | Subtract RAM address content from Accumulator (2's Complement) |
| **OUT** | `1110` | Load Accumulator content into Output Register |
| **HLT** | `1111` | Stop the Controller-Sequencer execution cycle |

---

## 🎮 Features
* **Formula Builder:** Automatically generates assembly machine code into RAM for formulas like A ± B ± C.
* **Dynamic LDA Address Selection:** Allows users to choose custom RAM addresses (ranging from `0H` to `FH`) for the `LDA` instruction directly through an interactive UI dropdown.
* **Dynamic Program Flow & Control:** Automatically handles instruction alignment, including data storage, `OUT`, and `HLT` placements depending on the formula length.
* **Real-time Bus & Control Signals:** Visual glow on active data transfers and control signals (`Ep`, `Lm`, `CE`, `Li`, `Ea`, `La`, `Su`, `Eu`, `Lb`, `Lo`).
* **8-bit Binary LED Display:** Visual circle indicators simulating physical hardware output LEDs.
* **T-State Micro-Step Inspection:** Execute clock cycles state-by-state (`T1` through `T6`) or run automatically with adjustable clock speed.

---

## 👥 Group Members
* Member 1 Gulane, John Rey
* Member 2 Jose, Laurence
* Member 3 Manalang, jan Vincent
* Member 4 Yabut, Emannuelle
* Member 5 Zamora, Ma. Frijida Grey

*Course: Computer Architecture and Organization*
