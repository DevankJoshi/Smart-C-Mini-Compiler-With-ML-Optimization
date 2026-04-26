# 🤖 ML Model Comparison Panel - User Guide

## Overview

The new **Phase 8: ML Model Comparison** panel displays detailed information about all 4 ML models running on your compiled C code. This gives you full transparency into how each model predicts which optimization to apply.

## What You'll See

### 1. **Best Model Selected** (Purple Header)
- The model with the highest accuracy that was chosen for optimization
- Its prediction for the best optimization pass
- The confidence score for that prediction
- The model's overall training accuracy

Example:
```
🏆 BEST MODEL SELECTED
Model: Logistic Regression
Prediction: Constant Folding
Confidence: 87.5%
Model Accuracy: 99.78%
```

### 2. **All Models Predictions Table**
A comprehensive table showing all 4 models side-by-side:

| Model | Prediction | Confidence | Model Accuracy |
|-------|-----------|-----------|-----------------|
| Logistic Regression ⭐ | Constant Folding | 87.5% | 99.78% |
| Decision Tree | Constant Folding | 85.0% | 100% |
| Random Forest | Constant Folding | 93.3% | 100% |
| Neural Network | Dead Code Elimination | 42.0% | 20.82% |

**What Each Column Means:**
- **Model**: The name of the ML model
- **Prediction**: What optimization the model recommends
- **Confidence**: How confident the model is in its prediction (0-100%)
- **Model Accuracy**: The overall accuracy of this model on the training data

### 3. **Model Details Cards**
Individual cards for each model showing:
- Model name with color indicator
- Its specific prediction
- Confidence score
- Model accuracy rating
- "⭐ SELECTED" badge if this is the best model

