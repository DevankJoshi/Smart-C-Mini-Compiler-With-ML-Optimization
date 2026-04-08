/* ═══════════════════════════════════════════════════════
   PHASE 7 — TAC OPTIMIZER (v2)
   Real compiler optimization passes on Three-Address Code.

   Passes (run iteratively until stable, max 10 rounds):
     1. Constant Folding       — t1 = 5+3  → t1 = 8
     2. Constant Propagation   — x=10; t1=x+2 → t1=10+2
     3. Copy Propagation       — y=x; t1=y+1  → t1=x+1
     4. CSE                    — t1=a+b; t2=a+b → t2=t1
     5. Branch Folding         — ifFalse 1 goto L  → (removed)
     6. Unreachable Code Elim  — code after goto with no label
     7. Dead Code Elimination  — remove assigns never read
═══════════════════════════════════════════════════════ */

function cloneIR(ir) {
  return ir.map(c => Object.assign({}, c));
}

function evalConst(a, op, b) {
  const na = parseFloat(a), nb = parseFloat(b);
  if (isNaN(na) || isNaN(nb)) return null;
  switch (op) {
    case '+':  return na + nb;
    case '-':  return na - nb;
    case '*':  return na * nb;
    case '/':  return nb !== 0 ? Math.trunc(na / nb) : null;
    case '%':  return nb !== 0 ? (na % nb) : null;
    case '<':  return (na <  nb) ? 1 : 0;
    case '>':  return (na >  nb) ? 1 : 0;
    case '<=': return (na <= nb) ? 1 : 0;
    case '>=': return (na >= nb) ? 1 : 0;
    case '==': return (na === nb) ? 1 : 0;
    case '!=': return (na !== nb) ? 1 : 0;
    default:   return null;
  }
}

function isConst(v) {
  return v !== undefined && v !== null && v !== '' &&
    /^-?[0-9]+(\.[0-9]+)?$/.test(String(v));
}

/* ── PASS 1: Constant Folding ─────────────────────────── */
function passConstantFolding(ir) {
  let changed = false;
  const hits = [];
  ir.forEach((c, i) => {
    if (c.op === 'binop' && isConst(c.arg1) && isConst(c.arg2)) {
      const val = evalConst(c.arg1, c.oper, c.arg2);
      if (val !== null) {
        ir[i] = { op: 'assign', dest: c.dest, arg1: String(val) };
        hits.push(`${c.dest} = ${c.arg1} ${c.oper} ${c.arg2}  →  ${c.dest} = ${val}`);
        changed = true;
      }
    }
    // Also fold unary on constants
    if (c.op === 'unary' && isConst(c.arg1)) {
      let val = null;
      if (c.oper === '-') val = -parseFloat(c.arg1);
      if (c.oper === '!') val = parseFloat(c.arg1) === 0 ? 1 : 0;
      if (val !== null) {
        ir[i] = { op: 'assign', dest: c.dest, arg1: String(val) };
        hits.push(`${c.dest} = ${c.oper}${c.arg1}  →  ${c.dest} = ${val}`);
        changed = true;
      }
    }
  });
  return { changed, hits };
}

/* ── PASS 2: Constant Propagation ─────────────────────── */
function passConstantPropagation(ir) {
  let changed = false;
  const hits = [];

  // Build: var → constant value (only if assigned exactly once w/ a const)
  const constVal = {};
  const assignCount = {};
  ir.forEach(c => {
    if ((c.op === 'assign' || c.op === 'binop' || c.op === 'unary') && c.dest) {
      assignCount[c.dest] = (assignCount[c.dest] || 0) + 1;
    }
    if (c.op === 'assign' && c.dest) {
      if (isConst(c.arg1)) constVal[c.dest] = c.arg1;
      else delete constVal[c.dest];
    }
  });
  // Remove vars assigned more than once (they change at runtime)
  Object.keys(assignCount).forEach(v => {
    if (assignCount[v] > 1) delete constVal[v];
  });

  ir.forEach((c, i) => {
    const replaceField = (field) => {
      if (c[field] && constVal[c[field]] !== undefined) {
        hits.push(`propagate ${c[field]} = ${constVal[c[field]]} (line ${i})`);
        ir[i] = Object.assign({}, ir[i], { [field]: constVal[c[field]] });
        changed = true;
      }
    };
    // Replace in uses, but skip the defining assignment itself
    if (c.op === 'assign' && c.dest && constVal[c.dest] === c.arg1) return;
    replaceField('arg1');
    replaceField('arg2');
  });

  return { changed, hits };
}

