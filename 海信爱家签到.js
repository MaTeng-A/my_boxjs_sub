// 海信爱家Cookie获取脚本（优化版）
const $ = new Env('海信Cookie获取');

// 检查是否在重写响应模式
if (typeof $response !== 'undefined') {
  $.log('=== 开始处理海信请求 ===');
  $.log('请求URL:', $request.url);
  $.log('请求方法:', $request.method);
  
  // 检查是否是关键接口
  const criticalUrls = [
    '/ecrp/member/initMember',
    '/ecrp/oauth/init',
    '/ecrp/forward/init'
  ];
  
  let isCritical = false;
  for (const url of criticalUrls) {
    if ($request.url.includes(url)) {
      isCritical = true;
      $.log('发现关键接口:', url);
      break;
    }
  }
  
  if (isCritical) {
    // 获取请求头中的Cookie
    const headers = $request.headers;
    const cookie = headers['Cookie'] || headers['cookie'];
    
    if (cookie) {
      $.log('获取到Cookie，长度:', cookie.length);
      
      // 尝试从响应体获取TOKEN_ACTIVITY
      let finalCookie = cookie;
      if ($response.body) {
        const tokenMatch = $response.body.match(/TOKEN_ACTIVITY=([^;]+)/);
        if (tokenMatch) {
          finalCookie += '; ' + tokenMatch[0];
          $.log('合并TOKEN_ACTIVITY成功');
        }
        
        // 尝试其他可能的token格式
        const otherTokenMatch = $response.body.match(/"token":"([^"]+)"/);
        if (otherTokenMatch) {
          finalCookie += '; token=' + otherTokenMatch[1];
          $.log('合并token成功');
        }
      }
      
      // 保存Cookie
      const saveResult = $persistentStore.write(finalCookie, 'hisense_ck');
      if (saveResult) {
        $.log('Cookie保存成功');
        $.msg('海信爱家', '✅ Cookie获取成功', '可以执行签到了');
      } else {
        $.log('Cookie保存失败');
        $.msg('海信爱家', '❌ 保存失败', '请检查权限');
      }
    } else {
      $.log('未找到Cookie');
      $.msg('海信爱家', '⚠️ 未找到Cookie', '请检查MITM配置');
    }
  } else {
    $.log('非关键接口，跳过处理');
  }
  
  $done();
} else {
  // 普通执行模式 - 检查存储状态
  $.log('运行环境:', $.getEnv());
  
  const savedCookie = $persistentStore.read('hisense_ck');
  if (savedCookie) {
    $.log('已存储Cookie，长度:', savedCookie.length);
    $.msg('海信爱家', 'Cookie状态', 'Cookie已就绪，可以签到');
  } else {
    $.log('未找到存储的Cookie');
    $.msg('海信爱家', 'Cookie状态', '请先获取Cookie');
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