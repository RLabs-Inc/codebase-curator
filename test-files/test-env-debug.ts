#!/usr/bin/env bun

import { EnvExtractor } from '../src/packages/semantic-core/src/extractors/EnvExtractor';
import { readFileSync } from 'fs';
import { join } from 'path';

async function debugEnvExtractor() {
  console.log('=== ENV EXTRACTOR DEBUG ===\n');
  
  const extractor = new EnvExtractor();
  const testFilePath = join(__dirname, '.env.example');
  
  console.log('1. Testing file path:', testFilePath);
  console.log('2. Can handle .env.example?', extractor.canHandle('.env.example'));
  console.log('3. Can handle test-files/.env.example?', extractor.canHandle('test-files/.env.example'));
  console.log('4. Can handle full path?', extractor.canHandle(testFilePath));
  
  // Check file existence
  try {
    const fileContent = readFileSync(testFilePath, 'utf-8');
    console.log('\n5. File exists and is readable');
    console.log('   File size:', fileContent.length, 'bytes');
    console.log('   Line count:', fileContent.split('\n').length);
  } catch (error) {
    console.error('\n5. Error reading file:', error);
    return;
  }
  
  // Try extraction
  console.log('\n6. Attempting extraction...');
  try {
    const content = readFileSync(testFilePath, 'utf-8');
    const extracted = await extractor.extract(content, testFilePath);
    
    console.log('\n7. Extraction results:');
    console.log('   - Definitions found:', extracted.definitions.length);
    console.log('   - References found:', extracted.references.length);
    
    // Count by type
    const typeCount: Record<string, number> = {};
    extracted.definitions.forEach(def => {
      typeCount[def.type] = (typeCount[def.type] || 0) + 1;
    });
    
    console.log('\n8. Definitions by type:');
    Object.entries(typeCount).forEach(([type, count]) => {
      console.log(`   - ${type}: ${count}`);
    });
    
    // Show some constants (env variables)
    const constants = extracted.definitions.filter(d => d.type === 'constant');
    if (constants.length > 0) {
      console.log('\n9. Sample environment variables (first 10):');
      constants.slice(0, 10).forEach((c, i) => {
        console.log(`   ${i + 1}. ${c.term} (line ${c.location.line})`);
        console.log(`      Context: ${c.context}`);
        console.log(`      Category: ${c.relatedTerms[0]}`);
      });
    }
    
    // Show some comments
    const comments = extracted.definitions.filter(d => d.type === 'comment');
    if (comments.length > 0) {
      console.log('\n10. Sample comments (first 5):');
      comments.slice(0, 5).forEach((c, i) => {
        console.log(`   ${i + 1}. Line ${c.location.line}: "${c.term}"`);
      });
    }
    
    // Show some strings (non-sensitive values)
    const strings = extracted.definitions.filter(d => d.type === 'string');
    if (strings.length > 0) {
      console.log('\n11. Sample extracted values (first 5):');
      strings.slice(0, 5).forEach((s, i) => {
        console.log(`   ${i + 1}. "${s.term}" from ${s.context} (line ${s.location.line})`);
      });
    }
    
    // Show references
    if (extracted.references.length > 0) {
      console.log('\n12. Cross-references found:');
      extracted.references.slice(0, 5).forEach((r, i) => {
        console.log(`   ${i + 1}. ${r.targetTerm} (${r.referenceType}) at line ${r.fromLocation.line}`);
        console.log(`      Context: ${r.context}`);
      });
    }
    
  } catch (error) {
    console.error('\n7. Extraction error:', error);
    console.error('   Stack:', error.stack);
  }
  
  // Additional debug: check the extractor's pattern
  console.log('\n10. Debug extractor internals:');
  console.log('    - Extractor class:', extractor.constructor.name);
  console.log('    - Expected file patterns: .env, .env.*, *.env');
}

// Run the debug script
debugEnvExtractor().catch(console.error);