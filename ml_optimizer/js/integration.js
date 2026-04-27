

function mlOptimizeCompile(sourceCode, enableML = true, verbose = false) {
  const result = {
    success: false,
    original: sourceCode,
    optimized: null,
    stats: {
      original_tac_size: 0,
      optimized_tac_size: 0,
      reduction_percent: 0,
      ml_prediction: null,
      ml_confidence: 0
    },
    errors: []
  };

  try {
    
    if (verbose) console.log('Step 1: Lexical Analysis');
    const tokens = lex(sourceCode);

    if (verbose) console.log('Step 2: Parsing');
    const ast = parse(tokens);

    if (verbose) console.log('Step 3: Semantic Analysis');
    const sem = semanticAnalysis(ast);

    if (verbose) console.log('Step 4: IR Generation');
    const originalTAC = generateIR(ast);
    result.stats.original_tac_size = originalTAC.filter(
      c => c.op !== 'label' && c.op !== 'func'
    ).length;

    if (verbose) console.log('Step 5: ML-Guided Optimization');
    const { optimizedIR, report } = enableML
      ? optimizeTACWithML(originalTAC, true)
      : optimizeTAC(originalTAC);

    result.stats.optimized_tac_size = optimizedIR.filter(
      c => c.op !== 'label' && c.op !== 'func'
    ).length;
    result.stats.reduction_percent = Math.round(
      ((result.stats.original_tac_size - result.stats.optimized_tac_size) /
        result.stats.original_tac_size) * 100
    );
    result.stats.ml_prediction = report.ml_prediction;
    result.stats.ml_confidence = report.ml_confidence;

    if (verbose) console.log('Step 6: Generating optimized C code');
    const optimizedC = tacToC(optimizedIR);
    result.optimized = optimizedC;

    if (verbose) console.log('Step 7: Validation');
    result.success = optimizedC && optimizedC.length > 0;

    if (verbose) {
      console.log(`✓ Original TAC: ${result.stats.original_tac_size} instructions`);
      console.log(`✓ Optimized TAC: ${result.stats.optimized_tac_size} instructions`);
      console.log(`✓ Reduction: ${result.stats.reduction_percent}%`);
      console.log(`✓ ML Prediction: ${result.stats.ml_prediction}`);
    }

    return result;
  } catch (error) {
    result.errors.push(error.message);
    if (verbose) console.error('Compilation error:', error);
    return result;
  }
}

function applyOptimizedCode(editorInstance, optimizedCode) {
  if (!editorInstance || !optimizedCode) {
    console.warn('Cannot apply optimized code: missing editor or code');
    return false;
  }

  try {
    
    editorInstance.setValue(optimizedCode);
    return true;
  } catch (error) {
    console.error('Failed to apply optimized code:', error);
    return false;
  }
}

function createOptimizationReport(originalCode, optimizationResult) {
  const lines = [];

  lines.push('═══════════════════════════════════════════════════════');
  lines.push('COMPILER OPTIMIZATION REPORT');
  lines.push('═══════════════════════════════════════════════════════');
  lines.push('');

  lines.push('STATISTICS:');
  lines.push(`  Original TAC Instructions: ${optimizationResult.stats.original_tac_size}`);
  lines.push(`  Optimized TAC Instructions: ${optimizationResult.stats.optimized_tac_size}`);
  lines.push(`  Reduction: ${optimizationResult.stats.reduction_percent}%`);
  lines.push('');

  if (optimizationResult.stats.ml_prediction) {
    lines.push('ML OPTIMIZATION:');
    lines.push(`  Predicted: ${optimizationResult.stats.ml_prediction}`);
    lines.push(
      `  Confidence: ${(optimizationResult.stats.ml_confidence * 100).toFixed(1)}%`
    );
    lines.push('');
  }

  lines.push('ORIGINAL CODE:');
  lines.push('-'.repeat(60));
  originalCode
    .split('\n')
    .slice(0, 20)
    .forEach(line => lines.push('  ' + line));
  if (originalCode.split('\n').length > 20) {
    lines.push('  ... [truncated]');
  }
  lines.push('');

  lines.push('OPTIMIZED CODE:');
  lines.push('-'.repeat(60));
  optimizationResult.optimized
    .split('\n')
    .slice(0, 20)
    .forEach(line => lines.push('  ' + line));
  if (optimizationResult.optimized.split('\n').length > 20) {
    lines.push('  ... [truncated]');
  }
  lines.push('');

  lines.push('═'.repeat(60));

  return lines.join('\n');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    mlOptimizeCompile,
    applyOptimizedCode,
    createOptimizationReport
  };
}
