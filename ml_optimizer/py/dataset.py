#!/usr/bin/env python3
"""
Dataset Pipeline for Compiler Optimizer

Tools for extracting C programs from:
- Project CodeNet (IBM Research)
- POJ-104 (Programming Online Judge)
- Custom datasets

Then generating TAC and labels for training.
"""

import json
import re
import os
from pathlib import Path
from typing import List, Dict, Tuple
import subprocess


class CCodeExtractor:
    """Extract C programs from dataset sources"""
    
    @staticmethod
    def extract_c_files(input_dir: str, output_dir: str, max_files: int = None) -> List[str]:
        """
        Extract .c files from a directory tree
        
        Args:
            input_dir: Root directory containing C files
            output_dir: Where to save extracted files
            max_files: Limit number of files (None = all)
        
        Returns:
            List of extracted file paths
        """
        input_path = Path(input_dir)
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        c_files = list(input_path.rglob('*.c'))
        if max_files:
            c_files = c_files[:max_files]
        
        extracted = []
        for i, src_file in enumerate(c_files):
            try:
                # Read and validate
                code = src_file.read_text(encoding='utf-8', errors='ignore')
                
                # Skip if too small or too large
                if len(code) < 50 or len(code) > 50000:
                    continue
                
                # Normalize code
                code = CCodeExtractor.normalize_code(code)
                
                # Save
                dst_file = output_path / f"program_{i:06d}.c"
                dst_file.write_text(code)
                extracted.append(str(dst_file))
                
                if (i + 1) % 100 == 0:
                    print(f"  Extracted {i + 1}/{len(c_files)} files")
            except Exception as e:
                print(f"  Warning: Failed to extract {src_file}: {e}")
        
        print(f"✓ Extracted {len(extracted)} C files")
        return extracted
    
    @staticmethod
    def normalize_code(code: str) -> str:
        """Normalize C code for consistency"""
        # Remove comments (simple approach)
        code = re.sub(r'//.*?$', '', code, flags=re.MULTILINE)
        code = re.sub(r'/\*.*?\*/', '', code, flags=re.DOTALL)
        
        # Normalize whitespace
        code = re.sub(r'\n\s*\n', '\n', code)
        code = re.sub(r'[ \t]+', ' ', code)
        
        return code.strip()
    
    @staticmethod
    def extract_from_codenet(codenet_dir: str, output_dir: str, 
                            language_id: str = 'c', max_files: int = None) -> List[str]:
        """
        Extract C files from CodeNet directory structure
        
        CodeNet format: p00000/p00000_s*.c
        """
        codenet_path = Path(codenet_dir)
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        print(f"Scanning CodeNet in {codenet_dir} for C files...")
        
        extracted = []
        problem_dirs = sorted(codenet_path.glob('p*'))
        
        for prob_dir in problem_dirs:
            if not prob_dir.is_dir():
                continue
            
            # Find .c files (or .txt files containing C code)
            c_files = list(prob_dir.glob(f'*_s*.c'))
            if not c_files:
                c_files = list(prob_dir.glob(f'*.txt'))
            
            for src_file in c_files:
                if max_files and len(extracted) >= max_files:
                    break
                
                try:
                    code = src_file.read_text(encoding='utf-8', errors='ignore')
                    
                    # Skip small/large files
                    if len(code) < 100 or len(code) > 50000:
                        continue
                    
                    # Normalize
                    code = CCodeExtractor.normalize_code(code)
                    
                    # Save
                    dst_file = output_path / f"codenet_{len(extracted):06d}.c"
                    dst_file.write_text(code)
                    extracted.append(str(dst_file))
                except Exception as e:
                    pass
        
        print(f"✓ Extracted {len(extracted)} C programs from CodeNet")
        return extracted