/* ── PASS 2b: Local Constant Propagation ────────────────
   Propagates constants within a basic block, even if the
   variable is reassigned elsewhere. Clears on jump targets.
─────────────────────────────────────────────────────── */
function passLocalConstantPropagation(ir) {
  let changed = false;
  const hits = [];
  let constMap = {};

  ir.forEach((c, i) => {
    // Clear state on block boundaries (labels/function starts)
    if (c.op === 'label' || c.op === 'func') {
      constMap = {};
    } else {
      // Replace reads first
      ['arg1', 'arg2'].forEach(f => {
        if (c[f] && constMap[c[f]] !== undefined) {
          hits.push(`local-prop ${c[f]} = ${constMap[c[f]]} (line ${i})`);
          ir[i] = Object.assign({}, ir[i], { [f]: constMap[c[f]] });
          changed = true;
        }
      });

      // Update writes
      if (c.op === 'assign' && c.dest) {
        if (isConst(c.arg1)) constMap[c.dest] = c.arg1;
        else delete constMap[c.dest];
      } else if (c.dest) {
        // Any other write (binop, call, etc.) invalidates it
        delete constMap[c.dest];
      }
    }
  });

  return { changed, hits };
}
/* ── PASS 3: Copy Propagation ─────────────────────────── */
function passCopyPropagation(ir) {
  let changed = false;
  const hits = [];
  const copyMap = {};

  ir.forEach((c, i) => {
    ['arg1', 'arg2'].forEach(f => {
      if (c[f] && copyMap[c[f]] !== undefined) {
        hits.push(`copy-prop ${c[f]} → ${copyMap[c[f]]} (line ${i})`);
        ir[i] = Object.assign({}, ir[i], { [f]: copyMap[c[f]] });
        changed = true;
      }
    });
    if (c.op === 'label' || c.op === 'func') {
      for (const k in copyMap) delete copyMap[k];
    } else if (c.op === 'assign' && c.dest && c.arg1 && !isConst(c.arg1)) {
      copyMap[c.dest] = c.arg1;
    } else if (c.dest) {
      delete copyMap[c.dest];
    }
  });

  return { changed, hits };
}

/* ── PASS 4: Common Subexpression Elimination ──────────── */
function passCSE(ir) {
  let changed = false;
  const hits = [];
  const exprMap = {};

  ir.forEach((c, i) => {
    if (c.op === 'label' || c.op === 'func') {
      for (const k in exprMap) delete exprMap[k];
    } else if (c.op === 'binop') {
      const key  = `${c.arg1}__${c.oper}__${c.arg2}`;
      const keyR = `${c.arg2}__${c.oper}__${c.arg1}`;
      const comm = ['+', '*', '==', '!='].includes(c.oper);
      const found = exprMap[key] || (comm && exprMap[keyR]);
      if (found) {
        hits.push(`CSE: ${c.dest}=${c.arg1}${c.oper}${c.arg2} → ${c.dest}=${found}`);
        ir[i] = { op: 'assign', dest: c.dest, arg1: found };
        changed = true;
      } else {
        exprMap[key] = c.dest;
      }
    }
    if (c.dest) {
      Object.keys(exprMap).forEach(k => {
        if (k.startsWith(c.dest + '__') || k.includes(`__${c.dest}__`)
            || k.endsWith('__' + c.dest)) {
          delete exprMap[k];
        }
      });
    }
  });

  return { changed, hits };
}

