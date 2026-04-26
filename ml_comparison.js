/* ═══════════════════════════════════════════════════════
   ML MODEL COMPARISON PANEL
   
   Displays all 4 models with:
   - Individual predictions
   - Confidence scores
   - Model accuracy metrics
   - Optimization results comparison
   - Feature analysis
═══════════════════════════════════════════════════════ */

/**
 * Render comprehensive ML model comparison
 */
function renderMLComparison(report) {
  const container = document.getElementById('out-8');
  
  if (!report || !report.ml_report) {
    container.innerHTML = '<span style="color:var(--text3)">No ML analysis available</span>';
    return;
  }

  const comparison = report.ml_report;
  const bestModel = comparison.best[0];
  const allPredictions = comparison.all;
  const comparisonData = comparison.comparison || [];

  let html = `
    <div style="display:flex; flex-direction:column; gap:15px;">
      
      <!-- Best Model Highlight -->
      <div style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding:12px; border-radius:8px; color:white;">
        <div style="font-weight:bold; margin-bottom:8px;">🏆 BEST MODEL SELECTED</div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; font-size:13px;">
          <div><strong>Model:</strong> ${bestModel}</div>
          <div><strong>Prediction:</strong> ${comparison.best[1][0].className}</div>
          <div><strong>Confidence:</strong> ${(comparison.best[1][0].confidence * 100).toFixed(1)}%</div>
          <div><strong>Model Accuracy:</strong> ${(comparison.best[1][0].modelAccuracy * 100).toFixed(2)}%</div>
        </div>
      </div>

      <!-- All Models Predictions Table -->
      <div style="border-left:3px solid var(--blue-bd); padding-left:10px;">
        <div style="font-weight:bold; margin-bottom:8px; color:var(--text1);">📊 ALL MODELS PREDICTIONS</div>
        <table style="width:100%; border-collapse:collapse; font-size:12px;">
          <thead>
            <tr style="background:var(--gray-bg); border-bottom:1px solid var(--gray-bd);">
              <th style="padding:8px; text-align:left; border-right:1px solid var(--gray-bd);">Model</th>
              <th style="padding:8px; text-align:left; border-right:1px solid var(--gray-bd);">Prediction</th>
              <th style="padding:8px; text-align:left; border-right:1px solid var(--gray-bd);">Confidence</th>
              <th style="padding:8px; text-align:left;">Model Accuracy</th>
            </tr>
          </thead>
          <tbody>
            ${comparisonData.map((item, idx) => {
              const isHighlight = item.model === bestModel;
              const bgColor = isHighlight ? 'rgba(102, 126, 234, 0.1)' : (idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)');
              const fontWeight = isHighlight ? 'bold' : 'normal';
              
              // Parse the percentage strings from multi_models.js
              const confidenceVal = parseFloat(item.confidence) / 100;
              const accuracyVal = parseFloat(item.modelAccuracy) / 100;
              
              return `
                <tr style="background:${bgColor}; border-bottom:1px solid var(--gray-bd);">
                  <td style="padding:8px; border-right:1px solid var(--gray-bd); font-weight:${fontWeight};">
                    ${isHighlight ? '⭐ ' : ''}${item.model}
                  </td>
                  <td style="padding:8px; border-right:1px solid var(--gray-bd); color:var(--text1);">
                    ${item.prediction}
                  </td>
                  <td style="padding:8px; border-right:1px solid var(--gray-bd);">
                    <div style="display:flex; align-items:center; gap:5px;">
                      <div style="width:60px; height:6px; background:var(--gray-bg); border-radius:3px; overflow:hidden;">
                        <div style="width:${confidenceVal * 100}%; height:100%; background:linear-gradient(90deg, #667eea, #764ba2);"></div>
                      </div>
                      <span>${item.confidence}</span>
                    </div>
                  </td>
                  <td style="padding:8px;">
                    <div style="display:flex; align-items:center; gap:5px;">
                      <div style="width:60px; height:6px; background:var(--gray-bg); border-radius:3px; overflow:hidden;">
                        <div style="width:${accuracyVal * 100}%; height:100%; background:#4CAF50;"></div>
                      </div>
                      <span>${item.modelAccuracy}</span>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- Model Details Cards -->
      <div style="border-left:3px solid var(--green-bd); padding-left:10px;">
        <div style="font-weight:bold; margin-bottom:8px; color:var(--text1);">🔍 MODEL DETAILS</div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:10px;">
          ${comparisonData.map(item => createModelCard(item, bestModel === item.model)).join('')}
        </div>
      </div>

      <!-- Consensus Analysis -->
      <div style="border-left:3px solid var(--amber-bd); padding-left:10px;">
        <div style="font-weight:bold; margin-bottom:8px; color:var(--text1);">🎯 CONSENSUS ANALYSIS</div>
        ${renderConsensusAnalysis(comparisonData)}
      </div>

      <!-- Feature Analysis -->
      ${report.ml_features ? renderFeatureAnalysis(report.ml_features) : ''}

      <!-- Optimization Comparison -->
      ${renderOptimizationComparison(report)}
    </div>
  `;

  container.innerHTML = html;
}

/**
 * Create individual model card
 */
function createModelCard(modelData, isBest) {
  const colors = {
    'Logistic Regression': { bg: '#667eea', light: 'rgba(102, 126, 234, 0.1)' },
    'Decision Tree': { bg: '#f093fb', light: 'rgba(240, 147, 251, 0.1)' },
    'Random Forest': { bg: '#4CAF50', light: 'rgba(76, 175, 80, 0.1)' },
    'Neural Network': { bg: '#FF9800', light: 'rgba(255, 152, 0, 0.1)' }
  };
  
  const color = colors[modelData.model] || { bg: '#999', light: 'rgba(0,0,0,0.1)' };
  const border = isBest ? `3px solid ${color.bg}` : '1px solid var(--gray-bd)';
  const shadow = isBest ? '0 4px 12px rgba(0,0,0,0.15)' : '0 2px 4px rgba(0,0,0,0.05)';
  
  // Parse string percentages from multi_models.js
  const confidenceVal = parseFloat(modelData.confidence) / 100;
  const accuracyVal = parseFloat(modelData.modelAccuracy) / 100;
  const colorCode = accuracyVal > 0.85 ? '#4CAF50' : accuracyVal > 0.5 ? '#FF9800' : '#f44336';

  return `
    <div style="
      border:${border}; 
      border-radius:8px; 
      padding:12px; 
      background:${color.light};
      box-shadow:${shadow};
      transition:all 0.3s ease;
    ">
      <div style="font-weight:bold; color:${color.bg}; margin-bottom:8px; display:flex; align-items:center; gap:5px;">
        <span style="width:12px; height:12px; border-radius:50%; background:${color.bg};"></span>
        ${modelData.model}
      </div>
      <div style="font-size:12px; color:var(--text2); display:flex; flex-direction:column; gap:6px;">
        <div><strong>Prediction:</strong> <span style="color:var(--text1);">${modelData.prediction}</span></div>
        <div><strong>Confidence:</strong> <span style="color:var(--text1);">${modelData.confidence}</span></div>
        <div><strong>Accuracy:</strong> <span style="color:${colorCode}; font-weight:bold;">${modelData.modelAccuracy}</span></div>
      </div>
      ${isBest ? `<div style="margin-top:8px; padding-top:8px; border-top:1px solid ${color.bg}; color:${color.bg}; font-size:11px; font-weight:bold;">⭐ SELECTED</div>` : ''}
    </div>
  `;
}

/**
 * Render consensus analysis
 */
function renderConsensusAnalysis(comparisonData) {
  const predictions = comparisonData.map(c => c.prediction);
  const uniquePredictions = [...new Set(predictions)];
  
  const predictions_count = {};
  predictions.forEach(p => {
    predictions_count[p] = (predictions_count[p] || 0) + 1;
  });

  const consensusPercentage = (Math.max(...Object.values(predictions_count)) / predictions.length) * 100;
  const consensusLevel = consensusPercentage >= 75 ? '🟢 High Consensus' : 
                         consensusPercentage >= 50 ? '🟡 Moderate Consensus' : 
                         '🔴 Low Consensus';

  let html = `
    <div style="background:rgba(0,0,0,0.02); padding:10px; border-radius:6px; font-size:12px;">
      <div style="margin-bottom:8px;">
        <strong>Agreement Level:</strong> ${consensusLevel} (${consensusPercentage.toFixed(0)}% of models agree)
      </div>
      <div style="margin-bottom:8px;">
        <strong>Unique Predictions:</strong> ${uniquePredictions.length}
      </div>
  `;

  if (uniquePredictions.length > 1) {
    html += `
      <div style="margin-top:8px;">
        <strong>All Predictions:</strong>
        <div style="display:flex; flex-wrap:wrap; gap:5px; margin-top:5px;">
    `;
    
    Object.entries(predictions_count).forEach(([pred, count]) => {
      const percentage = (count / predictions.length) * 100;
      html += `
        <div style="background:rgba(102, 126, 234, 0.2); padding:4px 8px; border-radius:4px; font-size:11px;">
          ${pred}: ${count}/4 (${percentage.toFixed(0)}%)
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  }

  html += `</div>`;
  return html;
}

