
function generateIR(ast) {
  let tmpN = 0, lblN = 0;
  const code = [];
  const newTmp = () => 't'+(++tmpN);
  const newLbl = () => 'L'+(++lblN);

  const breakStack    = [];   
  const continueStack = [];   

  function irExpr(e) {
    if (!e) return '0';

    switch (e.type) {
      case 'NumLit': return String(e.value);
      case 'StrLit': return e.value;
      case 'Ident':  return e.name;

      case 'UnaryExpr': {
        const v = irExpr(e.operand), t = newTmp();
        code.push({op:'unary', dest:t, arg1:v, oper:e.op});
        return t;
      }

      case 'PrefixExpr': {
        
        const delta = e.op === '++' ? '1' : '-1';
        const t = newTmp();
        code.push({op:'binop', dest:t, arg1:e.name, arg2:'1',
                   oper: e.op === '++' ? '+' : '-'});
        code.push({op:'assign', dest:e.name, arg1:t});
        return t;
      }

      case 'PostfixExpr': {
        
        const old = newTmp(), nxt = newTmp();
        code.push({op:'assign', dest:old, arg1:e.name}); 
        code.push({op:'binop',  dest:nxt, arg1:e.name, arg2:'1',
                   oper: e.op === '++' ? '+' : '-'});
        code.push({op:'assign', dest:e.name, arg1:nxt}); 
        return old; 
      }

      case 'AssignExpr': {
        
        const v = irExpr(e.value);
        code.push({op:'assign', dest:e.name, arg1:v});
        return v;
      }

      case 'IndexExpr': {
        
        const idx = irExpr(e.index), t = newTmp();
        code.push({op:'index_load', dest:t, arg1:e.name, arg2:idx});
        return t;
      }

      case 'BinaryExpr': {
        const l = irExpr(e.left), r = irExpr(e.right), t = newTmp();
        code.push({op:'binop', dest:t, arg1:l, arg2:r, oper:e.op});
        return t;
      }

      case 'CallExpr': {
        const args = e.args.map(irExpr);
        args.forEach(a => code.push({op:'param', dest:'', arg1:a}));
        const t = newTmp();
        code.push({op:'call', dest:t, arg1:e.name, arg2:String(e.args.length)});
        return t;
      }

      default: return '?';
    }
  }

  function irStmt(s) {
    if (!s) return;

    switch (s.type) {
      case 'VarDecl':
        if (s.init) {
          const v = irExpr(s.init);
          code.push({op:'assign', dest:s.name, arg1:v});
        } else if (s.arrSize) {
          
          code.push({op:'array_decl', dest:s.name, arg1:String(s.arrSize)});
        }
        break;

      case 'AssignStmt': {
        const v = irExpr(s.value);
        code.push({op:'assign', dest:s.name, arg1:v});
        break;
      }

      case 'ArrayAssignStmt': {
        
        const idx = irExpr(s.index), val = irExpr(s.value);
        code.push({op:'index_store', dest:s.name, arg1:idx, arg2:val});
        break;
      }

      case 'ReturnStmt':
        code.push({op:'return', dest:'', arg1:s.value ? irExpr(s.value) : ''});
        break;

      case 'ExprStmt':
        irExpr(s.expr); 
        break;

      case 'IfStmt': {
        const c = irExpr(s.cond), lF = newLbl(), lE = newLbl();
        code.push({op:'iffalse', dest:lF, arg1:c});
        s.body.body.forEach(irStmt);
        code.push({op:'goto', dest:lE});
        code.push({op:'label', dest:lF});
        if (s.else) s.else.body.forEach(irStmt);
        code.push({op:'label', dest:lE});
        break;
      }

      case 'WhileStmt': {
        const lS = newLbl(), lE = newLbl();
        code.push({op:'label', dest:lS});
        const c = irExpr(s.cond);
        code.push({op:'iffalse', dest:lE, arg1:c});
        breakStack.push(lE); continueStack.push(lS);
        s.body.body.forEach(irStmt);
        breakStack.pop(); continueStack.pop();
        code.push({op:'goto', dest:lS});
        code.push({op:'label', dest:lE});
        break;
      }

      case 'ForStmt': {
        
        if (s.init) irStmt(s.init);
        const lCond   = newLbl();
        const lUpdate = newLbl();
        const lEnd    = newLbl();

        code.push({op:'label', dest:lCond});
        if (s.cond) {
          const c = irExpr(s.cond);
          code.push({op:'iffalse', dest:lEnd, arg1:c});
        }

        breakStack.push(lEnd); continueStack.push(lUpdate);
        s.body.body.forEach(irStmt);
        breakStack.pop(); continueStack.pop();

        code.push({op:'label', dest:lUpdate});
        if (s.update) irExpr(s.update);
        code.push({op:'goto', dest:lCond});
        code.push({op:'label', dest:lEnd});
        break;
      }

      case 'BreakStmt':
        if (breakStack.length)
          code.push({op:'goto', dest:breakStack[breakStack.length-1]});
        break;

      case 'ContinueStmt':
        if (continueStack.length)
          code.push({op:'goto', dest:continueStack[continueStack.length-1]});
        break;

      case 'DoWhileStmt': {

        const lBody = newLbl();  
        const lCond = newLbl();  
        const lEnd  = newLbl();  
        code.push({op:'label', dest:lBody});
        breakStack.push(lEnd); continueStack.push(lCond);
        s.body.body.forEach(irStmt);
        breakStack.pop(); continueStack.pop();
        
        code.push({op:'label', dest:lCond});
        const dc = irExpr(s.cond);
        code.push({op:'iftrue', dest:lBody, arg1:dc});  
        code.push({op:'label', dest:lEnd});
        break;
      }

      case 'SwitchStmt': {
        
        const tSwitch = newTmp();
        const switchVal = irExpr(s.expr);
        code.push({op:'assign', dest:tSwitch, arg1:switchVal});

        const bodyLabels   = s.cases.map(() => newLbl());
        const lEnd         = newLbl();
        let   defaultLabel = lEnd; 

        s.cases.forEach((c, i) => {
          if (c.value === null) {
            defaultLabel = bodyLabels[i]; 
          } else {
            const cmpVal = irExpr(c.value);
            const tCmp   = newTmp();
            code.push({op:'binop',  dest:tCmp, arg1:tSwitch, arg2:cmpVal, oper:'=='});
            code.push({op:'iftrue', dest:bodyLabels[i], arg1:tCmp});
          }
        });
        code.push({op:'goto', dest:defaultLabel}); 

        breakStack.push(lEnd);
        s.cases.forEach((c, i) => {
          code.push({op:'label', dest:bodyLabels[i]});
          c.body.forEach(irStmt);
        });
        breakStack.pop();
        code.push({op:'label', dest:lEnd});
        break;
      }
    }
  }

  ast.body.forEach(fn => {
    code.push({op:'func', dest:fn.name, params:fn.params});
    fn.body.body.forEach(irStmt);
  });
  return code;
}

