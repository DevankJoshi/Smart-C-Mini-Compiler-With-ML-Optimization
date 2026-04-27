

const EXAMPLE_CONST_FOLD = `
int main() {
    int x = 5 + 3;
    int y = 10 * 2;
    int z = x + y;
    return z;
}
`;

const EXAMPLE_DEAD_CODE = `
int main() {
    int unused1 = 10;
    int unused2 = 20;
    int unused3 = 30;
    int result = 42;
    return result;
}
`;

const EXAMPLE_CSE = `
int main() {
    int a = 5, b = 3;
    int t1 = a + b;
    int t2 = a + b;
    int t3 = a + b;
    int c = t1 + t2 + t3;
    return c;
}
`;

const EXAMPLE_LOOPS = `
int main() {
    int sum = 0;
    int i;
    for (i = 1; i <= 10; i++) {
        sum = sum + i;
    }
    return sum;
}
`;

const EXAMPLE_MIXED = `
int main() {
    int x = 100;
    int y = 50;
    int z = x + y;
    int a = z * 2;
    int unused = 999;
    int b = x + y;
    int result = a + b;
    return result;
}
`;

function runAllExamples() {
  const examples = [
    { name: 'Constant Folding', code: EXAMPLE_CONST_FOLD },
    { name: 'Dead Code Elimination', code: EXAMPLE_DEAD_CODE },
    { name: 'CSE', code: EXAMPLE_CSE },
    { name: 'Loops', code: EXAMPLE_LOOPS },
    { name: 'Mixed', code: EXAMPLE_MIXED }
  ];

  console.log('=' * 70);
  console.log('ML COMPILER OPTIMIZER - EXAMPLE DEMONSTRATIONS');
  console.log('=' * 70);

  examples.forEach((ex, idx) => {
    console.log(`\n[${idx + 1}/${examples.length}] ${ex.name}`);
    console.log('-'.repeat(70));

    try {
      const result = mlOptimizeCompile(ex.code, true, false);

      console.log(`Original TAC size: ${result.stats.original_tac_size}`);
      console.log(`Optimized TAC size: ${result.stats.optimized_tac_size}`);
      console.log(`Reduction: ${result.stats.reduction_percent}%`);

      if (result.stats.ml_prediction) {
        console.log(
          `ML Prediction: ${result.stats.ml_prediction} (${(result.stats.ml_confidence * 100).toFixed(1)}%)`
        );
      }

      if (result.success) {
        console.log('✓ Optimization successful');
      } else {
        console.log('✗ Optimization failed');
        result.errors.forEach(e => console.error(`  Error: ${e}`));
      }
    } catch (error) {
      console.error(`Error: ${error.message}`);
    }
  });

  console.log('\n' + '='.repeat(70));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    EXAMPLE_CONST_FOLD,
    EXAMPLE_DEAD_CODE,
    EXAMPLE_CSE,
    EXAMPLE_LOOPS,
    EXAMPLE_MIXED,
    runAllExamples
  };
}