/* ── PASS 5: Branch Folding ───────────────────────────────
   When the condition of an ifTrue/ifFalse is a constant,
   we know at compile time whether the branch is taken.
   • ifFalse 0 goto L  → always branches  → replace with goto L
   • ifFalse 1 goto L  → never branches   → remove the instruction
   • iftrue  1 goto L  → always branches  → replace with goto L
   • iftrue  0 goto L  → never branches   → remove the instruction
─────────────────────────────────────────────────────────── */
function passBranchFolding(ir) {
  let changed = false;
  const hits = [];

  ir.forEach((c, i) => {
    if ((c.op === 'iffalse' || c.op === 'iftrue') && isConst(c.arg1)) {
      const val = parseFloat(c.arg1);
      const condTrue = val !== 0;
      // iffalse branches when condition is FALSE (val === 0)
      // iftrue  branches when condition is TRUE  (val !== 0)
      const branches =
        (c.op === 'iffalse' && !condTrue) ||
        (c.op === 'iftrue'  &&  condTrue);

      if (branches) {
        // Always jumps → unconditional goto
        hits.push(`Branch fold: always ${c.op} ${c.arg1} → goto ${c.dest}`);
        ir[i] = { op: 'goto', dest: c.dest };
      } else {
        // Never jumps → remove entirely
        hits.push(`Branch fold: never-taken ${c.op} ${c.arg1} → removed`);
        ir[i] = { op: '_dead_', dest: '', arg1: '' };
      }
      changed = true;
    }
  });

  // Remove _dead_ markers
  const before = ir.length;
  ir.splice(0, ir.length, ...ir.filter(c => c.op !== '_dead_'));
  return { changed, hits };
}

/* ── PASS 6: Unreachable Code Elimination ─────────────────
   After folding branches, instructions between an
   unconditional goto and the next label it does NOT target
   are unreachable. Remove them.
   Also remove labels that nobody jumps to.
─────────────────────────────────────────────────────────── */
function passUnreachable(ir) {
  let changed = false;
  const hits = [];

  // Step 1: find all labels actually used as jump targets
  const usedLabels = new Set();
  ir.forEach(c => {
    if (c.op === 'goto')             usedLabels.add(c.dest);
    if (c.op === 'iffalse')          usedLabels.add(c.dest);
    if (c.op === 'iftrue')           usedLabels.add(c.dest);
  });

  // Step 2: mark unreachable instructions (after goto until next used label)
  let unreachable = false;
  const keep = ir.map(c => {
    if (c.op === 'label') {
      if (usedLabels.has(c.dest)) {
        unreachable = false; // landed here → reachable again
        return { keep: true, c };
      } else {
        // Label nobody jumps to — remove it
        hits.push(`Unreachable label ${c.dest} removed`);
        changed = true;
        return { keep: false, c };
      }
    }
    if (unreachable) {
      hits.push(`Unreachable code removed: ${c.op} ${c.dest||''} ${c.arg1||''}`);
      changed = true;
      return { keep: false, c };
    }
    if (c.op === 'goto') {
      unreachable = true; // instructions after unconditional goto are dead
    }
    return { keep: true, c };
  });

  ir.splice(0, ir.length, ...keep.filter(x => x.keep).map(x => x.c));
  return { changed, hits };
}

/* ── PASS 7: Dead Code Elimination ───────────────────────
   Variables assigned but never subsequently read → remove.
─────────────────────────────────────────────────────────── */
function passDeadCode(ir) {
  let changed = false;
  const hits = [];

  const used = new Set();
  ir.forEach(c => {
    if (c.arg1 && !isConst(c.arg1))  used.add(c.arg1);
    if (c.arg2 && !isConst(c.arg2))  used.add(c.arg2);
    // Control flow / call instructions implicitly use their dest label
    if (c.op === 'goto')             {} // dest is a label, not a var
    if (c.op === 'return' && c.arg1) used.add(c.arg1);
    if (c.op === 'param')            used.add(c.arg1);
    if (c.op === 'call')             {} // call result dest might be unused
  });

  const keep = ir.filter((c) => {
    if ((c.op === 'assign' || c.op === 'binop' || c.op === 'unary') && c.dest) {
      if (!used.has(c.dest)) {
        hits.push(`DCE: unused  ${c.dest} = ...  removed`);
        changed = true;
        return false;
      }
    }
    return true;
  });

  ir.splice(0, ir.length, ...keep);
  return { changed, hits };
}

