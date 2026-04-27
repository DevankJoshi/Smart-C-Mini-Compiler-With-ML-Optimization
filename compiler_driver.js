
async function compile() {
  
  if (typeof mlModelManager !== 'undefined' && mlModelManager === null && typeof initializeMLModels === 'function') {
    try {
      await initializeMLModels();
    } catch(e) {
      console.warn('ML model init failed during compile:', e);
    }
  }
  try {
    resetAll();
    const src=document.getElementById('src-editor').value.trim();
    if(!src) return;

    let tokens;
    try {
      tokens=lex(src);
      window.lastLexerOutput = tokens;  
      document.getElementById('out-1').innerHTML=renderTokens(tokens);
      activatePhase(1,false);
    } catch(e) {
      document.getElementById('out-1').innerHTML=`<div class="alert-err">Lexer error: ${esc(e.message)}</div>`;
      activatePhase(1,true); return;
    }

    let ast;
    try {
      ast=parse(tokens);
      window.lastParserOutput = ast;  
      document.getElementById('out-2').innerHTML=astToSvg(ast);
      activatePhase(2,false);
    } catch(e) {
      document.getElementById('out-2').innerHTML=`<div class="alert-err">Parse error: ${esc(e.message)}</div>`;
      activatePhase(2,true); return;
    }

    try {
      const sem=semanticAnalysis(ast);
      window.lastSemanticOutput = sem;  
      document.getElementById('out-3').innerHTML=renderSemantic(sem);
      activatePhase(3, sem.errors.length>0);
    } catch(e) {
      document.getElementById('out-3').innerHTML=`<div class="alert-err">Semantic error: ${esc(e.message)}</div>`;
      activatePhase(3,true);
    }

    let ir;
    try {
      ir=generateIR(ast);
      window.lastIROutput = ir;  
      document.getElementById('out-4').innerHTML=renderIR(ir);
      activatePhase(4,false);
    } catch(e) {
      document.getElementById('out-4').innerHTML=`<div class="alert-err">IR error: ${esc(e.message)}</div>`;
      activatePhase(4,true); return;
    }

    let asm;
    try {
      asm = generateAsm(ir);
      window.lastCodegenOutput = asm;  
      document.getElementById('out-5').innerHTML = renderAsm(asm);
      activatePhase(5, false);
    } catch(e) {
      document.getElementById('out-5').innerHTML = `<div class="alert-err">Codegen error: ${esc(e.message)}</div>`;
      activatePhase(5, true);
    }

    try {
      if (typeof execute !== 'function') {
        throw new Error(`execute function not found. Available functions: ${Object.keys(window).filter(k => typeof window[k] === 'function').slice(0,20).join(', ')}`);
      }
      const result = execute(ast);
      window.lastExecOutput = result;  
      document.getElementById('out-6').innerHTML = renderExec(result);
      activatePhase(6, false);
    } catch(e) {
      document.getElementById('out-6').innerHTML = `<div class="alert-err">Runtime error: ${esc(e.message)}</div>`;
      activatePhase(6, true);
    }

    let mlReport = null;
    try {
      const useMLPath = (typeof optimizeTACWithML === 'function');
      const { optimizedIR, report } = useMLPath
        ? optimizeTACWithML(ir, true)
        : optimizeTAC(ir);

      mlReport = report;

      document.getElementById('out-7').innerHTML =
        renderOptimizerResult(ir, optimizedIR, report);

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

    try {
      const report8 = mlReport || window.lastMLReport;
      if (report8 && report8.ml_report && typeof renderMLComparison === 'function') {
        renderMLComparison(report8);
        activatePhase(8, false);
      } else if (report8 && !report8.ml_report) {
        document.getElementById('out-8').innerHTML = '<span style="color:var(--text3)">⚠️ ML models not loaded. Make sure you are serving the page from a local server (not file://) so the model JSON can be fetched.</span>';
        activatePhase(8, false);
      } else {
        document.getElementById('out-8').innerHTML = '<span style="color:var(--text3)">No ML analysis available. Compile code first.</span>';
        activatePhase(8, false);
      }
    } catch(e) {
      const out = document.getElementById('out-8');
      if (out) out.innerHTML = `<div class="alert-err">ML Comparison error: ${esc(e.message)}<br><small>${esc(e.stack||'')}</small></div>`;
      activatePhase(8, true);
    }
  } catch(outerError) {
    console.error('Compilation outer error:', outerError);
    document.getElementById('out-1').innerHTML = `<div class="alert-err">FATAL: ${esc(outerError.message)}</div>`;
  }
}



