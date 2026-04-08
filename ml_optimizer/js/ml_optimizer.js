/* ═══════════════════════════════════════════════════════
   ML-GUIDED OPTIMIZER
   
   Integrates ML model prediction with optimization engine.
   
   Strategy:
   1. Extract features from TAC
   2. Normalize features
   3. Run ML model to predict best optimization pass
   4. Apply predicted optimization
   5. Return optimized TAC
═══════════════════════════════════════════════════════ */

// Default pre-trained model weights (trained on synthetic dataset)
// Format: LogisticRegressionClassifier JSON
const DEFAULT_MODEL_WEIGHTS = {
  inputSize: 10,
  numClasses: 6,
  learningRate: 0.01,
  weights: [
    // Class 0: None
    [-0.12, 0.05, -0.08, 0.03, -0.06, 0.02, 0.01, -0.04, 0.05, -0.03, 0.02],
    // Class 1: Constant Folding
    [0.18, 0.12, 0.15, -0.05, -0.08, 0.04, 0.02, -0.06, 0.35, -0.12, 0.08],
    // Class 2: Dead Code Elimination
    [0.10, 0.22, 0.05, 0.08, 0.05, -0.03, 0.01, -0.04, -0.08, 0.42, 0.15],
    // Class 3: Common Subexpression Elimination
    [0.15, 0.18, 0.20, -0.03, -0.04, 0.02, 0.01, 0.38, 0.12, -0.10, 0.06],
    // Class 4: Loop Invariant Code Motion
    [-0.05, 0.08, 0.10, 0.12, 0.25, 0.35, 0.22, 0.08, -0.05, -0.15, 0.04],
    // Class 5: Loop Unrolling
    [-0.08, 0.05, 0.08, 0.10, 0.20, 0.30, 0.25, 0.05, 0.05, -0.12, 0.03]
  ],
  loss_history: [],
  epoch_history: []
};

// Feature normalization params (from training dataset)
const FEATURE_STATS = {
  mean: [25, 8, 12, 4, 6, 2, 1, 3, 2, 4],
  std:  [15, 6, 8, 3, 5, 2, 1, 2, 2, 3]
};

const OPTIMIZATION_NAMES = [
  'None',
  'Constant Folding',
  'Dead Code Elimination',
  'Common Subexpression Elimination',
  'Loop Invariant Code Motion',
  'Loop Unrolling'
];

/**
 * ML-guided TAC optimizer
 * Combines traditional passes with ML prediction
 */