function renderIR(code) {
  let n = 0;
  const rows = code.map(c => {
    if (c.op === 'func') {
      const sig = c.dest+'('+(c.params||[]).map(p=>p.type+' '+p.name).join(', ')+')';
      return `<tr><td></td><td colspan="2" style="font-weight:600;padding-top:8px">func ${esc(sig)}:</td></tr>`;
    }
    if (c.op === 'label')
      return `<tr><td></td><td colspan="2" style="color:var(--blue);padding-left:4px">${esc(c.dest)}:</td></tr>`;

    n++;
    let instr = '';
    switch (c.op) {
      case 'assign':      instr = `${esc(c.dest)} = ${esc(c.arg1)}`; break;
      case 'binop':       instr = `${esc(c.dest)} = ${esc(c.arg1)} ${esc(c.oper)} ${esc(c.arg2)}`; break;
      case 'unary':       instr = `${esc(c.dest)} = ${esc(c.oper)} ${esc(c.arg1)}`; break;
      case 'index_load':  instr = `${esc(c.dest)} = ${esc(c.arg1)}[${esc(c.arg2)}]`; break;
      case 'index_store': instr = `${esc(c.dest)}[${esc(c.arg1)}] = ${esc(c.arg2)}`; break;
      case 'array_decl':  instr = `array ${esc(c.dest)}[${esc(c.arg1)}]`; break;
      case 'param':       instr = `param ${esc(c.arg1)}`; break;
      case 'call':        instr = `${esc(c.dest)} = call ${esc(c.arg1)}, ${esc(c.arg2)}`; break;
      case 'return':      instr = `return ${esc(c.arg1)}`; break;
      case 'iffalse':     instr = `ifFalse ${esc(c.arg1)} goto ${esc(c.dest)}`; break;
      case 'iftrue':      instr = `ifTrue  ${esc(c.arg1)} goto ${esc(c.dest)}`; break;
      case 'goto':        instr = `goto ${esc(c.dest)}`; break;
    }
    return `<tr><td>${n}</td><td>${esc(c.op)}</td><td style="font-family:var(--font-mono)">${instr}</td></tr>`;
  }).join('');

  return `<table class="ir-table">
    <tr><td></td>
        <td style="color:var(--text3);font-size:10px;text-transform:uppercase">op</td>
        <td style="color:var(--text3);font-size:10px;text-transform:uppercase">instruction</td>
    </tr>
    ${rows}</table>`;
}
