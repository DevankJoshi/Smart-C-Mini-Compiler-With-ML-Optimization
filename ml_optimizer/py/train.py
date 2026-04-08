#!/usr/bin/env python3
"""
ML Training Pipeline for Compiler Optimizer

Generates synthetic training data and trains the ML model.
This script can be extended to use real CodeNet/POJ-104 datasets.
"""

import json
import numpy as np
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / 'py'))


class SyntheticDatasetGenerator:
    """Generate synthetic program characteristics for training"""
    
    def __init__(self, num_samples=1000, seed=42):
        np.random.seed(seed)
        self.num_samples = num_samples
    
    def generate_features(self):
        """Generate random feature vectors with realistic correlations"""
        X = []
        Y = []
        
        for _ in range(self.num_samples):
            # instruction_count: 5-100
            inst_count = np.random.randint(5, 100)
            
            # number_of_temporaries: proportional to instructions
            num_temps = max(1, int(inst_count * np.random.uniform(0.1, 0.4)))
            
            # arithmetic_operations: subset of instructions
            arith_ops = np.random.randint(0, max(1, inst_count // 3))
            
            # memory_access_count: 0-30
            mem_access = np.random.randint(0, 30)
            
            # branch_count: 0-20
            branch_count = np.random.randint(0, 20)
            
            # loop_count: 0-5
            loop_count = np.random.randint(0, 5)
            
            # loop_nesting_depth: 0-3
            nesting = loop_count > 0 and np.random.randint(0, loop_count) or 0
            
            # repeated_expressions: 0-15
            repeated = np.random.randint(0, 15)
            
            # constant_expressions: 0-10
            const_exprs = np.random.randint(0, 10)
            
            # dead_assignments: 0-20
            dead_assigns = np.random.randint(0, 20)
            
            features = [
                inst_count, num_temps, arith_ops, mem_access, branch_count,
                loop_count, nesting, repeated, const_exprs, dead_assigns
            ]
            
            # Label logic: classify based on feature patterns
            label = self._assign_label(features)
            
            X.append(features)
            Y.append(label)
        
        return np.array(X), np.array(Y)
    
    def _assign_label(self, features):
        """Assign optimization label based on features"""
        inst, temps, arith, mem, branch, loops, depth, repeat, const, dead = features
        
        # High constant expressions → constant folding
        if const > 5:
            return 1
        
        # Many dead assignments → dead code elimination
        if dead > 8:
            return 2
        
        # Many repeated expressions → CSE
        if repeat > 5:
            return 3
        
        # High loop count and nesting → loop optimizations
        if loops > 2 and depth > 0:
            return 4 if inst > 30 else 5  # LICM vs unroll
        
        # Default: no optimization needed
        return 0


class LogisticRegressionClassifier:
    """Multiclass Logistic Regression from scratch"""
    
    def __init__(self, input_size, num_classes, learning_rate=0.01):
        self.input_size = input_size
        self.num_classes = num_classes
        self.learning_rate = learning_rate
        
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


def compute_feature_stats(X):
    """Compute mean and std for normalization"""
    return {
        'mean': X.mean(axis=0).tolist(),
        'std': X.std(axis=0).tolist()
    }


def main():
    print("=" * 70)
    print("ML TRAINING PIPELINE FOR COMPILER OPTIMIZER")
    print("=" * 70)
    
    # Generate synthetic dataset
    print("\n[1/4] Generating synthetic dataset...")
    generator = SyntheticDatasetGenerator(num_samples=1000)
    X, Y = generator.generate_features()
    
    print(f"  Generated {X.shape[0]} samples with {X.shape[1]} features")
    print(f"  Class distribution: {np.bincount(Y)}")
    
    # Compute feature statistics
    print("\n[2/4] Computing feature statistics...")
    stats = compute_feature_stats(X)
    print(f"  Mean: {[f'{m:.2f}' for m in stats['mean']]}")
    print(f"  Std:  {[f'{s:.2f}' for s in stats['std']]}")
    
    # Normalize features
    X_normalized = (X - np.array(stats['mean'])) / (np.array(stats['std']) + 1e-10)
    
    # Split into train/test
    split_idx = int(0.8 * len(X))
    X_train, X_test = X_normalized[:split_idx], X_normalized[split_idx:]
    Y_train, Y_test = Y[:split_idx], Y[split_idx:]
    
    # Train model
    print("\n[3/4] Training Logistic Regression model...")
    model = LogisticRegressionClassifier(input_size=10, num_classes=6, learning_rate=0.1)
    model.train(X_train, Y_train, epochs=50, batch_size=32, verbose=True)
    
    # Evaluate
    print("\n[4/4] Evaluating model...")
    train_acc = model.evaluate(X_train, Y_train)
    test_acc = model.evaluate(X_test, Y_test)
    
    print(f"  Train accuracy: {train_acc:.4f}")
    print(f"  Test accuracy:  {test_acc:.4f}")
    
    # Save model
    model_path = Path(__file__).parent.parent / 'js' / 'trained_model.json'
    model_dict = model.to_dict()
    model_dict['feature_stats'] = stats
    
    with open(model_path, 'w') as f:
        json.dump(model_dict, f, indent=2)
    
    print(f"\n✓ Model saved to: {model_path}")
    print("\nModel ready for integration into compiler!")
    
    return model_dict


if __name__ == '__main__':
    main()
