#!/usr/bin/env bun

import { createCuratorService } from './src/services/curator/CuratorService.js'

async function testCurator() {
  console.log('🧪 Testing Curator Service...')
  
  const curator = createCuratorService()
  await curator.initialize()
  
  console.log('📂 Setting project path...')
  curator.setProjectPath(process.cwd())
  
  console.log('🤖 Getting codebase overview...')
  console.log('⏳ This may take 1-2 minutes...')
  
  try {
    const startTime = Date.now()
    const overview = await curator.getOverview()
    const duration = Math.round((Date.now() - startTime) / 1000)
    
    console.log(`\n✅ Success! Got response in ${duration} seconds`)
    console.log('\n📊 Overview (first 500 chars):')
    console.log(overview.substring(0, 500) + '...')
    console.log(`\n📏 Total length: ${overview.length} characters`)
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

testCurator()