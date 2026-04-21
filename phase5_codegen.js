/* ═══════════════════════════════════════════════════════
   PHASE 5 — CODE GENERATION (pseudo x86 assembly)
   Stack-frame based, accumulator model (eax).

   NEW in this version:
   ● unary  neg eax  /  not eax
   ● prefix / postfix ++  dec / inc instructions
   ● array_decl, index_load, index_store (symbolic refs)
   ● for loop TAC maps naturally to same patterns as while
═══════════════════════════════════════════════════════ */
function generateAsm(ir) {
  const instr  = [];
  const varOff = {}; // variable → stack offset (+ve = local, -ve = param)
  let sp = 4;

  function ref(name) {
    if (/^-?[0-9.]+$/.test(name)) return name;
    if (varOff[name] !== undefined) {
      return varOff[name] < 0
        ? `[ebp+${-varOff[name]}]`   // parameter above frame
        : `[ebp-${varOff[name]}]`;   // local below frame
    }
    return name; // label / unknown
  }
  function alloc(name) { if (varOff[name] === undefined) { varOff[name] = sp; sp += 4; } }
  function emit(t, s, cmt) { instr.push({t, s, comment:cmt||''}); }

  ir.forEach(c => {
    switch (c.op) {

      /* ── Function prologue ── */
      case 'func':
        Object.keys(varOff).forEach(k => delete varOff[k]); sp = 4;
        emit('lbl', c.dest+':');
        emit('op',  'push ebp',        '; save base pointer');
        emit('op',  'mov ebp, esp',    '; set up stack frame');
        if (c.params) c.params.forEach((p,i) => { varOff[p.name] = -(8 + i*4); });
        break;

      case 'label':
        emit('lbl', c.dest+':');
        break;

      /* ── Simple assignment ── */
      case 'assign':
        alloc(c.dest);
        emit('op', `mov eax, ${ref(c.arg1)}`,  `; load ${c.arg1}`);
        emit('op', `mov ${ref(c.dest)}, eax`,  `; store → ${c.dest}`);
        break;

      /* ── Unary operator ── */
      case 'unary':
        alloc(c.dest);
        emit('op', `mov eax, ${ref(c.arg1)}`, `; load ${c.arg1}`);
        if (c.oper === '-') emit('op', 'neg eax', '; negate');
        if (c.oper === '!') {
          emit('op', 'cmp eax, 0');
          emit('op', 'sete al');
          emit('op', 'movzx eax, al', '; logical NOT');
        }
        emit('op', `mov ${ref(c.dest)}, eax`, `; store unary result → ${c.dest}`);
        break;

      /* ── Binary operation ── */
      case 'binop': {
        alloc(c.dest);
        emit('op', `mov eax, ${ref(c.arg1)}`, '; left operand');
        const ARITH = {'+':'add','-':'sub','*':'imul','/':'idiv','%':'idiv'};
        const CMP   = {'<':'jl','>':'jg','<=':'jle','>=':'jge','==':'je','!=':'jne'};
        if (ARITH[c.oper]) {
          if (c.oper === '/' || c.oper === '%') {
            emit('op', 'cdq',                        '; sign-extend eax → edx:eax');
            emit('op', `mov ecx, ${ref(c.arg2)}`,   '; divisor');
            emit('op', 'idiv ecx',                   '; eax=quotient edx=remainder');
            if (c.oper === '%') emit('op', 'mov eax, edx', '; keep remainder');
          } else {
            emit('op', `${ARITH[c.oper]} eax, ${ref(c.arg2)}`, `; ${c.oper}`);
          }
        } else if (CMP[c.oper]) {
          emit('op', `cmp eax, ${ref(c.arg2)}`,    '; compare');
          emit('op', `${CMP[c.oper]} .t_${c.dest}`, '; branch if true');
          emit('op', 'mov eax, 0');
          emit('op', `jmp .d_${c.dest}`);
          emit('lbl', `.t_${c.dest}:`);
          emit('op', 'mov eax, 1');
          emit('lbl', `.d_${c.dest}:`);
        } else if (c.oper === '&&') {
          const t2 = ref(c.arg2);
          emit('op', `and eax, ${t2}`, '; logical AND');
        } else if (c.oper === '||') {
          const t2 = ref(c.arg2);
          emit('op', `or eax, ${t2}`, '; logical OR');
        }
        emit('op', `mov ${ref(c.dest)}, eax`, `; store → ${c.dest}`);
        break;
      }

      /* ── Array declaration (allocate stack space) ── */
      case 'array_decl':
        // Reserve size*4 bytes; store base offset
        alloc(c.dest);
        emit('op', `sub esp, ${(parseInt(c.arg1)-1)*4}`,
             `; reserve ${c.arg1} elements for ${c.dest}`);
        break;

      /* ── Array element load  t = arr[i] ── */
      case 'index_load':
        alloc(c.dest);
        emit('op', `mov esi, ${ref(c.arg2)}`, `; index = ${c.arg2}`);
        emit('op', `imul esi, 4`,              '; byte offset');
        emit('op', `lea eax, ${ref(c.arg1)}`, `; base address of ${c.arg1}`);
        emit('op', `mov eax, [eax + esi]`,    '; load element');
        emit('op', `mov ${ref(c.dest)}, eax`, `; store → ${c.dest}`);
        break;

      /* ── Array element store  arr[i] = v ── */
      case 'index_store':
        emit('op', `mov esi, ${ref(c.arg1)}`, `; index = ${c.arg1}`);
        emit('op', `imul esi, 4`,              '; byte offset');
        emit('op', `lea edi, ${ref(c.dest)}`, `; base address of ${c.dest}`);
        emit('op', `mov eax, ${ref(c.arg2)}`, `; value = ${c.arg2}`);
        emit('op', `mov [edi + esi], eax`,    '; store element');
        break;

      /* ── Function call ── */
      case 'param':
        emit('op', `push ${ref(c.arg1)}`, '; push arg');
        break;

      case 'call':
        alloc(c.dest);
        emit('op', `call ${c.arg1}`,  '; function call');
        if (parseInt(c.arg2) > 0)
          emit('op', `add esp, ${parseInt(c.arg2)*4}`, '; clean up args');
        emit('op', `mov ${ref(c.dest)}, eax`, `; capture return → ${c.dest}`);
        break;

      /* ── Return ── */
      case 'return':
        if (c.arg1) emit('op', `mov eax, ${ref(c.arg1)}`, '; set return value');
        emit('op', 'pop ebp', '; restore base pointer');
        emit('op', 'ret',     '; return to caller');
        break;

      /* ── Control flow ── */
      case 'iffalse':
        emit('op', 'cmp eax, 0');
        emit('op', `je ${c.dest}`, '; jump if false');
        break;

      case 'iftrue':
        emit('op', 'cmp eax, 0');
        emit('op', `jne ${c.dest}`, '; jump if true');
        break;

      case 'goto':
        emit('op', `jmp ${c.dest}`);
        break;
    }
  });
  return instr;
}

function renderAsm(instr) {
  const html = instr.map(i => {
    if (i.t === 'lbl')
      return `<span class="asm-lbl">${esc(i.s)}</span>`;
    const parts = i.s.split(' '), op = parts[0], rest = parts.slice(1).join(' ');
    const cmt = i.comment ? `  <span class="asm-cmt">${esc(i.comment)}</span>` : '';
    
    // Syntax highlight operands: registers (%eax, etc), addresses ([...]), numbers
    let highlightedRest = esc(rest)
      .replace(/(%[a-z0-9]+)/g, '<span style="color:var(--amber)">$1</span>')  // registers
      .replace(/(\$\d+)/g, '<span style="color:var(--purple)">$1</span>')      // immediates
      .replace(/(\[.*?\])/g, '<span style="color:var(--green)">$1</span>')     // memory addresses
      .replace(/(,)/g, '<span style="color:var(--text3)">$1</span>');          // commas
    
    return `    <span class="asm-op">${esc(op)}</span> ${highlightedRest}${cmt}`;
  }).join('\n');
  return `<div class="asm-block">${html}</div>`;
}
