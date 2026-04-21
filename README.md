# SmartC — ML-Guided Mini C Compiler

> A browser-based mini C compiler that visualizes all compiler phases and applies **ML-guided TAC optimization**.

<p>
  <img alt="language" src="https://img.shields.io/badge/JavaScript-Vanilla-yellow" />
  <img alt="ml" src="https://img.shields.io/badge/ML-Logistic%20Regression-blue" />
  <img alt="backend" src="https://img.shields.io/badge/Backend-None%20(browser%20runtime)-brightgreen" />
  <img alt="python" src="https://img.shields.io/badge/Python-Training%20pipeline-3776AB" />
</p>

---

## Why this project?

SmartC is designed for learning, demos, and experimentation with compiler internals. You can:

- Write C-like code in the browser
- See each compilation phase output in real time
- Compare original TAC vs optimized TAC
- Use a custom ML model to guide optimization strategy selection

---

## Features

- Full visual pipeline from source code to execution
- TAC-based intermediate representation
- Traditional optimization passes (constant folding, propagation, CSE, DCE, etc.)
- ML-guided pass selection using a model implemented from scratch
- Optimized assembly preview
- Browser-first workflow (no complex app framework required)

---

## Compiler pipeline

SmartC runs these phases in order:

1. **Lexer** — Source → Tokens
2. **Parser** — Tokens → AST
3. **Semantic Analysis** — Type/symbol checks
4. **IR Generation** — AST → TAC
5. **Code Generation** — TAC → pseudo assembly
6. **Execution** — Simulated runtime
7. **TAC Optimizer** — Traditional + ML-guided optimization

---

## Project structure

```text
.
├── index.html
├── styles.css
├── compiler_driver.js
├── phase0_utils.js
├── phase1_lexer.js
├── phase2_parser.js
├── phase3_semantic.js
├── phase4_ir.js
├── phase5_codegen.js
├── phase6_execute.js
├── phase7_optimizer.js
└── ml_optimizer/
    ├── js/
    │   ├── feature_extractor.js
    │   ├── model.js
    │   ├── ml_optimizer.js
    │   ├── tac_to_c.js
    │   └── integration.js
    └── py/
        ├── train.py
        └── dataset.py
```

---

## Quick start

Run the website locally:

```bash
cd /Users/devank/Downloads/cd/cd
python3 -m http.server 8000
```

Open in browser:

- `http://localhost:8000`

---

## Train the ML model

The training pipeline currently uses synthetic data, trains multiclass logistic regression, evaluates it, and exports model weights.

```bash
cd /Users/devank/Downloads/cd/cd
python3 -m pip install numpy
python3 ml_optimizer/py/train.py
```

Generated model file:

- `ml_optimizer/js/trained_model.json`

---

## How ML is integrated

- `compiler_driver.js` calls `optimizeTACWithML(ir, true)` during Phase 7 when available.
- `ml_optimizer/js/ml_optimizer.js`:
  - loads model weights with `LogisticRegressionClassifier.fromJSON(...)`
  - predicts the optimization class with `predictWithConfidence(...)`
  - applies selected strategy, then runs core optimization rounds

Fallback behavior:

- If ML path is unavailable, SmartC falls back to traditional optimizer logic.

---

## Typical workflow

1. Open the app in browser.
2. Select or write C-like code in the editor.
3. Click **Compile & Run**.
4. Expand each phase card to inspect internal outputs.
5. Use Phase 7 to inspect optimization effects.

---

## Notes

- Supports a mini-C subset intended for education/demo use.
- Assembly output is pseudo x86-like (not native machine code).
- Dataset integration utilities are available in `ml_optimizer/py/dataset.py`.

---

## Troubleshooting

- Blank page: verify script paths in `index.html`.
- Python errors during training: ensure Python 3 and `numpy` are installed.
- Port conflict: use another port (for example, `8080`).

---

## Contributing

Contributions are welcome. Good areas to improve:

- Broader C subset support
- Better optimization heuristics and pass scheduling
- Real dataset-driven model training and evaluation
- Additional compiler diagnostics and visualizations

---

## License

No `LICENSE` file is currently present in this repository.
If you plan to distribute or accept external contributions, add one.
