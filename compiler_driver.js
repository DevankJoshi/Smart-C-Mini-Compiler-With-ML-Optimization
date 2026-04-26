/* ═══════════════════════════════════════════════════════
   MAIN COMPILE DRIVER — runs all 6 phases in sequence,
   stops and marks phase red on first hard error.
═══════════════════════════════════════════════════════ */
function compile() {
  try {
    resetAll();
    const src=document.getElementById('src-editor').value.trim();
    if(!src) return;

    // Phase 1 — Lex
    let tokens;
    try {
      tokens=lex(src);
      window.lastLexerOutput = tokens;  // Store for export
      document.getElementById('out-1').innerHTML=renderTokens(tokens);
      activatePhase(1,false);
    } catch(e) {
      document.getElementById('out-1').innerHTML=`<div class="alert-err">Lexer error: ${esc(e.message)}</div>`;
      activatePhase(1,true); return;
    }

    // Phase 2 — Parse
    let ast;
    try {
      ast=parse(tokens);
      window.lastParserOutput = ast;  // Store for export
      document.getElementById('out-2').innerHTML=astToSvg(ast);
      activatePhase(2,false);
    } catch(e) {
      document.getElementById('out-2').innerHTML=`<div class="alert-err">Parse error: ${esc(e.message)}</div>`;
      activatePhase(2,true); return;
    }

    // Phase 3 — Semantic
    try {
      const sem=semanticAnalysis(ast);
      window.lastSemanticOutput = sem;  // Store for export
      document.getElementById('out-3').innerHTML=renderSemantic(sem);
      activatePhase(3, sem.errors.length>0);
    } catch(e) {
      document.getElementById('out-3').innerHTML=`<div class="alert-err">Semantic error: ${esc(e.message)}</div>`;
      activatePhase(3,true);
    }

    // Phase 4 — IR
    let ir;
    try {
      ir=generateIR(ast);
      window.lastIROutput = ir;  // Store for export
      document.getElementById('out-4').innerHTML=renderIR(ir);
      activatePhase(4,false);
    } catch(e) {
      document.getElementById('out-4').innerHTML=`<div class="alert-err">IR error: ${esc(e.message)}</div>`;
      activatePhase(4,true); return;
    }

    // Phase 5 — Code gen (original)
    let asm;
    try {
      asm = generateAsm(ir);
      window.lastCodegenOutput = asm;  // Store for export
      document.getElementById('out-5').innerHTML = renderAsm(asm);
      activatePhase(5, false);
    } catch(e) {
      document.getElementById('out-5').innerHTML = `<div class="alert-err">Codegen error: ${esc(e.message)}</div>`;
      activatePhase(5, true);
    }

    // Phase 6 — Execute (original)
    try {
      if (typeof execute !== 'function') {
        throw new Error(`execute function not found. Available functions: ${Object.keys(window).filter(k => typeof window[k] === 'function').slice(0,20).join(', ')}`);
      }
      const result = execute(ast);
      window.lastExecOutput = result;  // Store for export
      document.getElementById('out-6').innerHTML = renderExec(result);
      activatePhase(6, false);
    } catch(e) {
      document.getElementById('out-6').innerHTML = `<div class="alert-err">Runtime error: ${esc(e.message)}</div>`;
      activatePhase(6, true);
    }

    // Phase 7 — TAC Optimizer (ML-guided when available)
    try {
      const useMLPath = (typeof optimizeTACWithML === 'function');
      const { optimizedIR, report } = useMLPath
        ? optimizeTACWithML(ir, true)
        : optimizeTAC(ir);

      // Show side-by-side comparison + transformation log
      const mlHeader = (useMLPath && typeof renderMLPrediction === 'function')
        ? renderMLPrediction(report)
        : '';
      document.getElementById('out-7').innerHTML =
        mlHeader + renderOptimizerResult(ir, optimizedIR, report);

      // Also re-run codegen on optimized TAC and show optimized assembly
      const optAsm = generateAsm(optimizedIR);
      const optAsmHtml = renderAsm(optAsm);
      document.getElementById('out-7').innerHTML +=
        `<div style="margin-top:12px">
          <div style="font-size:10px;color:#10b981;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">✓ Optimized Assembly</div>
          ${optAsmHtml}
         </div>`;

      activatePhase(7, false);
    } catch(e) {
      const out = document.getElementById('out-7');
      if (out) out.innerHTML = `<div class="alert-err">Optimizer error: ${esc(e.message)}</div>`;
      activatePhase(7, true);
    }
  } catch(outerError) {
    console.error('Compilation outer error:', outerError);
    document.getElementById('out-1').innerHTML = `<div class="alert-err">FATAL: ${esc(outerError.message)}</div>`;
  }
}

// Initialize on page load - comment out auto-compile for safety
// window.addEventListener('DOMContentLoaded', compile);

