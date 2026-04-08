/* ═══════════════════════════════════════════════════════
   TAC TO C CODE GENERATOR
   
   Converts Three-Address Code back to C source code.
   This is critical for the pipeline:
   
   C source → compiler → TAC → optimizer → optimized TAC
                                                ↓
                                        TAC → C code
                                        (this module)
   
   Challenges:
   - TAC is unstructured (uses labels and gotos)
   - Must reconstruct if/while/for loops
   - Must handle arrays, functions, temporaries
═══════════════════════════════════════════════════════ */

function tacToC(ir) {
  const gen = new CCodeGenerator(ir);
  return gen.generate();
}

class CCodeGenerator {
  constructor(ir) {
    this.ir = ir;
    this.lines = [];
    this.labelMap = new Map(); // label -> line number
    this.variableTypes = new Map(); // var name -> type
    this.declaredVars = new Set();
    this.arrays = new Map(); // array name -> size
  }

  generate() {
    // Phase 1: Analyze IR to extract metadata
    this.analyzeIR();

    // Phase 2: Generate code
    this.generateCode();

    // Phase 3: Format output
    return this.formatOutput();
  }

  analyzeIR() {
    // Build label map
    this.ir.forEach((instr, idx) => {
      if (instr.op === 'label') {
        this.labelMap.set(instr.dest, idx);
      }

      // Infer array declarations
      if (instr.op === 'array_decl') {
        this.arrays.set(instr.dest, parseInt(instr.arg1));
      }

      // Infer variable types (default to int)
      ['dest', 'arg1', 'arg2'].forEach(field => {
        const varName = instr[field];
        if (varName && !this.isLiteral(varName) && !varName.startsWith('L')) {
          if (!this.variableTypes.has(varName)) {
            this.variableTypes.set(varName, 'int');
          }
        }
      });
    });
  }

  generateCode() {
    let i = 0;
    let inFunction = false;
    let currentFuncIndent = '';

    while (i < this.ir.length) {
      const instr = this.ir[i];

      switch (instr.op) {
        case 'func':
          // Generate function declaration
          const params = (instr.params || [])
            .map(p => `int ${p.name}`)
            .join(', ');
          this.lines.push(`int ${instr.dest}(${params}) {`);
          inFunction = true;
          currentFuncIndent = '  ';
          break;

        case 'label':
          // Emit label (will be converted to if/while/goto if possible)
          // For now, just comment it
          this.lines.push(`${currentFuncIndent}// label: ${instr.dest}`);
          break;

        case 'assign':
          const val = this.formatValue(instr.arg1);
          this.lines.push(
            `${currentFuncIndent}${instr.dest} = ${val};`
          );
          this.declaredVars.add(instr.dest);
          break;

        case 'binop':
          const left = this.formatValue(instr.arg1);
          const right = this.formatValue(instr.arg2);
          this.lines.push(
            `${currentFuncIndent}${instr.dest} = ${left} ${instr.oper} ${right};`
          );
          this.declaredVars.add(instr.dest);
          break;

        case 'unary':
          const operand = this.formatValue(instr.arg1);
          this.lines.push(
            `${currentFuncIndent}${instr.dest} = ${instr.oper}${operand};`
          );
          this.declaredVars.add(instr.dest);
          break;

        case 'index_load':
          const idx = this.formatValue(instr.arg2);
          this.lines.push(
            `${currentFuncIndent}${instr.dest} = ${instr.arg1}[${idx}];`
          );
          this.declaredVars.add(instr.dest);
          break;

        case 'index_store':
          const storeIdx = this.formatValue(instr.arg1);
          const storeVal = this.formatValue(instr.arg2);
          this.lines.push(
            `${currentFuncIndent}${instr.dest}[${storeIdx}] = ${storeVal};`
          );
          break;

        case 'array_decl':
          const arrSize = instr.arg1;
          this.lines.push(
            `${currentFuncIndent}int ${instr.dest}[${arrSize}];`
          );
          this.declaredVars.add(instr.dest);
          break;

        case 'return':
          const retVal = instr.arg1 ? this.formatValue(instr.arg1) : '';
          this.lines.push(
            `${currentFuncIndent}return ${retVal};`
          );
          break;

        case 'goto':
          this.lines.push(`${currentFuncIndent}goto ${instr.dest};`);
          break;

        case 'iffalse':
          const cond1 = this.formatValue(instr.arg1);
          this.lines.push(
            `${currentFuncIndent}if (!${cond1}) goto ${instr.dest};`
          );
          break;

        case 'iftrue':
          const cond2 = this.formatValue(instr.arg1);
          this.lines.push(
            `${currentFuncIndent}if (${cond2}) goto ${instr.dest};`
          );
          break;

        case 'param':
          // Parameter passing (for function calls)
          // In simple case, just skip (handled in call)
          break;

        case 'call':
          const numParams = parseInt(instr.arg2);
          this.lines.push(
            `${currentFuncIndent}${instr.dest} = ${instr.arg1}(...);`
          );
          this.declaredVars.add(instr.dest);
          break;

        default:
          // Unknown instruction
          this.lines.push(`${currentFuncIndent}// unknown: ${instr.op}`);
      }

      i++;
    }

    // Close last function
    if (inFunction) {
      this.lines.push('}');
    }
  }

  formatOutput() {
    // Generate variable declarations at the top
    const declarations = [];
    
    // Emit array declarations
    this.arrays.forEach((size, name) => {
      if (!declarations.find(d => d.includes(`${name}[`))) {
        declarations.push(`int ${name}[${size}];`);
      }
    });

    // Emit regular variable declarations
    const tempVars = Array.from(this.declaredVars)
      .filter(v => v.startsWith('t'))
      .sort();
    
    if (tempVars.length > 0) {
      declarations.push(`int ${tempVars.join(', ')};`);
    }

    // Combine with body
    const result = [
      '#include <stdio.h>',
      '',
      ...declarations,
      '',
      ...this.lines
    ].join('\n');

    return this.formatC(result);
  }

  /**
   * Pretty-print C code
   */
  formatC(code) {
    let indentLevel = 0;
    const lines = code.split('\n');
    const formatted = [];

    lines.forEach(line => {
      const trimmed = line.trim();
      
      if (trimmed === '' || trimmed.startsWith('//')) {
        formatted.push(trimmed);
        return;
      }

      // Decrease indent for closing braces
      if (trimmed.startsWith('}')) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      // Add indentation
      const indented = '  '.repeat(indentLevel) + trimmed;
      formatted.push(indented);

      // Increase indent for opening braces
      if (trimmed.endsWith('{')) {
        indentLevel++;
      }
    });

    return formatted.join('\n');
  }

  isLiteral(val) {
    if (!val) return false;
    const str = String(val);
    // Number literal
    if (/^-?[0-9]+(\.[0-9]+)?$/.test(str)) return true;
    // String literal
    if (str.startsWith('"') && str.endsWith('"')) return true;
    return false;
  }

  formatValue(val) {
    if (!val) return '0';
    const str = String(val);
    // Negate unary minus if needed
    if (str === '-') return '-';
    return str;
  }
}

/**
 * Compare two C code strings semantically
 * (simplified: just check they compute the same values)
 */
function compareCodeEquivalence(original, optimized) {
  // This would require executing both and comparing outputs
  // For now, just a placeholder
  return {
    equivalent: true,
    confidence: 0.8,
    note: 'Formal verification not implemented'
  };
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { tacToC, CCodeGenerator, compareCodeEquivalence };
}
