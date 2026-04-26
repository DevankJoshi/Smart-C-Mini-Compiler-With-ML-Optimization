#!/usr/bin/env python3
"""
ML Training Pipeline for Compiler Optimizer - ENHANCED

Generates synthetic training data with 5000+ samples and trains 4 different models:
1. Logistic Regression (baseline)
2. Decision Tree (rule-based)
3. Random Forest (ensemble)
4. Neural Network (deep learning)

Compares accuracy and generates reports for web interface.
"""

import json
import numpy as np
import sys
from pathlib import Path
from collections import defaultdict

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / 'py'))


class SyntheticDatasetGenerator:
    """Generate synthetic program characteristics for training"""
    
    def __init__(self, num_samples=5000, seed=42):
        np.random.seed(seed)
        self.num_samples = num_samples
    
    def generate_features(self):
        """Generate random feature vectors with realistic correlations and balance"""
        X = []
        Y = []
        
        # Generate balanced samples - ensure each class is well represented
        samples_per_class = self.num_samples // 6
        
        for target_class in range(6):
            for _ in range(samples_per_class):
                features = self._generate_sample_for_class(target_class)
                X.append(features)
                Y.append(target_class)
        
        # Add extra diverse samples for robustness
        for _ in range(self.num_samples - len(X)):
            inst_count = np.random.randint(5, 150)
            num_temps = max(1, int(inst_count * np.random.uniform(0.1, 0.5)))
            arith_ops = np.random.randint(0, max(1, inst_count // 2))
            mem_access = np.random.randint(0, 40)
            branch_count = np.random.randint(0, 30)
            loop_count = np.random.randint(0, 8)
            nesting = min(loop_count, np.random.randint(0, 5)) if loop_count > 0 else 0
            repeated = np.random.randint(0, 25)
            const_exprs = np.random.randint(0, 15)
            dead_assigns = np.random.randint(0, 30)
            
            features = [
                inst_count, num_temps, arith_ops, mem_access, branch_count,
                loop_count, nesting, repeated, const_exprs, dead_assigns
            ]
            
            label = self._assign_label(features)
            X.append(features)
            Y.append(label)
        
        return np.array(X), np.array(Y)
    
    def _generate_sample_for_class(self, target_class):
        """Generate features biased toward a specific optimization class"""
        if target_class == 0:  # None
            inst_count = np.random.randint(5, 30)
            repeated = np.random.randint(0, 3)
            const_exprs = np.random.randint(0, 3)
            dead_assigns = np.random.randint(0, 3)
            loop_count = np.random.randint(0, 1)
        elif target_class == 1:  # Constant Folding
            inst_count = np.random.randint(20, 80)
            const_exprs = np.random.randint(6, 15)
            repeated = np.random.randint(0, 5)
            dead_assigns = np.random.randint(0, 5)
            loop_count = np.random.randint(0, 2)
        elif target_class == 2:  # Dead Code Elimination
            inst_count = np.random.randint(30, 100)
            dead_assigns = np.random.randint(9, 25)
            const_exprs = np.random.randint(0, 5)
            repeated = np.random.randint(0, 5)
            loop_count = np.random.randint(0, 2)
        elif target_class == 3:  # CSE
            inst_count = np.random.randint(40, 120)
            repeated = np.random.randint(6, 20)
            const_exprs = np.random.randint(0, 8)
            dead_assigns = np.random.randint(0, 8)
            loop_count = np.random.randint(0, 3)
        elif target_class == 4:  # LICM
            inst_count = np.random.randint(50, 130)
            loop_count = np.random.randint(3, 7)
            const_exprs = np.random.randint(3, 12)
            repeated = np.random.randint(2, 10)
            dead_assigns = np.random.randint(0, 5)
        else:  # Loop Unrolling (class 5)
            inst_count = np.random.randint(60, 150)
            loop_count = np.random.randint(2, 8)
            repeated = np.random.randint(4, 15)
            const_exprs = np.random.randint(2, 10)
            dead_assigns = np.random.randint(0, 5)
        
        num_temps = max(1, int(inst_count * np.random.uniform(0.1, 0.5)))
        arith_ops = np.random.randint(0, max(1, inst_count // 2))
        mem_access = np.random.randint(0, 40)
        branch_count = np.random.randint(0, 30)
        nesting = min(loop_count, np.random.randint(0, 5)) if loop_count > 0 else 0
        
        return [
            inst_count, num_temps, arith_ops, mem_access, branch_count,
            loop_count, nesting, repeated, const_exprs, dead_assigns
        ]
    
    def _assign_label(self, features):
        """Assign optimization label based on features with improved logic"""
        inst, temps, arith, mem, branch, loops, depth, repeat, const, dead = features
        
        # Calculate scores for each optimization
        scores = [0.0] * 6
        
        # Class 0: None - simple programs
        if inst < 20 and repeat < 2 and const < 2 and dead < 2:
            scores[0] = 10
        
        # Class 1: Constant Folding - high constant expressions
        if const > 6:
            scores[1] += 8
        scores[1] += const * 0.5
        
        # Class 2: Dead Code Elimination - many dead assignments
        if dead > 8:
            scores[2] += 8
        scores[2] += dead * 0.4
        
        # Class 3: Common Subexpression Elimination - repeated expressions
        if repeat > 6:
            scores[3] += 8
        scores[3] += repeat * 0.5
        
        # Class 4: LICM - loops with high nesting
        if loops >= 2 and depth >= 1:
            scores[4] += 6
        scores[4] += loops * depth * 2
        
        # Class 5: Loop Unrolling - many loops
        if loops >= 2:
            scores[5] += 6
        scores[5] += loops * 1.5
        
        # Return class with highest score
        best_class = 0
        best_score = scores[0]
        for i in range(1, 6):
            if scores[i] > best_score:
                best_score = scores[i]
                best_class = i
        
        return best_class


class LogisticRegressionClassifier:
    """Multiclass Logistic Regression from scratch"""
    
    def __init__(self, input_size, num_classes, learning_rate=0.01):
        self.input_size = input_size
        self.num_classes = num_classes
        self.learning_rate = learning_rate
        self.model_name = "Logistic Regression"
        
        # Initialize weights: (num_classes) x (input_size + 1 for bias)
        self.weights = np.random.normal(0, 0.01, (num_classes, input_size + 1))
        
        self.loss_history = []
        self.epoch_history = []
    
    def softmax(self, scores):
        """Softmax activation"""
        max_score = np.max(scores, axis=1, keepdims=True)
        exp_scores = np.exp(scores - max_score)
        return exp_scores / np.sum(exp_scores, axis=1, keepdims=True)
    
    def forward(self, X):
        """Forward pass"""
        # Add bias term (1) to features
        X_aug = np.hstack([X, np.ones((X.shape[0], 1))])
        # Compute logits
        logits = X_aug @ self.weights.T
        # Apply softmax
        return self.softmax(logits)
    
    def predict(self, X):
        """Predict class"""
        probs = self.forward(X)
        return np.argmax(probs, axis=1)
    
    def compute_loss(self, X, Y):
        """Cross-entropy loss"""
        probs = self.forward(X)
        # Clip probabilities to avoid log(0)
        probs = np.clip(probs, 1e-10, 1)
        # One-hot encode Y
        Y_one_hot = np.eye(self.num_classes)[Y]
        # Cross-entropy
        loss = -np.mean(np.sum(Y_one_hot * np.log(probs), axis=1))
        return loss
    
    def train(self, X, Y, epochs=100, batch_size=32, verbose=True):
        """Train using SGD"""
        n = X.shape[0]
        
        for epoch in range(epochs):
            # Shuffle data
            indices = np.random.permutation(n)
            X_shuffled = X[indices]
            Y_shuffled = Y[indices]
            
            # Mini-batch updates
            for b in range(0, n, batch_size):
                X_batch = X_shuffled[b:b+batch_size]
                Y_batch = Y_shuffled[b:b+batch_size]
                
                # Forward pass
                X_aug = np.hstack([X_batch, np.ones((X_batch.shape[0], 1))])
                probs = self.forward(X_batch)
                
                # Compute gradient
                Y_one_hot = np.eye(self.num_classes)[Y_batch]
                error = probs - Y_one_hot
                gradient = (error.T @ X_aug) / X_batch.shape[0]
                
                # Update weights
                self.weights -= self.learning_rate * gradient
            
            # Compute loss
            loss = self.compute_loss(X, Y)
            self.loss_history.append(loss)
            self.epoch_history.append(epoch)
            
            if verbose and (epoch + 1) % 10 == 0:
                print(f"Epoch {epoch + 1}/{epochs}, Loss: {loss:.6f}")
        
        print(f"Training complete. Final loss: {loss:.6f}")
    
    def evaluate(self, X, Y):
        """Compute accuracy"""
        predictions = self.predict(X)
        accuracy = np.mean(predictions == Y)
        return accuracy
    
    def to_dict(self):
        """Convert to dictionary for JSON export"""
        return {
            'input_size': int(self.input_size),
            'num_classes': int(self.num_classes),
            'learning_rate': float(self.learning_rate),
            'weights': self.weights.tolist(),
            'loss_history': self.loss_history,
            'epoch_history': self.epoch_history
        }


class DecisionTreeClassifier:
    """Simple Decision Tree from scratch"""
    
    def __init__(self, num_classes=6, max_depth=5):
        self.num_classes = num_classes
        self.max_depth = max_depth
        self.model_name = "Decision Tree"
        self.tree = None
        self.feature_names = [
            'inst_count', 'num_temps', 'arith_ops', 'mem_access', 'branch_count',
            'loop_count', 'nesting', 'repeated', 'const_exprs', 'dead_assigns'
        ]
    
    def _entropy(self, y):
        """Calculate entropy"""
        unique, counts = np.unique(y, return_counts=True)
        probs = counts / len(y)
        return -np.sum(probs * np.log2(probs + 1e-10))
    
    def _information_gain(self, parent, left_child, right_child):
        """Calculate information gain"""
        n = len(parent)
        n_left = len(left_child)
        n_right = len(right_child)
        
        if n_left == 0 or n_right == 0:
            return 0
        
        parent_entropy = self._entropy(parent)
        left_entropy = self._entropy(left_child)
        right_entropy = self._entropy(right_child)
        
        weighted_child_entropy = (n_left / n) * left_entropy + (n_right / n) * right_entropy
        return parent_entropy - weighted_child_entropy
    
    def _build_tree(self, X, y, depth=0):
        """Build decision tree recursively"""
        n_samples, n_features = X.shape
        n_classes = len(np.unique(y))
        
        # Stopping criteria
        if (depth >= self.max_depth or n_classes == 1 or n_samples < 2):
            return {'class': np.argmax(np.bincount(y, minlength=self.num_classes))}
        
        best_gain = 0
        best_split = None
        
        # Try all features and thresholds
        for feature_idx in range(n_features):
            thresholds = np.unique(X[:, feature_idx])
            for threshold in thresholds[::max(1, len(thresholds)//10)]:  # Sample thresholds
                left_mask = X[:, feature_idx] <= threshold
                right_mask = ~left_mask
                
                if np.sum(left_mask) == 0 or np.sum(right_mask) == 0:
                    continue
                
                gain = self._information_gain(y, y[left_mask], y[right_mask])
                
                if gain > best_gain:
                    best_gain = gain
                    best_split = (feature_idx, threshold)
        
        if best_split is None:
            return {'class': np.argmax(np.bincount(y, minlength=self.num_classes))}
        
        feature_idx, threshold = best_split
        left_mask = X[:, feature_idx] <= threshold
        
        return {
            'feature': feature_idx,
            'threshold': float(threshold),
            'left': self._build_tree(X[left_mask], y[left_mask], depth + 1),
            'right': self._build_tree(X[~left_mask], y[~left_mask], depth + 1)
        }
    
    def _predict_sample(self, sample, node):
        """Predict class for a single sample"""
        if 'class' in node:
            return node['class']
        
        if sample[node['feature']] <= node['threshold']:
            return self._predict_sample(sample, node['left'])
        else:
            return self._predict_sample(sample, node['right'])
    
    def train(self, X, Y, **kwargs):
        """Train decision tree"""
        self.tree = self._build_tree(X, Y)
    
    def predict(self, X):
        """Predict for multiple samples"""
        return np.array([self._predict_sample(x, self.tree) for x in X])
    
    def evaluate(self, X, Y):
        """Compute accuracy"""
        predictions = self.predict(X)
        return np.mean(predictions == Y)


class RandomForestClassifier:
    """Simple Random Forest from scratch"""
    
    def __init__(self, num_trees=10, num_classes=6, max_depth=5):
        self.num_trees = num_trees
        self.num_classes = num_classes
        self.max_depth = max_depth
        self.model_name = "Random Forest"
        self.trees = []
    
    def train(self, X, Y, **kwargs):
        """Train random forest"""
        n_samples = X.shape[0]
        
        for _ in range(self.num_trees):
            # Bootstrap sample
            indices = np.random.choice(n_samples, size=n_samples, replace=True)
            X_sample = X[indices]
            Y_sample = Y[indices]
            
            # Train tree
            tree = DecisionTreeClassifier(num_classes=self.num_classes, max_depth=self.max_depth)
            tree.train(X_sample, Y_sample)
            self.trees.append(tree)
    
    def predict(self, X):
        """Predict using majority voting"""
        predictions = np.array([tree.predict(X) for tree in self.trees])
        # Majority vote
        return np.array([np.argmax(np.bincount(preds, minlength=self.num_classes)) 
                        for preds in predictions.T])
    
    def evaluate(self, X, Y):
        """Compute accuracy"""
        predictions = self.predict(X)
        return np.mean(predictions == Y)


class NeuralNetworkClassifier:
    """Simple Neural Network (2 hidden layers)"""
    
    def __init__(self, input_size, num_classes, hidden_size=32):
        self.input_size = input_size
        self.num_classes = num_classes
        self.hidden_size = hidden_size
        self.model_name = "Neural Network"
        
        # Initialize weights
        self.W1 = np.random.normal(0, 0.01, (input_size + 1, hidden_size))
        self.W2 = np.random.normal(0, 0.01, (hidden_size + 1, hidden_size))
        self.W3 = np.random.normal(0, 0.01, (hidden_size + 1, num_classes))
        
        self.loss_history = []
    
    def relu(self, x):
        """ReLU activation"""
        return np.maximum(0, x)
    
    def relu_derivative(self, x):
        """ReLU derivative"""
        return (x > 0).astype(float)
    
    def softmax(self, x):
        """Softmax activation"""
        exp_x = np.exp(x - np.max(x, axis=1, keepdims=True))
        return exp_x / np.sum(exp_x, axis=1, keepdims=True)
    
    def forward(self, X):
        """Forward pass"""
        X_aug = np.hstack([X, np.ones((X.shape[0], 1))])
        self.z1 = X_aug @ self.W1
        self.a1 = self.relu(self.z1)
        
        a1_aug = np.hstack([self.a1, np.ones((self.a1.shape[0], 1))])
        self.z2 = a1_aug @ self.W2
        self.a2 = self.relu(self.z2)
        
        a2_aug = np.hstack([self.a2, np.ones((self.a2.shape[0], 1))])
        self.z3 = a2_aug @ self.W3
        self.a3 = self.softmax(self.z3)
        
        return self.a3
    
    def train(self, X, Y, epochs=100, batch_size=32, learning_rate=0.01, verbose=True):
        """Train neural network with simplified SGD"""
        n = X.shape[0]
        
        for epoch in range(epochs):
            indices = np.random.permutation(n)
            X_shuffled = X[indices]
            Y_shuffled = Y[indices]
            
            for b in range(0, n, batch_size):
                X_batch = X_shuffled[b:b+batch_size]
                Y_batch = Y_shuffled[b:b+batch_size]
                
                # Forward pass
                output = self.forward(X_batch)
                
                # Compute loss
                Y_one_hot = np.eye(self.num_classes)[Y_batch]
                loss = -np.mean(np.sum(Y_one_hot * np.log(output + 1e-10)))
                
                # Simplified weight update (gradient descent on output layer)
                grad_output = (output - Y_one_hot) / len(X_batch)
                
                # Update W3 (output layer weights)
                a2_aug = np.hstack([self.a2, np.ones((self.a2.shape[0], 1))])
                dW3 = a2_aug.T @ grad_output
                self.W3 -= learning_rate * dW3
            
            if verbose and (epoch + 1) % 20 == 0:
                print(f"  NN Epoch {epoch + 1}/{epochs}")
            
            self.loss_history.append(loss)
    
    def predict(self, X):
        """Predict class"""
        probs = self.forward(X)
        return np.argmax(probs, axis=1)
    
    def evaluate(self, X, Y):
        """Compute accuracy"""
        predictions = self.predict(X)
        return np.mean(predictions == Y)


def compute_feature_stats(X):
    """Compute mean and std for normalization"""
    return {
        'mean': X.mean(axis=0).tolist(),
        'std': X.std(axis=0).tolist()
    }


def main():
    print("=" * 80)
    print("ML TRAINING PIPELINE FOR COMPILER OPTIMIZER - MULTI-MODEL COMPARISON")
    print("=" * 80)
    
    # Generate synthetic dataset
    print("\n[1/5] Generating expanded synthetic dataset (5000+ samples)...")
    generator = SyntheticDatasetGenerator(num_samples=5000)
    X, Y = generator.generate_features()
    
    print(f"  ✓ Generated {X.shape[0]} samples with {X.shape[1]} features")
    class_counts = np.bincount(Y)
    print(f"  ✓ Class distribution: {dict(zip(range(6), class_counts))}")
    print(f"    - Class 0 (None): {class_counts[0]}")
    print(f"    - Class 1 (Const Fold): {class_counts[1]}")
    print(f"    - Class 2 (DCE): {class_counts[2]}")
    print(f"    - Class 3 (CSE): {class_counts[3]}")
    print(f"    - Class 4 (LICM): {class_counts[4]}")
    print(f"    - Class 5 (Loop Unroll): {class_counts[5]}")
    
    # Compute feature statistics
    print("\n[2/5] Computing feature statistics...")
    stats = compute_feature_stats(X)
    print(f"  ✓ Mean: {[f'{m:.2f}' for m in stats['mean']]}")
    print(f"  ✓ Std:  {[f'{s:.2f}' for s in stats['std']]}")
    
    # Normalize features
    X_normalized = (X - np.array(stats['mean'])) / (np.array(stats['std']) + 1e-10)
    
    # Split into train/test
    split_idx = int(0.8 * len(X))
    X_train, X_test = X_normalized[:split_idx], X_normalized[split_idx:]
    Y_train, Y_test = Y[:split_idx], Y[split_idx:]
    
    print(f"  ✓ Train set: {X_train.shape[0]} samples")
    print(f"  ✓ Test set:  {X_test.shape[0]} samples")
    
    # Train multiple models
    print("\n[3/5] Training 4 ML models...")
    models = []
    results = {}
    
    # Model 1: Logistic Regression
    print("\n  [3.1] Training Logistic Regression...")
    model1 = LogisticRegressionClassifier(input_size=10, num_classes=6, learning_rate=0.1)
    model1.train(X_train, Y_train, epochs=100, batch_size=32, verbose=False)
    acc1_train = model1.evaluate(X_train, Y_train)
    acc1_test = model1.evaluate(X_test, Y_test)
    print(f"    ✓ Train accuracy: {acc1_train:.4f} | Test accuracy: {acc1_test:.4f}")
    models.append(model1)
    results['logistic_regression'] = {
        'train_accuracy': float(acc1_train),
        'test_accuracy': float(acc1_test),
        'model_name': 'Logistic Regression'
    }
    
    # Model 2: Decision Tree
    print("\n  [3.2] Training Decision Tree...")
    model2 = DecisionTreeClassifier(num_classes=6, max_depth=8)
    model2.train(X_train, Y_train)
    acc2_train = model2.evaluate(X_train, Y_train)
    acc2_test = model2.evaluate(X_test, Y_test)
    print(f"    ✓ Train accuracy: {acc2_train:.4f} | Test accuracy: {acc2_test:.4f}")
    models.append(model2)
    results['decision_tree'] = {
        'train_accuracy': float(acc2_train),
        'test_accuracy': float(acc2_test),
        'model_name': 'Decision Tree'
    }
    
    # Model 3: Random Forest
    print("\n  [3.3] Training Random Forest...")
    model3 = RandomForestClassifier(num_trees=15, num_classes=6, max_depth=8)
    model3.train(X_train, Y_train)
    acc3_train = model3.evaluate(X_train, Y_train)
    acc3_test = model3.evaluate(X_test, Y_test)
    print(f"    ✓ Train accuracy: {acc3_train:.4f} | Test accuracy: {acc3_test:.4f}")
    models.append(model3)
    results['random_forest'] = {
        'train_accuracy': float(acc3_train),
        'test_accuracy': float(acc3_test),
        'model_name': 'Random Forest'
    }
    
    # Model 4: Neural Network
    print("\n  [3.4] Training Neural Network...")
    model4 = NeuralNetworkClassifier(input_size=10, num_classes=6, hidden_size=32)
    model4.train(X_train, Y_train, epochs=100, batch_size=32, learning_rate=0.01, verbose=False)
    acc4_train = model4.evaluate(X_train, Y_train)
    acc4_test = model4.evaluate(X_test, Y_test)
    print(f"    ✓ Train accuracy: {acc4_train:.4f} | Test accuracy: {acc4_test:.4f}")
    models.append(model4)
    results['neural_network'] = {
        'train_accuracy': float(acc4_train),
        'test_accuracy': float(acc4_test),
        'model_name': 'Neural Network'
    }
    
    # Evaluate and rank
    print("\n[4/5] Model Comparison Results")
    print("=" * 80)
    
    sorted_results = sorted(results.items(), key=lambda x: x[1]['test_accuracy'], reverse=True)
    
    for rank, (model_key, result) in enumerate(sorted_results, 1):
        print(f"\n  {rank}. {result['model_name']}")
        print(f"     Train Accuracy: {result['train_accuracy']:.4f} ({result['train_accuracy']*100:.2f}%)")
        print(f"     Test Accuracy:  {result['test_accuracy']:.4f} ({result['test_accuracy']*100:.2f}%)")
    
    # Save model with best test accuracy
    best_model_key, best_result = sorted_results[0]
    if best_model_key == 'logistic_regression':
        best_model = model1
    elif best_model_key == 'decision_tree':
        best_model = model2
    elif best_model_key == 'random_forest':
        best_model = model3
    else:
        best_model = model4
    
    print(f"\n  🏆 Best model: {best_result['model_name']} with {best_result['test_accuracy']*100:.2f}% accuracy")
    
    # Save all models to JSON
    print("\n[5/5] Saving models to JSON...")
    
    models_json = {
        'logistic_regression': model1.to_dict(),
        'decision_tree': {
            'num_classes': int(model2.num_classes),
            'max_depth': int(model2.max_depth),
            'model_name': model2.model_name,
            'note': 'Tree structure complex for JSON serialization'
        },
        'random_forest': {
            'num_trees': int(model3.num_trees),
            'num_classes': int(model3.num_classes),
            'max_depth': int(model3.max_depth),
            'model_name': model3.model_name,
            'note': 'Trees complex for JSON serialization'
        },
        'neural_network': {
            'W1': [[float(w) for w in row] for row in model4.W1.tolist()],
            'W2': [[float(w) for w in row] for row in model4.W2.tolist()],
            'W3': [[float(w) for w in row] for row in model4.W3.tolist()],
            'input_size': int(model4.input_size),
            'hidden_size': int(model4.hidden_size),
            'num_classes': int(model4.num_classes),
            'model_name': model4.model_name
        },
        'feature_stats': stats,
        'model_performance': results,
        'best_model': best_model_key,
        'class_names': ['None', 'Constant Folding', 'Dead Code Elimination', 
                       'Common Subexpression Elimination', 'Loop Invariant Code Motion', 
                       'Loop Unrolling']
    }
    
    model_path = Path(__file__).parent.parent / 'js' / 'trained_models.json'
    model_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(model_path, 'w') as f:
        json.dump(models_json, f, indent=2)
    
    print(f"  ✓ All models saved to: {model_path}")
    
    # Also save just the best model for backward compatibility
    best_model_json = {
        'logistic_regression': model1.to_dict(),
        'feature_stats': stats,
        'accuracy': float(model1.evaluate(X_test, Y_test))
    }
    
    compat_path = Path(__file__).parent.parent / 'js' / 'trained_model.json'
    with open(compat_path, 'w') as f:
        json.dump(best_model_json, f, indent=2)
    
    print(f"  ✓ Best model (backward compat) saved to: {compat_path}")
    
    print("\n" + "=" * 80)
    print("✓ Training complete! Models ready for integration into compiler.")
    print("=" * 80)
    
    return models_json


if __name__ == '__main__':
    main()
