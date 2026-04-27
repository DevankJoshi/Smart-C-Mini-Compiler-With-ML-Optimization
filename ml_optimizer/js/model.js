

class LogisticRegressionClassifier {
  constructor(inputSize, numClasses, learningRate = 0.01) {
    this.inputSize = inputSize;
    this.numClasses = numClasses;
    this.learningRate = learningRate;

    this.weights = Array(numClasses).fill(0).map(() =>
      Array(inputSize + 1).fill(0).map(() => (Math.random() - 0.5) * 0.01)
    );

    this.loss_history = [];
    this.epoch_history = [];
  }

  softmax(scores) {
    const maxScore = Math.max(...scores);
    const expScores = scores.map(s => Math.exp(s - maxScore));
    const sumExp = expScores.reduce((a, b) => a + b, 0);
    return expScores.map(e => e / sumExp);
  }

  forward(features) {
    
    const augmented = [...features, 1];

    const logits = this.weights.map(w =>
      w.reduce((sum, wij, j) => sum + wij * augmented[j], 0)
    );

    return this.softmax(logits);
  }

  predict(features) {
    const probs = this.forward(features);
    return probs.indexOf(Math.max(...probs));
  }

  predictWithConfidence(features) {
    const probs = this.forward(features);
    const classIdx = probs.indexOf(Math.max(...probs));
    return {
      class: classIdx,
      confidence: probs[classIdx],
      probabilities: probs
    };
  }

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

  train(X, Y, epochs = 100, batchSize = 32, verbose = true) {
    const n = X.length;

    for (let epoch = 0; epoch < epochs; epoch++) {
      
      const indices = Array.from({ length: n }, (_, i) => i);
      for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }

      for (let b = 0; b < n; b += batchSize) {
        const batchEnd = Math.min(b + batchSize, n);
        const batchIndices = indices.slice(b, batchEnd);

        const gradients = Array(this.numClasses).fill(0)
          .map(() => Array(this.inputSize + 1).fill(0));

        batchIndices.forEach(i => {
          const augmented = [...X[i], 1];
          const probs = this.forward(X[i]);

          for (let k = 0; k < this.numClasses; k++) {
            const error = probs[k] - (k === Y[i] ? 1 : 0);
            for (let j = 0; j <= this.inputSize; j++) {
              gradients[k][j] += error * augmented[j];
            }
          }
        });

        const batchSize_actual = batchEnd - b;
        for (let k = 0; k < this.numClasses; k++) {
          for (let j = 0; j <= this.inputSize; j++) {
            const grad = gradients[k][j] / batchSize_actual;
            this.weights[k][j] -= this.learningRate * grad;
          }
        }
      }

      const loss = this.computeLoss(X, Y);
      this.loss_history.push(loss);
      this.epoch_history.push(epoch);

      if (verbose && (epoch + 1) % 10 === 0) {
        console.log(`Epoch ${epoch + 1}/${epochs}, Loss: ${loss.toFixed(6)}`);
      }
    }
  }

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

  evaluate(X, Y) {
    let correct = 0;
    for (let i = 0; i < X.length; i++) {
      const pred = this.predict(X[i]);
      if (pred === Y[i]) correct++;
    }
    return correct / X.length;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LogisticRegressionClassifier };
}
