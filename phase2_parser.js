
function parse(tokens) {
  let pos = 0;
  const cur  = () => tokens[pos];
  const peek = n => tokens[pos + (n || 0)];
  const eat  = () => tokens[pos++];

  function expect(v) {
    if (!cur() || cur().val !== v)
      throw new Error(`Expected '${v}' got '${cur() ? cur().val : 'EOF'}'`);
    return eat();
  }

  const isType = () => cur() && ['int','float','char','void'].includes(cur().val);
  const parseType = () => isType() ? eat().val : null;

  const parseExpr   = () => parseTernary();
  const parseTernary = () => {
    let cond = parseOr();
    if (cur() && cur().val === '?') {
      eat(); 
      const trueExpr = parseExpr();
      expect(':');
      const falseExpr = parseTernary();
      return {type:'TernaryExpr', condition:cond, trueExpr, falseExpr};
    }
    return cond;
  };
  const parseOr     = () => leftAssoc(parseAnd,    ['||']);
  const parseAnd    = () => leftAssoc(parseCmp,    ['&&']);
  const parseCmp    = () => leftAssoc(parseBitOr,  ['<','>','<=','>=','==','!=']);
  const parseBitOr  = () => leftAssoc(parseBitXor, ['|']);
  const parseBitXor = () => leftAssoc(parseBitAnd, ['^']);
  const parseBitAnd = () => leftAssoc(parseShift,  ['&']);
  const parseShift  = () => leftAssoc(parseAddSub, ['<<','>>']);
  const parseAddSub = () => leftAssoc(parseMulDiv, ['+','-']);
  const parseMulDiv = () => leftAssoc(parseUnary,  ['*','/','%']);

  function leftAssoc(sub, ops) {
    let l = sub();
    while (cur() && ops.includes(cur().val)) {
      const op = eat().val, r = sub();
      l = {type:'BinaryExpr', op, left:l, right:r};
    }
    return l;
  }

  function parseUnary() {
    if (cur() && cur().val === '-') {
      eat();
      return {type:'UnaryExpr', op:'-', operand:parseUnary()};
    }
    if (cur() && cur().val === '!') {
      eat();
      return {type:'UnaryExpr', op:'!', operand:parseUnary()};
    }
    
    if (cur() && (cur().val === '++' || cur().val === '--')) {
      const op = eat().val;
      const name = eat().val; 
      return {type:'PrefixExpr', op, name};
    }
    return parsePostfix();
  }

  function parsePostfix() {
    let n = parsePrimary();
    if (!n) return n;

    
    while (true) {
      
      if (n.type === 'Ident' && cur() && cur().val === '(') {
        eat(); 
        const args = [];
        while (cur() && cur().val !== ')') {
          args.push(parseExpr());
          if (cur() && cur().val === ',') eat();
        }
        expect(')');
        n = {type:'CallExpr', name:n.name, args};
        continue;
      }
      
      if (n.type === 'Ident' && cur() && cur().val === '[') {
        eat(); 
        const index = parseExpr();
        expect(']');
        n = {type:'IndexExpr', name:n.name, index};
        continue;
      }
      
      if (n.type === 'Ident' && cur() && (cur().val === '++' || cur().val === '--')) {
        const op = eat().val;
        n = {type:'PostfixExpr', op, name:n.name};
        continue;
      }
      break;
    }
    return n;
  }

  function parsePrimary() {
    if (!cur()) return null;
    if (cur().type === 'NUMBER' || cur().type === 'CHAR')
      return {type:'NumLit', value:parseFloat(eat().val)};
    if (cur().type === 'STRING')
      return {type:'StrLit', value:eat().val};
    if (cur().type === 'IDENT')
      return {type:'Ident', name:eat().val};
    if (cur().val === '(') {
      eat(); const e = parseExpr(); expect(')'); return e;
    }
    
    if (isType() && peek(1) && peek(1).val === ')') {
      eat(); eat(); return parseUnary();
    }
    throw new Error(`Unexpected token '${cur().val}'`);
  }

  function parseBlock() {
    expect('{');
    const stmts = [];
    while (cur() && cur().val !== '}') stmts.push(parseStmt());
    expect('}');
    return {type:'Block', body:stmts};
  }

  function parseForUpdate() {
    if (!cur() || cur().val === ')') return null;
    
    if (cur().type === 'IDENT' && peek(1) && ['+=','-=','*=','/='].includes(peek(1).val)) {
      const name = eat().val;
      const op   = eat().val;           
      const rhs  = parseExpr();
      const opChar = op[0];             
      return {type:'AssignExpr', name,
              value:{type:'BinaryExpr', op:opChar,
                     left:{type:'Ident',name}, right:rhs}};
    }
    
    if (cur().type === 'IDENT' && peek(1) && peek(1).val === '=') {
      const name = eat().val; eat();
      return {type:'AssignExpr', name, value:parseExpr()};
    }
    
    return parseExpr();
  }

  function parseStmt() {
    if (!cur()) return null;

    if (cur().val === 'if') {
      eat(); expect('('); const cond = parseExpr(); expect(')');
      const body = parseBlock();
      let elseBody = null;
      if (cur() && cur().val === 'else') { eat(); elseBody = parseBlock(); }
      return {type:'IfStmt', cond, body, else:elseBody};
    }

    if (cur().val === 'while') {
      eat(); expect('('); const cond = parseExpr(); expect(')');
      return {type:'WhileStmt', cond, body:parseBlock()};
    }

    if (cur().val === 'for') {
      eat(); expect('(');
      
      let init = null;
      if (cur() && cur().val !== ';') {
        init = parseStmt(); 
      } else {
        eat(); 
      }
      
      let cond = null;
      if (cur() && cur().val !== ';') cond = parseExpr();
      expect(';');
      
      const update = parseForUpdate();
      expect(')');
      return {type:'ForStmt', init, cond, update, body:parseBlock()};
    }

    if (cur().val === 'return') {
      eat();
      const val = cur() && cur().val !== ';' ? parseExpr() : null;
      expect(';'); return {type:'ReturnStmt', value:val};
    }

    if (cur().val === 'break') { eat(); expect(';'); return {type:'BreakStmt'}; }

    if (cur().val === 'continue') { eat(); expect(';'); return {type:'ContinueStmt'}; }

    if (cur().val === 'do') {
      eat();
      const body = parseBlock();
      expect('while'); expect('(');
      const cond = parseExpr();
      expect(')'); expect(';');
      return {type:'DoWhileStmt', body, cond};
    }

    if (cur().val === 'switch') {
      eat(); expect('(');
      const expr = parseExpr();
      expect(')'); expect('{');
      const cases = [];
      while (cur() && cur().val !== '}') {
        if (cur().val === 'case') {
          eat();
          const value = parseExpr();
          expect(':');
          const body = [];
          while (cur() && cur().val !== 'case' &&
                 cur().val !== 'default' && cur().val !== '}') {
            body.push(parseStmt());
          }
          cases.push({value, body});
        } else if (cur().val === 'default') {
          eat(); expect(':');
          const body = [];
          while (cur() && cur().val !== 'case' &&
                 cur().val !== 'default' && cur().val !== '}') {
            body.push(parseStmt());
          }
          cases.push({value:null, body});
        } else {
          break; 
        }
      }
      expect('}');
      return {type:'SwitchStmt', expr, cases};
    }

    if (isType()) {
      const dtype = parseType(), name = eat().val;
      
      let arrSize = null;
      if (cur() && cur().val === '[') {
        eat();
        if (cur() && cur().val !== ']') arrSize = parseFloat(eat().val);
        expect(']');
      }
      let init = null;
      if (!arrSize && cur() && cur().val === '=') { eat(); init = parseExpr(); }
      expect(';');
      return {type:'VarDecl', dtype, name, arrSize, init};
    }

    if (cur().type === 'IDENT' && peek(1) && peek(1).val === '[') {
      const name = eat().val;
      eat(); 
      const index = parseExpr();
      expect(']');
      
      expect('=');
      const value = parseExpr();
      expect(';');
      return {type:'ArrayAssignStmt', name, index, value};
    }

    if (cur().type === 'IDENT' && peek(1) &&
        ['=','+=','-=','*=','/='].includes(peek(1).val)) {
      const name = eat().val;
      const op   = eat().val;
      const rhs  = parseExpr();
      expect(';');
      if (op === '=') return {type:'AssignStmt', name, value:rhs};
      
      return {type:'AssignStmt', name,
              value:{type:'BinaryExpr', op:op[0],
                     left:{type:'Ident',name}, right:rhs}};
    }

    const expr = parseExpr(); expect(';');
    return {type:'ExprStmt', expr};
  }

  function parseFuncDecl() {
    const rtype = parseType() || 'int', name = eat().val;
    expect('(');
    const params = [];
    while (cur() && cur().val !== ')') {
      const pt = parseType() || 'int', pn = eat().val;
      params.push({type:pt, name:pn});
      if (cur() && cur().val === ',') eat();
    }
    expect(')');
    return {type:'FuncDecl', rtype, name, params, body:parseBlock()};
  }

  const body = [];
  while (pos < tokens.length) body.push(parseFuncDecl());
  return {type:'Program', body};
}

