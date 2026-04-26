/* ═══════════════════════════════════════════════════════
   ML MODELS: MULTI-MODEL ENSEMBLE FOR COMPILER OPTIMIZATION
   
   Implements 4 different ML models:
   1. Logistic Regression (baseline, fast)
   2. Decision Tree (interpretable)
   3. Random Forest (robust, ensemble)
   4. Neural Network (complex patterns)
   
   Predicts which optimization pass to apply:
   0 = None (no optimization)
   1 = Constant Folding
   2 = Dead Code Elimination
   3 = Common Subexpression Elimination
   4 = Loop Invariant Code Motion
   5 = Loop Unrolling
═══════════════════════════════════════════════════════ */

class LogisticRegressionClassifier {
  constructor(inputSize, numClasses, learningRate = 0.01) {
    this.inputSize = inputSize;
    this.numClasses = numClasses;
    this.learningRate = learningRate;
    this.modelName = "Logistic Regression";
    this.weights = Array(numClasses).fill(0).map(() =>
      Array(inputSize + 1).fill(0).map(() => (Math.random() - 0.5) * 0.01)
    );
    this.loss_history = [];
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
      probabilities: probs,
      modelName: this.modelName
    };
  }

  evaluate(X, Y) {
    let correct = 0;
    for (let i = 0; i < X.length; i++) {
      const pred = this.predict(X[i]);
      if (pred === Y[i]) correct++;
    }
    return correct / X.length;
  }

  toJSON() {
    return {
      inputSize: this.inputSize,
      numClasses: this.numClasses,
      learningRate: this.learningRate,
      weights: this.weights,
      modelName: this.modelName
    };
  }

  static fromJSON(data) {
    const model = new LogisticRegressionClassifier(
      data.inputSize,
      data.numClasses,
      data.learningRate
    );
    model.weights = data.weights;
    return model;
  }
}

class DecisionTreeClassifier {
  constructor(numClasses = 6, maxDepth = 5) {
    this.numClasses = numClasses;
    this.maxDepth = maxDepth;
    this.modelName = "Decision Tree";
    this.tree = null;
  }

  predict(features) {
    return this._predictSample(features, this.tree);
  }

  _predictSample(sample, node) {
    if ('class' in node) {
      return node.class;
    }
    if (sample[node.feature] <= node.threshold) {
      return this._predictSample(sample, node.left);
    } else {
      return this._predictSample(sample, node.right);
    }
  }

