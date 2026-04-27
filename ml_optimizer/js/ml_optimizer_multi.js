

let mlModelManager = null;

async function initializeMLModels() {
  try {
    let data;
    
    if (typeof TRAINED_MODELS_JSON !== 'undefined') {
      data = TRAINED_MODELS_JSON;
    } else {
      
      const response = await fetch('ml_optimizer/js/trained_models.json');
      if (response.ok) {
        data = await response.json();
      }
    }

    if (data) {
      mlModelManager = new MLModelManager();
      mlModelManager.loadFromJSON(data);
      console.log('✓ Loaded multi-model ML system');
      return true;
    }
  } catch (e) {
    console.error('Multi-model initialization failed:', e);
    console.log('Multi-model system not available, using single model fallback');
  }
  
  return false;
}

const OPTIMIZATION_NAMES = [
  'None',
  'Constant Folding',
  'Dead Code Elimination',
  'Common Subexpression Elimination',
  'Loop Invariant Code Motion',
  'Loop Unrolling'
];

function optimizeTACWithML(ir, useML = true) {
  let opt = cloneIR(ir);
  const report = {
    passes: [],
    totalHits: 0,
    rounds: 0,
    original_count: ir.filter(c => c.op !== 'label' && c.op !== 'func').length,
    optimized_count: 0,
    ml_prediction: null,
    ml_confidence: 0,
    ml_report: null,
    useMultiModel: false
  };

  const { raw: rawFeatures, vector: featureVector } = extractFeatures(ir);
  report.ml_features = rawFeatures;

  if (useML && mlModelManager) {
    try {
      report.useMultiModel = true;

      const comparison = mlModelManager.getModelComparison(featureVector);
      report.ml_report = comparison;

      const [bestModelName, bestPred] = comparison.best;
      const optClass = bestPred[0].class;
      
      report.ml_prediction = bestPred[0].className;
      report.ml_confidence = bestPred[0].confidence;
      report.ml_best_model = bestModelName;

      comparison.comparison.forEach(comp => {
        report.passes.push({
          round: 0,
          pass: `${comp.model} → ${comp.prediction}`,
          detail: `Confidence: ${comp.confidence} | Model Accuracy: ${comp.modelAccuracy}`
        });
      });

      applyOptimization(opt, optClass, report);
      
    } catch (e) {
      console.warn('Multi-model prediction failed:', e.message);
      
    }
  } else if (useML) {
    
    try {
      const model = LogisticRegressionClassifier.fromJSON(DEFAULT_MODEL_WEIGHTS);
      const normalizedFeatures = normalizeFeatures(featureVector);
      const prediction = model.predictWithConfidence(normalizedFeatures);
      const optClass = prediction.class;
      
      report.ml_prediction = OPTIMIZATION_NAMES[optClass];
      report.ml_confidence = prediction.confidence;

      report.passes.push({
        round: 0,
        pass: `ML Prediction (${OPTIMIZATION_NAMES[optClass]})`,
        detail: `Confidence: ${(prediction.confidence * 100).toFixed(1)}%`
      });

      applyOptimization(opt, optClass, report);
      
    } catch (e) {
      console.warn('ML prediction failed:', e.message);
    }
  }

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

  window.lastMLReport = report;
  
  return { optimizedIR: opt, report };
}

function applyOptimization(ir, optClass, report) {
  if (optClass === 1) {
    const res = passConstantFolding(ir);
    if (res.changed) {
      res.hits.forEach(h => report.passes.push({
        round: 1, pass: 'Constant Folding', detail: h
      }));
      report.totalHits += res.hits.length;
    }
  } else if (optClass === 2) {
    const res = passDeadCode(ir);
    if (res.changed) {
      res.hits.forEach(h => report.passes.push({
        round: 1, pass: 'Dead Code Elimination', detail: h
      }));
      report.totalHits += res.hits.length;
    }
  } else if (optClass === 3) {
    const res = passCSE(ir);
    if (res.changed) {
      res.hits.forEach(h => report.passes.push({
        round: 1, pass: 'CSE', detail: h
      }));
      report.totalHits += res.hits.length;
    }
  } else if (optClass === 4 || optClass === 5) {
    const res = passCSE(ir);
    if (res.changed) {
      res.hits.forEach(h => report.passes.push({
        round: 1, pass: 'CSE (loop preparation)', detail: h
      }));
      report.totalHits += res.hits.length;
    }
  }
}