function astToSvg(ast) {
  function exprNode(n) {
    if (!n) return {label:'null', children:[]};
    switch (n.type) {
      case 'NumLit':     return {label:'Num: '+n.value,   children:[]};
      case 'StrLit':     return {label:'Str: '+n.value.slice(0,10), children:[]};
      case 'Ident':      return {label:'ID: '+n.name,     children:[]};
      case 'BinaryExpr': return {label:'BinOp "'+n.op+'"',
                                 children:[exprNode(n.left),exprNode(n.right)]};
      case 'UnaryExpr':  return {label:'Unary '+n.op,     children:[exprNode(n.operand)]};
      case 'PrefixExpr': return {label:n.op+n.name,       children:[]};
      case 'PostfixExpr':return {label:n.name+n.op,       children:[]};
      case 'AssignExpr': return {label:'AssignExpr '+n.name,children:[exprNode(n.value)]};
      case 'IndexExpr':  return {label:n.name+'[…]',      children:[exprNode(n.index)]};
      case 'CallExpr':   return {label:'Call: '+n.name,
                                 children:n.args.map((a,i)=>({label:'arg'+(i+1),children:[exprNode(a)]}))};
      default:           return {label:n.type, children:[]};
    }
  }

  function stmtNode(s) {
    switch (s.type) {
      case 'VarDecl':        return {label:'VarDecl '+s.dtype+' '+s.name+(s.arrSize?'['+s.arrSize+']':''),
                                     children:s.init?[exprNode(s.init)]:[]};
      case 'AssignStmt':     return {label:'Assign '+s.name, children:[exprNode(s.value)]};
      case 'ArrayAssignStmt':return {label:'Assign '+s.name+'[…]',
                                     children:[exprNode(s.index),exprNode(s.value)]};
      case 'ReturnStmt':     return {label:'Return',  children:s.value?[exprNode(s.value)]:[]};
      case 'ExprStmt':       return {label:'ExprStmt',children:[exprNode(s.expr)]};
      case 'BreakStmt':      return {label:'Break',   children:[]};
      case 'ContinueStmt':   return {label:'Continue',children:[]};
      case 'DoWhileStmt':  return {label:'DoWhileStmt',
                                   children:[{label:'Body',children:s.body.body.map(stmtNode)},
                                             {label:'Cond',children:[exprNode(s.cond)]}]};
      case 'SwitchStmt':   return {label:'SwitchStmt',
                                   children:[
                                     {label:'Expr',children:[exprNode(s.expr)]},
                                     ...s.cases.map((c,i) => ({
                                       label: c.value ? 'case '+i : 'default',
                                       children: c.body.map(stmtNode)
                                     }))
                                   ]};

      case 'IfStmt': {
        const c = [{label:'Cond',children:[exprNode(s.cond)]},
                   {label:'Then',children:s.body.body.map(stmtNode)}];
        if (s.else) c.push({label:'Else',children:s.else.body.map(stmtNode)});
        return {label:'IfStmt', children:c};
      }
      case 'WhileStmt': return {label:'WhileStmt',
                                children:[{label:'Cond',children:[exprNode(s.cond)]},
                                          {label:'Body',children:s.body.body.map(stmtNode)}]};
      case 'ForStmt':  return {label:'ForStmt',
                               children:[
                                 {label:'Init',   children:s.init?[stmtNode(s.init)]:[]},
                                 {label:'Cond',   children:s.cond?[exprNode(s.cond)]:[]},
                                 {label:'Update', children:s.update?[exprNode(s.update)]:[]},
                                 {label:'Body',   children:s.body.body.map(stmtNode)}
                               ]};
      default: return {label:s.type, children:[]};
    }
  }

  function fnNode(fn) {
    const sig = fn.name+'('+fn.params.map(p=>p.type+' '+p.name).join(', ')+'):'+fn.rtype;
    return {label:'FuncDecl: '+sig,
            children:[{label:'Body',children:fn.body.body.map(stmtNode)}]};
  }

  const root = {label:'Program', children:ast.body.map(fnNode)};

  const NH=22, GX=10, GY=36, PAD=10, CW=6.4;
  function measureW(n) {
    n.sw = Math.max(60, n.label.length*CW+PAD*2);
    if (!n.children.length) { n.w=n.sw; return; }
    n.children.forEach(measureW);
    const cs = n.children.reduce((s,c)=>s+c.w,0)+(n.children.length-1)*GX;
    n.w = Math.max(n.sw, cs);
  }
  function layout(n,x,y) {
    n.x=x; n.y=y;
    if (!n.children.length) return;
    const total = n.children.reduce((s,c)=>s+c.w,0)+(n.children.length-1)*GX;
    let cx = x+n.w/2-total/2;
    n.children.forEach(c=>{ layout(c,cx,y+GY); cx+=c.w+GX; });
  }
  function maxV(n,fn){return Math.max(fn(n),...n.children.map(c=>maxV(c,fn)));}
  measureW(root); layout(root,4,8);
  const svgH = maxV(root,n=>n.y)+NH+20;
  const svgW = Math.max(600,maxV(root,n=>n.x+n.w)+8);

  const FILLS  =['#EEEDFE','#E1F5EE','#FAEEDA','#FAECE7','#E6F1FB','#F1EFE8'];
  const STROKES=['#AFA9EC','#5DCAA5','#EF9F27','#F0997B','#85B7EB','#B4B2A9'];
  const TEXTS  =['#3C3489','#085041','#633806','#4A1B0C','#042C53','#2C2C2A'];

  const rects=[], lines=[];
  function draw(n,depth,parent) {
    const ci = depth%FILLS.length;
    const nx = n.x+(n.w-n.sw)/2, mx = nx+n.sw/2, my = n.y+NH/2;
    if (parent) {
      const px = parent.x+(parent.w-parent.sw)/2+parent.sw/2;
      lines.push(`<line x1="${px}" y1="${parent.y+NH}" x2="${mx}" y2="${n.y}" stroke="#b4b2a9" stroke-width="0.8"/>`);
    }
    rects.push(
      `<rect x="${nx}" y="${n.y}" width="${n.sw}" height="${NH}" rx="4" fill="${FILLS[ci]}" stroke="${STROKES[ci]}" stroke-width="0.5"/>` +
      `<text x="${mx}" y="${my}" text-anchor="middle" dominant-baseline="central" fill="${TEXTS[ci]}" font-size="10" font-family="monospace" font-weight="500">${esc(n.label)}</text>`
    );
    n.children.forEach(c=>draw(c,depth+1,n));
  }
  draw(root,0,null);
  return `<div class="tree-wrap">
    <svg class="tree-svg" width="${svgW}" viewBox="0 0 ${svgW} ${svgH}" style="min-width:${svgW}px">
      ${lines.join('')}${rects.join('')}
    </svg>
  </div>
  <p class="hint">${ast.body.length} function(s) parsed — hover to explore the tree</p>`;
}
