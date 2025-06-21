// 单词识别功能验证脚本
// 这个脚本可以在浏览器控制台中运行，用于测试单词识别的准确性

class WordRecognitionTester {
  constructor() {
    this.testCases = {
      // 应该被识别的单词
      validWords: [
        'hello',
        'world',
        'beautiful',
        'wonderful',
        'amazing',
        'well-known',
        'state-of-the-art',
        'twenty-one',
        'self-confident',
        'user-friendly',
        "don't",
        "can't",
        "it's",
        "we're",
        "they're",
        "John's",
        "children's",
        'café',
        'résumé',
        'naïve',
        'façade',
        'internationalization',
        'incomprehensible',
        'technology',
        'development',
        'keyboard',
        'smartphone',
        'breakthrough',
        'correctly',
        'handle',
        'plugin',
        'technical',
        'scientific',
        'everyday',
        'specialized',
        'algorithm',
        'efficiently',
        'performance',
        'interface',
        'comprehensive',
        'optimization',
        'expected'
      ],
      
      // 应该被过滤的内容
      invalidWords: [
        'aaa',
        'bbb',
        'ccc',
        'xxx',
        'yyy',
        'zzz',
        'la',
        'le',
        'li',
        'lo',
        'lu',
        'da',
        'de',
        'di',
        'do',
        'du',
        'www',
        'http',
        'https',
        'jpg',
        'png',
        'gif',
        'pdf',
        'div',
        'span',
        'img',
        'src',
        'href',
        'HTML5',
        'CSS3',
        'API2.0',
        'version1.2.3',
        '123',
        '2024',
        '1st',
        '2nd',
        '3rd'
      ]
    };
  }

  // 测试单词验证函数
  testWordValidation() {
    console.log('🧪 开始测试单词识别准确性...\n');
    
    // 检查是否存在 WordImageSearch 实例
    if (!window.wordImageSearchInstance) {
      console.error('❌ 未找到 WordImageSearch 实例，请确保插件已加载');
      return;
    }
    
    const instance = window.wordImageSearchInstance;
    let validCorrect = 0;
    let validTotal = this.testCases.validWords.length;
    let invalidCorrect = 0;
    let invalidTotal = this.testCases.invalidWords.length;
    
    console.log('📝 测试有效单词识别：');
    this.testCases.validWords.forEach(word => {
      const isValid = instance.isValidWord(word);
      if (isValid) {
        validCorrect++;
        console.log(`✅ "${word}" - 正确识别`);
      } else {
        console.log(`❌ "${word}" - 识别失败`);
      }
    });
    
    console.log('\n📝 测试无效内容过滤：');
    this.testCases.invalidWords.forEach(word => {
      const isValid = instance.isValidWord(word);
      if (!isValid) {
        invalidCorrect++;
        console.log(`✅ "${word}" - 正确过滤`);
      } else {
        console.log(`❌ "${word}" - 过滤失败`);
      }
    });
    
    console.log('\n📊 测试结果统计：');
    console.log(`有效单词识别率: ${validCorrect}/${validTotal} (${(validCorrect/validTotal*100).toFixed(1)}%)`);
    console.log(`无效内容过滤率: ${invalidCorrect}/${invalidTotal} (${(invalidCorrect/invalidTotal*100).toFixed(1)}%)`);
    console.log(`总体准确率: ${(validCorrect + invalidCorrect)}/${(validTotal + invalidTotal)} (${((validCorrect + invalidCorrect)/(validTotal + invalidTotal)*100).toFixed(1)}%)`);
    
    return {
      validCorrect,
      validTotal,
      invalidCorrect,
      invalidTotal,
      accuracy: (validCorrect + invalidCorrect) / (validTotal + invalidTotal)
    };
  }

  // 测试快捷键状态
  testModifierKeyTracking() {
    console.log('\n⌨️ 测试快捷键状态跟踪：');
    
    if (!window.wordImageSearchInstance) {
      console.error('❌ 未找到 WordImageSearch 实例');
      return;
    }
    
    const instance = window.wordImageSearchInstance;
    console.log(`当前快捷键设置: ${instance.settings.modifierKey}`);
    console.log(`快捷键是否按下: ${instance.isModifierPressed}`);
    console.log(`插件是否激活: ${instance.isActive}`);
    
    console.log('\n💡 请按住快捷键并观察状态变化');
  }

  // 模拟鼠标事件测试
  simulateMouseEvent(element, eventType, clientX, clientY) {
    const event = new MouseEvent(eventType, {
      bubbles: true,
      cancelable: true,
      clientX: clientX || 100,
      clientY: clientY || 100,
      metaKey: true // 模拟按住 Command/Win 键
    });
    
    element.dispatchEvent(event);
    return event;
  }

  // 运行完整测试套件
  runFullTest() {
    console.clear();
    console.log('🚀 单词识别功能完整测试开始\n');
    console.log('=' * 50);
    
    // 测试单词验证
    const validationResults = this.testWordValidation();
    
    // 测试快捷键跟踪
    this.testModifierKeyTracking();
    
    console.log('\n' + '=' * 50);
    console.log('✨ 测试完成！');
    
    if (validationResults && validationResults.accuracy > 0.9) {
      console.log('🎉 单词识别准确率优秀！');
    } else if (validationResults && validationResults.accuracy > 0.8) {
      console.log('👍 单词识别准确率良好');
    } else {
      console.log('⚠️ 单词识别准确率需要改进');
    }
    
    return validationResults;
  }
}

// 创建测试实例
const tester = new WordRecognitionTester();

// 导出到全局作用域，方便在控制台中使用
window.wordRecognitionTester = tester;

console.log('🧪 单词识别测试工具已加载');
console.log('使用方法：');
console.log('- wordRecognitionTester.runFullTest() - 运行完整测试');
console.log('- wordRecognitionTester.testWordValidation() - 仅测试单词验证');
console.log('- wordRecognitionTester.testModifierKeyTracking() - 仅测试快捷键跟踪');