/**
 * Render feature analysis
 */
function renderFeatureAnalysis(features) {
  const featureNames = [
    'Instructions',
    'Temporaries',
    'Arithmetic Ops',
    'Memory Access',
    'Branches',
    'Loops',
    'Nesting Depth',
    'Repeated Expr',
    'Constant Expr',
    'Dead Assigns'
  ];

  const maxFeature = Math.max(...features);
  
  let html = `
    <div style="border-left:3px solid var(--coral-bd); padding-left:10px;">
      <div style="font-weight:bold; margin-bottom:8px; color:var(--text1);">📈 EXTRACTED FEATURES</div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:8px; font-size:12px;">
  `;

  features.forEach((value, idx) => {
    const percentage = (value / maxFeature) * 100;
    const name = featureNames[idx] || `Feature ${idx}`;
    
    html += `
      <div style="background:var(--gray-bg); padding:8px; border-radius:6px; border-left:3px solid #667eea;">
        <div style="font-size:11px; color:var(--text3); margin-bottom:4px;">${name}</div>
        <div style="font-weight:bold; color:var(--text1); margin-bottom:4px;">${value}</div>
        <div style="width:100%; height:4px; background:rgba(0,0,0,0.1); border-radius:2px; overflow:hidden;">
          <div style="width:${percentage}%; height:100%; background:linear-gradient(90deg, #667eea, #764ba2);"></div>
        </div>
      </div>
    `;
  });

  html += `</div></div>`;
  return html;
}

