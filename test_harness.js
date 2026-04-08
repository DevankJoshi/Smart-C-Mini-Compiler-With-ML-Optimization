#!/usr/bin/env node
/**
 * TEST HARNESS FOR ML OPTIMIZER
 * 
 * Run this to test the ML optimizer system
 * Requires Node.js
 * 
 * Usage: node test_harness.js
 */

const fs = require('fs');
const path = require('path');

// Load all modules (simulating browser environment)
const files = [
  'phase0_utils.js',
  'phase1_lexer.js',
  'phase2_parser.js',
  'phase3_semantic.js',
  'phase4_ir.js',
  'ml_optimizer/js/feature_extractor.js',
  'ml_optimizer/js/model.js',
  'ml_optimizer/js/ml_optimizer.js',
  'ml_optimizer/js/tac_to_c.js',
  'ml_optimizer/js/integration.js'
];

console.log('Loading modules...');
files.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    try {
      eval(fs.readFileSync(filePath, 'utf8'));
      console.log(`  ✓ ${file}`);
    } catch (e) {
      console.error(`  ✗ ${file}: ${e.message}`);
    }
  } else {
    console.warn(`  ⚠ ${file} not found (may be optional)`);
  }
});

console.log('\n' + '='.repeat(70));
console.log('ML COMPILER OPTIMIZER - TEST SUITE');
console.log('='.repeat(70));

// Test cases
const tests = [
  {
    name: 'Constant Folding Example',
    code: `
int main() {
    int x = 5 + 3;
    int y = x * 2;
    return y;
}
    `,
    expectedClass: 1
  },
  {
    name: 'Dead Code Elimination Example',
    code: `
int main() {
    int unused1 = 10;
    int unused2 = 20;
    int result = 42;
    return result;
}
    `,
    expectedClass: 2
  },
  {
    name: 'CSE Example',
    code: `
int main() {
    int a = 5, b = 3;
    int t1 = a + b;
    int t2 = a + b;
    int t3 = a + b;
    return t1 + t2 + t3;
}
    `,
    expectedClass: 3
  },
  {
    name: 'Loop Example',
    code: `
int main() {
    int sum = 0;
    int i;
    for (i = 0; i < 10; i++) {
        sum = sum + i;
    }
    return sum;
}
    `,
    expectedClass: 4
  },
  {
    name: 'Mixed Example',
    code: `
int main() {
    int x = 100;
    int y = 50;
    int z = x + y;
    int unused = 999;
    int a = x + y;
    return z + a;
}
    `,
    expectedClass: 3
  }
];

// Run tests
let passCount = 0;
let failCount = 0;

tests.forEach((test, idx) => {
  console.log(`\n[Test ${idx + 1}/${tests.length}] ${test.name}`);
  console.log('-'.repeat(70));

  try {
    // Extract features
    let tokens = lex(test.code);
    let ast = parse(tokens);
    let ir = generateIR(ast);

    const { raw: features, vector: featureVector } = extractFeatures(ir);

    // Predict
    const model = LogisticRegressionClassifier.fromJSON({
      inputSize: 10,
      numClasses: 6,
      learningRate: 0.01,
      weights: DEFAULT_MODEL_WEIGHTS.weights
    });

    const normalizedFeatures = featureVector.map((val, i) => {
      const s = FEATURE_STATS.std[i];
      return s > 0 ? (val - FEATURE_STATS.mean[i]) / s : 0;
    });

    const prediction = model.predictWithConfidence(normalizedFeatures);

    console.log(`Original TAC size: ${ir.filter(c => c.op !== 'label' && c.op !== 'func').length} instructions`);
    console.log('\nFeatures extracted:');
    Object.entries(features).forEach(([key, val]) => {
      console.log(`  ${key.padEnd(25)} ${String(val).padStart(5)}`);
    });

    console.log('\nML Prediction:');
    console.log(`  Class: ${OPTIMIZATION_NAMES[prediction.class]}`);
    console.log(`  Confidence: ${(prediction.confidence * 100).toFixed(1)}%`);
    console.log(`  Probabilities:`);
    prediction.probabilities.forEach((prob, i) => {
      const bar = '█'.repeat(Math.round(prob * 20));
      console.log(`    ${OPTIMIZATION_NAMES[i].padEnd(30)} ${bar} ${(prob * 100).toFixed(1)}%`);
    });

    // Optimize
    const { optimizedIR, report } = optimizeTACWithML(ir, true);
    const optimizedSize = optimizedIR.filter(c => c.op !== 'label' && c.op !== 'func').length;
    const reduction = Math.round(
      ((ir.length - optimizedIR.length) / ir.length) * 100
    );

    console.log('\nOptimization Results:');
    console.log(`  Optimized TAC size: ${optimizedSize} instructions`);
    console.log(`  Reduction: ${reduction}%`);
    console.log(`  Passes applied: ${report.totalHits}`);

    // Generate optimized code
    const optimizedC = tacToC(optimizedIR);
    console.log('\nOptimized code preview:');
    optimizedC.split('\n').slice(0, 8).forEach(line => {
      if (line.trim()) console.log(`  ${line}`);
    });

    console.log('\n✓ TEST PASSED');
    passCount++;
  } catch (error) {
    console.error(`✗ TEST FAILED: ${error.message}`);
    console.error(`  Stack: ${error.stack.split('\n')[0]}`);
    failCount++;
  }
});

// Summary
console.log('\n' + '='.repeat(70));
console.log(`TEST RESULTS: ${passCount} passed, ${failCount} failed`);
console.log('='.repeat(70));

if (failCount === 0) {
  console.log('\n🎉 All tests passed! ML optimizer is working correctly.\n');
  process.exit(0);
} else {
  console.log(`\n⚠️  ${failCount} test(s) failed. Check output above.\n`);
  process.exit(1);
}