function normalizeFeatures(featureVector) {
  const FEATURE_STATS = {
    mean: [50, 15, 20, 10, 12, 3, 2, 5, 4, 8],
    std:  [25, 10, 12, 8, 10, 2, 2, 3, 3, 5]
  };

  return featureVector.map((val, i) => {
    const s = FEATURE_STATS.std[i];
    return s > 0 ? (val - FEATURE_STATS.mean[i]) / s : 0;
  });
}

const DEFAULT_MODEL_WEIGHTS = {
  inputSize: 10,
  numClasses: 6,
  learningRate: 0.01,
  weights: [
    [-0.12, 0.05, -0.08, 0.03, -0.06, 0.02, 0.01, -0.04, 0.05, -0.03, 0.02],
    [0.18, 0.12, 0.15, -0.05, -0.08, 0.04, 0.02, -0.06, 0.35, -0.12, 0.08],
    [0.10, 0.22, 0.05, 0.08, 0.05, -0.03, 0.01, -0.04, -0.08, 0.42, 0.15],
    [0.15, 0.18, 0.20, -0.03, -0.04, 0.02, 0.01, 0.38, 0.12, -0.10, 0.06],
    [-0.05, 0.08, 0.10, 0.12, 0.25, 0.35, 0.22, 0.08, -0.05, -0.15, 0.04],
    [-0.08, 0.05, 0.08, 0.10, 0.20, 0.30, 0.25, 0.05, 0.05, -0.12, 0.03]
  ],
  loss_history: [],
  epoch_history: []
};

function renderMLPrediction(report) {
  if (!report.ml_prediction) return '';

  const confColor = report.ml_confidence > 0.7 ? '#10b981' 
                  : report.ml_confidence > 0.5 ? '#f59e0b' 
                  : '#ef4444';

  let html = `
<div style="background:linear-gradient(135deg,${confColor}18,${confColor}08);
    border:1px solid ${confColor}44;border-radius:8px;padding:12px;margin-bottom:14px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
    <div style="font-size:12px;font-weight:600;color:var(--text1)">ML-Guided Optimization</div>
    <div style="background:${confColor}44;border:1px solid ${confColor};color:${confColor};
        border-radius:12px;padding:2px 10px;font-size:11px;font-weight:600">
      ${report.ml_prediction}
    </div>
  </div>
`;

  if (report.useMultiModel && report.ml_best_model) {
    html += `
  <div style="font-size:10px;color:var(--text2);margin-bottom:8px">
    🤖 Model: <strong>${report.ml_best_model}</strong> | 
    Confidence: <strong>${(report.ml_confidence * 100).toFixed(1)}%</strong>
  </div>`;
  }

  if (report.ml_report && report.ml_report.comparison.length > 0) {
    html += `
  <div style="margin-top:8px;padding-top:8px;border-top:1px solid ${confColor}33;font-size:10px">
    <div style="font-weight:600;color:var(--text1);margin-bottom:6px">Model Comparison:</div>
    <table style="width:100%;font-size:10px;color:var(--text2)">
      <tr style="border-bottom:1px solid ${confColor}22">
        <th style="text-align:left;padding:4px;color:var(--text1)">Model</th>
        <th style="text-align:left;padding:4px;color:var(--text1)">Prediction</th>
        <th style="text-align:right;padding:4px;color:var(--text1)">Conf.</th>
        <th style="text-align:right;padding:4px;color:var(--text1)">Acc.</th>
      </tr>`;
    
    report.ml_report.comparison.forEach(comp => {
      html += `
      <tr style="border-bottom:1px solid ${confColor}11">
        <td style="padding:4px;font-weight:500">${comp.model}</td>
        <td style="padding:4px">${comp.prediction.substring(0, 10)}</td>
        <td style="text-align:right;padding:4px">${comp.confidence}</td>
        <td style="text-align:right;padding:4px">${comp.modelAccuracy}</td>
      </tr>`;
    });
    
    html += `</table></div>`;
  }

  if (report.ml_features) {
    const featureRows = Object.entries(report.ml_features).map(([key, val]) => 
      `<tr>
        <td style="font-size:10px;color:var(--text2);padding:3px 6px">${key.replace(/_/g, ' ')}</td>
        <td style="font-size:10px;color:var(--text1);padding:3px 6px;text-align:right;font-weight:500">${val}</td>
      </tr>`
    ).join('');

    html += `
  <div style="margin-top:8px;padding-top:8px;border-top:1px solid ${confColor}33">
    <div style="font-weight:600;color:var(--text1);margin-bottom:6px;font-size:10px">Extracted Features:</div>
    <table style="width:100%;font-size:9px">${featureRows}</table>
  </div>`;
  }

  html += `</div>`;
  return html;
}
