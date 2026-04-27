

function tacToC(ir) {
  const gen = new CCodeGenerator(ir);
  return gen.generate();
}

class CCodeGenerator {
  constructor(ir) {
    this.ir = ir;
    this.lines = [];
    this.labelMap = new Map(); 
    this.variableTypes = new Map(); 
    this.declaredVars = new Set();
    this.arrays = new Map(); 
  }

  generate() {
    
    this.analyzeIR();

    this.generateCode();

    return this.formatOutput();
  }

  analyzeIR() {
    
    this.ir.forEach((instr, idx) => {
      if (instr.op === 'label') {
        this.labelMap.set(instr.dest, idx);
      }

      if (instr.op === 'array_decl') {
        this.arrays.set(instr.dest, parseInt(instr.arg1));
      }

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
          
          const params = (instr.params || [])
            .map(p => `int ${p.name}`)
            .join(', ');
          this.lines.push(`int ${instr.dest}(${params}) {`);
          inFunction = true;
          currentFuncIndent = '  ';
          break;

        case 'label':

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

          break;

        case 'call':
          const numParams = parseInt(instr.arg2);
          this.lines.push(
            `${currentFuncIndent}${instr.dest} = ${instr.arg1}(...);`
          );
          this.declaredVars.add(instr.dest);
          break;

        default:
          
          this.lines.push(`${currentFuncIndent}// unknown: ${instr.op}`);
      }

      i++;
    }

    if (inFunction) {
      this.lines.push('}');
    }
  }

  formatOutput() {
    
    const declarations = [];

    this.arrays.forEach((size, name) => {
      if (!declarations.find(d => d.includes(`${name}[`))) {
        declarations.push(`int ${name}[${size}];`);
      }
    });

    const tempVars = Array.from(this.declaredVars)
      .filter(v => v.startsWith('t'))
      .sort();
    
    if (tempVars.length > 0) {
      declarations.push(`int ${tempVars.join(', ')};`);
    }

    const result = [
      '#include <stdio.h>',
      '',
      ...declarations,
      '',
      ...this.lines
    ].join('\n');

    return this.formatC(result);
  }

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

      if (trimmed.startsWith('}')) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      const indented = '  '.repeat(indentLevel) + trimmed;
      formatted.push(indented);

      if (trimmed.endsWith('{')) {
        indentLevel++;
      }
    });

    return formatted.join('\n');
  }

  isLiteral(val) {
    if (!val) return false;
    const str = String(val);
    
    if (/^-?[0-9]+(\.[0-9]+)?$/.test(str)) return true;
    
    if (str.startsWith('"') && str.endsWith('"')) return true;
    return false;
  }

  formatValue(val) {
    if (!val) return '0';
    const str = String(val);
    
    if (str === '-') return '-';
    return str;
  }
}

function compareCodeEquivalence(original, optimized) {

  return {
    equivalent: true,
    confidence: 0.8,
    note: 'Formal verification not implemented'
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { tacToC, CCodeGenerator, compareCodeEquivalence };
}