/* ── MAIN OPTIMIZER ───────────────────────────────────── */
function optimizeTAC(ir) {
  let opt = cloneIR(ir);
  const report = {
    passes: [],
    totalHits: 0,
    rounds: 0,
    original_count: ir.filter(c => c.op !== 'label' && c.op !== 'func').length,
    optimized_count: 0
  };

  const MAX_ROUNDS = 10;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    let anyChange = false;

    const runs = [
      { name: 'Constant Folding',      fn: passConstantFolding },
      { name: 'Constant Propagation',  fn: passConstantPropagation },
      { name: 'Local Constant Prop',   fn: passLocalConstantPropagation },
      { name: 'Copy Propagation',      fn: passCopyPropagation },
      { name: 'CSE',                   fn: passCSE },
      { name: 'Branch Folding',        fn: passBranchFolding },
      { name: 'Unreachable Code Elim', fn: passUnreachable },
      { name: 'Dead Code Elimination', fn: passDeadCode },
    ];

    runs.forEach(({ name, fn }) => {
      const { changed, hits } = fn(opt);
      if (changed) {
        anyChange = true;
        hits.forEach(h => report.passes.push({ round: round + 1, pass: name, detail: h }));
        report.totalHits += hits.length;
      }
    });

    report.rounds++;
    if (!anyChange) break;
  }

  report.optimized_count = opt.filter(c => c.op !== 'label' && c.op !== 'func').length;
  return { optimizedIR: opt, report };
}