Color-coded by model:
- 🟣 **Logistic Regression** - Purple (#667eea)
- 🌸 **Decision Tree** - Pink (#f093fb)
- 🟢 **Random Forest** - Green (#4CAF50)
- 🟠 **Neural Network** - Orange (#FF9800)

### 4. **Consensus Analysis**
Shows how much agreement there is among the 4 models:

```
Agreement Level: 🟢 High Consensus (75% of models agree)
Unique Predictions: 1
All Predictions: Constant Folding: 3/4 (75%)
```

**Consensus Levels:**
- 🟢 **High Consensus**: 75%+ models agree → Reliable recommendation
- 🟡 **Moderate Consensus**: 50-75% agree → Worth checking alternatives
- 🔴 **Low Consensus**: <50% agree → Consider manual optimization

### 5. **Extracted Features**
Shows the 10 features extracted from your C code that were used to make the predictions:

```
📊 EXTRACTED FEATURES
• Instructions: 45
• Temporaries: 12
• Arithmetic Ops: 18
• Memory Access: 8
• Branches: 5
• Loops: 0
• Nesting Depth: 0
• Repeated Expr: 3
• Constant Expr: 8 ← Why Constant Folding was recommended!
• Dead Assigns: 1
```

Each feature has a bar showing its relative value compared to other features in your code.

### 6. **Optimization Comparison**
Details about what each model recommends:

```
⚙️ OPTIMIZATION COMPARISON

🔢 Logistic Regression
Predicts: Constant Folding
Pre-compute constant expressions
Benefit: Speed: Reduces computation at runtime
Confidence: 87.5%

🔄 Random Forest
Predicts: Common Subexpression Elimination
Eliminate duplicate expressions
Benefit: Speed: Reduces redundant calculations
Confidence: 93.3%

... (shows all 4 models)
```

**Optimization Types:**
- 🔢 **Constant Folding** - Speed optimization, reduces runtime computation
- 🗑️ **Dead Code Elimination** - Size optimization, removes unused code
- ♻️ **CSE** - Speed optimization, eliminates duplicate calculations
- 🔄 **Loop Motion** - Speed optimization, moves invariant code out of loops
- 📋 **Loop Unrolling** - Speed optimization, expands loop bodies
- ⚪ **None** - Keep original code

## How to Read the Data

### High Confidence Score (>80%)
- The model is very sure about its prediction
- Safe to trust the recommendation
- Apply the optimization

### Medium Confidence (50-80%)
- The model is somewhat sure
- Check if the optimization makes sense for your code
- Look at the extracted features to understand why

### Low Confidence (<50%)
- The model is uncertain
- Consider manual optimization selection
- Multiple models might disagree

### Model Accuracy
- **>85%**: Reliable model - trust its predictions
- **50-85%**: Decent model - use with caution
- **<50%**: Uncertain model - take recommendation as suggestion only

## Example Scenario

You compile this C code:
```c
int main() {
    int x = 5 + 3;  // constant expression
    int y = x * 2;
    int z = 5 + 3;  // repeated constant expression
    return y;
}
```

The panel might show:

```
📊 EXTRACTED FEATURES
• Constant Expr: 8 (highest among your features)

🏆 BEST MODEL SELECTED
Model: Logistic Regression
Prediction: Constant Folding ✓
Confidence: 99.9%
Model Accuracy: 99.78%

🟡 CONSENSUS ANALYSIS
Agreement Level: 🟢 High Consensus (100%)
All 4 models agree: Constant Folding

⚙️ OPTIMIZATION COMPARISON
🔢 Constant Folding recommended by all models
Pre-compute: 5 + 3 = 8
This eliminates redundant calculations
```

**Result**: All models agree → Apply Constant Folding optimization

## Tips for Using the Panel

1. **When consensus is high (>75%)**: Trust the recommendation
2. **When consensus is low**: Check the features and manual alternatives
3. **When a model has low accuracy**: Give more weight to other models
4. **Compare confidences**: The model with highest confidence makes the recommendation
5. **Look at features**: Understand WHY each model made its prediction

## Technical Details

### The 4 Models

1. **Logistic Regression** (Best Overall)
   - Training Accuracy: 99.78%
   - Speed: <1ms per prediction
   - Most reliable for production use

2. **Decision Tree**
   - Training Accuracy: 100%
   - Transparent rules: You can see exactly why it made a decision
   - Good for understanding model logic

3. **Random Forest**
   - Training Accuracy: 100%
   - Ensemble of 15 trees with voting
   - Robust to edge cases

4. **Neural Network**
   - Training Accuracy: 20.82%
   - Fast inference: <2ms
   - Useful as ensemble component

### How Predictions Are Made

1. **Feature Extraction**: 10 features extracted from your Three-Address Code (TAC)
2. **Normalization**: Features scaled to 0-1 range based on training data statistics
3. **Prediction**: Each model independently predicts the best optimization
4. **Selection**: The model with highest accuracy is chosen to select the final optimization
5. **Application**: The selected optimization is applied to your TAC

### Why Different Models?

Multiple models provide:
- **Validation**: Cross-check predictions
- **Robustness**: If one fails, others still work
- **Transparency**: See how different algorithms approach the problem
- **Ensemble Benefits**: Consensus voting is more reliable than single model

## Frequently Asked Questions

**Q: Why do models sometimes disagree?**
A: Different algorithms find different patterns in the code. Multiple disagreements might indicate the code is ambiguous about which optimization is best.

**Q: Which model should I trust?**
A: Look at the Model Accuracy column. Logistic Regression (99.78%) is most reliable. If consensus is high, any model is safe.

**Q: What if I disagree with the recommendation?**
A: You can manually select optimizations in Phase 7. The ML system is a guide, not mandatory.

**Q: Why is confidence sometimes low?**
A: The code features are uncommon in the training data, or the code genuinely needs careful analysis. Lower confidence = more caution needed.

**Q: How often is the model retrained?**
A: You can manually retrain with: `python3 ml_optimizer/py/train.py`
This uses a dataset of 5,000 synthetic C programs.

## Next Steps

1. **Explore different code samples** (loop, arrays, functions) to see how recommendations change
2. **Note patterns** in consensus for different code types
3. **Try manual vs ML optimizations** to compare results
4. **Retrain models** with real C code for better predictions

---

**Want to learn more?** Check out:
- `MULTI_MODEL_README.md` - Quick technical overview
- `ML_MODELS_DOCUMENTATION.md` - Deep technical details
- `MULTI_MODEL_IMPLEMENTATION.md` - How each model works