  predictWithConfidence(features) {
    const classIdx = this.predict(features);
    return {
      class: classIdx,
      confidence: 0.85, // Decision trees don't give probability by default
      modelName: this.modelName
    };
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

class RandomForestClassifier {
  constructor(numTrees = 10, numClasses = 6) {
    this.numTrees = numTrees;
    this.numClasses = numClasses;
    this.modelName = "Random Forest";
    this.trees = [];
  }

  predict(features) {
    const votes = Array(this.numClasses).fill(0);
    for (let tree of this.trees) {
      const pred = tree.predict(features);
      votes[pred]++;
    }
    return votes.indexOf(Math.max(...votes));
  }

  predictWithConfidence(features) {
    const votes = Array(this.numClasses).fill(0);
    for (let tree of this.trees) {
      const pred = tree.predict(features);
      votes[pred]++;
    }
    const classIdx = votes.indexOf(Math.max(...votes));
    const confidence = votes[classIdx] / this.numTrees;
    return {
      class: classIdx,
      confidence: confidence,
      modelName: this.modelName
    };
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

class NeuralNetworkClassifier {
  constructor(inputSize, numClasses, hiddenSize = 32) {
    this.inputSize = inputSize;
    this.numClasses = numClasses;
    this.hiddenSize = hiddenSize;
    this.modelName = "Neural Network";
    this.W1 = null;
    this.W2 = null;
    this.W3 = null;
  }

  relu(x) {
    return x.map(v => Math.max(0, v));
  }

  softmax(x) {
    const maxScore = Math.max(...x);
    const expScores = x.map(s => Math.exp(s - maxScore));
    const sumExp = expScores.reduce((a, b) => a + b, 0);
    return expScores.map(e => e / sumExp);
  }

  forward(features) {
    // Add bias
    const augmented = [...features, 1];

    // Layer 1: input -> hidden
    const hidden1 = [];
    for (let i = 0; i < this.hiddenSize; i++) {
      let sum = 0;
      for (let j = 0; j < this.inputSize + 1; j++) {
        sum += this.W1[j][i] * augmented[j];
      }
      hidden1.push(Math.max(0, sum)); // ReLU
    }

    // Layer 2: hidden -> hidden
    const augmented2 = [...hidden1, 1];
    const hidden2 = [];
    for (let i = 0; i < this.hiddenSize; i++) {
      let sum = 0;
      for (let j = 0; j < this.hiddenSize + 1; j++) {
        sum += this.W2[j][i] * augmented2[j];
      }
      hidden2.push(Math.max(0, sum)); // ReLU
    }

    // Layer 3: hidden -> output
    const augmented3 = [...hidden2, 1];
    const output = [];
    for (let i = 0; i < this.numClasses; i++) {
      let sum = 0;
      for (let j = 0; j < this.hiddenSize + 1; j++) {
        sum += this.W3[j][i] * augmented3[j];
      }
      output.push(sum);
    }

    return this.softmax(output);
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
      modelName: this.modelName
    };
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

// Multi-Model Manager
class MLModelManager {
  constructor() {
    this.models = {};
    this.modelPerformance = {};
    this.bestModel = null;
    this.featureStats = null;
    this.classNames = [
      'None',
      'Constant Folding',
      'Dead Code Elimination',
      'Common Subexpression Elimination',
      'Loop Invariant Code Motion',
      'Loop Unrolling'
    ];
  }

  normalizeFeatures(features) {
    if (!this.featureStats) return features;
    
    const mean = this.featureStats.mean;
    const std = this.featureStats.std;
    
    return features.map((f, i) => {
      const stdVal = std[i] || 1;
      return (f - mean[i]) / (stdVal + 1e-10);
    });
  }

  loadFromJSON(data) {
    this.featureStats = data.feature_stats;
    this.modelPerformance = data.model_performance || {};
    this.bestModel = data.best_model || 'logistic_regression';
    this.classNames = data.class_names || this.classNames;

    // Load Logistic Regression
    if (data.logistic_regression) {
      const lr_data = data.logistic_regression;
      this.models['logistic_regression'] = LogisticRegressionClassifier.fromJSON(lr_data);
    }

    // Load Decision Tree
    if (data.decision_tree) {
      const dt = new DecisionTreeClassifier(data.decision_tree.num_classes, data.decision_tree.max_depth);
      dt.tree = data.decision_tree.tree;
      this.models['decision_tree'] = dt;
    }

    // Load Random Forest
    if (data.random_forest) {
      const rf = new RandomForestClassifier(data.random_forest.num_trees, data.random_forest.num_classes);
      if (data.random_forest.trees) {
        for (let treeData of data.random_forest.trees) {
          const tree = new DecisionTreeClassifier(data.random_forest.num_classes);
          tree.tree = treeData;
          rf.trees.push(tree);
        }
      }
      this.models['random_forest'] = rf;
    }

    // Load Neural Network
    if (data.neural_network) {
      const nn = new NeuralNetworkClassifier(
        data.neural_network.input_size,
        data.neural_network.num_classes,
        data.neural_network.hidden_size
      );
      nn.W1 = data.neural_network.W1;
      nn.W2 = data.neural_network.W2;
      nn.W3 = data.neural_network.W3;
      this.models['neural_network'] = nn;
    }
  }

  predictWithAllModels(features) {
    const normalized = this.normalizeFeatures(features);
    const results = {};

    for (let [modelName, model] of Object.entries(this.models)) {
      try {
        const prediction = model.predictWithConfidence(normalized);
        results[modelName] = {
          class: prediction.class,
          className: this.classNames[prediction.class],
          confidence: prediction.confidence,
          accuracy: this.modelPerformance[modelName]?.test_accuracy || 0
        };
      } catch (e) {
        console.warn(`Error predicting with ${modelName}:`, e);
      }
    }

    return results;
  }

  predictWithBestModel(features) {
    const normalized = this.normalizeFeatures(features);
    const model = this.models[this.bestModel];
    
    if (!model) {
      console.warn('Best model not loaded');
      return null;
    }

    const prediction = model.predictWithConfidence(normalized);
    return {
      class: prediction.class,
      className: this.classNames[prediction.class],
      confidence: prediction.confidence,
      modelUsed: this.bestModel,
      modelAccuracy: this.modelPerformance[this.bestModel]?.test_accuracy || 0
    };
  }

  getModelComparison(features) {
    const allPredictions = this.predictWithAllModels(features);
    const sorted = Object.entries(allPredictions)
      .sort((a, b) => b[1].confidence - a[1].confidence);

    return {
      best: sorted[0],
      all: allPredictions,
      comparison: sorted.map(([name, pred]) => ({
        model: name,
        prediction: pred.className,
        confidence: (pred.confidence * 100).toFixed(2) + '%',
        modelAccuracy: (pred.accuracy * 100).toFixed(2) + '%'
      }))
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    LogisticRegressionClassifier,
    DecisionTreeClassifier,
    RandomForestClassifier,
    NeuralNetworkClassifier,
    MLModelManager
  };
}
