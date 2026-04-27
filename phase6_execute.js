
function execute(ast) {
  const funcs = {}, stdout = [];
  ast.body.forEach(fn => funcs[fn.name] = fn);

  const isRet  = r => r !== null && typeof r === 'object' && '__ret__'  in r;
  const isBreak= r => r !== null && typeof r === 'object' && '__break__' in r;
  const isCont = r => r !== null && typeof r === 'object' && '__cont__'  in r;

  function evalExpr(e, env) {
    if (!e) return 0;

    switch (e.type) {
      case 'NumLit': return e.value;
      case 'StrLit': return e.value;

      case 'Ident':
        return (e.name in env) ? env[e.name] : 0;

      case 'UnaryExpr': {
        const v = evalExpr(e.operand, env);
        if (e.op === '-') return -v;
        if (e.op === '!') return v ? 0 : 1;
        return v;
      }

      case 'PrefixExpr': {
        const nxt = (env[e.name] || 0) + (e.op === '++' ? 1 : -1);
        env[e.name] = nxt;
        return nxt;
      }

      case 'PostfixExpr': {
        const old = env[e.name] || 0;
        env[e.name] = old + (e.op === '++' ? 1 : -1);
        return old;
      }

      case 'AssignExpr': {
        const v = evalExpr(e.value, env);
        env[e.name] = v;
        return v;
      }

      case 'IndexExpr': {
        const arr = env[e.name];
        const idx = evalExpr(e.index, env);
        return Array.isArray(arr) ? (arr[idx] ?? 0) : 0;
      }

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

      case 'CallExpr': {
        
        if (['printf','print','puts','putchar'].includes(e.name)) {
          const vals = e.args.map(a => evalExpr(a, env));
          
          if (vals.length > 0 && typeof vals[0] === 'string') {
            let fmt = vals[0]; let vi = 1;
            fmt = fmt.replace(/%(d|i|f|c|s|u)/g, () => {
              const v = vals[vi++];
              return v !== undefined ? String(v) : '';
            });
            
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
        
        return (fnResult && typeof fnResult === 'object' && '__ret__' in fnResult)
               ? fnResult.__ret__ : (fnResult || 0);
      }

      default: return 0;
    }
  }

  function runBlock(block, env) {
    for (const s of block.body) {
      const r = runStmt(s, env);
      if (r !== null) return r; 
    }
    return 0;
  }

  function runStmt(s, env) {
    if (!s) return null;

    switch (s.type) {
      case 'VarDecl':
        
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
            if (isRet(r))   return r;            
            if (isBreak(r)) return null;          
            if (isCont(r))  break;               
          }
        }
        if (guard >= 100000) stdout.push('[Loop limit reached — halted]');
        return null;
      }

      case 'ForStmt': {
        
        if (s.init) runStmt(s.init, env);
        let guard = 0;
        while ((!s.cond || evalExpr(s.cond, env)) && ++guard < 100000) {
          for (const x of s.body.body) {
            const r = runStmt(x, env);
            if (isRet(r))   return r;
            if (isBreak(r)) return null;
            if (isCont(r))  break;
          }
          
          if (s.update) evalExpr(s.update, env);
        }
        if (guard >= 100000) stdout.push('[Loop limit reached — halted]');
        return null;
      }

      case 'DoWhileStmt': {
        
        let guard = 0;
        do {
          for (const x of s.body.body) {
            const r = runStmt(x, env);
            if (isRet(r))   return r;
            if (isBreak(r)) return null; 
            if (isCont(r))  break;       
          }
          if (++guard >= 100000) { stdout.push('[Loop limit reached — halted]'); break; }
        } while (evalExpr(s.cond, env));
        return null;
      }

      case 'SwitchStmt': {
        const switchVal = evalExpr(s.expr, env);
        
        let startIdx = s.cases.findIndex(c =>
          c.value !== null && evalExpr(c.value, env) === switchVal
        );
        
        if (startIdx === -1)
          startIdx = s.cases.findIndex(c => c.value === null);
        if (startIdx === -1) return null; 

        for (let i = startIdx; i < s.cases.length; i++) {
          for (const x of s.cases[i].body) {
            const r = runStmt(x, env);
            if (isRet(r))   return r;
            if (isBreak(r)) return null; 
          }
        }
        return null;
      }

      default:
        return null;
    }
  }

  const main = funcs['main'];
  const rawRet = main ? runBlock(main.body, {}) : undefined;
  
  const ret = (rawRet && typeof rawRet === 'object' && '__ret__' in rawRet)
               ? rawRet.__ret__
               : (rawRet !== undefined ? rawRet : 0);
  return {stdout, ret};
}

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
