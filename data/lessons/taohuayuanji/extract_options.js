const fs = require('fs');
const path = require('path');

// 从voice_script_full.md提取选项台词
function extractOptions() {
  const scriptPath = path.join(__dirname, 'voice_script_full.md');
  const content = fs.readFileSync(scriptPath, 'utf8');
  
  const options = [];
  
  // 直接查找包含option的行
  const optionLines = content.match(/.*option\.[A-C].*/g);
  if (optionLines) {
    optionLines.forEach(line => {
      // 提取ID和文本
      const match = line.match(/-(.*?)\s*\|\s*(.*?)$/);
      if (match) {
        const id = match[1].trim();
        const text = match[2].trim();
        options.push({ id, text });
      }
    });
  }
  
  return options;
}

// 生成选项台词的配音配置
function generateOptionVoiceConfig(options) {
  const config = {
    options: options.map(option => ({
      id: option.id.replace(/\./g, '_'),
      text: option.text,
      voiceType: 'player',
      speed: 1.0,
      style: '更实，更有礼貌感，更有对人说话的方向性，正常中速，句子短，别拖'
    }))
  };
  
  return config;
}

// 主函数
function main() {
  const options = extractOptions();
  const config = generateOptionVoiceConfig(options);
  
  console.log('提取的选项台词:');
  options.forEach(option => {
    console.log(`${option.id}: ${option.text}`);
  });
  
  // 保存配置到文件
  const outputPath = path.join(__dirname, 'option_voice_config.json');
  fs.writeFileSync(outputPath, JSON.stringify(config, null, 2));
  
  console.log(`\n选项配置已保存到: ${outputPath}`);
  console.log(`共提取到 ${options.length} 个选项台词`);
}

// 运行主函数
main();
