/* ═══════════════════════════════════════════════════════
   PHASE 6 — EXECUTION (tree-walking interpreter)
   Walks the AST directly, no bytecode needed.

   NEW in this version:
   ● for loops  — init / cond / update / body
   ● break      — {__break__: true} sentinel propagation
   ● continue   — {__continue__: true} sentinel propagation
   ● Arrays     — env stores plain JS arrays
   ● Unary  -  !
   ● Prefix / Postfix  ++  --
   ● float arithmetic  (JavaScript numbers handle it natively)
   ● char literals arrive as integer ASCII values from lexer
═══════════════════════════════════════════════════════ */
function execute(ast) {
  const funcs = {}, stdout = [];
  ast.body.forEach(fn => funcs[fn.name] = fn);

  /* ── Sentinel helpers ── */
  const isRet  = r => r !== null && typeof r === 'object' && '__ret__'  in r;
  const isBreak= r => r !== null && typeof r === 'object' && '__break__' in r;
  const isCont = r => r !== null && typeof r === 'object' && '__cont__'  in r;

  /* ── Expression evaluator ── */
  function evalExpr(e, env) {
    if (!e) return 0;

    switch (e.type) {
      case 'NumLit': return e.value;
      case 'StrLit': return e.value;

      case 'Ident':
        return (e.name in env) ? env[e.name] : 0;

      /* -expr   !expr */
      case 'UnaryExpr': {
        const v = evalExpr(e.operand, env);
        if (e.op === '-') return -v;
        if (e.op === '!') return v ? 0 : 1;
        return v;
      }

      /* ++i  or  --i  (side effect: mutates env, returns new value) */
      case 'PrefixExpr': {
        const nxt = (env[e.name] || 0) + (e.op === '++' ? 1 : -1);
        env[e.name] = nxt;
        return nxt;
      }

      /* i++  or  i--  (side effect: mutates env, returns OLD value) */
      case 'PostfixExpr': {
        const old = env[e.name] || 0;
        env[e.name] = old + (e.op === '++' ? 1 : -1);
        return old;
      }

      /* Assignment expression used in for-update  i = expr */
      case 'AssignExpr': {
        const v = evalExpr(e.value, env);
        env[e.name] = v;
        return v;
      }

      /* arr[i] */
      case 'IndexExpr': {
        const arr = env[e.name];
        const idx = evalExpr(e.index, env);
        return Array.isArray(arr) ? (arr[idx] ?? 0) : 0;
      }

      /* Binary operators */
      case 'BinaryExpr': {
        const l = evalExpr(e.left, env), r = evalExpr(e.right, env);
        switch (e.op) {
          case '+':  return l + r;
          case '-':  return l - r;
          case '*':  return l * r;
          case '/':  return r ? (Number.isInteger(l) && Number.isInteger(r)
                                 ? Math.trunc(l/r) : l/r) : 0;
          case '%':  return r ? l % r : 0;
          case '<':  return l < r  ? 1 : 0;
          case '>':  return l > r  ? 1 : 0;
          case '<=': return l <= r ? 1 : 0;
          case '>=': return l >= r ? 1 : 0;
          case '==': return l === r ? 1 : 0;
          case '!=': return l !== r ? 1 : 0;
          case '&&': return (l && r) ? 1 : 0;
          case '||': return (l || r) ? 1 : 0;
          default:   return 0;
        }
      }

      /* Function call */
      case 'CallExpr': {
        // Built-in output functions
        if (['printf','print','puts','putchar'].includes(e.name)) {
          const vals = e.args.map(a => evalExpr(a, env));
          // Simple printf: replace %d %f %c %s with values
          if (vals.length > 0 && typeof vals[0] === 'string') {
            let fmt = vals[0]; let vi = 1;
            fmt = fmt.replace(/%(d|i|f|c|s|u)/g, () => {
              const v = vals[vi++];
              return v !== undefined ? String(v) : '';
            });
            // strip surrounding quotes and escape sequences
            fmt = fmt.replace(/^"|"$/g,'').replace(/\\n/g,'\n').replace(/\\t/g,'\t');
            stdout.push(fmt);
          } else {
            stdout.push(vals.map(v => typeof v === 'number' ? v : String(v)).join(' '));
          }
          return 0;
        }
        const fn = funcs[e.name];
        if (!fn) return 0;
        const nenv = {};
        fn.params.forEach((p,i) =>
          nenv[p.name] = evalExpr(e.args[i] || {type:'NumLit',value:0}, env));
        const fnResult = runBlock(fn.body, nenv);
        // Unwrap the __ret__ sentinel to get the actual return value
        return (fnResult && typeof fnResult === 'object' && '__ret__' in fnResult)
               ? fnResult.__ret__ : (fnResult || 0);
      }

      default: return 0;
    }
  }

  /* ── Block runner ── returns value, {__ret__:v}, {__break__:1}, {__cont__:1} ── */
  function runBlock(block, env) {
    for (const s of block.body) {
      const r = runStmt(s, env);
      if (r !== null) return r; // propagate ret / break / continue
    }
    return 0;
  }

  /* ── Statement runner ── */
  function runStmt(s, env) {
    if (!s) return null;

    switch (s.type) {
      case 'VarDecl':
        // Arrays initialised as JS arrays
        if (s.arrSize) {
          env[s.name] = new Array(s.arrSize).fill(0);
        } else {
          env[s.name] = s.init ? evalExpr(s.init, env) : 0;
        }
        return null;

      case 'AssignStmt':
        env[s.name] = evalExpr(s.value, env);
        return null;

      case 'ArrayAssignStmt': {
        const arr = env[s.name] || [];
        const idx = evalExpr(s.index, env);
        const val = evalExpr(s.value, env);
        if (!Array.isArray(arr)) env[s.name] = [];
        env[s.name][idx] = val;
        return null;
      }

      case 'ExprStmt':
        evalExpr(s.expr, env);
        return null;

      case 'ReturnStmt':
        return {__ret__: s.value ? evalExpr(s.value, env) : 0};

      case 'BreakStmt':
        return {__break__: 1};

      case 'ContinueStmt':
        return {__cont__: 1};

      case 'IfStmt': {
        const branch = evalExpr(s.cond, env) ? s.body : s.else;
        if (branch) {
          for (const x of branch.body) {
            const r = runStmt(x, {...env});
            // copy mutations back (simple flat env merge)
            if (r !== null) return r;
          }
        }
        return null;
      }

      case 'WhileStmt': {
        let guard = 0;
        while (evalExpr(s.cond, env) && ++guard < 100000) {
          for (const x of s.body.body) {
            const r = runStmt(x, env);
            if (isRet(r))   return r;            // propagate return
            if (isBreak(r)) return null;          // break exits loop
            if (isCont(r))  break;               // continue next iteration
          }
        }
        if (guard >= 100000) stdout.push('[Loop limit reached — halted]');
        return null;
      }

      case 'ForStmt': {
        // Init in parent env (may declare loop variable)
        if (s.init) runStmt(s.init, env);
        let guard = 0;
        while ((!s.cond || evalExpr(s.cond, env)) && ++guard < 100000) {
          for (const x of s.body.body) {
            const r = runStmt(x, env);
            if (isRet(r))   return r;
            if (isBreak(r)) return null;
            if (isCont(r))  break;
          }
          // Update expression
          if (s.update) evalExpr(s.update, env);
        }
        if (guard >= 100000) stdout.push('[Loop limit reached — halted]');
        return null;
      }

      case 'DoWhileStmt': {
        // body executes at least once, then checks condition
        let guard = 0;
        do {
          for (const x of s.body.body) {
            const r = runStmt(x, env);
            if (isRet(r))   return r;
            if (isBreak(r)) return null; // exit do-while
            if (isCont(r))  break;       // skip to condition check
          }
          if (++guard >= 100000) { stdout.push('[Loop limit reached — halted]'); break; }
        } while (evalExpr(s.cond, env));
        return null;
      }

      case 'SwitchStmt': {
        const switchVal = evalExpr(s.expr, env);
        // Find matching case (or default)
        let startIdx = s.cases.findIndex(c =>
          c.value !== null && evalExpr(c.value, env) === switchVal
        );
        // If no match, fall back to default
        if (startIdx === -1)
          startIdx = s.cases.findIndex(c => c.value === null);
        if (startIdx === -1) return null; // no match, no default

        // Execute from matched case downward (C fall-through)
        for (let i = startIdx; i < s.cases.length; i++) {
          for (const x of s.cases[i].body) {
            const r = runStmt(x, env);
            if (isRet(r))   return r;
            if (isBreak(r)) return null; // break exits switch
          }
        }
        return null;
      }

      default:
        return null;
    }
  }

  // Entry point — run main()
  const main = funcs['main'];
  const rawRet = main ? runBlock(main.body, {}) : undefined;
  // Unwrap the __ret__ sentinel: runBlock returns {__ret__: value} on return statement
  const ret = (rawRet && typeof rawRet === 'object' && '__ret__' in rawRet)
               ? rawRet.__ret__
               : (rawRet !== undefined ? rawRet : 0);
  return {stdout, ret};
}

/* ── Output renderer ── */
function renderExec({stdout, ret}) {
  let html = '';
  if (stdout.length) {
    html += `<div class="exec-lbl">stdout</div>`;
    html += stdout.map(l =>
      `<div class="exec-out">${esc(String(l))}</div>`).join('');
  }
  const rv = ret === undefined ? 'undefined' : ret;
  return html +
    `<div class="alert-ok">&#10003; Process exited &mdash; return value: <strong>${esc(String(rv))}</strong></div>`;
}
