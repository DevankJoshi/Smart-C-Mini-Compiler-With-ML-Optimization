/* ═══════════════════════════════════════════════════════
   ML MODEL: MULTICLASS LOGISTIC REGRESSION (FROM SCRATCH)
   
   Predicts which optimization pass to apply:
   0 = None (no optimization)
   1 = Constant Folding
   2 = Dead Code Elimination
   3 = Common Subexpression Elimination
   4 = Loop Invariant Code Motion (simplified)
   5 = Loop Unrolling (simplified)
   
   Model architecture:
   - Input: 10 features (normalized)
   - Hidden: None (direct classification)
   - Output: 6 classes (softmax)
   
   Training: Stochastic Gradient Descent with cross-entropy loss
═══════════════════════════════════════════════════════ */

class LogisticRegressionClassifier {
  constructor(inputSize, numClasses, learningRate = 0.01) {
    this.inputSize = inputSize;
    this.numClasses = numClasses;
    this.learningRate = learningRate;
    
    // Initialize weights: (numClasses) x (inputSize + 1 for bias)
    this.weights = Array(numClasses).fill(0).map(() =>
      Array(inputSize + 1).fill(0).map(() => (Math.random() - 0.5) * 0.01)
    );
    
    this.loss_history = [];
    this.epoch_history = [];
  }

  /**
   * Softmax activation: converts raw scores to probabilities
   */
  softmax(scores) {
    const maxScore = Math.max(...scores);
    const expScores = scores.map(s => Math.exp(s - maxScore));
    const sumExp = expScores.reduce((a, b) => a + b, 0);
    return expScores.map(e => e / sumExp);
  }

  /**
   * Forward pass: compute softmax probabilities for a sample
   */
  forward(features) {
    // Add bias term (1) to features
    const augmented = [...features, 1];
    
    // Compute logits: z = W * x
    const logits = this.weights.map(w =>
      w.reduce((sum, wij, j) => sum + wij * augmented[j], 0)
    );
    
    // Apply softmax
    return this.softmax(logits);
  }

  /**
   * Predict class (argmax of probabilities)
   */
  predict(features) {
    const probs = this.forward(features);
    return probs.indexOf(Math.max(...probs));
  }

  /**
   * Predict with confidence
   */
  predictWithConfidence(features) {
    const probs = this.forward(features);
    const classIdx = probs.indexOf(Math.max(...probs));
    return {
      class: classIdx,
      confidence: probs[classIdx],
      probabilities: probs
    };
  }

  /**
   * Cross-entropy loss
   */
  computeLoss(X, Y) {
    let totalLoss = 0;
    for (let i = 0; i < X.length; i++) {
      const probs = this.forward(X[i]);
      const trueClass = Y[i];
      const logProb = Math.log(Math.max(probs[trueClass], 1e-10));
      totalLoss -= logProb;
    }
    return totalLoss / X.length;
  }

  /**
   * Train using SGD
   * X: array of feature vectors (each is array of 10 numbers)
   * Y: array of labels (0-5)
   */
  train(X, Y, epochs = 100, batchSize = 32, verbose = true) {
    const n = X.length;
    
    for (let epoch = 0; epoch < epochs; epoch++) {
      // Shuffle data
      const indices = Array.from({length: n}, (_, i) => i);
      for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }

      // Mini-batch updates
      for (let b = 0; b < n; b += batchSize) {
        const batchEnd = Math.min(b + batchSize, n);
        const batchIndices = indices.slice(b, batchEnd);

        // Compute gradient for this batch
        const gradients = Array(this.numClasses).fill(0)
          .map(() => Array(this.inputSize + 1).fill(0));

        batchIndices.forEach(i => {
          const augmented = [...X[i], 1];
          const probs = this.forward(X[i]);
          
          // Gradient: (probs[k] - (k === Y[i] ? 1 : 0)) * augmented
          for (let k = 0; k < this.numClasses; k++) {
            const error = probs[k] - (k === Y[i] ? 1 : 0);
            for (let j = 0; j <= this.inputSize; j++) {
              gradients[k][j] += error * augmented[j];
            }
          }
        });

        // Update weights
        const batchSize_actual = batchEnd - b;
        for (let k = 0; k < this.numClasses; k++) {
          for (let j = 0; j <= this.inputSize; j++) {
            const grad = gradients[k][j] / batchSize_actual;
            this.weights[k][j] -= this.learningRate * grad;
          }
        }
      }

      // Compute loss
      const loss = this.computeLoss(X, Y);
      this.loss_history.push(loss);
      this.epoch_history.push(epoch);

      if (verbose && (epoch + 1) % 10 === 0) {
        console.log(`Epoch ${epoch + 1}/${epochs}, Loss: ${loss.toFixed(6)}`);
      }
    }
  }

  /**
   * Save model weights to JSON
   */
  toJSON() {
    return {
      inputSize: this.inputSize,
      numClasses: this.numClasses,
      learningRate: this.learningRate,
      weights: this.weights,
      loss_history: this.loss_history,
      epoch_history: this.epoch_history
    };
  }

  /**
   * Load model from JSON
   */
  static fromJSON(data) {
    const model = new LogisticRegressionClassifier(
      data.inputSize,
      data.numClasses,
      data.learningRate
    );
    model.weights = data.weights;
    model.loss_history = data.loss_history || [];
    model.epoch_history = data.epoch_history || [];
    return model;
  }

  /**
   * Compute accuracy on test set
   */
  evaluate(X, Y) {
    let correct = 0;
    for (let i = 0; i < X.length; i++) {
      const pred = this.predict(X[i]);
      if (pred === Y[i]) correct++;
    }
    return correct / X.length;
  }
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LogisticRegressionClassifier };
}
