// 基础网络测试 - 修复版本
function main() {
  console.log("=== 基础网络测试开始 ===");
  
  // 依次测试不同的URL
  setTimeout(() => {
    testURL("http://www.baidu.com", "百度HTTP");
  }, 1000);
  
  setTimeout(() => {
    testURL("https://www.baidu.com", "百度HTTPS");
  }, 3000);
  
  setTimeout(() => {
    testURL("http://web.juhe.cn", "聚合数据域名");
  }, 5000);
  
  setTimeout(() => {
    testURL("http://web.juhe.cn/finance/gold/shgold?key=f24e2fa4068b20c4d44fbff66b7745de", "黄金API");
  }, 7000);
}

function testURL(url, name) {
  console.log(`测试 ${name}: ${url}`);
  
  const xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);
  xhr.timeout = 10000;
  
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4) {
      console.log(`${name} - 状态码: ${xhr.status}`);
      if (xhr.status === 200) {
        console.log(`✅ ${name}测试成功`);
        if (typeof $notification !== 'undefined') {
          $notification.post(`✅ ${name}测试成功`, `状态码: ${xhr.status}`, "网络连接正常");
        }
      } else {
        console.log(`❌ ${name}测试失败 - 状态码: ${xhr.status}`);
        if (typeof $notification !== 'undefined') {
          $notification.post(`❌ ${name}测试失败`, `状态码: ${xhr.status}`, "请检查网络权限");
        }
      }
    }
  };
  
  xhr.ontimeout = function() {
    console.log(`⏰ ${name} - 请求超时`);
    if (typeof $notification !== 'undefined') {
      $notification.post(`⏰ ${name}超时`, "10秒无响应", "请检查网络");
    }
  };
  
  xhr.onerror = function() {
    console.log(`❌ ${name} - 网络错误`);
    if (typeof $notification !== 'undefined') {
      $notification.post(`❌ ${name}网络错误`, "无法建立连接", "检查Loon权限");
    }
  };
  
  try {
    xhr.send();
    console.log(`📤 ${name} - 请求已发送`);
  } catch (error) {
    console.log(`🚨 ${name} - 异常: ${error.message}`);
    if (typeof $notification !== 'undefined') {
      $notification.post(`🚨 ${name}异常`, error.message, "脚本执行错误");
    }
  }
}

// 启动测试
main();

// 脚本不会立即结束，等待所有测试完成
setTimeout(() => {
  console.log("=== 基础网络测试结束 ===");
  if (typeof $done !== 'undefined') {
    $done();
  }
}, 10000);