/* ── RENDERER ─────────────────────────────────────────── */
function renderOptimizerResult(originalIR, optimizedIR, report) {
  const removed = report.original_count - report.optimized_count;
  const pct = report.original_count > 0
    ? Math.round((removed / report.original_count) * 100)
    : 0;

  const passNames = [...new Set(report.passes.map(p => p.pass))];

  const badgeColors = {
    'Constant Folding':      '#f59e0b',
    'Constant Propagation':  '#3b82f6',
    'Copy Propagation':      '#8b5cf6',
    'CSE':                   '#ec4899',
    'Branch Folding':        '#f97316',
    'Unreachable Code Elim': '#ef4444',
    'Dead Code Elimination': '#10b981',
  };

  const badges = passNames.length > 0
    ? passNames.map(p =>
        `<span style="background:${badgeColors[p]||'#555'}22;
          border:1px solid ${badgeColors[p]||'#555'}66;
          color:${badgeColors[p]||'#aaa'};
          border-radius:20px; padding:2px 10px; font-size:11px;
          white-space:nowrap; display:inline-block">${p}</span>`
      ).join(' ')
    : `<span style="color:var(--text3);font-size:12px">No optimizations applicable for this code pattern</span>`;

  function tacLines(code) {
    return code.map(c => {
      let line = '';
      switch (c.op) {
        case 'func':        line = `<b style="color:var(--blue)">func ${c.dest}(${(c.params||[]).map(p=>p.name).join(', ')}):</b>`; break;
        case 'label':       line = `<span style="color:var(--blue); padding-left:0">${c.dest}:</span>`; break;
        case 'assign':      line = `&nbsp;&nbsp;${c.dest} = ${c.arg1}`; break;
        case 'binop':       line = `&nbsp;&nbsp;${c.dest} = ${c.arg1} ${c.oper} ${c.arg2}`; break;
        case 'unary':       line = `&nbsp;&nbsp;${c.dest} = ${c.oper}${c.arg1}`; break;
        case 'index_load':  line = `&nbsp;&nbsp;${c.dest} = ${c.arg1}[${c.arg2}]`; break;
        case 'index_store': line = `&nbsp;&nbsp;${c.dest}[${c.arg1}] = ${c.arg2}`; break;
        case 'array_decl':  line = `&nbsp;&nbsp;array ${c.dest}[${c.arg1}]`; break;
        case 'return':      line = `&nbsp;&nbsp;<span style="color:var(--coral)">return ${c.arg1 || ''}</span>`; break;
        case 'goto':        line = `&nbsp;&nbsp;<span style="color:#94a3b8">goto ${c.dest}</span>`; break;
        case 'iffalse':     line = `&nbsp;&nbsp;<span style="color:#94a3b8">ifFalse ${c.arg1} goto ${c.dest}</span>`; break;
        case 'iftrue':      line = `&nbsp;&nbsp;<span style="color:#94a3b8">ifTrue ${c.arg1} goto ${c.dest}</span>`; break;
        case 'param':       line = `&nbsp;&nbsp;param ${c.arg1}`; break;
        case 'call':        line = `&nbsp;&nbsp;${c.dest} = call ${c.arg1}, ${c.arg2}`; break;
        default:            line = `&nbsp;&nbsp;<span style="color:#555">${c.op}</span>`;
      }
      return `<div style="font-family:var(--font-mono);font-size:12px;line-height:1.8">${line}</div>`;
    }).join('');
  }

  const logRows = report.passes.map(p =>
    `<tr>
      <td style="color:${badgeColors[p.pass]||'#aaa'};font-size:10px;padding:2px 8px 2px 0;white-space:nowrap;vertical-align:top">
        R${p.round} · ${p.pass}
      </td>
      <td style="font-family:var(--font-mono);font-size:11px;color:var(--text2);padding:2px 0">${p.detail}</td>
    </tr>`
  ).join('');

  const pctColor = pct >= 50 ? '#10b981' : pct >= 20 ? '#f59e0b' : '#94a3b8';

  return `
<div style="display:flex;flex-direction:column;gap:14px;font-family:var(--font-sans)">

  <!-- Stats row -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
    <div style="background:linear-gradient(135deg,${pctColor}18,${pctColor}08);
        border:1px solid ${pctColor}44;border-radius:8px;padding:10px;text-align:center">
      <div style="font-size:28px;font-weight:800;color:${pctColor}">${pct}%</div>
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px">Reduced</div>
    </div>
    <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:8px;padding:10px;text-align:center">
      <div style="font-size:28px;font-weight:800;color:var(--text1)">${report.original_count}</div>
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px">Original</div>
    </div>
    <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:8px;padding:10px;text-align:center">
      <div style="font-size:28px;font-weight:800;color:var(--text1)">${report.optimized_count}</div>
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px">Optimized</div>
    </div>
    <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:8px;padding:10px;text-align:center">
      <div style="font-size:28px;font-weight:800;color:var(--blue)">${report.rounds}</div>
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px">Rounds</div>
    </div>
  </div>

  <!-- Badges -->
  <div>
    <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:7px">Applied Passes</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px">${badges}</div>
  </div>

  <!-- Side-by-side TAC -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
    <div style="background:var(--bg1);border:1px solid var(--border);border-radius:6px;padding:10px;overflow:auto;max-height:280px">
      <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Original TAC</div>
      ${tacLines(originalIR)}
    </div>
    <div style="background:rgba(16,185,129,0.04);border:1px solid rgba(16,185,129,0.3);border-radius:6px;padding:10px;overflow:auto;max-height:280px">
      <div style="font-size:10px;color:#10b981;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">✓ Optimized TAC</div>
      ${tacLines(optimizedIR)}
    </div>
  </div>

  ${logRows ? `
  <details>
    <summary style="cursor:pointer;font-size:11px;color:var(--text3);user-select:none;list-style:none">
      <span style="display:inline-flex;align-items:center;gap:5px">
        <span style="font-size:9px">▶</span>
        Transformation Log (${report.passes.length} changes across ${report.rounds} rounds)
      </span>
    </summary>
    <div style="background:var(--bg1);border:1px solid var(--border);border-radius:6px;
        padding:8px 12px;margin-top:6px;overflow:auto;max-height:200px">
      <table style="border-collapse:collapse;width:100%"><tbody>${logRows}</tbody></table>
    </div>
  </details>` : ''}

</div>`;
}