class TACGenerator:
    """Generate TAC from C programs using the compiler"""
    
    @staticmethod
    def generate_tac(c_file: str, compiler_dir: str):
        """
        Generate TAC for a C file using Node.js compiler
        
        Returns: TAC representation as dict, or None if compilation fails
        """
        try:
            # Read C source
            code = Path(c_file).read_text()
            
            # Create Node.js wrapper to invoke compiler
            node_script = f"""
const fs = require('fs');
// Load compiler modules
eval(fs.readFileSync('{compiler_dir}/phase0_utils.js', 'utf8'));
eval(fs.readFileSync('{compiler_dir}/phase1_lexer.js', 'utf8'));
eval(fs.readFileSync('{compiler_dir}/phase2_parser.js', 'utf8'));
eval(fs.readFileSync('{compiler_dir}/phase3_semantic.js', 'utf8'));
eval(fs.readFileSync('{compiler_dir}/phase4_ir.js', 'utf8'));

const code = `{repr(code)}`;
try {{
  const tokens = lex(code);
  const ast = parse(tokens);
  const ir = generateIR(ast);
  console.log(JSON.stringify(ir));
}} catch(e) {{
  console.error('Error:', e.message);
}}
            """
            
            # Run Node.js
            result = subprocess.run(
                ['node', '-e', node_script],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if result.returncode == 0:
                return json.loads(result.stdout)
            else:
                return None
        except Exception as e:
            return None


class LabelGenerator:
    """Generate labels for training data"""
    
    @staticmethod
    def generate_labels(c_file: str, output_file: str = None) -> Dict:
        """
        Generate optimization labels by compiling with GCC at different levels
        and measuring improvements.
        
        Requires: GCC installed
        
        Labels:
        0 = no optimization
        1 = constant folding
        2 = dead code elimination
        3 = cse
        4 = licm
        5 = loop unrolling
        """
        try:
            # Compile with different optimization levels
            metrics = {}
            
            for opt_level in ['O0', 'O1', 'O2', 'O3']:
                try:
                    # Compile
                    exe = f'/tmp/test_{opt_level}'
                    compile_cmd = f'gcc -{opt_level} {c_file} -o {exe} 2>/dev/null'
                    ret = os.system(compile_cmd)
                    
                    if ret == 0:
                        # Get binary size as proxy for optimization
                        size = os.path.getsize(exe)
                        metrics[opt_level] = size
                        os.remove(exe)
                except:
                    pass
            
            # Determine best optimization level
            if not metrics:
                return {'label': 0, 'details': 'compilation failed'}
            
            best_opt = min(metrics, key=metrics.get)
            size_reduction = (metrics.get('O0', 1) - metrics.get(best_opt, 1)) / metrics.get('O0', 1)
            
            # Map to optimization pass
            label = int(best_opt[-1]) if best_opt in ['O1', 'O2', 'O3'] else 0
            
            return {
                'label': label,
                'best_opt': best_opt,
                'size_reduction': size_reduction,
                'metrics': metrics
            }
        
        except Exception as e:
            return {'label': 0, 'error': str(e)}


class DatasetManager:
    """Manage training dataset creation and storage"""
    
    def __init__(self, dataset_dir: str):
        self.dataset_dir = Path(dataset_dir)
        self.dataset_dir.mkdir(parents=True, exist_ok=True)
        self.metadata = self._load_metadata()
    
    def _load_metadata(self) -> Dict:
        """Load existing metadata"""
        meta_file = self.dataset_dir / 'metadata.json'
        if meta_file.exists():
            return json.loads(meta_file.read_text())
        return {'samples': [], 'stats': {}}
    
    def _save_metadata(self):
        """Save metadata"""
        meta_file = self.dataset_dir / 'metadata.json'
        meta_file.write_text(json.dumps(self.metadata, indent=2))
    
    def add_sample(self, c_file: str, tac: List, label: int, 
                  tac_features: Dict = None, source: str = 'custom'):
        """Add training sample"""
        sample_id = len(self.metadata['samples'])
        
        sample = {
            'id': sample_id,
            'source': source,
            'label': label,
            'tac_length': len(tac),
            'features': tac_features or {}
        }
        
        # Save TAC
        tac_file = self.dataset_dir / f'tac_{sample_id}.json'
        tac_file.write_text(json.dumps(tac, indent=2))
        sample['tac_file'] = str(tac_file)
        
        # Save source code
        code_file = self.dataset_dir / f'code_{sample_id}.c'
        code_file.write_text(Path(c_file).read_text())
        sample['code_file'] = str(code_file)
        
        self.metadata['samples'].append(sample)
        self._save_metadata()
    
    def export_features_csv(self, output_file: str):
        """Export features for ML training (CSV format)"""
        import csv
        
        rows = []
        for sample in self.metadata['samples']:
            feat = sample.get('features', {})
            row = {
                'id': sample['id'],
                'label': sample['label'],
                'instruction_count': feat.get('instruction_count', 0),
                'number_of_temporaries': feat.get('number_of_temporaries', 0),
                'arithmetic_operations': feat.get('arithmetic_operations', 0),
                'memory_access_count': feat.get('memory_access_count', 0),
                'branch_count': feat.get('branch_count', 0),
                'loop_count': feat.get('loop_count', 0),
                'loop_nesting_depth': feat.get('loop_nesting_depth', 0),
                'repeated_expressions': feat.get('repeated_expressions', 0),
                'constant_expressions': feat.get('constant_expressions', 0),
                'dead_assignments': feat.get('dead_assignments', 0),
            }
            rows.append(row)
        
        with open(output_file, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=rows[0].keys() if rows else [])
            writer.writeheader()
            writer.writerows(rows)
        
        print(f"✓ Exported {len(rows)} samples to {output_file}")


def main():
    """Example usage"""
    print("=" * 70)
    print("DATASET PIPELINE FOR COMPILER OPTIMIZER")
    print("=" * 70)
    
    # Example: extract from local directory
    print("\n[Example] To use this pipeline:")
    print("  1. Download CodeNet or POJ-104")
    print("  2. Call CCodeExtractor.extract_from_codenet()")
    print("  3. Use TACGenerator.generate_tac() for each file")
    print("  4. Use LabelGenerator.generate_labels() for each file")
    print("  5. Use DatasetManager to store samples")
    
    # Create sample dataset manager
    dm = DatasetManager('/tmp/compiler_dataset')
    print(f"\n✓ Dataset manager ready at: {dm.dataset_dir}")


if __name__ == '__main__':
    main()
