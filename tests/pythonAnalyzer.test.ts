import { describe, it, expect } from 'bun:test'
import { pythonAnalyzer } from '../src/languages/plugins/python'

describe('PythonAnalyzer', () => {
  describe('parseImports', () => {
    it('should parse simple imports', () => {
      const content = `
import os
import sys
import json
      `
      const imports = pythonAnalyzer.parseImports(content, 'test.py')
      
      expect(imports).toHaveLength(3)
      expect(imports[0]).toMatchObject({ source: 'os', type: 'static' })
      expect(imports[1]).toMatchObject({ source: 'sys', type: 'static' })
      expect(imports[2]).toMatchObject({ source: 'json', type: 'static' })
    })

    it('should parse import with alias', () => {
      const content = `
import numpy as np
import pandas as pd
      `
      const imports = pythonAnalyzer.parseImports(content, 'test.py')
      
      expect(imports).toHaveLength(2)
      expect(imports[0]).toMatchObject({ source: 'numpy', alias: 'np' })
      expect(imports[1]).toMatchObject({ source: 'pandas', alias: 'pd' })
    })

    it('should parse from imports', () => {
      const content = `
from os import path
from typing import List, Dict, Optional
from collections import defaultdict
      `
      const imports = pythonAnalyzer.parseImports(content, 'test.py')
      
      expect(imports).toHaveLength(5)
      expect(imports[0]).toMatchObject({ source: 'os', specifiers: ['path'] })
      expect(imports[1]).toMatchObject({ source: 'typing', specifiers: ['List'] })
      expect(imports[2]).toMatchObject({ source: 'typing', specifiers: ['Dict'] })
      expect(imports[3]).toMatchObject({ source: 'typing', specifiers: ['Optional'] })
      expect(imports[4]).toMatchObject({ source: 'collections', specifiers: ['defaultdict'] })
    })

    it('should parse from imports with aliases', () => {
      const content = `
from datetime import datetime as dt
from urllib.parse import urlparse as parse_url
      `
      const imports = pythonAnalyzer.parseImports(content, 'test.py')
      
      expect(imports).toHaveLength(2)
      expect(imports[0]).toMatchObject({ 
        source: 'datetime', 
        specifiers: ['datetime'], 
        alias: 'dt' 
      })
      expect(imports[1]).toMatchObject({ 
        source: 'urllib.parse', 
        specifiers: ['urlparse'], 
        alias: 'parse_url' 
      })
    })

    it('should parse wildcard imports', () => {
      const content = `
from math import *
from tkinter import *
      `
      const imports = pythonAnalyzer.parseImports(content, 'test.py')
      
      expect(imports).toHaveLength(2)
      expect(imports[0]).toMatchObject({ source: 'math', isWildcard: true })
      expect(imports[1]).toMatchObject({ source: 'tkinter', isWildcard: true })
    })

    it('should parse relative imports', () => {
      const content = `
from . import utils
from .. import parent_module
from ...config import settings
from .models import User, Post
from ..database.connection import get_db
      `
      const imports = pythonAnalyzer.parseImports(content, 'test.py')
      
      expect(imports).toHaveLength(6)
      expect(imports[0]).toMatchObject({ source: '.', specifiers: ['utils'] })
      expect(imports[1]).toMatchObject({ source: '..', specifiers: ['parent_module'] })
      expect(imports[2]).toMatchObject({ source: '...config', specifiers: ['settings'] })
      expect(imports[3]).toMatchObject({ source: '.models', specifiers: ['User'] })
      expect(imports[4]).toMatchObject({ source: '.models', specifiers: ['Post'] })
      expect(imports[5]).toMatchObject({ source: '..database.connection', specifiers: ['get_db'] })
    })

    it('should parse multiple imports on one line', () => {
      const content = `
import os, sys, json
      `
      const imports = pythonAnalyzer.parseImports(content, 'test.py')
      
      expect(imports).toHaveLength(3)
      expect(imports[0]).toMatchObject({ source: 'os' })
      expect(imports[1]).toMatchObject({ source: 'sys' })
      expect(imports[2]).toMatchObject({ source: 'json' })
    })

    it('should ignore comments', () => {
      const content = `
# This is a comment
import os  # inline comment
# import sys  # commented out import
from typing import List  # another inline comment
      `
      const imports = pythonAnalyzer.parseImports(content, 'test.py')
      
      expect(imports).toHaveLength(2)
      expect(imports[0]).toMatchObject({ source: 'os' })
      expect(imports[1]).toMatchObject({ source: 'typing', specifiers: ['List'] })
    })
  })

  describe('detectFrameworks', () => {
    it('should detect web frameworks from dependencies', () => {
      const dependencies = [
        'django==4.2.0',
        'djangorestframework==3.14.0',
        'flask==2.3.0',
        'requests==2.31.0'
      ]
      
      const frameworks = pythonAnalyzer.detectFrameworks(dependencies)
      
      expect(frameworks).toHaveLength(2)
      expect(frameworks).toContainEqual({ name: 'Django', type: 'web', version: '4.2.0' })
      expect(frameworks).toContainEqual({ name: 'Flask', type: 'web', version: '2.3.0' })
    })

    it('should detect data science frameworks', () => {
      const dependencies = [
        'pandas==2.0.0',
        'numpy>=1.24.0',
        'scikit-learn~=1.3.0',
        'matplotlib==3.7.0'
      ]
      
      const frameworks = pythonAnalyzer.detectFrameworks(dependencies)
      
      expect(frameworks).toHaveLength(3)
      expect(frameworks).toContainEqual({ name: 'Pandas', type: 'data', version: '2.0.0' })
      expect(frameworks).toContainEqual({ name: 'NumPy', type: 'data', version: '1.24.0' })
      expect(frameworks).toContainEqual({ name: 'Scikit-learn', type: 'ml', version: '1.3.0' })
    })

    it('should detect ML frameworks', () => {
      const dependencies = [
        'tensorflow==2.13.0',
        'torch>=2.0.0',
        'transformers==4.30.0'
      ]
      
      const frameworks = pythonAnalyzer.detectFrameworks(dependencies)
      
      expect(frameworks.some(f => f.name === 'TensorFlow')).toBe(true)
      expect(frameworks.some(f => f.name === 'PyTorch')).toBe(true)
    })

    it('should detect frameworks from file contents', () => {
      const dependencies: string[] = []
      const fileContents = new Map([
        ['app.py', `
from flask import Flask, render_template
app = Flask(__name__)

@app.route('/')
def home():
    return render_template('index.html')
        `],
        ['models.py', `
from django.db import models

class User(models.Model):
    name = models.CharField(max_length=100)
        `]
      ])
      
      const frameworks = pythonAnalyzer.detectFrameworks(dependencies, fileContents)
      
      expect(frameworks).toHaveLength(2)
      expect(frameworks).toContainEqual({ name: 'Flask', type: 'web' })
      expect(frameworks).toContainEqual({ name: 'Django', type: 'web' })
    })
  })

  describe('extractPatterns', () => {
    it('should extract class definitions', () => {
      const content = `
class Animal:
    pass

class Dog(Animal):
    def bark(self):
        return "Woof!"

class Cat(Animal, Feline):
    pass
      `
      
      const patterns = pythonAnalyzer.extractPatterns(content, 'test.py')
      const classes = patterns.filter(p => p.type === 'class')
      
      expect(classes).toHaveLength(3)
      expect(classes[0]).toMatchObject({ name: 'Animal', parameters: [] })
      expect(classes[1]).toMatchObject({ name: 'Dog', parameters: ['Animal'] })
      expect(classes[2]).toMatchObject({ name: 'Cat', parameters: ['Animal', 'Feline'] })
    })

    it('should extract function definitions', () => {
      const content = `
def simple_function():
    pass

def function_with_params(name, age=25):
    return f"{name} is {age} years old"

def typed_function(name: str, age: int = 25) -> str:
    return f"{name} is {age} years old"
      `
      
      const patterns = pythonAnalyzer.extractPatterns(content, 'test.py')
      const functions = patterns.filter(p => p.type === 'function')
      
      expect(functions).toHaveLength(3)
      expect(functions[0]).toMatchObject({ name: 'simple_function', parameters: [] })
      expect(functions[1]).toMatchObject({ 
        name: 'function_with_params', 
        parameters: ['name', 'age=25'] 
      })
      expect(functions[2]).toMatchObject({ 
        name: 'typed_function',
        parameters: ['name: str', 'age: int = 25'],
        returnType: 'str'
      })
    })

    it('should extract async functions', () => {
      const content = `
async def fetch_data(url: str) -> dict:
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            return await response.json()

async def process_items(items):
    for item in items:
        await process_item(item)
      `
      
      const patterns = pythonAnalyzer.extractPatterns(content, 'test.py')
      const asyncFuncs = patterns.filter(p => p.type === 'function' && p.modifiers?.includes('async'))
      
      expect(asyncFuncs).toHaveLength(2)
      expect(asyncFuncs[0]).toMatchObject({
        name: 'fetch_data',
        returnType: 'dict',
        modifiers: ['async']
      })
      expect(asyncFuncs[1]).toMatchObject({
        name: 'process_items',
        modifiers: ['async']
      })
    })

    it('should extract decorators', () => {
      const content = `
@property
def name(self):
    return self._name

@app.route('/api/users')
@require_auth
def get_users():
    return jsonify(users)

@lru_cache(maxsize=128)
def expensive_computation(n):
    return n ** 2
      `
      
      const patterns = pythonAnalyzer.extractPatterns(content, 'test.py')
      const decorators = patterns.filter(p => p.type === 'decorator')
      
      expect(decorators).toHaveLength(4)
      expect(decorators[0]).toMatchObject({ name: 'property' })
      expect(decorators[1]).toMatchObject({ name: 'app.route', parameters: ['/api/users'] })
      expect(decorators[2]).toMatchObject({ name: 'require_auth' })
      expect(decorators[3]).toMatchObject({ name: 'lru_cache', parameters: ['maxsize=128'] })
    })
  })

  describe('removeComments', () => {
    it('should remove single-line comments', () => {
      const content = `
# This is a comment
import os  # inline comment
value = "# not a comment"  # but this is
      `
      
      const cleaned = pythonAnalyzer['removeComments'](content)
      
      expect(cleaned).not.toContain('This is a comment')
      expect(cleaned).not.toContain('inline comment')
      expect(cleaned).not.toContain('but this is')
      expect(cleaned).toContain('"# not a comment"')
    })

    it('should handle docstrings appropriately', () => {
      const content = `
"""Module docstring"""

def function():
    """Function docstring"""
    return 42

standalone = """This should be removed"""
      `
      
      const cleaned = pythonAnalyzer['removeComments'](content)
      
      // Docstrings after colons should be kept
      expect(cleaned).toContain('"""Function docstring"""')
      // Standalone triple-quoted strings should be removed
      expect(cleaned).not.toContain('This should be removed')
    })
  })

  describe('getFilePattern', () => {
    it('should return correct file pattern for Python', () => {
      expect(pythonAnalyzer.getFilePattern()).toBe('**/*.py')
    })
  })

  describe('language property', () => {
    it('should have correct language metadata', () => {
      expect(pythonAnalyzer.language).toEqual({
        name: 'Python',
        extensions: ['.py'],
        aliases: ['python', 'py']
      })
    })
  })
})