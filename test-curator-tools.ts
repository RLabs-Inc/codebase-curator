#!/usr/bin/env bun

/**
 * Test script for curator tools
 */

import { createCuratorService } from './src/core'

async function main() {
  console.log('🧪 Testing Curator Service...\n')
  
  const curator = createCuratorService({
    projectPath: process.cwd(),
    cacheEnabled: true
  })
  
  await curator.initialize()
  
  // Test 1: askCurator with overview detection
  console.log('📋 Test 1: Ask for overview (should use specialized overview prompt)')
  const overviewResponse = await curator.askCurator({
    question: 'Can you give me an overview of this codebase?',
    newSession: true
  })
  console.log('Response length:', overviewResponse.content.length)
  console.log('First 200 chars:', overviewResponse.content.substring(0, 200) + '...\n')
  
  // Test 2: askCurator with feature detection  
  console.log('🚀 Test 2: Ask about adding feature (should use specialized feature prompt)')
  const featureResponse = await curator.askCurator({
    question: 'How do I add a new caching feature to this system?',
    newSession: false
  })
  console.log('Response length:', featureResponse.content.length)
  console.log('First 200 chars:', featureResponse.content.substring(0, 200) + '...\n')
  
  // Test 3: Direct add_new_feature (should use simple prompt)
  console.log('✨ Test 3: Direct add_new_feature call (should use simple direct prompt)')
  const directFeatureResponse = await curator.addNewFeature({
    feature: 'Add a REST API endpoint for retrieving analysis results'
  })
  console.log('Response length:', directFeatureResponse.length)
  console.log('First 200 chars:', directFeatureResponse.substring(0, 200) + '...\n')
  
  // Test 4: Direct implement_change (should use simple prompt)
  console.log('🔧 Test 4: Direct implement_change call (should use simple direct prompt)')
  const directChangeResponse = await curator.implementChange({
    change: 'Fix the memory leak in the analysis service'
  })
  console.log('Response length:', directChangeResponse.length)
  console.log('First 200 chars:', directChangeResponse.substring(0, 200) + '...\n')
  
  // Test 5: askCurator with general question
  console.log('❓ Test 5: General question (should pass through)')
  const generalResponse = await curator.askCurator({
    question: 'What testing framework does this project use?',
    newSession: false
  })
  console.log('Response length:', generalResponse.content.length)
  console.log('First 200 chars:', generalResponse.content.substring(0, 200) + '...\n')
  
  await curator.cleanup()
  console.log('✅ All tests completed!')
}

main().catch(console.error)