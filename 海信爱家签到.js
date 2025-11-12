// 海信Cookie获取调试脚本
const $ = new Env('海信Cookie调试');

// 检查是否在重写响应模式
if (typeof $response !== 'undefined') {
  $.log('=== 进入重写响应模式 ===');
  $.log('请求URL:', $request.url);
  $.log('请求方法:', $request.method);
  
  // 检查请求头
  const headers = $request.headers;
  $.log('请求头Keys:', Object.keys(headers));
  
  // 获取Cookie
  const cookie = headers['Cookie'] || headers['cookie'];
  $.log('获取到的Cookie:', cookie ? '有' : '无');
  
  if (cookie) {
    $.log('Cookie长度:', cookie.length);
    $.log('Cookie内容(前100字符):', cookie.substring(0, 100));
    
    // 尝试从响应体获取TOKEN_ACTIVITY
    let finalCookie = cookie;
    if ($response.body) {
      const tokenMatch = $response.body.match(/TOKEN_ACTIVITY=([^;]+)/);
      $.log('TOKEN_ACTIVITY匹配:', tokenMatch ? '成功' : '失败');
      
      if (tokenMatch) {
        finalCookie += '; ' + tokenMatch[0];
        $.log('完整Cookie:', finalCookie);
      }
    }
    
    // 保存Cookie
    const saveResult = $persistentStore.write(finalCookie, 'hisense_ck');
    $.log('保存结果:', saveResult ? '成功' : '失败');
    
    if (saveResult) {
      $.msg('海信Cookie', '✅ 获取成功', '请返回查看存储状态');
    } else {
      $.msg('海信Cookie', '❌ 保存失败', '请检查权限');
    }
  } else {
    $.msg('海信Cookie', '❌ 未找到Cookie', '请检查MITM配置');
  }
  
  $done();
} else {
  // 普通执行模式 - 检查存储状态
  $.log('=== 普通执行模式 ===');
  $.log('运行环境:', $.getEnv());
  
  const savedCookie = $persistentStore.read('hisense_ck');
  $.log('存储的Cookie:', savedCookie ? `有 (${savedCookie.length}字符)` : '无');
  
  if (savedCookie) {
    $.log('Cookie内容(前50字符):', savedCookie.substring(0, 50));
    $.msg('海信调试', 'Cookie状态', 'Cookie已存储，可以执行签到');
  } else {
    $.msg('海信调试', 'Cookie状态', '未找到Cookie，请先获取');
  }
  
  $done();
}

function Env(name) {
  return new class {
    constructor(name) {
      this.name = name;
      this.logs = [];
      console.log(`🔔 ${name} 开始执行`);
    }

    getEnv() {
      if (typeof $loon !== 'undefined') return 'Loon';
      if (typeof $task !== 'undefined') return 'Quantumult X';
      return 'Unknown';
    }

    log(...msg) {
      this.logs.push(...msg);
      console.log(msg.join(' '));
    }

    msg(title, subtitle, body) {
      console.log(title, subtitle, body);
      if (typeof $notification !== 'undefined') {
        $notification.post(title, subtitle, body);
      }
    }
  }(name);
}