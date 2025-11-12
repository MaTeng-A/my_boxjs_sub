// 海信轻量级被动记录
const $ = new Env('海信被动记录');

if (typeof $response !== 'undefined') {
  const url = $request.url;
  const method = $request.method;
  const path = url.split('/').pop();
  
  // 只记录，不进行任何拦截或修改
  console.log(`👀 观察到: ${method} ${path}`);
  
  // 静默保存认证信息（不通知）
  const headers = $request.headers;
  if (headers['Cookie'] || headers['cookie']) {
    const cookie = headers['Cookie'] || headers['cookie'];
    $persistentStore.write(cookie, 'hisense_cookie');
  }
  
  if (headers['Authorization']) {
    $persistentStore.write(headers['Authorization'], 'hisense_auth');
  }
  
  // 静默保存用户ID
  if (url.includes('userId=')) {
    const userIdMatch = url.match(/userId=(\d+)/);
    if (userIdMatch) {
      $persistentStore.write(userIdMatch[1], 'hisense_user_id');
    }
  }
}

// 立即完成，不阻塞
$done();

function Env(name) {
  return new class {
    constructor(name) {
      this.name = name;
    }
  }(name);
}