/**
 * Render optimization comparison
 */
function renderOptimizationComparison(report) {
  if (!report.ml_report) return '';

  const OPTIMIZATION_NAMES = [
    'None',
    'Constant Folding',
    'Dead Code Elimination',
    'Common Subexpression Elimination',
    'Loop Invariant Code Motion',
    'Loop Unrolling'
  ];

  const comparison = report.ml_report.comparison;
  
  // Create a mapping of predictions to optimization details
  const optDetails = {
    'Constant Folding': { emoji: '🔢', desc: 'Pre-compute constant expressions', benefit: 'Speed: Reduces computation at runtime' },
    'Dead Code Elimination': { emoji: '🗑️', desc: 'Remove unused variables & code', benefit: 'Size: Reduces binary size' },
    'Common Subexpression Elimination': { emoji: '♻️', desc: 'Eliminate duplicate expressions', benefit: 'Speed: Reduces redundant calculations' },
    'Loop Invariant Code Motion': { emoji: '🔄', desc: 'Move invariant code outside loops', benefit: 'Speed: Reduces loop iterations' },
    'Loop Unrolling': { emoji: '📋', desc: 'Expand loop bodies', benefit: 'Speed: Reduces branch overhead' },
    'None': { emoji: '⚪', desc: 'No optimization', benefit: 'Keep original code' }
  };

  let html = `
    <div style="border-left:3px solid var(--blue-bd); padding-left:10px;">
      <div style="font-weight:bold; margin-bottom:8px; color:var(--text1);">⚙️ OPTIMIZATION COMPARISON</div>
      <div style="display:grid; gap:8px;">
  `;

  comparison.forEach(item => {
    const details = optDetails[item.prediction] || { emoji: '❓', desc: item.prediction, benefit: 'Optimization' };
    
    html += `
      <div style="
        background:rgba(0,0,0,0.02); 
        padding:10px; 
        border-radius:6px; 
        border-left:3px solid #667eea;
        display:grid;
        grid-template-columns: 40px 1fr auto;
        gap:10px;
        align-items:start;
      ">
        <div style="font-size:24px; line-height:1;">${details.emoji}</div>
        <div style="font-size:12px;">
          <div style="font-weight:bold; color:var(--text1); margin-bottom:2px;">${item.model}</div>
          <div style="color:var(--text2);">Predicts: <strong>${item.prediction}</strong></div>
          <div style="color:var(--text3); font-size:11px; margin-top:4px;">${details.desc}</div>
          <div style="color:var(--text3); font-size:11px; margin-top:2px; font-style:italic;">${details.benefit}</div>
        </div>
        <div style="text-align:right; white-space:nowrap;">
          <div style="font-size:11px; color:var(--text3);">Confidence</div>
          <div style="font-weight:bold; color:#667eea; font-size:14px;">${item.confidence}</div>
        </div>
      </div>
    `;
  });

  html += `</div></div>`;
  return html;
}

/**
 * Hook into compile process to display ML comparison
 */
const originalCompile = compile;
compile = function() {
  originalCompile.call(this);
  
  // After compilation, display ML comparison if available
  if (window.lastMLReport) {
    setTimeout(() => {
      renderMLComparison(window.lastMLReport);
    }, 100);
  }
};
