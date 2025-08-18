#!/usr/bin/env node

import fs from 'fs';

async function updateNgrokUrls() {
  try {
    // Get ngrok tunnels from local API
    const response = await fetch('http://localhost:4040/api/tunnels');
    const data = await response.json();
    
    // Find tunnels by port (handles both 'localhost:3000' and 'http://localhost:3000' formats)
    const botTunnel = data.tunnels.find(t => 
      t.config.addr.includes(':3000') || t.name === 'bot-server'
    );
    const webTunnel = data.tunnels.find(t => 
      t.config.addr.includes(':3001') || t.name === 'web-interface'
    );
    
    if (!botTunnel || !webTunnel) {
      console.log('Available tunnels:', data.tunnels.map(t => ({ name: t.name, addr: t.config.addr, url: t.public_url })));
      throw new Error('Could not find both tunnels. Make sure ngrok is running with both 3000 and 3001 tunnels.');
    }
    
    const botUrl = botTunnel.public_url;
    const webUrl = webTunnel.public_url;
    
    console.log(`🤖 Bot tunnel: ${botUrl}`);
    console.log(`🌐 Web tunnel: ${webUrl}`);
    
    // Update root .env
    updateEnvFile('.env', {
      'WEB_APP_URL': webUrl
    });
    
    // Update web-interface .env.local
    updateEnvFile('web-interface/.env.local', {
      'NEXT_PUBLIC_BOT_API_URL': botUrl,
      'BOT_WEBHOOK_URL': `${botUrl}/api/webhook/wallet-created`,
      'NEXTAUTH_URL': webUrl
    });
    
    console.log('✅ Environment files updated successfully!');
    
  } catch (error) {
    console.error('❌ Error updating ngrok URLs:', error.message);
    console.log('\n💡 Make sure:');
    console.log('   1. ngrok is running: ngrok start --all --config ngrok.yml');
    console.log('   2. Both tunnels (3000 and 3001) are active');
    process.exit(1);
  }
}

function updateEnvFile(filePath, updates) {
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  ${filePath} does not exist, skipping...`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  Object.entries(updates).forEach(([key, value]) => {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (content.match(regex)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content += `\n${key}=${value}`;
    }
  });
  
  fs.writeFileSync(filePath, content);
  console.log(`📝 Updated ${filePath}`);
}

updateNgrokUrls();