function optimizeTACWithML(ir, useML = true) {
  let opt = cloneIR(ir);
  const report = {
    passes: [],
    totalHits: 0,
    rounds: 0,
    original_count: ir.filter(c => c.op !== 'label' && c.op !== 'func').length,
    optimized_count: 0,
    ml_prediction: null,
    ml_confidence: 0
  };

  // Extract features
  const { raw: rawFeatures, vector: featureVector } = extractFeatures(ir);
  report.ml_features = rawFeatures;

  // ML-guided optimization
  if (useML) {
    try {
      // Load pre-trained model
      const model = LogisticRegressionClassifier.fromJSON(DEFAULT_MODEL_WEIGHTS);
      
      // Normalize features
      const normalizedFeatures = featureVector.map((val, i) => {
        const s = FEATURE_STATS.std[i];
        return s > 0 ? (val - FEATURE_STATS.mean[i]) / s : 0;
      });
      
      // Predict
      const prediction = model.predictWithConfidence(normalizedFeatures);
      const optClass = prediction.class;
      
      report.ml_prediction = OPTIMIZATION_NAMES[optClass];
      report.ml_confidence = prediction.confidence;

      // Log prediction
      report.passes.push({
        round: 0,
        pass: `ML Prediction (${OPTIMIZATION_NAMES[optClass]})`,
        detail: `Confidence: ${(prediction.confidence * 100).toFixed(1)}%`
      });

      // Apply predicted optimization once
      if (optClass === 1) {
        // Constant Folding
        const res = passConstantFolding(opt);
        if (res.changed) {
          res.hits.forEach(h => report.passes.push({
            round: 1, pass: 'Constant Folding', detail: h
          }));
          report.totalHits += res.hits.length;
        }
      } else if (optClass === 2) {
        // Dead Code Elimination
        const res = passDeadCode(opt);
        if (res.changed) {
          res.hits.forEach(h => report.passes.push({
            round: 1, pass: 'Dead Code Elimination', detail: h
          }));
          report.totalHits += res.hits.length;
        }
      } else if (optClass === 3) {
        // Common Subexpression Elimination
        const res = passCSE(opt);
        if (res.changed) {
          res.hits.forEach(h => report.passes.push({
            round: 1, pass: 'CSE', detail: h
          }));
          report.totalHits += res.hits.length;
        }
      } else if (optClass === 4 || optClass === 5) {
        // Loop optimizations: apply CSE first
        const res = passCSE(opt);
        if (res.changed) {
          res.hits.forEach(h => report.passes.push({
            round: 1, pass: 'CSE (loop preparation)', detail: h
          }));
          report.totalHits += res.hits.length;
        }
      }
    } catch (e) {
      console.warn('ML prediction failed:', e.message);
    }
  }

  // Always apply fundamental passes (in order)
  const MAX_ROUNDS = 5;
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    let anyChange = false;

    const runs = [
      { name: 'Constant Folding', fn: passConstantFolding },
      { name: 'Constant Propagation', fn: passConstantPropagation },
      { name: 'Copy Propagation', fn: passCopyPropagation },
      { name: 'CSE', fn: passCSE },
      { name: 'Branch Folding', fn: passBranchFolding },
      { name: 'Unreachable Code Elim', fn: passUnreachable },
      { name: 'Dead Code Elimination', fn: passDeadCode },
    ];

    runs.forEach(({ name, fn }) => {
      const { changed, hits } = fn(opt);
      if (changed) {
        anyChange = true;
        hits.forEach(h => report.passes.push({
          round: round + 1, pass: name, detail: h
        }));
        report.totalHits += hits.length;
      }
    });

    report.rounds++;
    if (!anyChange) break;
  }

  report.optimized_count = opt.filter(c => c.op !== 'label' && c.op !== 'func').length;
  return { optimizedIR: opt, report };
}

/**
 * Renders ML prediction result with feature visualization
 */
function renderMLPrediction(report) {
  if (!report.ml_prediction) return '';

  const confColor = report.ml_confidence > 0.7 ? '#10b981' 
                  : report.ml_confidence > 0.5 ? '#f59e0b' 
                  : '#ef4444';

  const featureRows = Object.entries(report.ml_features || {}).map(([key, val]) => 
    `<tr>
      <td style="font-size:11px;color:var(--text2);padding:4px 8px">${key.replace(/_/g, ' ')}</td>
      <td style="font-size:11px;color:var(--text1);padding:4px 8px;text-align:right;font-weight:500">${val}</td>
    </tr>`
  ).join('');

  return `
<div style="background:linear-gradient(135deg,${confColor}18,${confColor}08);
    border:1px solid ${confColor}44;border-radius:8px;padding:12px;margin-bottom:14px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
    <div style="font-size:12px;font-weight:600;color:var(--text1)">ML Prediction</div>
    <div style="background:${confColor}44;border:1px solid ${confColor};color:${confColor};
        border-radius:12px;padding:2px 10px;font-size:11px;font-weight:600">
      ${report.ml_prediction}
    </div>
  </div>
  <div style="display:flex;gap:10px">
    <div style="flex:1">
      <div style="font-size:10px;color:var(--text3);margin-bottom:4px">Confidence</div>
      <div style="width:100%;height:8px;background:var(--bg2);border-radius:4px;overflow:hidden">
        <div style="width:${Math.round(report.ml_confidence * 100)}%;height:100%;background:${confColor}"></div>
      </div>
      <div style="font-size:10px;color:var(--text2);margin-top:2px">${(report.ml_confidence * 100).toFixed(1)}%</div>
    </div>
    <details style="flex:1">
      <summary style="cursor:pointer;font-size:11px;color:var(--text3);user-select:none">Features</summary>
      <table style="border-collapse:collapse;width:100%;margin-top:6px;font-size:10px">
        <tbody>${featureRows}</tbody>
      </table>
    </details>
  </div>
</div>`;
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    optimizeTACWithML,
    renderMLPrediction,
    OPTIMIZATION_NAMES,
    DEFAULT_MODEL_WEIGHTS,
    FEATURE_STATS
  };
}
