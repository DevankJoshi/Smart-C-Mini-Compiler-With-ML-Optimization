/* ═══════════════════════════════════════════════════════
   PHASE 3 — SEMANTIC ANALYSIS
   • Builds a global function symbol table (first pass)
   • Checks each function body for:
       - undeclared / redeclared variables
       - undeclared function calls
       - argument count mismatches
       - strings used in arithmetic (warning)

   NEW in this version:
   ● ForStmt checking (init, cond, update, body)
   ● BreakStmt / ContinueStmt — warns if outside a loop
   ● ArrayAssignStmt checking
   ● IndexExpr, PostfixExpr, PrefixExpr, UnaryExpr, AssignExpr
   ● float / char type awareness
═══════════════════════════════════════════════════════ */
function semanticAnalysis(ast) {
  const funcTable = {}, allSymbols = {}, errors = [], warnings = [];
  let loopDepth = 0; // track if we're inside a loop

  // First pass: register all function signatures
  ast.body.forEach(fn => {
    if (funcTable[fn.name]) errors.push(`Function '${fn.name}' declared more than once`);
    funcTable[fn.name] = {rtype:fn.rtype, params:fn.params};
    allSymbols[fn.name] = {
      kind:'function',
      sig:fn.rtype+'('+fn.params.map(p=>p.type+' '+p.name).join(', ')+')'
    };
  });

  /* ──── Expression type checker ──── */
  function checkExpr(e, scope) {
    if (!e) return 'void';

    switch (e.type) {
      case 'NumLit':
        return Number.isInteger(e.value) ? 'int' : 'float';

      case 'StrLit':
        return 'char*';

      case 'Ident':
        if (!scope[e.name]) errors.push(`Variable '${e.name}' used before declaration`);
        return scope[e.name] || 'unknown';

      case 'UnaryExpr':
        return checkExpr(e.operand, scope); // propagate type

      case 'PrefixExpr':
      case 'PostfixExpr':
        if (!scope[e.name]) errors.push(`Variable '${e.name}' used before declaration`);
        return scope[e.name] || 'int';

      case 'AssignExpr':
        if (!scope[e.name]) errors.push(`Variable '${e.name}' used before declaration`);
        checkExpr(e.value, scope);
        return scope[e.name] || 'int';

      case 'IndexExpr': {
        // arr[i]
        const arrType = scope[e.name];
        if (!arrType) errors.push(`Array '${e.name}' used before declaration`);
        checkExpr(e.index, scope);
        // base type is the element type (strip '[]' suffix if present)
        return arrType ? arrType.replace('[]','') : 'unknown';
      }

      case 'BinaryExpr': {
        const lt = checkExpr(e.left, scope), rt = checkExpr(e.right, scope);
        if (lt === 'char*' || rt === 'char*')
          warnings.push(`String operand in arithmetic expression '${e.op}'`);
        if (lt === 'float' || rt === 'float') return 'float';
        return 'int';
      }

      case 'CallExpr': {
        if (!funcTable[e.name]) errors.push(`Function '${e.name}' called but not declared`);
        const fn = funcTable[e.name];
        if (fn && fn.params.length !== e.args.length)
          errors.push(`'${e.name}' expects ${fn.params.length} arg(s), got ${e.args.length}`);
        e.args.forEach(a => checkExpr(a, scope));
        return fn ? fn.rtype : 'unknown';
      }

      default:
        return 'int';
    }
  }

  /* ──── Statement checker ──── */
  function checkStmt(s, scope) {
    if (!s) return;

    switch (s.type) {
      case 'VarDecl':
        if (scope.hasOwnProperty(s.name))
          errors.push(`Variable '${s.name}' redeclared in same scope`);
        // Store type; mark arrays with '[]' suffix
        scope[s.name] = s.arrSize ? s.dtype+'[]' : s.dtype;
        allSymbols[s.name] = {kind: s.arrSize ? 'array' : 'variable',
                              sig: s.dtype + (s.arrSize ? '['+s.arrSize+']' : '')};
        if (s.init) checkExpr(s.init, scope);
        break;

      case 'AssignStmt':
        if (!scope[s.name]) errors.push(`Variable '${s.name}' assigned but not declared`);
        checkExpr(s.value, scope);
        break;

      case 'ArrayAssignStmt':
        if (!scope[s.name]) errors.push(`Array '${s.name}' assigned but not declared`);
        checkExpr(s.index, scope);
        checkExpr(s.value, scope);
        break;

      case 'ReturnStmt':
        checkExpr(s.value, scope);
        break;

      case 'ExprStmt':
        checkExpr(s.expr, scope);
        break;

      case 'IfStmt':
        checkExpr(s.cond, scope);
        s.body.body.forEach(x => checkStmt(x, {...scope}));
        if (s.else) s.else.body.forEach(x => checkStmt(x, {...scope}));
        break;

      case 'WhileStmt':
        checkExpr(s.cond, scope);
        loopDepth++;
        s.body.body.forEach(x => checkStmt(x, {...scope}));
        loopDepth--;
        break;

      case 'ForStmt':
        // Init might declare variables — use a child scope
        const forScope = {...scope};
        if (s.init) checkStmt(s.init, forScope);
        if (s.cond) checkExpr(s.cond, forScope);
        if (s.update) checkExpr(s.update, forScope);
        loopDepth++;
        s.body.body.forEach(x => checkStmt(x, {...forScope}));
        loopDepth--;
        break;

      case 'BreakStmt':
        if (loopDepth === 0) errors.push(`'break' used outside of a loop`);
        break;

      case 'ContinueStmt':
        if (loopDepth === 0) errors.push(`'continue' used outside of a loop`);
        break;

      case 'DoWhileStmt':
        loopDepth++;
        s.body.body.forEach(x => checkStmt(x, {...scope}));
        loopDepth--;
        checkExpr(s.cond, scope);
        break;

      case 'SwitchStmt':
        checkExpr(s.expr, scope);
        loopDepth++; // break is valid inside switch
        s.cases.forEach(c => {
          if (c.value) checkExpr(c.value, scope);
          c.body.forEach(x => checkStmt(x, {...scope}));
        });
        loopDepth--;
        break;
    }
  }

  ast.body.forEach(fn => {
    const scope = {};
    fn.params.forEach(p => {
      scope[p.name] = p.type;
      allSymbols[p.name] = {kind:'param', sig:p.type};
    });
    fn.body.body.forEach(s => checkStmt(s, scope));
  });

  return {allSymbols, errors, warnings};
}

function renderSemantic({allSymbols, errors, warnings}) {
  const rows = Object.entries(allSymbols).map(([name,info]) =>
    `<tr><td>${esc(name)}</td><td>${info.kind}</td><td>${esc(info.sig)}</td></tr>`
  ).join('');
  const symHtml = `<table class="sym-table">
    <tr><th>Name</th><th>Kind</th><th>Type / Signature</th></tr>${rows}</table>`;
  const wHtml = warnings.map(w =>
    `<div class="alert-warn" style="margin-top:6px">&#9888; ${esc(w)}</div>`).join('');
  const eHtml = errors.length
    ? errors.map(e =>
        `<div class="alert-err" style="margin-top:6px">&#10005; ${esc(e)}</div>`).join('')
    : `<div class="alert-ok" style="margin-top:6px">&#10003; No semantic errors detected</div>`;
  return symHtml + wHtml + eHtml;
}
