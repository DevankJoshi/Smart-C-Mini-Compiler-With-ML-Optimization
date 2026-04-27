

function extractFeatures(ir) {
  const features = {};

  const instructions = ir.filter(c => c.op !== 'label' && c.op !== 'func');
  features.instruction_count = instructions.length;

  const temps = new Set();
  ir.forEach(c => {
    ['dest', 'arg1', 'arg2'].forEach(field => {
      if (c[field] && String(c[field]).startsWith('t')) {
        temps.add(c[field]);
      }
    });
  });
  features.number_of_temporaries = temps.size;

  let arith_count = 0;
  ir.forEach(c => {
    if (c.op === 'binop' && ['+', '-', '*', '/', '%'].includes(c.oper)) {
      arith_count++;
    }
    if (c.op === 'unary' && ['-', '!'].includes(c.oper)) {
      arith_count++;
    }
  });
  features.arithmetic_operations = arith_count;

  let mem_count = 0;
  ir.forEach(c => {
    if (c.op === 'index_load') mem_count++;
    if (c.op === 'index_store') mem_count++;
    if (c.op === 'array_decl') mem_count++;
    if (c.op === 'param') mem_count++;
    if (c.op === 'call') mem_count++;
  });
  features.memory_access_count = mem_count;

  let branch_count = 0;
  ir.forEach(c => {
    if (['goto', 'iffalse', 'iftrue'].includes(c.op)) {
      branch_count++;
    }
  });
  features.branch_count = branch_count;

  const labels = new Set();
  const gotos = [];
  ir.forEach(c => {
    if (c.op === 'label') labels.add(c.dest);
    if (c.op === 'goto' || c.op === 'iffalse' || c.op === 'iftrue') {
      gotos.push({ op: c.op, dest: c.dest, line: ir.indexOf(c) });
    }
  });

  let loop_count = 0;
  const gotoMap = new Map();
  ir.forEach((c, idx) => {
    if (c.op === 'label') {
      gotoMap.set(c.dest, idx);
    }
  });

  gotos.forEach(({ dest, line }) => {
    const targetLine = gotoMap.get(dest);
    if (targetLine !== undefined && targetLine < line) {
      loop_count++; 
    }
  });
  features.loop_count = Math.max(1, Math.floor(loop_count / 2)); 

  features.loop_nesting_depth = features.loop_count > 0 ? 1 : 0;

  let repeated_count = 0;
  const exprSeen = {};
  ir.forEach(c => {
    if (c.op === 'binop') {
      const key = `${c.arg1}__${c.oper}__${c.arg2}`;
      const keyRev = `${c.arg2}__${c.oper}__${c.arg1}`;
      if (exprSeen[key] || exprSeen[keyRev]) {
        repeated_count++;
      } else {
        exprSeen[key] = true;
      }
    }
  });
  features.repeated_expressions = repeated_count;

  let const_expr_count = 0;
  ir.forEach(c => {
    if (c.op === 'binop') {
      const isConstArg1 = isConst(c.arg1);
      const isConstArg2 = isConst(c.arg2);
      if (isConstArg1 && isConstArg2) {
        const_expr_count++;
      }
    }
    if (c.op === 'unary') {
      if (isConst(c.arg1)) {
        const_expr_count++;
      }
    }
  });
  features.constant_expressions = const_expr_count;

  let dead_count = 0;
  const reads = new Set();
  const writes = new Map();

  ir.forEach(c => {
    ['arg1', 'arg2'].forEach(f => {
      if (c[f]) reads.add(String(c[f]));
    });
    if (c.op === 'return' && c.arg1) reads.add(String(c.arg1));
    if (c.op === 'param' && c.arg1) reads.add(String(c.arg1));

    if (c.dest) {
      if (!writes.has(c.dest)) writes.set(c.dest, 0);
      writes.set(c.dest, writes.get(c.dest) + 1);
    }
  });

  writes.forEach((count, varName) => {
    if (!reads.has(varName)) {
      dead_count += count;
    }
  });
  features.dead_assignments = dead_count;

  return {
    raw: features,
    vector: [
      features.instruction_count,
      features.number_of_temporaries,
      features.arithmetic_operations,
      features.memory_access_count,
      features.branch_count,
      features.loop_count,
      features.loop_nesting_depth,
      features.repeated_expressions,
      features.constant_expressions,
      features.dead_assignments
    ]
  };
}

function normalizeFeatures(vector, mean, std) {
  return vector.map((val, i) => {
    const s = std[i];
    return s > 0 ? (val - mean[i]) / s : 0;
  });
}

function isConst(v) {
  return v !== undefined && v !== null && v !== '' &&
    /^-?[0-9]+(\.[0-9]+)?$/.test(String(v));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { extractFeatures, normalizeFeatures, isConst };
}
